/**
 * src/features/athan/download-service.ts
 *
 * DownloadService -- خدمة تحميل المؤذنين القابلين للتحميل.
 *
 * المسؤولية:
 *   getAvailableVoices()  -- جلب قائمة المؤذنين من catalog.json مع حالتهم
 *   isDownloaded(id)      -- هل الملف موجود محليا؟
 *   getProgress(id)       -- نسبة التقدم الحالية (0-1)
 *   download(id)          -- تحميل ملف مؤذن كامل
 *   cancel(id)            -- إلغاء تحميل جار
 *   delete(id)            -- حذف الملف والسجل المحلي
 *
 * مصدر الكتالوج:
 *   catalog.json على Cloudflare — يُجلَب عبر cloudflareClient.fetchCatalog()
 *   ويُخزَّن في الذاكرة طوال جلسة التطبيق (_catalogCache).
 *   لا يوجد كتالوج ثابت في الكود — إضافة مؤذن جديد تتم فقط عبر
 *   رفع mp3 وتعديل catalog.json على الخادم، بدون تحديث التطبيق.
 *
 * الاعتماديات:
 *   cloudflareClient  -- جلب الكتالوج ورابط التحميل
 *   FileSystem        -- تنزيل الملف وحذفه
 *   storageService    -- حفظ السجل وقراءته
 *   downloadManager   -- تتبع الحالة وإصدار الأحداث
 *
 * ما لا يفعله:
 * - لا يعدل AudioService او PlaylistManager او AudioController
 * - لا يعرف UI
 */

import * as FileSystem from 'expo-file-system/legacy';

import { cloudflareClient }         from './cloudflare';
import type { RemoteVoice }         from './cloudflare/cloudflare-types';
import type { DownloadableMuezzin } from './downloadable-muezzin-types';
import type { DownloadResult }      from './downloadable-muezzin-types';
import { storageService }           from './storage';
import type { StoredVoiceRecord }   from './storage';
import { downloadManager }          from './download-manager';
import type { Muezzin }             from './athan-types';

// --- مجلد التخزين المحلي ---

const ATHAN_DIR = `${FileSystem.cacheDirectory ?? ''}athan/`;

// --- DownloadService ---

class DownloadService {

  /** خريطة عمليات التحميل النشطة (id -> DownloadResumable) */
  private readonly _resumables = new Map<string, FileSystem.DownloadResumable>();

  /**
   * ذاكرة مؤقتة للكتالوج البعيد — تُملأ عند أول استدعاء لـ _ensureCatalog().
   * تبقى صالحة طوال جلسة التطبيق (لا تحتاج تحديثاً إلا عند إعادة التشغيل).
   */
  private _catalogCache: RemoteVoice[] | null = null;

  // -- _ensureCatalog --

  /**
   * يجلب الكتالوج من Cloudflare مرة واحدة ويخزنه في الذاكرة.
   * الاستدعاءات اللاحقة تعيد النسخة المخزنة مباشرة.
   * عند فشل الجلب يُعيد مصفوفة فارغة.
   */
  private async _ensureCatalog(): Promise<RemoteVoice[]> {
    if (this._catalogCache !== null) return this._catalogCache;

    const result = await cloudflareClient.fetchCatalog();
    if (!result.success) {
      // لا نخزّن الفشل — سيُعاد المحاولة في الاستدعاء التالي
      return [];
    }

    this._catalogCache = result.data
      .filter((item) => item.available)
      .map((item) => item.voice);

    return this._catalogCache;
  }

  // -- getAvailableVoices --

