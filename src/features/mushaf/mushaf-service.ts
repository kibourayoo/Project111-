/**
 * mushaf-service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * واجهة خفيفة فوق نظام التحميل الموجود في lib/audio/
 *
 * المبدأ:
 *   لا ينشئ أي Download Manager أو Storage أو Registry جديد.
 *   يُفوّض بالكامل إلى:
 *     downloadManager  ← التحميل والـ Queue
 *     audioRepository  ← التحقق من التثبيت / الحذف
 *     registryService  ← قراءة حالة الحزمة من installed.json
 *
 * المسار النهائي بعد التثبيت:
 *   {documentDirectory}/audio/packages/mushaf/{id}/
 *     manifest.json       ← AudioPackage الأصلي من ZIP
 *     package-info.json   ← InstalledPackageInfo (دليل اكتمال التثبيت)
 *     assets/             ← thumbnail وأي ملفات مساعدة
 *     audio/              ← صفحات .webp أو .json أو ملفات المصحف
 *
 * التحديث بدون إعادة تنزيل:
 *   يقارن version في Registry مع version في الكتالوج.
 *   إذا تساوتا: يُعيد المسار المحلي مباشرة بدون تحميل.
 *   إذا اختلفتا: يُزيل النسخة القديمة ثم يُضيف Job جديد إلى Queue.
 *
 * العمل Offline:
 *   isInstalled() يقرأ من Registry المحلي فقط — لا شبكة.
 *   getLocalPath() يُعيد المسار من FileSystem مباشرة — لا شبكة.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Paths, Directory } from 'expo-file-system';
import { downloadManager }  from '@/lib/audio/download/download-manager';
import { audioRepository }  from '@/lib/audio/audio-repository';
import { registryService }  from '@/lib/audio/audio-registry';
import {
  AUDIO_ROOT,
  PACKAGES_DIRECTORY,
  AUDIO_DIRECTORY,
} from '@/lib/audio/storage-layout';

// ─── الثابت: نوع المصحف ──────────────────────────────────────────────────────

const MUSHAF_TYPE = 'mushaf' as const;

// ─── MushafInstallState ───────────────────────────────────────────────────────

/**
 * حالة المصحف على الجهاز — تُستخدم في واجهة شاشة التحميل
 */
export type MushafInstallState =
  | 'not_installed'   // لم يُحمَّل بعد
  | 'downloading'     // في Queue أو جارٍ التحميل الآن
  | 'installed';      // مثبّت وجاهز للاستخدام Offline

// ─── MushafServiceResult ──────────────────────────────────────────────────────

export interface MushafServiceResult {
  success: boolean;
  message: string;
  /** موجود فقط عند success=true ونتيجة تحتوي بيانات */
  data?: unknown;
}

// ─── MushafService ────────────────────────────────────────────────────────────

class MushafService {

  // ── isInstalled ─────────────────────────────────────────────────────────────

  /**
   * هل المصحف مثبّت على الجهاز؟
   * يقرأ من Registry المحلي (installed.json) — لا شبكة.
   *
   * @param packageId - معرّف حزمة المصحف (مثال: 'mushaf-hafs-standard')
   */
  async isInstalled(packageId: string): Promise<boolean> {
    return registryService.isInstalled(packageId, MUSHAF_TYPE);
  }

  // ── getInstallState ──────────────────────────────────────────────────────────

  /**
   * يُعيد الحالة الحالية للمصحف للعرض في الواجهة.
   *
   * التحقق بالترتيب:
   *   1. هل يوجد Job نشط في downloadManager؟ → 'downloading'
   *   2. هل الحزمة في Registry؟              → 'installed'
   *   3. غير ذلك                             → 'not_installed'
   */
  async getInstallState(packageId: string): Promise<MushafInstallState> {
    // 1. فحص Queue النشطة أولاً
    const isInQueue = downloadManager.queue().some(
      (item) => item.packageId === packageId,
    );
    if (isInQueue) return 'downloading';

    // 2. فحص Registry
    const installed = await registryService.isInstalled(packageId, MUSHAF_TYPE);
    if (installed) return 'installed';

    return 'not_installed';
  }

  // ── getInstalledVersion ──────────────────────────────────────────────────────

  /**
   * يُعيد نسخة المصحف المثبتة أو null إذا لم يكن مثبتاً.
   * يُستخدم لمقارنة النسخة مع الكتالوج لتحديد الحاجة للتحديث.
   */
  async getInstalledVersion(packageId: string): Promise<string | null> {
    const pkg = await registryService.getInstalledPackage(packageId, MUSHAF_TYPE);
    return pkg?.version ?? null;
  }

