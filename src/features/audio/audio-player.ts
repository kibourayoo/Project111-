/**
 * src/features/audio/audio-player.ts
 *
 * Application Integration Layer — AudioPlayer
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * AudioPlayer هو الوسيط الوحيد بين شاشات التطبيق ومكتبة الصوت.
 *
 * الشاشات تتعامل مع AudioPlayer فقط ولا تعرف شيئاً عن:
 *   AudioService / PlaylistManager / AudioController / Runtime / Session
 *
 * ─── ما يعتمد عليه ───────────────────────────────────────────────────────────
 *   audioService ← الطبقة الوحيدة التي يستدعيها AudioPlayer
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   playSurah(surah)              ← تشغيل سورة واحدة
 *   playSurahList(surahs, start?) ← تشغيل قائمة سور
 *   pause()                       ← إيقاف مؤقت
 *   resume()                      ← استكمال التشغيل
 *   stop()                        ← إيقاف (يحتفظ بالقائمة)
 *   next()                        ← السورة التالية
 *   previous()                    ← السورة السابقة
 *   getStatus()                   ← لقطة كاملة بأنواع التطبيق
 *   getCurrentSurah()             ← السورة الحالية أو null
 *   on(type, listener)            ← الاشتراك في حدث
 *   off(type, listener)           ← إلغاء الاشتراك
 */

import { audioService } from '../../lib/audio/service';

import type { AudioServiceResult }    from '../../lib/audio/service';
import type {
  AudioServiceEvent,
  AudioServiceEventType,
  AudioServiceStatus,
  AudioTrack,
} from '../../lib/audio/service';

// الأنواع الداخلية للأحداث الواردة من AudioService
import type {
  PlaylistStateChangedPayload,
  PlaylistTrackChangedPayload,
  PlaylistQueueChangedPayload,
  PlaylistErrorPayload,
} from '../../lib/audio/playlist/playlist-types';

import type {
  SurahTrack,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioPlayerResult,
  AudioPlayerEventType,
  AudioPlayerListener,
  AudioPlayerUnsubscribe,
  SurahChangedPayload,
  ListChangedPayload,
  PlayerStateChangedPayload,
  PlayerErrorPayload,
} from './audio-player-types';

// ─── تحويل الأنواع ────────────────────────────────────────────────────────────

/** يحوّل SurahTrack → AudioTrack للتمرير لـ AudioService */
function toAudioTrack(surah: SurahTrack): AudioTrack {
  return {
    id:             surah.id,
    uri:            surah.uri,
    title:          surah.title,
    durationSeconds: surah.durationSeconds,
  };
}

/** يحوّل AudioServiceState → AudioPlayerState */
function mapState(serviceState: string): AudioPlayerState {
  switch (serviceState) {
    case 'PLAYING': return 'PLAYING';
    case 'PAUSED':  return 'PAUSED';
    case 'ENDED':   return 'ENDED';
    default:        return 'IDLE'; // EMPTY + READY = IDLE للشاشات
  }
}

