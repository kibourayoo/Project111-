/**
 * idownloader.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Interface الطبقة الشبكية للتنزيل + Stub للمرحلة 20.
 *
 * IDownloader — واجهة مجردة تُمكّن:
 *   - Dependency Inversion: Worker يعتمد على الواجهة لا التنفيذ
 *   - اختبار Lifecycle كاملة بدون Networking
 *
 * DownloaderStub — تنفيذ وهمي يُحاكي التنزيل:
 *   - لا يستخدم fetch / XMLHttpRequest / stream
 *   - يُصدر تقدماً وهمياً (0 → 20 → 40 → 60 → 80 → 100%)
 *   - يحترم إشارة الإلغاء (DownloadSignal.cancelled)
 *   - TODO (مرحلة 21): استبدل DownloaderStub بـ Downloader الحقيقي
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── DownloadSignal ───────────────────────────────────────────────────────────

/**
 * إشارة تُمرَّر من Worker إلى Downloader للتحكم في التنفيذ.
 * تُقرأ فقط — لا يُعدّلها Downloader.
 */
export interface DownloadSignal {
  /** هل طلب Worker إلغاء الـ Job؟ */
  readonly cancelled: boolean;
}

// ─── IDownloader ──────────────────────────────────────────────────────────────

/**
 * واجهة طبقة التنزيل الشبكية.
 *
 * المسؤولية الوحيدة:
 *   - تنزيل ملف من url إلى destPath
 *   - الإبلاغ عن التقدم عبر onProgress
 *   - احترام إشارة الإلغاء
 *
 * لا يعرف: DownloadJob، AudioPackage، Registry، StateMachine، EventBus.
 */
export interface IDownloader {
  /**
   * يُنزِّل ملفاً من url إلى destPath.
   *
   * @param jobId      - معرّف الـ Job (للـ logging فقط)
   * @param url        - رابط الملف المراد تنزيله
   * @param destPath   - المسار المحلي الوجهة (audio/temp/{jobId}.zip)
   * @param onProgress - callback يُستدعى عند كل تحديث تقدم
   * @param signal     - إشارة للتحقق من الإلغاء أثناء التنزيل
   *
   * @throws إذا فشل التنزيل (أخطاء الشبكة، timeout، إلغاء)
   */
  download(
    jobId:      string,
    url:        string,
    destPath:   string,
    onProgress: (downloaded: number, total: number) => void,
    signal:     DownloadSignal,
  ): Promise<void>;
}

// ─── DownloaderStub ───────────────────────────────────────────────────────────

/**
 * تنفيذ وهمي لـ IDownloader — المرحلة 20.
 *
 * يُحاكي عملية تنزيل حقيقية بـ 5 خطوات تقدم:
 *   0% → 20% → 40% → 60% → 80% → 100%
 *
 * ⚠️ لا يُستخدم:
 *   - fetch / XMLHttpRequest / stream
 *   - expo-file-system
 *   - أي Networking
 *
 * يُستخدم بدلاً من ذلك:
 *   - Promise-based async (microtask + setTimeout(0))
 *   - حجم وهمي ثابت: 5MB
 *
 * TODO (مرحلة 21): احذف هذا الملف واستبدله بـ Downloader الحقيقي.
 */
export class DownloaderStub implements IDownloader {

  /** الحجم الوهمي الكلي للملف (bytes) */
  private static readonly FAKE_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB

  /** خطوات التقدم الوهمي (نسب مئوية) */
  private static readonly PROGRESS_STEPS = [0, 20, 40, 60, 80, 100];

  async download(
    jobId:      string,
    url:        string,
    destPath:   string,
    onProgress: (downloaded: number, total: number) => void,
    signal:     DownloadSignal,
  ): Promise<void> {
    void jobId; void url; void destPath; // Stub — لا نستخدم هذه القيم

    const total = DownloaderStub.FAKE_TOTAL_BYTES;

    for (const percent of DownloaderStub.PROGRESS_STEPS) {
      // تحقق من الإلغاء قبل كل خطوة
      if (signal.cancelled) {
        throw new DownloadCancelledError(jobId);
      }

      const downloaded = Math.floor((percent / 100) * total);
      onProgress(downloaded, total);

      // تسليم دور للـ event loop (بدون blocking)
      await yieldToEventLoop();
    }
  }
}

// ─── DownloadCancelledError ───────────────────────────────────────────────────

/**
 * خطأ خاص يُلقيه Downloader عند استقبال إشارة الإلغاء.
 * يُميّزه Worker عن أخطاء الشبكة لاتخاذ قرار Retry/Cancel.
 */
export class DownloadCancelledError extends Error {
  readonly jobId: string;

  constructor(jobId: string) {
    super(`تم إلغاء تنزيل الـ Job: ${jobId}`);
    this.name  = 'DownloadCancelledError';
    this.jobId = jobId;
  }
}

// ─── مساعد داخلي ─────────────────────────────────────────────────────────────

/**
 * يُسلّم دور التنفيذ للـ event loop للدورة التالية.
 * يُستخدم في Stub لتجنب blocking وللسماح بالتحقق من الإلغاء.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
