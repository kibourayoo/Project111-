/**
 * audio-session-types.ts
 * أنواع طبقة إدارة جلسة الصوت — Audio Session Layer Types
 *
 * ─── المحتويات ────────────────────────────────────────────────────────────────
 *   AudioSessionState       ← حالات الجلسة
 *   AudioSessionConfig      ← إعدادات الجلسة القابلة للضبط
 *   AudioSessionResult<T>   ← نتيجة موحدة لجميع عمليات Session
 *   AudioSessionError       ← تفاصيل الخطأ
 *   AudioSessionErrorCode   ← رموز الأخطاء
 *   AudioSessionEventType   ← أنواع الأحداث
 *   AudioSessionEvent<T>    ← بنية الحدث الموحدة
 *   AudioSessionListener<T> ← نوع دالة الاستماع
 *   AudioSessionUnsubscribe ← دالة إلغاء الاشتراك
 *
 * ─── القيود ──────────────────────────────────────────────────────────────────
 *   لا يحتوي هذا الملف على أي منطق تنفيذي.
 *   لا يستورد من expo-audio مباشرة.
 *   لا يحتوي على أي React أو Hooks أو UI.
 */

// ─── AudioSessionState ────────────────────────────────────────────────────────

/**
 * حالة جلسة الصوت في أي لحظة.
 *
 *   UNINITIALIZED ← لم تُهيَّأ بعد (الحالة الابتدائية)
 *   CONFIGURED    ← مُهيَّأة بإعدادات، لكن الجلسة غير مفعَّلة
 *   ACTIVE        ← الجلسة مفعَّلة والصوت جاهز
 *   DEACTIVATED   ← الجلسة أُوقفت بشكل صريح
 *   ERROR         ← حدث خطأ أثناء التهيئة أو التفعيل
 */
export type AudioSessionState =
  | 'UNINITIALIZED'
  | 'CONFIGURED'
  | 'ACTIVE'
  | 'DEACTIVATED'
  | 'ERROR';

// ─── AudioInterruptionMode ────────────────────────────────────────────────────

/**
 * سلوك التطبيق عند تعارض صوته مع تطبيقات أخرى.
 *
 *   mixWithOthers ← يعمل الصوت بالتوازي مع التطبيقات الأخرى (بدون طلب Focus)
 *   doNotMix      ← يوقف صوت التطبيقات الأخرى (Focus حصري)
 *   duckOthers    ← يخفّض صوت التطبيقات الأخرى (Ducking)
 *
 * يُعيَّن مباشرةً كـ interruptionMode في expo-audio setAudioModeAsync.
 */
export type AudioInterruptionMode = 'mixWithOthers' | 'doNotMix' | 'duckOthers';

// ─── AudioRoute ───────────────────────────────────────────────────────────────

/**
 * مسار إخراج الصوت.
 *
 *   speaker  ← مكبر الصوت الخارجي (الافتراضي)
 *   earpiece ← سماعة الأذن الداخلية
 *
 * ملاحظة: هذا الخيار فعّال فقط على iOS عندما يكون allowsRecording = true.
 * على Android والـ Web يُتجاهَل هذا الإعداد من قِبَل expo-audio.
 */
export type AudioRoute = 'speaker' | 'earpiece';

// ─── AudioSessionConfig ───────────────────────────────────────────────────────

/**
 * إعدادات جلسة الصوت الكاملة.
 * تُمرَّر مباشرةً إلى setAudioModeAsync في expo-audio.
 */
export interface AudioSessionConfig {
  /**
   * سلوك التعارض مع التطبيقات الأخرى (Interruptions / Audio Focus / Ducking).
   * @default 'doNotMix'
   */
  interruptionMode: AudioInterruptionMode;

  /**
   * هل يستمر الصوت عند تفعيل وضع الصمت؟ (iOS فقط — يُتجاهَل على Android/Web)
   * @default true
   */
  playsInSilentMode: boolean;

  /**
   * هل يستمر الصوت في الخلفية عند إخفاء التطبيق؟
   * @default false
   */
  shouldPlayInBackground: boolean;

