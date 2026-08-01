/**
 * src/lib/audio/playlist/playlist-types.ts
 *
 * جميع الأنواع والواجهات الخاصة بطبقة Playlist / Queue.
 * هذه الطبقة مستقلة تماماً — لا تعتمد على FileSystem أو Download أو PackageManager.
 */

// ─── PlaylistItem ─────────────────────────────────────────────────────────────

/**
 * عنصر واحد في قائمة التشغيل.
 * uri هو المسار/الرابط الوحيد المطلوب لتشغيل الملف.
 */
export interface PlaylistItem {
  /** معرّف فريد للعنصر ضمن القائمة */
  id: string;
  /** مسار الملف الصوتي أو رابطه */
  uri: string;
  /** عنوان الملف للعرض (اختياري) */
  title?: string;
  /** المدة الكلية بالثواني (اختياري — مُعبَّأ من المصدر إن توفّر) */
  durationSeconds?: number;
}

// ─── PlaylistState ────────────────────────────────────────────────────────────

/**
 * الحالات الممكنة لطبقة Playlist.
 *
 *   EMPTY   ← القائمة فارغة
 *   READY   ← يوجد عناصر لكن لا يوجد تشغيل
 *   PLAYING ← يتم التشغيل حالياً
 *   PAUSED  ← التشغيل موقوف مؤقتاً
 *   ENDED   ← وصل آخر عنصر للنهاية ولا يوجد تالٍ
 */
export type PlaylistState =
  | 'EMPTY'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'ENDED';

// ─── PlaylistStatus ───────────────────────────────────────────────────────────

/**
 * لقطة فورية كاملة لحالة PlaylistManager.
 */
export interface PlaylistStatus {
  /** الحالة الحالية للـ Playlist */
  state: PlaylistState;
  /** نسخة للقراءة فقط من قائمة التشغيل */
  queue: readonly PlaylistItem[];
  /** فهرس العنصر الحالي (1- إذا كانت القائمة فارغة) */
  currentIndex: number;
  /** العنصر الحالي أو null إذا كانت القائمة فارغة */
  current: PlaylistItem | null;
  /** هل يوجد عنصر تالٍ؟ */
  hasNext: boolean;
  /** هل يوجد عنصر سابق؟ */
  hasPrevious: boolean;
  /** إجمالي عدد العناصر */
  totalCount: number;
}

// ─── PlaylistResult ───────────────────────────────────────────────────────────

/**
 * نتيجة موحدة لجميع عمليات PlaylistManager.
 */
export interface PlaylistResult<T = void> {
  success: boolean;
  message: string;
  data?:   T;
  error?:  PlaylistError;
}

// ─── PlaylistError ────────────────────────────────────────────────────────────

export interface PlaylistError {
  code:    PlaylistErrorCode;
  message: string;
  cause?:  unknown;
}

export type PlaylistErrorCode =
  | 'EMPTY_QUEUE'              // القائمة فارغة عند محاولة التشغيل
  | 'INDEX_OUT_OF_RANGE'       // الفهرس خارج حدود القائمة
  | 'NO_NEXT'                  // لا يوجد عنصر تالٍ
  | 'NO_PREVIOUS'              // لا يوجد عنصر سابق
  | 'PLAY_FAILED'              // فشل التشغيل عبر AudioController
  | 'INVALID_ITEM'             // عنصر غير صالح (id أو uri فارغ)
  | 'PLAYLIST_DISPOSED'        // PlaylistManager تم التخلص منه
  | 'MOVE_FAILED'              // فشل تحريك العنصر
  | 'TRANSITION_IN_PROGRESS';  // عملية انتقال جارية — الطلب رُفض بسبب Lock

// ─── PlaylistEventType ────────────────────────────────────────────────────────

/**
 * أنواع الأحداث التي تُصدرها طبقة Playlist.
 *
 *   queue:changed    ← تغيّرت قائمة التشغيل (إضافة / حذف / ترتيب)
 *   track:changed    ← تغيّر المسار الحالي (play / next / previous)
 *   state:changed    ← تغيّرت حالة PlaylistState
 *   playlist:ended   ← انتهى آخر مسار ولا يوجد تالٍ
 *   playback:error   ← خطأ أثناء التشغيل
 */
export type PlaylistEventType =
  | 'queue:changed'
  | 'track:changed'
  | 'state:changed'
  | 'playlist:ended'
  | 'playback:error';

// ─── PlaylistEvent ────────────────────────────────────────────────────────────

export interface PlaylistEvent<TPayload = unknown> {
  type:      PlaylistEventType;
  payload:   TPayload;
  timestamp: number;
}

export type PlaylistListener<TPayload = unknown> =
  (event: PlaylistEvent<TPayload>) => void;

export type PlaylistUnsubscribe = () => void;

// ─── Event Payloads ───────────────────────────────────────────────────────────

/** حمولة حدث state:changed */
export interface PlaylistStateChangedPayload {
  previousState: PlaylistState;
  currentState:  PlaylistState;
}

/** حمولة حدث track:changed */
export interface PlaylistTrackChangedPayload {
  previousIndex: number;
  currentIndex:  number;
  item:          PlaylistItem | null;
}

/** حمولة حدث queue:changed */
export interface PlaylistQueueChangedPayload {
  queue:      readonly PlaylistItem[];
  totalCount: number;
}

/** حمولة حدث playback:error */
export interface PlaylistErrorPayload {
  error: PlaylistError;
}
