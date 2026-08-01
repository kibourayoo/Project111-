/**
 * audio-controller-types.ts
 * أنواع طبقة التنسيق — Audio Controller Layer Types
 *
 * ─── المحتويات ────────────────────────────────────────────────────────────────
 *   AudioControllerState       ← حالات Controller الموحدة
 *   AudioControllerStatus      ← لقطة شاملة تجمع Runtime + Session
 *   AudioControllerResult<T>   ← نتيجة موحدة لجميع عمليات Controller
 *   AudioControllerError       ← تفاصيل الخطأ
 *   AudioControllerErrorCode   ← رموز الأخطاء
 *   AudioControllerEventType   ← أنواع الأحداث
 *   AudioControllerEvent<T>    ← بنية الحدث الموحدة
 *   AudioControllerListener<T> ← نوع دالة الاستماع
 *   AudioControllerUnsubscribe ← دالة إلغاء الاشتراك
 *
 * ─── القيود ──────────────────────────────────────────────────────────────────
 *   لا يحتوي هذا الملف على أي منطق تنفيذي.
 *   لا يستورد من expo-audio أو Runtime أو Session مباشرة.
 *   لا يحتوي على أي React أو Hooks أو UI.
 */

// ─── AudioControllerState ─────────────────────────────────────────────────────

/**
 * الحالة الموحدة لـ AudioController في أي لحظة.
 * تجمع حالة Session وحالة Runtime في بُعد واحد يفهمه UI.
 *
 *   IDLE             ← لا شيء: لا جلسة، لا ملف
 *   SESSION_ACTIVE   ← الجلسة مفعَّلة، لا ملف محمَّل بعد
 *   LOADED           ← ملف محمَّل وجاهز، لم يبدأ التشغيل
 *   PLAYING          ← يعزف حالياً
 *   PAUSED           ← موقوف مؤقتاً (يحتفظ بالموضع)
 *   STOPPED          ← موقوف ومُعاد للبداية
 *   ENDED            ← وصل لنهاية الملف
 *   ERROR            ← خطأ في Session أو Runtime
 */
export type AudioControllerState =
  | 'IDLE'
  | 'SESSION_ACTIVE'
  | 'LOADED'
  | 'PLAYING'
  | 'PAUSED'
  | 'STOPPED'
  | 'ENDED'
  | 'ERROR';

// ─── AudioControllerStatus ────────────────────────────────────────────────────

/**
 * لقطة شاملة تجمع حالة Runtime وSession معاً.
 * مُعادة من `AudioController.getStatus()`.
 * هذا هو الكائن الوحيد الذي يحتاجه UI لعرض حالة التشغيل.
 */
export interface AudioControllerStatus {
  /** الحالة الموحدة لـ Controller */
  state:          AudioControllerState;
  /** هل جلسة الصوت مفعَّلة؟ */
  sessionActive:  boolean;
  /** الموضع الحالي بالثواني */
  currentTime:    number;
  /** المدة الكلية بالثواني (0 إذا لم تُحدَّد بعد) */
  duration:       number;
  /** معدل التشغيل (1.0 = طبيعي) */
  rate:           number;
  /** مستوى الصوت (0.0 – 1.0) */
  volume:         number;
  /** هل الملف مُحمَّل بالكامل؟ */
  isLoaded:       boolean;
  /** هل يجري الـ buffering؟ */
  isBuffering:    boolean;
  /** مسار الملف الصوتي الحالي (null إذا لم يُحمَّل) */
  uri:            string | null;
}

// ─── AudioControllerErrorCode ─────────────────────────────────────────────────

/**
 * رموز الأخطاء المعروفة في Controller.
 */
export type AudioControllerErrorCode =
  | 'SESSION_ACTIVATE_FAILED'     // فشل تفعيل الجلسة
  | 'SESSION_DEACTIVATE_FAILED'   // فشل إيقاف الجلسة
  | 'LOAD_FAILED'                 // فشل تحميل الملف
  | 'PLAY_FAILED'                 // فشل التشغيل
  | 'PAUSE_FAILED'                // فشل الإيقاف المؤقت
  | 'RESUME_FAILED'               // فشل الاستئناف
  | 'STOP_FAILED'                 // فشل الإيقاف الكامل
  | 'SEEK_FAILED'                 // فشل تغيير الموضع
  | 'SET_RATE_FAILED'             // فشل ضبط السرعة
  | 'SET_VOLUME_FAILED'           // فشل ضبط الصوت
  | 'DISPOSE_FAILED'              // فشل تحرير الموارد
  | 'CONTROLLER_DISPOSED'         // Controller تم التخلص منه — لا يمكن استخدامه
  | 'UNEXPECTED';                 // خطأ غير متوقع

// ─── AudioControllerError ────────────────────────────────────────────────────

/**
 * تفاصيل خطأ Controller.
 */
export interface AudioControllerError {
  code:    AudioControllerErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── AudioControllerResult ────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات AudioController.
 */
export interface AudioControllerResult<T = void> {
  success: boolean;
  data?:   T;
  message: string;
  error?:  AudioControllerError;
}

// ─── AudioControllerEventType ─────────────────────────────────────────────────

/**
 * أنواع الأحداث التي يُصدرها AudioController.
 * تشمل أحداث Runtime المُعاد إصدارها + أحداث Session + حالة Controller.
 */
export type AudioControllerEventType =
  | 'playback:started'    // بدأ التشغيل
  | 'playback:paused'     // مُوقَّف مؤقتاً
  | 'playback:resumed'    // استُؤنف التشغيل
  | 'playback:stopped'    // مُوقَّف ومُعاد للبداية
  | 'playback:ended'      // وصل لنهاية الملف
  | 'playback:error'      // خطأ في التشغيل
  | 'playback:progress'   // تحديث دوري للموضع
  | 'session:activated'   // تفعّلت الجلسة
  | 'session:deactivated' // أُوقفت الجلسة
  | 'state:changed';      // تغيّرت AudioControllerState

// ─── AudioControllerEvent ────────────────────────────────────────────────────

/**
 * بنية الحدث الموحدة التي يستقبلها UI.
 */
export interface AudioControllerEvent<TPayload = unknown> {
  type:       AudioControllerEventType;
  payload?:   TPayload;
  timestamp:  number;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

/** payload لحدث state:changed */
export interface ControllerStateChangedPayload {
  previousState: AudioControllerState;
  currentState:  AudioControllerState;
}

/** payload لحدث playback:progress */
export interface ControllerProgressPayload {
  currentTime: number;
  duration:    number;
  state:       AudioControllerState;
}

/** payload لحدث playback:error */
export interface ControllerErrorPayload {
  error: AudioControllerError;
}

// ─── Listener / Unsubscribe ───────────────────────────────────────────────────

/** نوع دالة الاستماع للأحداث */
export type AudioControllerListener<TPayload = unknown> = (
  event: AudioControllerEvent<TPayload>,
) => void;

/** دالة إلغاء الاشتراك المُعادة من `AudioController.on()` */
export type AudioControllerUnsubscribe = () => void;
