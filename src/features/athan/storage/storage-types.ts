/**
 * src/features/athan/storage/storage-types.ts
 *
 * أنواع طبقة التخزين المحلي للمؤذّنين المحمَّلين.
 *
 * ─── مبدأ التصميم ────────────────────────────────────────────────────────────
 * هذه الأنواع خاصة بما يُخزَّن في AsyncStorage فقط.
 * لا تعرف شيئاً عن الشبكة أو AudioService أو UI.
 *
 * ─── الفرق عن DownloadableMuezzin ───────────────────────────────────────────
 * DownloadableMuezzin  → نموذج كامل يشمل حالة Runtime (isDownloading, progress)
 * StoredVoiceRecord    → فقط ما يُكتب ويُقرأ من AsyncStorage
 */

// ─── StoredVoiceRecord ────────────────────────────────────────────────────────

/**
 * السجل المحفوظ في AsyncStorage لمؤذّن محمَّل.
 * هذا هو الشكل الدقيق لقيمة كل مفتاح في AsyncStorage.
 */
export interface StoredVoiceRecord {
  /** معرّف المؤذّن — مطابق لـ DownloadableMuezzin.id */
  id: string;
  /** المسار المحلي الكامل للملف الصوتي */
  localPath: string;
  /** رقم الإصدار المثبَّت محلياً */
  installedVersion: string;
  /** تاريخ التحميل (ISO 8601) */
  downloadedAt: string;
  /** حجم الملف المحفوظ بالبايت */
  size: number;
  /** checksum SHA-256 للملف المحفوظ (للتحقق مستقبلاً) */
  checksum: string;
  /**
   * اسم المؤذّن — يُحفظ وقت التحميل من الكتالوج البعيد
   * لضمان عمل getInstalledVoices() بدون اتصال بالشبكة.
   * اختياري للتوافق مع السجلات المحفوظة قبل هذا التعديل.
   */
  name?: string;
  /**
   * دولة المؤذّن — يُحفظ وقت التحميل من الكتالوج البعيد.
   * اختياري للتوافق مع السجلات المحفوظة قبل هذا التعديل.
   */
  country?: string;
}

// ─── StorageResult ────────────────────────────────────────────────────────────

/** نتيجة موحّدة لجميع عمليات StorageService */
export type StorageResult<T = void> =
  | { success: true;  data: T;      message: string }
  | { success: false; data?: never; message: string; error?: Error };

// ─── دوال مساعدة ─────────────────────────────────────────────────────────────

export function storageOk<T>(data: T, message = 'تمت العملية بنجاح'): StorageResult<T> {
  return { success: true, data, message };
}

export function storageOk0(message = 'تمت العملية بنجاح'): StorageResult<void> {
  return { success: true, data: undefined, message };
}

export function storageFail<T = void>(
  message: string,
  error?: Error,
): StorageResult<T> {
  return { success: false, message, error };
}
