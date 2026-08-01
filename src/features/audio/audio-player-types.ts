/**
 * src/features/audio/audio-player-types.ts
 *
 * أنواع طبقة Application Integration — AudioPlayer
 *
 * هذه الأنواع هي الواجهة الوحيدة التي تعرفها شاشات التطبيق.
 * لا تحتوي على أي مرجع لـ AudioService أو PlaylistManager
 * أو AudioController أو Runtime أو Session.
 */

// ─── SurahTrack ───────────────────────────────────────────────────────────────

/**
 * بيانات سورة كاملة كما يحتاجها مشغّل التطبيق.
 * هذا هو النموذج الوحيد للسورة من وجهة نظر الشاشات.
 */
export interface SurahTrack {
  /** معرّف فريد — يجب أن يكون ثابتاً طوال جلسة التشغيل */
  id:               string;
  /** مسار الملف الصوتي على الجهاز */
  uri:              string;
  /** رقم السورة (1–114) */
  surahNumber:      number;
  /** اسم السورة للعرض */
  title:            string;
  /** المدة الكلية بالثواني (اختياري) */
  durationSeconds?: number;
}

// ─── AudioPlayerState ─────────────────────────────────────────────────────────

/**
 * حالة المشغّل كما تراها الشاشات.
 *
 *   IDLE    ← لا يوجد تشغيل (لا قائمة أو القائمة فارغة)
 *   PLAYING ← يُشغّل سورة حالياً
 *   PAUSED  ← موقوف مؤقتاً
 *   ENDED   ← انتهت آخر سورة في القائمة
 */
export type AudioPlayerState =
  | 'IDLE'
  | 'PLAYING'
  | 'PAUSED'
  | 'ENDED';

// ─── AudioPlayerStatus ────────────────────────────────────────────────────────

/**
 * لقطة كاملة لحالة المشغّل في أي لحظة.
 * الشاشات تستخدم هذا فقط لعرض الحالة.
 */
export interface AudioPlayerStatus {
  /** حالة التشغيل الحالية */
  state:        AudioPlayerState;
  /** السورة الحالية أو null إذا لم يكن هناك تشغيل */
  currentSurah: SurahTrack | null;
  /** قائمة السور الحالية (للقراءة فقط) */
  surahList:    readonly SurahTrack[];
  /** فهرس السورة الحالية ضمن القائمة (1- إذا كانت القائمة فارغة) */
  currentIndex: number;
  /** هل توجد سورة تالية؟ */
  hasNext:      boolean;
  /** هل توجد سورة سابقة؟ */
  hasPrevious:  boolean;
  /** إجمالي عدد السور في القائمة */
  totalCount:   number;
  /** الموضع الحالي بالثواني */
  currentTime:  number;
  /** المدة الكلية للسورة الحالية بالثواني (0 إذا لم تُحدَّد بعد) */
  duration:     number;
  /** هل يجري الـ buffering؟ */
  isBuffering:  boolean;
  /** اختصار: هل التشغيل جارٍ؟ */
  isPlaying:    boolean;
  /** اختصار: هل موقوف مؤقتاً؟ */
  isPaused:     boolean;
}

// ─── AudioPlayerResult ────────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات AudioPlayer.
 * الشاشات تفحص success وتعرض error عند الحاجة.
 */
export interface AudioPlayerResult<T = void> {
  /** هل نجحت العملية؟ */
  success: boolean;
  /** البيانات عند النجاح */
  data?:   T;
  /** وصف نصي للعملية */
  message: string;
  /** رسالة الخطأ عند الفشل */
  error?:  string;
}

// ─── AudioPlayerEventType ─────────────────────────────────────────────────────

/**
 * أنواع الأحداث التي يُصدرها AudioPlayer.
 *
 *   surah:changed  ← تغيّرت السورة الحالية (next / previous / play)
 *   list:changed   ← تغيّرت قائمة السور (بدء تشغيل قائمة جديدة)
 *   state:changed  ← تغيّرت حالة التشغيل (PLAYING / PAUSED / ENDED...)
 *   list:ended     ← انتهت آخر سورة في القائمة
 *   playback:error ← خطأ أثناء التشغيل
 */
export type AudioPlayerEventType =
  | 'surah:changed'
  | 'list:changed'
  | 'state:changed'
  | 'list:ended'
  | 'playback:error';

// ─── Event Payloads ───────────────────────────────────────────────────────────

/** حمولة حدث surah:changed */
export interface SurahChangedPayload {
  previousIndex: number;
  currentIndex:  number;
  surah:         SurahTrack | null;
}

/** حمولة حدث list:changed */
export interface ListChangedPayload {
  surahs:     readonly SurahTrack[];
  totalCount: number;
}

/** حمولة حدث state:changed */
export interface PlayerStateChangedPayload {
  previousState: AudioPlayerState;
  currentState:  AudioPlayerState;
}

/** حمولة حدث playback:error */
export interface PlayerErrorPayload {
  message: string;
  code:    string;
}

// ─── Listener / Unsubscribe ───────────────────────────────────────────────────

/** نوع دالة الاستماع للأحداث */
export type AudioPlayerListener<TPayload = unknown> =
  (payload: TPayload) => void;

/** دالة إلغاء الاشتراك المُعادة من `AudioPlayer.on()` */
export type AudioPlayerUnsubscribe = () => void;