  /**
   * يعيد قائمة المؤذنين القابلين للتحميل مع حالتهم.
   * المصدر: catalog.json على Cloudflare (عبر cloudflareClient.fetchCatalog).
   */
  async getAvailableVoices(): Promise<DownloadableMuezzin[]> {
    const catalog = await this._ensureCatalog();
    if (catalog.length === 0) return [];

    const allResult = await storageService.getAll();
    const savedMap  = new Map(
      (allResult.success ? allResult.data : []).map((r) => [r.id, r]),
    );

    return catalog.map((voice) => {
      const saved = savedMap.get(voice.id);
      const entry = downloadManager.getEntry(voice.id);
      return {
        id:               voice.id,
        name:             voice.name,
        country:          voice.country,
        size:             voice.size,
        version:          voice.version,
        filename:         voice.filename,
        downloadUrl:      '',            // يُبنى داخلياً بواسطة cloudflareClient
        checksum:         '',            // يُجلب عند الحاجة عبر fetchMetadata
        localPath:        saved?.localPath        ?? '',
        installedVersion: saved?.installedVersion ?? '',
        isDownloaded:     !!saved?.localPath,
        isDownloading:    entry?.status === 'DOWNLOADING' || entry?.status === 'PENDING',
        progress:         entry?.progress ?? 0,
      };
    });
  }

  // -- getInstalledVoices --

  /**
   * يعيد قائمة المؤذنين المحمّلين فعلياً بشكل Muezzin جاهز للتشغيل.
   *
   * - يقرأ السجلات المخزنة من storageService.getAll()
   * - يستخدم name/country المحفوظَين في السجل (لا يحتاج الشبكة)
   * - يستخدم localPath كـ uri مباشرة
   * - يتجاهل السجلات التي تفتقر إلى localPath
   *
   * هذا هو المدخل الوحيد لـ use-athan-player — يعمل بدون اتصال بالشبكة.
   */
  async getInstalledVoices(): Promise<Muezzin[]> {
    const allResult = await storageService.getAll();
    if (!allResult.success) return [];

    return allResult.data
      .filter((record) => !!record.localPath)
      .map((record): Muezzin => ({
        id:      record.id,
        name:    record.name    ?? record.id,   // سجلات قديمة لا تملك name → fallback للـ id
        country: record.country ?? '',
        uri:     record.localPath,
      }));
  }

  // -- isDownloaded --

  /** هل الملف محمل ومخزن محليا؟ */
  async isDownloaded(id: string): Promise<boolean> {
    return storageService.exists(id);
  }

  // -- getProgress --

  /** نسبة التقدم الحالية (0-1) */
  getProgress(id: string): number {
    return downloadManager.getEntry(id)?.progress ?? 0;
  }

  // -- download --

