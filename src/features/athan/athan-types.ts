/**
 * src/features/athan/athan-types.ts
 *
 * أنواع ميزة مشغّل الأذان — الواجهة الوحيدة التي تعرفها شاشة الأذان.
 *
 * لا تحتوي على أي مرجع لـ AudioService أو PlaylistManager
 * أو AudioController أو Runtime أو Session.
 */

// ─── Muezzin ──────────────────────────────────────────────────────────────────

/**
 * بيانات مؤذّن واحد كما يعرفه التطبيق.
 */
export interface Muezzin {
  /** معرّف فريد */
  id:           string;
  /** اسم المؤذّن بالعربية */
  name:         string;
  /** الدولة (اختياري) */
  country?:     string;
  /** وصف مختصر (اختياري) */
  description?: string;
  /**
   * مسار الملف الصوتي.
   * بالنسبة للأصوات المُضمَّنة، سيكون URI محلي مُحلَّل من require().
   * سلسلة فارغة تعني أن الملف لم يُضف بعد.
   */
  uri:          string;
}

// ─── AthanPlayerState ─────────────────────────────────────────────────────────

/**
 * حالة مشغّل الأذان كما تراها الشاشة.
 *
 *   IDLE    ← لا تشغيل (الوضع الافتراضي)
 *   PLAYING ← يُشغّل حالياً
 *   PAUSED  ← موقوف مؤقتاً
 *   ENDED   ← انتهى التشغيل
 *   ERROR   ← حدث خطأ
 */
export type AthanPlayerState =
  | 'IDLE'
  | 'PLAYING'
  | 'PAUSED'
  | 'ENDED'
  | 'ERROR';

// ─── AthanPlayerStatus ────────────────────────────────────────────────────────

/**
 * لقطة كاملة لحالة مشغّل الأذان.
 * الشاشة تستخدم هذا لعرض الحالة الحالية وتحديث الواجهة.
 */
export interface AthanPlayerStatus {
  /** حالة التشغيل */
  state:          AthanPlayerState;
  /** المؤذّن الحالي أو null إذا لم يختر المستخدم بعد */
  currentMuezzin: Muezzin | null;
  /** الموضع الحالي بالثواني */
  currentTime:    number;
  /** المدة الكلية بالثواني (0 إذا لم تُحدَّد) */
  duration:       number;
  /** هل يجري الـ buffering؟ */
  isBuffering:    boolean;
  /** اختصار: هل التشغيل جارٍ؟ */
  isPlaying:      boolean;
  /** اختصار: هل موقوف مؤقتاً؟ */
  isPaused:       boolean;
  /** رسالة الخطأ عند state === 'ERROR' */
  error:          string | null;
}

// ─── AthanPlayerResult ────────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لعمليات مشغّل الأذان.
 */
export interface AthanPlayerResult {
  success: boolean;
  message: string;
  error?:  string;
}

// ─── Callback ─────────────────────────────────────────────────────────────────

/** دالة استدعاء عند تغيّر الحالة */
export type AthanStatusCallback = (status: AthanPlayerStatus) => void;

/** دالة إلغاء الاشتراك */
export type AthanUnsubscribe = () => void;