/** يحوّل AudioServiceResult → AudioPlayerResult */
function toPlayerResult<T = void>(r: AudioServiceResult<T>): AudioPlayerResult<T> {
  return {
    success: r.success,
    data:    r.data,
    message: r.message,
    error:   r.error?.message,
  };
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

export class AudioPlayer {

  /** خريطة id السورة → SurahTrack للقائمة الحالية */
  private _surahMap = new Map<string, SurahTrack>();

  /** مستمعو أحداث التطبيق */
  private readonly _listeners = new Map<
    AudioPlayerEventType,
    Set<AudioPlayerListener<unknown>>
  >();

  /** دوال إلغاء الاشتراك في أحداث AudioService */
  private readonly _serviceSubs: Array<() => void> = [];

  constructor() {
    this._subscribeToService();
  }

  // ── التشغيل ─────────────────────────────────────────────────────────────────

  /**
   * يشغّل سورة واحدة.
   * يستبدل القائمة الحالية بعنصر واحد.
   */
  async playSurah(surah: SurahTrack): Promise<AudioPlayerResult> {
    this._surahMap.clear();
    this._surahMap.set(surah.id, surah);

    const result = await audioService.playSingle(toAudioTrack(surah));
    return toPlayerResult(result);
  }

  /**
   * يشغّل قائمة سور.
   * يبدأ من startIndex (الافتراضي: 0).
   */
  async playSurahList(
    surahs:     SurahTrack[],
    startIndex: number = 0,
  ): Promise<AudioPlayerResult> {
    this._surahMap.clear();
    for (const s of surahs) {
      this._surahMap.set(s.id, s);
    }

    const result = await audioService.playPlaylist({
      items:      surahs.map(toAudioTrack),
      startIndex,
    });
    return toPlayerResult(result);
  }

  // ── التحكم ──────────────────────────────────────────────────────────────────

  /** يوقف التشغيل مؤقتاً مع الاحتفاظ بالموضع */
  pause(): AudioPlayerResult {
    return toPlayerResult(audioService.pause());
  }

  /** يستكمل التشغيل من نقطة الإيقاف */
  resume(): AudioPlayerResult {
    return toPlayerResult(audioService.resume());
  }

  /** يوقف التشغيل مع الاحتفاظ بالقائمة */
  async stop(): Promise<AudioPlayerResult> {
    return toPlayerResult(await audioService.stop());
  }

  /** ينتقل للسورة التالية ويشغّلها */
  async next(): Promise<AudioPlayerResult> {
    return toPlayerResult(await audioService.next());
  }

  /** ينتقل للسورة السابقة ويشغّلها */
  async previous(): Promise<AudioPlayerResult> {
    return toPlayerResult(await audioService.previous());
  }

  // ── القراءة ─────────────────────────────────────────────────────────────────

  /**
   * يُعيد لقطة كاملة لحالة المشغّل بأنواع التطبيق.
   */
  getStatus(): AudioPlayerStatus {
    const s = audioService.getStatus();
    return this._toPlayerStatus(s);
  }

  /**
   * يُعيد السورة الحالية أو null إذا لم يكن هناك تشغيل.
   */
  getCurrentSurah(): SurahTrack | null {
    const current = audioService.getCurrent();
    if (!current) return null;
    return this._lookupSurah(current);
  }

  // ── الأحداث ─────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لحدث محدد.
   * @returns دالة إلغاء الاشتراك
   */
  on<TPayload = unknown>(
    type:     AudioPlayerEventType,
    listener: AudioPlayerListener<TPayload>,
  ): AudioPlayerUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener as AudioPlayerListener<unknown>);

    return () => this.off(type, listener);
  }

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     AudioPlayerEventType,
    listener: AudioPlayerListener<TPayload>,
  ): void {
    this._listeners.get(type)?.delete(listener as AudioPlayerListener<unknown>);
  }

  // ── الأساليب الداخلية ────────────────────────────────────────────────────────

  /**
   * يشترك في أحداث AudioService ويُترجمها لأحداث AudioPlayer.
   * يُستدعى مرة واحدة في الـ constructor.
   */
  private _subscribeToService(): void {

    // ── state:changed ─────────────────────────────────────────────────────────
    const unsubState = audioService.on<PlaylistStateChangedPayload>(
      'state:changed',
      (event: AudioServiceEvent<PlaylistStateChangedPayload>) => {
        const payload = event.payload;
        const p: PlayerStateChangedPayload = {
          previousState: mapState(payload.previousState),
          currentState:  mapState(payload.currentState),
        };
        this._emit<PlayerStateChangedPayload>('state:changed', p);
      },
    );

    // ── track:changed → surah:changed ────────────────────────────────────────
    const unsubTrack = audioService.on<PlaylistTrackChangedPayload>(
      'track:changed',
      (event: AudioServiceEvent<PlaylistTrackChangedPayload>) => {
        const payload = event.payload;
        const p: SurahChangedPayload = {
          previousIndex: payload.previousIndex,
          currentIndex:  payload.currentIndex,
          surah:         payload.item ? this._lookupSurah(payload.item) : null,
        };
        this._emit<SurahChangedPayload>('surah:changed', p);
      },
    );

    // ── queue:changed → list:changed ─────────────────────────────────────────
    const unsubQueue = audioService.on<PlaylistQueueChangedPayload>(
      'queue:changed',
      (event: AudioServiceEvent<PlaylistQueueChangedPayload>) => {
        const payload = event.payload;
        const surahs  = payload.queue.map((t) => this._lookupSurah(t));
        const p: ListChangedPayload = {
          surahs:     surahs,
          totalCount: payload.totalCount,
        };
        this._emit<ListChangedPayload>('list:changed', p);
      },
    );

    // ── playlist:ended → list:ended ───────────────────────────────────────────
    const unsubEnded = audioService.on<undefined>(
      'playlist:ended',
      (_event: AudioServiceEvent<undefined>) => {
        this._emit<undefined>('list:ended', undefined);
      },
    );

    // ── playback:error ────────────────────────────────────────────────────────
    const unsubError = audioService.on<PlaylistErrorPayload>(
      'playback:error',
      (event: AudioServiceEvent<PlaylistErrorPayload>) => {
        const p: PlayerErrorPayload = {
          message: event.payload.error.message,
          code:    event.payload.error.code,
        };
        this._emit<PlayerErrorPayload>('playback:error', p);
      },
    );

    this._serviceSubs.push(
      unsubState, unsubTrack, unsubQueue, unsubEnded, unsubError,
    );
  }

  /**
   * يُرسل حدثاً لجميع المستمعين المسجَّلين على هذا النوع.
   */
  private _emit<TPayload = unknown>(
    type:    AudioPlayerEventType,
    payload: TPayload,
  ): void {
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch {
        // تجاهل أخطاء المستمعين لمنع تأثيرها على بقية القائمة
      }
    }
  }

  /**
   * يبحث عن SurahTrack في الخريطة بمعرّف Track.
   * إذا لم يوجد في الخريطة، يبني SurahTrack مبسّطاً من AudioTrack.
   */
  private _lookupSurah(track: AudioTrack): SurahTrack {
    const found = this._surahMap.get(track.id);
    if (found) return found;

    // fallback: بناء SurahTrack مبسّط من بيانات AudioTrack
    return {
      id:             track.id,
      uri:            track.uri,
      surahNumber:    0,
      title:          track.title ?? track.uri,
      durationSeconds: track.durationSeconds,
    };
  }

  /**
   * يحوّل AudioServiceStatus → AudioPlayerStatus باستخدام خريطة السور.
   */
  private _toPlayerStatus(s: AudioServiceStatus): AudioPlayerStatus {
    const state       = mapState(s.state);
    const currentSurah = s.current ? this._lookupSurah(s.current) : null;
    const surahList   = s.queue.map((t) => this._lookupSurah(t));

    return {
      state,
      currentSurah,
      surahList,
      currentIndex: s.currentIndex,
      hasNext:      s.hasNext,
      hasPrevious:  s.hasPrevious,
      totalCount:   s.totalCount,
      currentTime:  s.currentTime,
      duration:     s.duration,
      isBuffering:  s.isBuffering,
      isPlaying:    state === 'PLAYING',
      isPaused:     state === 'PAUSED',
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const audioPlayer = new AudioPlayer();
