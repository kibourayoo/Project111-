/**
 * audio-runtime-types.ts
 * أنواع طبقة تشغيل الصوت — Runtime Layer Types
 *
 * ─── المحتويات ────────────────────────────────────────────────────────────────
 *   AudioPlaybackState   ← حالات تشغيل الصوت
 *   AudioRuntimeStatus   ← لقطة شاملة لحالة التشغيل الحالية
 *   AudioRuntimeResult   ← نتيجة موحدة لجميع عمليات Runtime
 *   AudioRuntimeError    ← تفاصيل الخطأ
 *   AudioRuntimeErrorCode ← رموز الأخطاء المعروفة
 *   AudioRuntimeEventType ← أنواع الأحداث التي يُصدرها Runtime
 *   AudioRuntimeEvent    ← بنية الحدث الموحدة
 *   AudioRuntimeListener ← نوع دالة الاستماع للأحداث
 *   AudioRuntimeUnsubscribe ← دالة إلغاء الاشتراك
 *
 * ─── القيود ──────────────────────────────────────────────────────────────────
 *   لا يحتوي هذا الملف على أي منطق تنفيذي.
 *   لا يستورد من expo-audio مباشرة.
 *   لا يحتوي على أي React أو Hooks أو UI.
 */

// ─── AudioPlaybackState ───────────────────────────────────────────────────────

/**
 * حالة تشغيل الصوت في أي لحظة.
 *
 *   IDLE      ← لا يوجد ملف محمّل (الحالة الابتدائية)
 *   LOADING   ← جارٍ تحميل المصدر
 *   READY     ← مُحمَّل وجاهز للتشغيل، لم يبدأ بعد
 *   PLAYING   ← يعزف حالياً
 *   PAUSED    ← موقوف مؤقتاً (يحتفظ بالموضع)
 *   STOPPED   ← موقوف ومُعاد للبداية (موضع = 0)
 *   ENDED     ← وصل لنهاية الملف الصوتي
 *   ERROR     ← حدث خطأ أثناء التحميل أو التشغيل
 */
export type AudioPlaybackState =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'STOPPED'
  | 'ENDED'
  | 'ERROR';

// ─── AudioRuntimeStatus ───────────────────────────────────────────────────────

/**
 * لقطة شاملة لحالة التشغيل الحالية.
 * مُعادة من `AudioRuntime.getStatus()`.
 */
export interface AudioRuntimeStatus {
  /** حالة التشغيل الحالية */
  state: AudioPlaybackState;
  /** الموضع الحالي بالثواني */
  currentTime: number;
  /** المدة الكلية للملف الصوتي بالثواني (0 إذا لم يُحدَّد بعد) */
  duration: number;
  /** معدل التشغيل (1.0 = سرعة طبيعية) */
  rate: number;
  /** مستوى الصوت (0.0 – 1.0) */
  volume: number;
  /** هل اكتمل تحميل الملف الصوتي؟ */
  isLoaded: boolean;
  /** هل يجري الـ buffering حالياً؟ */
  isBuffering: boolean;
  /** مسار الملف الصوتي المحمَّل حالياً (null إذا لم يُحمَّل) */
  uri: string | null;
}

// ─── AudioRuntimeErrorCode ────────────────────────────────────────────────────

/**
 * رموز الأخطاء المعروفة في Runtime.
 */
export type AudioRuntimeErrorCode =
  | 'NOT_LOADED'            // لا يوجد ملف صوتي محمّل
  | 'ALREADY_LOADING'       // يجري تحميل ملف بالفعل
  | 'LOAD_FAILED'           // فشل تحميل المصدر
  | 'PLAYBACK_FAILED'       // فشل التشغيل
  | 'SEEK_OUT_OF_RANGE'     // الموضع خارج نطاق المدة
  | 'INVALID_RATE'          // معدل التشغيل خارج النطاق المسموح (0.1–2.0)
  | 'INVALID_VOLUME'        // مستوى الصوت خارج النطاق (0.0–1.0)
  | 'DISPOSE_FAILED'        // فشل تنظيف الموارد
  | 'UNEXPECTED';           // خطأ غير متوقع

// ─── AudioRuntimeError ────────────────────────────────────────────────────────

/**
 * تفاصيل خطأ Runtime.
 */
export interface AudioRuntimeError {
  /** رمز الخطأ */
  code: AudioRuntimeErrorCode;
  /** رسالة وصفية للخطأ */
  message: string;
  /** الاستثناء الأصلي إن وجد */
  cause?: unknown;
}

// ─── AudioRuntimeResult ───────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات AudioRuntime.
 */
export interface AudioRuntimeResult<T = void> {
  /** نجاح العملية */
  success: boolean;
  /** البيانات عند النجاح */
  data?: T;
  /** رسالة وصفية */
  message: string;
  /** تفاصيل الخطأ عند الفشل */
  error?: AudioRuntimeError;
}

// ─── AudioRuntimeEventType ────────────────────────────────────────────────────

/**
 * أنواع الأحداث التي يُصدرها AudioRuntime.
 */
export type AudioRuntimeEventType =
  | 'playback:started'    // بدأ التشغيل
  | 'playback:paused'     // مُوقَّف مؤقتاً
  | 'playback:resumed'    // استُؤنف التشغيل
  | 'playback:stopped'    // مُوقَّف ومُعاد للبداية
  | 'playback:ended'      // وصل لنهاية الملف
  | 'playback:error'      // حدث خطأ
  | 'playback:progress'   // تحديث دوري للموضع والحالة
  | 'state:changed';      // تغيّرت حالة AudioPlaybackState

// ─── AudioRuntimeEvent ────────────────────────────────────────────────────────

/**
 * بنية الحدث الموحدة التي يستقبلها المستمعون.
 */
export interface AudioRuntimeEvent<TPayload = unknown> {
  /** نوع الحدث */
  type: AudioRuntimeEventType;
  /** بيانات الحدث (اختياري — يعتمد على النوع) */
  payload?: TPayload;
  /** وقت إصدار الحدث بالـ ms (Date.now()) */
  timestamp: number;
}

/**
 * payload لحدث playback:progress
 */
export interface PlaybackProgressPayload {
  currentTime: number;
  duration:    number;
  state:       AudioPlaybackState;
}

/**
 * payload لحدث state:changed
 */
export interface StateChangedPayload {
  previousState: AudioPlaybackState;
  currentState:  AudioPlaybackState;
}

/**
 * payload لحدث playback:error
 */
export interface PlaybackErrorPayload {
  error: AudioRuntimeError;
}

// ─── AudioRuntimeListener ─────────────────────────────────────────────────────

/**
 * نوع دالة الاستماع للأحداث.
 */
export type AudioRuntimeListener<TPayload = unknown> = (
  event: AudioRuntimeEvent<TPayload>,
) => void;

/**
 * دالة إلغاء الاشتراك المُعادة من `AudioRuntime.on()`.
 * استدعاؤها يوقف استقبال الأحداث.
 */
export type AudioRuntimeUnsubscribe = () => void;
