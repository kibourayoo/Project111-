/**
 * src/lib/audio/service/audio-service-types.ts
 *
 * أنواع طبقة AudioService — الواجهة العامة لبقية التطبيق.
 *
 * بقية التطبيق تعرف فقط هذه الأنواع ولا تعرف شيئاً عن:
 *   PlaylistManager / AudioController / AudioRuntime / AudioSession
 */

import type { AudioType } from '../audio-types';
import type {
  PlaylistItem,
  PlaylistState,
  PlaylistResult,
  PlaylistEventType,
  PlaylistEvent,
  PlaylistListener,
  PlaylistUnsubscribe,
} from '../playlist/playlist-types';

// ─── إعادة تصدير بأسماء خاصة بطبقة Service ──────────────────────────────────
// بقية التطبيق تستورد من هنا — لا تعرف المصدر الداخلي

export type AudioTrack           = PlaylistItem;
export type AudioServiceState    = PlaylistState;
export type AudioServiceEventType= PlaylistEventType;
export type AudioServiceEvent<T> = PlaylistEvent<T>;
export type AudioServiceListener<T = unknown> = PlaylistListener<T>;
export type AudioServiceUnsubscribe = PlaylistUnsubscribe;

// ─── AudioServiceResult ───────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات AudioService.
 * نفس نمط PlaylistResult مع تسمية خاصة بطبقة Service.
 */
export type AudioServiceResult<T = void> = PlaylistResult<T>;

// ─── AudioServiceStatus ───────────────────────────────────────────────────────

/**
 * لقطة كاملة لحالة AudioService في أي لحظة.
 * تجمع حالة Playlist مع حالة التشغيل المباشر من Controller.
 */
export interface AudioServiceStatus {
  /** حالة القائمة: EMPTY | READY | PLAYING | PAUSED | ENDED */
  state:        AudioServiceState;
  /** المسار الحالي أو null إذا كانت القائمة فارغة */
  current:      AudioTrack | null;
  /** نسخة للقراءة فقط من قائمة التشغيل */
  queue:        readonly AudioTrack[];
  /** فهرس المسار الحالي (1- إذا كانت القائمة فارغة) */
  currentIndex: number;
  /** هل يوجد مسار تالٍ؟ */
  hasNext:      boolean;
  /** هل يوجد مسار سابق؟ */
  hasPrevious:  boolean;
  /** إجمالي عدد المسارات */
  totalCount:   number;
  /** الموضع الحالي بالثواني (من Controller) */
  currentTime:  number;
  /** المدة الكلية بالثواني (من Controller، 0 إذا لم تُحدَّد) */
  duration:     number;
  /** هل يجري الـ buffering؟ (من Controller) */
  isBuffering:  boolean;
  /** مسار الملف الصوتي الحالي كما يراه Controller (null إذا لم يُحمَّل) */
  uri:          string | null;
}

// ─── SurahPlayOptions ─────────────────────────────────────────────────────────

/**
 * خيارات تشغيل سورة واحدة من حزمة صوتية مُثبَّتة.
 */
export interface SurahPlayOptions {
  /** معرّف الحزمة الصوتية */
  packageId:        string;
  /** نوع الحزمة (quran / ruqyah / ...) */
  packageType:      AudioType;
  /** رقم السورة (1–114) */
  surahNumber:      number;
  /** عنوان السورة للعرض (اختياري) */
  title?:           string;
  /** مدة السورة بالثواني (اختياري) */
  durationSeconds?: number;
}

// ─── PlaylistPlayOptions ──────────────────────────────────────────────────────

/**
 * خيارات تشغيل قائمة تشغيل كاملة.
 */
export interface PlaylistPlayOptions {
  /** عناصر القائمة */
  items:       AudioTrack[];
  /** فهرس البداية (الافتراضي: 0) */
  startIndex?: number;
}
