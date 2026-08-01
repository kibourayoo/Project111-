/**
 * src/features/athan/download-manager/download-manager-types.ts
 *
 * أنواع Download Manager Layer.
 *
 * ─── مبدأ التصميم ────────────────────────────────────────────────────────────
 * هذه الأنواع تمثّل حالة عمليات التحميل فقط — في الذاكرة.
 * لا تعرف شيئاً عن الشبكة أو FileSystem أو UI.
 */

// ─── DownloadStatus ───────────────────────────────────────────────────────────

/**
 * حالات دورة حياة عملية التحميل.
 *
 * IDLE        ← لم تبدأ بعد (الحالة الافتراضية)
 * PENDING     ← مُدرجة في القائمة، تنتظر البدء
 * DOWNLOADING ← جارٍ التحميل الآن
 * COMPLETED   ← اكتمل التحميل بنجاح
 * FAILED      ← فشل التحميل
 * CANCELLED   ← أُلغي التحميل
 */
export type DownloadStatus =
  | 'IDLE'
  | 'PENDING'
  | 'DOWNLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// ─── DownloadEntry ────────────────────────────────────────────────────────────

/** سجل عملية تحميل واحدة في الذاكرة */
export interface DownloadEntry {
  /** معرّف المؤذّن */
  id: string;
  /** الحالة الحالية */
  status: DownloadStatus;
  /** نسبة التقدم (0–1) — صالحة فقط عند DOWNLOADING */
  progress: number;
  /** رسالة الخطأ — صالحة فقط عند FAILED */
  errorMessage?: string;
  /** وقت بدء العملية */
  startedAt?: string;
  /** وقت الانتهاء (نجاحاً أو فشلاً أو إلغاءً) */
  finishedAt?: string;
}

// ─── DownloadStatusChangedEvent ───────────────────────────────────────────────

/** حدث تغيّر الحالة — يُصدَر عند كل تغيير */
export interface DownloadStatusChangedEvent {
  id:       string;
  previous: DownloadStatus;
  current:  DownloadStatus;
  entry:    DownloadEntry;
}

// ─── DownloadProgressEvent ────────────────────────────────────────────────────

/** حدث تحديث التقدم — يُصدَر أثناء DOWNLOADING */
export interface DownloadProgressEvent {
  id:       string;
  progress: number;
}

// ─── أنواع المستمعين ──────────────────────────────────────────────────────────

export type StatusChangedListener = (event: DownloadStatusChangedEvent) => void;
export type ProgressListener      = (event: DownloadProgressEvent)      => void;
export type ManagerUnsubscribe    = () => void;

// ─── ManagerResult ────────────────────────────────────────────────────────────

/** نتيجة موحّدة لعمليات DownloadManager */
export type ManagerResult<T = void> =
  | { success: true;  data: T;      message: string }
  | { success: false; data?: never; message: string };

export function mgrOk<T>(data: T, message = 'تمت العملية'): ManagerResult<T> {
  return { success: true, data, message };
}

export function mgrOk0(message = 'تمت العملية'): ManagerResult<void> {
  return { success: true, data: undefined, message };
}

export function mgrFail<T = void>(message: string): ManagerResult<T> {
  return { success: false, message };
}