  /**
   * يحمل ملف المؤذن من Cloudflare ويحفظه محليا.
   *
   * التدفق:
   * 1. جلب الكتالوج للتحقق من وجود المؤذن والحصول على بياناته
   * 2. التحقق ان الملف غير محمل مسبقا
   * 3. downloadManager: register -> start (DOWNLOADING)
   * 4. cloudflareClient.fetchDownloadUrl()
   * 5. FileSystem.createDownloadResumable() مع callback للتقدم
   * 6. downloadAsync()
   * 7. storageService.save() مع name/country لضمان العمل offline
   * 8. downloadManager.complete()
   */
  async download(id: string): Promise<DownloadResult> {
    // 1. التحقق من الكتالوج البعيد
    const catalog = await this._ensureCatalog();
    const def     = catalog.find((v) => v.id === id);
    if (!def) {
      return { success: false, message: `المؤذن "${id}" غير موجود في الكتالوج` };
    }

    // 2. تجنب إعادة التنزيل
    const alreadyDownloaded = await storageService.exists(id);
    if (alreadyDownloaded) {
      return { success: true, message: `المؤذن "${id}" محمل مسبقا` };
    }

    // منع تشغيل عمليتين لنفس المؤذن
    if (downloadManager.isActive(id)) {
      return { success: false, message: `يوجد تحميل جار للمؤذن "${id}"` };
    }

    // 3. تسجيل وبدء التتبع
    downloadManager.register(id);
    downloadManager.start(id);

    // 4. جلب رابط التحميل
    const urlResult = await cloudflareClient.fetchDownloadUrl(id);
    if (!urlResult.success) {
      downloadManager.fail(id, urlResult.message);
      return { success: false, message: urlResult.message };
    }

    const downloadUrl = urlResult.data;

    // بناء مسار الملف المحلي
    const localPath = `${ATHAN_DIR}${def.filename}`;

    // التأكد من وجود المجلد
    try {
      const dirInfo = await FileSystem.getInfoAsync(ATHAN_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(ATHAN_DIR, { intermediates: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      downloadManager.fail(id, msg);
      return { success: false, message: `فشل إنشاء المجلد: ${msg}` };
    }

    // 5. إنشاء DownloadResumable مع callback للتقدم
    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      localPath,
      {},
      (data) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = data;
        if (totalBytesExpectedToWrite > 0) {
          const progress = totalBytesWritten / totalBytesExpectedToWrite;
          downloadManager.updateProgress(id, progress);
        }
      },
    );

    this._resumables.set(id, resumable);

    // 6. تنفيذ التحميل
    let downloadResult: FileSystem.FileSystemDownloadResult | undefined;
    try {
      downloadResult = await resumable.downloadAsync();
    } catch (err) {
      await this._safeDeleteFile(localPath);
      const msg = err instanceof Error ? err.message : String(err);
      downloadManager.fail(id, msg);
      return { success: false, message: `فشل التحميل: ${msg}` };
    } finally {
      this._resumables.delete(id);
    }

    if (!downloadResult) {
      await this._safeDeleteFile(localPath);
      downloadManager.fail(id, 'تم إلغاء التحميل');
      return { success: false, message: 'تم إلغاء التحميل' };
    }

    if (!downloadResult.status || downloadResult.status < 200 || downloadResult.status >= 300) {
      await this._safeDeleteFile(localPath);
      const msg = `HTTP ${downloadResult.status ?? 'unknown'}`;
      downloadManager.fail(id, msg);
      return { success: false, message: `فشل التحميل: ${msg}` };
    }

    // 7. حفظ السجل مع name/country لضمان عمل getInstalledVoices() بدون شبكة
    const record: StoredVoiceRecord = {
      id,
      name:             def.name,
      country:          def.country,
      localPath,
      installedVersion: def.version,
      downloadedAt:     new Date().toISOString(),
      size:             def.size,
      checksum:         '',   // يُضاف لاحقاً عبر fetchMetadata إذا احتجنا التحقق
    };

    const saveResult = await storageService.save(record);
    if (!saveResult.success) {
      await this._safeDeleteFile(localPath);
      downloadManager.fail(id, saveResult.message);
      return { success: false, message: `فشل حفظ السجل: ${saveResult.message}` };
    }

    // 8. اكتمل التحميل
    downloadManager.complete(id);
    return { success: true, message: `تم تحميل المؤذن "${def.name}" بنجاح` };
  }

  // -- cancel --

  /**
   * يلغي تحميلا جاريا.
   * يوقف DownloadResumable ويحدث DownloadManager.
   */
  async cancel(id: string): Promise<DownloadResult> {
    const resumable = this._resumables.get(id);
    if (resumable) {
      try {
        await resumable.cancelAsync();
      } catch {
        // تجاهل خطأ الإلغاء -- قد يكون اكتمل بالفعل
      }
      this._resumables.delete(id);
    }

    if (downloadManager.isActive(id)) {
      downloadManager.cancel(id);
    }

    return { success: true, message: 'تم إلغاء التحميل' };
  }

  // -- delete --

  /**
   * يحذف الملف من FileSystem والسجل من StorageService.
   * يعيد DownloadManager الى IDLE.
   */
  async delete(id: string): Promise<DownloadResult> {
    const getResult = await storageService.get(id);
    if (getResult.success && getResult.data?.localPath) {
      const localPath = getResult.data.localPath;
      try {
        const info = await FileSystem.getInfoAsync(localPath);
        if (info.exists) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
        }
      } catch {
        // الملف غير موجود او حذف مسبقا -- لا بأس
      }
    }

    const removeResult = await storageService.remove(id);
    if (!removeResult.success) {
      return { success: false, message: `فشل حذف السجل: ${removeResult.message}` };
    }

    const entry = downloadManager.getEntry(id);
    if (entry && entry.status !== 'IDLE' && entry.status !== 'DOWNLOADING') {
      downloadManager.reset(id);
    }

    return { success: true, message: `تم حذف المؤذن "${id}"` };
  }

  // -- _safeDeleteFile --

  private async _safeDeleteFile(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch {
      // تجاهل -- الملف غير موجود او لم يُنشأ بعد
    }
  }
}

// --- Singleton ---

export const downloadService = new DownloadService();
