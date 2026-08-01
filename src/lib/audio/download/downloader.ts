/**
 * downloader.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloader الحقيقي — المرحلة 21.
 *
 * يُنفّذ IDownloader بالكامل باستخدام:
 *   - Fetch API (عبر global fetch المدعومة على iOS/Android في Expo SDK 55)
 *     مع ReadableStream لقراءة Chunks بدون تحميل الملف كاملاً في الذاكرة.
 *   - expo-file-system v2 (API الحديثة فقط — File + FileHandle + Paths)
 *     للكتابة chunk-by-chunk إلى القرص.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Pause / Resume — قيد موثّق
 * ──────────────────────────────────────────────────────────────────────────
 * expo-file-system v2 (SDK 55) لا تُقدّم أي دعم رسمي لـ Pause/Resume:
 *
 *   1. File.downloadFileAsync() — طلب ذري كامل، لا يمكن إيقافه.
 *   2. FileHandle — واجهة للكتابة المحلية فقط، لا علاقة لها بالشبكة.
 *   3. createDownloadResumable — deprecated بالكامل:
 *      "This method will throw in runtime." (legacyWarnings.d.ts)
 *
 * بديل Streaming (المُستخدم هنا):
 *   الحلقة `for(;;) { reader.read() }` يمكنها التوقف بين الـ Chunks،
 *   لكن اتصال HTTP يبقى مفتوحاً من جانب الخادم — لا يمكن "تجميد" التنزيل.
 *   استئناف حقيقي يستلزم HTTP Range Requests مع ضمان دعم الخادم لها،
 *   وهو ما لا يمكن افتراضه.
 *
 * القرار:
 *   Pause/Resume خلال خطوة DOWNLOADING غير مدعومة.
 *   الـ Worker يتعامل مع Pause بين الخطوات (بعد انتهاء download كاملاً).
 *   إذا طلب المستخدم Pause أثناء التنزيل النشط، يستمر التنزيل حتى
 *   نهاية الخطوة، ثم يدخل Worker حالة Paused قبل الخطوة التالية.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * الحدود (خارج نطاق هذا الملف):
 *   - لا فك ضغط ZIP
 *   - لا قراءة manifest
 *   - لا checksum
 *   - لا installPackage
 *   - لا Registry
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Directory, File, Paths } from 'expo-file-system';

import type { DownloadSignal, IDownloader } from './idownloader';
import { DownloadCancelledError }           from './idownloader';

// ─── ثوابت ────────────────────────────────────────────────────────────────────

/** حجم الـ Chunk: 64 KB — توازن بين استهلاك الذاكرة ودقة Progress */
const CHUNK_SIZE_BYTES = 64 * 1_024;
void CHUNK_SIZE_BYTES; // مرجع للتوثيق — القراءة تتم عبر reader.read() بدون تحديد حجم

// ─── Downloader ───────────────────────────────────────────────────────────────

/**
 * تنفيذ حقيقي لـ IDownloader.
 *
 * دورة الحياة:
 *   1. حلّ destPath إلى مسار مطلق بالنسبة لـ Paths.cache
 *   2. أنشئ Directory إذا لم تكن موجودة
 *   3. احذف أي ملف جزئي من محاولة سابقة
 *   4. أنشئ الملف الهدف + افتح FileHandle
 *   5. fetch() مع ReadableStream → اقرأ Chunks → اكتب chunk-by-chunk
 *   6. أبلّغ عن التقدم بعد كل Chunk
 *   7. تحقق من Cancel بين كل Chunk
 *   8. عند الإلغاء: احذف الملف الجزئي فوراً
 *   9. تحقق من وجود الملف وحجمه > 0
 */
export class Downloader implements IDownloader {

