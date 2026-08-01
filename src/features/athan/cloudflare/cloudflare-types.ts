/**
 * src/features/athan/cloudflare/cloudflare-types.ts
 *
 * جميع Models الخاصة بطبقة Cloudflare.
 *
 * ─── مبدأ التصميم ────────────────────────────────────────────────────────────
 * هذه الأنواع تمثّل بنية استجابة Cloudflare فقط.
 * لا تُستخدَم مباشرةً في UI — يُحوّلها CloudflareClient
 * إلى DownloadableMuezzin قبل تسليمها لـ DownloadService.
 *
 * ─── الاستخدام ───────────────────────────────────────────────────────────────
 * CloudflareClient  ← يستخدم هذه الأنواع داخلياً
 * DownloadService   ← يستقبل DownloadableMuezzin (لا يعرف هذه الأنواع)
 * UI                ← لا تعرف هذه الأنواع إطلاقاً
 */

// ─── RemoteChecksum ───────────────────────────────────────────────────────────

/** بصمة تحقق ملف صوتي لضمان سلامة التحميل */
export interface RemoteChecksum {
  /** خوارزمية الـ Hash — SHA-256 افتراضياً */
  algorithm: 'sha256' | 'md5';
  /** قيمة الـ Hash hex-encoded */
  value: string;
}

// ─── RemoteVersion ────────────────────────────────────────────────────────────

/** إصدار ملف صوتي على Cloudflare */
export interface RemoteVersion {
  /** رقم الإصدار ("1.0.0") */
  version: string;
  /** حجم الملف بالبايت */
  size: number;
  /** تاريخ الرفع على Cloudflare (ISO 8601) */
  uploadedAt: string;
  /** بصمة التحقق */
  checksum: RemoteChecksum;
  /** مسار الملف نسبةً إلى BASE_URL */
  path: string;
}

// ─── CloudflareMetadata ───────────────────────────────────────────────────────

/** بيانات تفصيلية لمؤذّن واحد على Cloudflare */
export interface CloudflareMetadata {
  /** معرّف فريد مطابق لـ DownloadableMuezzin.id */
  id: string;
  /** الاسم الكامل */
  name: string;
  /** الدولة */
  country: string;
  /** الإصدار الحالي على الخادم */
  latestVersion: RemoteVersion;
  /** جميع الإصدارات المتاحة (للترقية) */
  versions: RemoteVersion[];
}

// ─── RemoteVoice ─────────────────────────────────────────────────────────────

/**
 * ملخّص مؤذّن واحد في استجابة الكتالوج.
 * أقل تفصيلاً من CloudflareMetadata — للعرض السريع في القائمة.
 */
export interface RemoteVoice {
  id: string;
  name: string;
  country: string;
  /** حجم الملف بالبايت */
  size: number;
  /** رقم الإصدار الحالي */
  version: string;
  /** اسم الملف ("afasy.mp3") */
  filename: string;
}

// ─── CloudflareCatalogItem ────────────────────────────────────────────────────

/**
 * عنصر واحد في استجابة fetchCatalog().
 * يُستخدم لبناء قائمة المؤذّنين القابلين للتحميل.
 */
export interface CloudflareCatalogItem {
  voice: RemoteVoice;
  /** هل هذا المؤذّن متاح للتحميل حالياً؟ */
  available: boolean;
}

// ─── CloudflareResult ─────────────────────────────────────────────────────────

/** نتيجة موحّدة لجميع عمليات CloudflareClient */
export type CloudflareResult<T> =
  | { success: true;  data: T;       message: string }
  | { success: false; data?: never;  message: string; error?: Error };

// ─── دوال مساعدة لبناء النتائج ────────────────────────────────────────────────

export function cfOk<T>(data: T, message = 'نجح الطلب'): CloudflareResult<T> {
  return { success: true, data, message };
}

export function cfFail<T = never>(
  message: string,
  error?: Error,
): CloudflareResult<T> {
  return { success: false, message, error };
}