  // ── download ─────────────────────────────────────────────────────────────────

  /**
   * يُضيف حزمة المصحف إلى Queue التحميل.
   *
   * الحراسات:
   *   - يرفض إذا كانت الحزمة مثبتة بنفس النسخة (لا داعي للتحميل)
   *   - يرفض إذا كانت في Queue بالفعل
   *   - إذا كانت نسخة أحدث متاحة: يحذف القديمة ثم يُضيف Job جديد
   *
   * @param packageId   - معرّف الحزمة
   * @param downloadUrl - رابط ZIP على Cloudflare R2
   * @param remoteVersion - النسخة المتاحة على الخادم (للمقارنة)
   */
  async download(
    packageId:     string,
    downloadUrl:   string,
    remoteVersion: string,
  ): Promise<MushafServiceResult> {
    // ── 1. هل مثبتة بنفس النسخة؟ ───────────────────────────────────────────
    const installedVersion = await this.getInstalledVersion(packageId);

    if (installedVersion !== null) {
      if (installedVersion === remoteVersion) {
        // نفس النسخة — لا داعي للتحميل
        return {
          success: true,
          message: `المصحف "${packageId}" مثبّت بأحدث نسخة (${remoteVersion}) — لا حاجة للتحديث`,
        };
      }
      // نسخة أحدث متاحة — احذف القديمة أولاً
      await audioRepository.removePackage(packageId, MUSHAF_TYPE);
    }

    // ── 2. أضف إلى Queue التحميل ────────────────────────────────────────────
    const result = downloadManager.enqueue(
      packageId,
      MUSHAF_TYPE,
      downloadUrl,
      { priority: 'normal', maxRetries: 3 },
    );

    if (!result.success) {
      return {
        success: false,
        message: result.error?.message ?? `فشل إضافة المصحف إلى Queue: ${packageId}`,
      };
    }

    return {
      success: true,
      message: `بدأ تحميل المصحف "${packageId}" — Job: ${result.jobId}`,
      data:    { jobId: result.jobId },
    };
  }

  // ── cancelDownload ───────────────────────────────────────────────────────────

  /**
   * يُلغي تحميل جارٍ بمعرّف الـ Job.
   * يُستخدم jobId الذي أعادته download().
   */
  cancelDownload(jobId: string): void {
    downloadManager.cancel(jobId);
  }

  // ── uninstall ────────────────────────────────────────────────────────────────

  /**
   * يحذف المصحف من FileSystem و Registry معاً.
   * يُفوّض إلى audioRepository.removePackage() بالكامل.
   */
  async uninstall(packageId: string): Promise<MushafServiceResult> {
    const result = await audioRepository.removePackage(packageId, MUSHAF_TYPE);
    return {
      success: result.success,
      message: result.message,
    };
  }

  // ── getLocalPagesDir ─────────────────────────────────────────────────────────

  /**
   * يُعيد المسار المطلق لمجلد ملفات المصحف (audio/) على الجهاز.
   *
   * المسار النهائي:
   *   {documentDirectory}/audio/packages/mushaf/{id}/audio/
   *
   * يُستخدم من شاشة المصحف لتحميل صفحات .webp أو .json مباشرة.
   * لا شبكة — يعمل Offline بالكامل بعد التثبيت.
   *
   * @returns المسار كـ string (URI صالح لـ expo-file-system)
   *          أو null إذا لم يكن المصحف مثبتاً
   */
  async getLocalPagesDir(packageId: string): Promise<string | null> {
    const installed = await registryService.isInstalled(packageId, MUSHAF_TYPE);
    if (!installed) return null;

    const dir = new Directory(
      Paths.document,
      AUDIO_ROOT,
      PACKAGES_DIRECTORY,
      MUSHAF_TYPE,
      packageId,
      AUDIO_DIRECTORY,
    );

    return dir.exists ? dir.uri : null;
  }

  // ── getDownloadProgress ──────────────────────────────────────────────────────

  /**
   * يُعيد نسبة تقدم التحميل (0–100) للـ Job النشط على packageId.
   * يُستخدم لتحديث شريط التقدم في الواجهة.
   * يُعيد 0 إذا لم يكن هناك تحميل جارٍ.
   */
  getDownloadProgress(packageId: string): number {
    const job = downloadManager.queue().find(
      (item) => item.packageId === packageId,
    );
    return job?.progress?.percent ?? 0;
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const mushafService = new MushafService();
