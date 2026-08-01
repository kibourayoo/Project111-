/**
 * src/features/athan/downloadable-muezzin-types.ts
 *
 * نموذج المؤذّن القابل للتحميل.
 *
 * ─── ملاحظة التصميم ──────────────────────────────────────────────────────────
 * هذا النموذج مستقل تماماً عن Muezzin (المؤذّنين المُضمَّنين).
 * الفصل مقصود: المُضمَّنون جزء من البندل، أما القابلون للتحميل
 * فيُدارون عبر نظام تحميل منفصل يُتصل بـ Cloudflare لاحقاً.
 */

// ─── DownloadableMuezzin ──────────────────────────────────────────────────────

/** مؤذّن قابل للتحميل من الخادم */
export interface DownloadableMuezzin {
  /** معرّف فريد — يُستخدم مفتاحاً في AsyncStorage والكتالوج */
  id: string;

  /** الاسم الكامل للمؤذّن */
  name: string;

  /** الدولة */
  country: string;

  /** حجم الملف بالبايت (للعرض — "3.2 MB") */
  size: number;

  /** رقم إصدار الملف الصوتي على الخادم ("1.0.0") */
  version: string;

  /** اسم الملف المحفوظ محلياً ("afasy.mp3") */
  filename: string;

  /**
   * المسار المحلي الكامل بعد التحميل.
   * فارغ "" قبل التحميل.
   */
  localPath: string;

  /**
   * رابط التحميل من Cloudflare.
   * فارغ "" حتى يُربط الخادم لاحقاً.
   */
  downloadUrl: string;

  /**
   * SHA-256 checksum للتحقق من سلامة الملف.
   * فارغ "" حتى يُضاف لاحقاً.
   */
  checksum: string;

  // ─── حالة التحميل (Runtime — لا تُخزَّن في الكتالوج) ──────────────────────

  /** هل تم تحميل الملف وهو جاهز للاستخدام؟ */
  isDownloaded: boolean;

  /** هل يجري التحميل الآن؟ */
  isDownloading: boolean;

  /** نسبة التقدم (0–1) أثناء التحميل */
  progress: number;

  /**
   * رقم الإصدار المثبّت محلياً.
   * فارغ "" إذا لم يُحمَّل بعد.
   */
  installedVersion: string;
}

// ─── نوع مساعد: حالة التحميل فقط ─────────────────────────────────────────────

export type DownloadState = Pick<
  DownloadableMuezzin,
  'isDownloaded' | 'isDownloading' | 'progress' | 'installedVersion' | 'localPath'
>;

// ─── نتيجة عمليات الـ Service ─────────────────────────────────────────────────

export interface DownloadResult {
  success: boolean;
  message: string;
  error?:  Error;
}