  async download(
    jobId:      string,
    url:        string,
    destPath:   string,
    onProgress: (downloaded: number, total: number) => void,
    signal:     DownloadSignal,
  ): Promise<void> {

    // ── 1. حلّ المسار ─────────────────────────────────────────────────────────
    const destFile = this._resolveFile(destPath);

    // ── 2. أنشئ المجلد الأب إذا لم يكن موجوداً ──────────────────────────────
    const parentDir = this._resolveDir(destPath);
    if (!parentDir.exists) {
      parentDir.create({ intermediates: true });
    }

    // ── 3. نظّف أي ملف جزئي متبقٍّ من محاولة سابقة ──────────────────────────
    if (destFile.exists) {
      destFile.delete();
    }

    // ── 4. أنشئ الملف الهدف ──────────────────────────────────────────────────
    destFile.create();
    const handle = destFile.open();

    let downloadComplete = false;

    try {
      // ── 5. أرسل طلب HTTP مع ReadableStream ───────────────────────────────
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `فشل طلب HTTP — الحالة: ${response.status} ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error(
          'لا يدعم الخادم بث البيانات (response.body غير متاح)',
        );
      }

      // حجم الملف الكلي — يُحوَّل إلى 0 إذا غاب الـ header أو كان NaN أو سالباً
      const contentLength = response.headers.get('content-length');
      const rawLength     = contentLength ? parseInt(contentLength, 10) : NaN;
      const totalBytes    = Number.isFinite(rawLength) && rawLength > 0 ? rawLength : 0;

      // ── 6. اقرأ الـ Chunks واكتبها إلى القرص ──────────────────────────────
      const reader         = response.body.getReader();
      let   bytesDownloaded = 0;

      try {
        for (;;) {
          // تحقق من الإلغاء قبل كل Chunk
          if (signal.cancelled) {
            await reader.cancel('تم الإلغاء من قِبل المستخدم');
            break;
          }

          const { done, value } = await reader.read();

          if (done) {
            downloadComplete = true;
            break;
          }

          // اكتب Chunk إلى القرص بشكل متزامن عبر FileHandle
          handle.writeBytes(value);
          bytesDownloaded += value.byteLength;

          // أبلّغ عن التقدم
          onProgress(bytesDownloaded, totalBytes);

          // تحقق ثانٍ بعد الكتابة
          if (signal.cancelled) {
            await reader.cancel('تم الإلغاء من قِبل المستخدم');
            break;
          }
        }
      } finally {
        // ألغِ Stream الشبكي أولاً في جميع مسارات الخروج:
        //   طبيعي (done=true)           — cancel() no-op آمن على stream مغلق
        //   إلغاء (signal.cancelled)    — تأكيد إغلاق الاتصال
        //   exception (writeBytes/قرص)  — يُغلق الاتصال فوراً بدلاً من انتظار timeout
        try { await reader.cancel(); } catch { /* تجاهل */ }
        try { reader.releaseLock(); } catch { /* تم التحرير مسبقاً */ }
      }

    } finally {
      // أغلق FileHandle في جميع المسارات (نجاح، فشل، إلغاء)
      handle.close();
    }

    // ── 7. معالجة الإلغاء — احذف الملف الجزئي ──────────────────────────────
    if (signal.cancelled) {
      try {
        if (destFile.exists) destFile.delete();
      } catch {
        // تجاهل أخطاء الحذف عند الإلغاء
      }
      throw new DownloadCancelledError(jobId);
    }

    // ── 8. تحقق من اكتمال التنزيل وسلامة الملف ──────────────────────────────
    if (!downloadComplete || !destFile.exists || destFile.size === 0) {
      try {
        if (destFile.exists) destFile.delete();
      } catch {
        // تجاهل
      }
      throw new Error(
        `فشل التنزيل — الملف فارغ أو غير مكتمل: ${destPath}`,
      );
    }

    // ── 9. أبلّغ عن التقدم النهائي بحجم الملف الفعلي ────────────────────────
    const finalSize = destFile.size;
    onProgress(finalSize, finalSize);
  }

  // ── مساعدات المسار ──────────────────────────────────────────────────────────

  /**
   * يُنشئ File بالنسبة لـ Paths.cache من مسار نسبي.
   *
   * مثال: "audio/temp/job-abc.zip"
   *   → File(Paths.cache.uri + "/audio/temp/job-abc.zip")
   *
   * نستخدم بناء URI يدوياً لتجنب مشكلة TypeScript
   * مع spread على (string | File | Directory)[].
   */
  private _resolveFile(relativePath: string): File {
    const base = Paths.cache.uri.replace(/\/+$/, '');
    return new File(`${base}/${relativePath}`);
  }

  /**
   * يُنشئ Directory للمجلد الأب من مسار نسبي.
   *
   * مثال: "audio/temp/job-abc.zip"
   *   → Directory(Paths.cache.uri + "/audio/temp")
   */
  private _resolveDir(relativePath: string): Directory {
    const parts   = relativePath.split('/').filter(Boolean);
    const dirParts = parts.slice(0, -1); // كل شيء ما عدا اسم الملف
    const base    = Paths.cache.uri.replace(/\/+$/, '');
    const dirUri  = dirParts.length > 0
      ? `${base}/${dirParts.join('/')}`
      : base;
    return new Directory(dirUri);
  }
}