  /**
   * مسار إخراج الصوت.
   * speaker  ← مكبر الصوت الخارجي (الافتراضي)
   * earpiece ← سماعة الأذن (iOS فقط مع allowsRecording)
   * @default 'speaker'
   */
  audioRoute: AudioRoute;
}

// ─── AudioSessionErrorCode ────────────────────────────────────────────────────

/**
 * رموز الأخطاء المعروفة في Session.
 */
export type AudioSessionErrorCode =
  | 'CONFIGURE_FAILED'    // فشل ضبط إعدادات الجلسة
  | 'ACTIVATE_FAILED'     // فشل تفعيل الجلسة
  | 'DEACTIVATE_FAILED'   // فشل إيقاف الجلسة
  | 'INVALID_CONFIG'      // إعدادات غير صالحة
  | 'UNEXPECTED';         // خطأ غير متوقع

// ─── AudioSessionError ────────────────────────────────────────────────────────

/**
 * تفاصيل خطأ Session.
 */
export interface AudioSessionError {
  code:    AudioSessionErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── AudioSessionResult ───────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات AudioSession.
 */
export interface AudioSessionResult<T = void> {
  success: boolean;
  data?:   T;
  message: string;
  error?:  AudioSessionError;
}

// ─── AudioSessionEventType ────────────────────────────────────────────────────

/**
 * أنواع الأحداث التي يُصدرها AudioSession.
 *
 * ─── ما لا يُصدَر (غير مدعوم من expo-audio SDK 55) ──────────────────────────
 *   interruption:begin  ← بدء مقاطعة من تطبيق آخر
 *   interruption:end    ← انتهاء المقاطعة
 *   focus:gained        ← استعادة Audio Focus
 *   focus:lost          ← فقدان Audio Focus
 *   route:changed       ← تغيير مسار الصوت (توصيل/فصل سماعات)
 *
 *   السبب: expo-audio لا يكشف هذه الأحداث على مستوى Session API.
 *   المقاطعات وتغيير المسار تُعالَج داخلياً من قِبَل expo-audio.
 */
export type AudioSessionEventType =
  | 'session:activated'    // تفعّلت الجلسة
  | 'session:deactivated'  // أُوقفت الجلسة
  | 'session:configured'   // تغيّرت الإعدادات
  | 'session:error'        // حدث خطأ
  | 'state:changed';       // تغيّرت AudioSessionState

// ─── AudioSessionEvent ────────────────────────────────────────────────────────

/**
 * بنية الحدث الموحدة.
 */
export interface AudioSessionEvent<TPayload = unknown> {
  type:       AudioSessionEventType;
  payload?:   TPayload;
  timestamp:  number;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

/** payload لحدث state:changed */
export interface SessionStateChangedPayload {
  previousState: AudioSessionState;
  currentState:  AudioSessionState;
}

/** payload لحدث session:configured */
export interface SessionConfiguredPayload {
  config: AudioSessionConfig;
}

/** payload لحدث session:error */
export interface SessionErrorPayload {
  error: AudioSessionError;
}

// ─── Listener / Unsubscribe ───────────────────────────────────────────────────

/** نوع دالة الاستماع للأحداث */
export type AudioSessionListener<TPayload = unknown> = (
  event: AudioSessionEvent<TPayload>,
) => void;

/** دالة إلغاء الاشتراك المُعادة من `AudioSession.on()` */
export type AudioSessionUnsubscribe = () => void;

// ─── DEFAULT_SESSION_CONFIG ───────────────────────────────────────────────────

/**
 * الإعدادات الافتراضية المُوصى بها لتطبيقات قرآن/ذكر:
 *   - doNotMix      ← يُوقف صوت التطبيقات الأخرى
 *   - playsInSilentMode: true ← يُكمل حتى لو الهاتف صامت (iOS)
 *   - shouldPlayInBackground: false ← يُوقف في الخلفية (يُفعَّل لاحقاً عند الحاجة)
 *   - audioRoute: speaker ← مكبر الصوت الافتراضي
 */
export const DEFAULT_SESSION_CONFIG: AudioSessionConfig = {
  interruptionMode:       'doNotMix',
  playsInSilentMode:      true,
  shouldPlayInBackground: false,
  audioRoute:             'speaker',
};
