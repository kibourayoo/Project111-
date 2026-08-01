/**
 * src/features/athan/athan-service.ts
 *
 * AthanService — طبقة منطق الأذان
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * يُترجم عمليات الأذان (تشغيل مؤذّن محدد، إيقاف، استكمال) إلى استدعاءات
 * AudioService. يحتفظ بحالة المؤذّن الحالي ويُخطر المستمعين عند كل تغيير.
 *
 * ─── ما يعتمد عليه ───────────────────────────────────────────────────────────
 *   audioService ← الطبقة الوحيدة التي يستدعيها مباشرة
 *
 * ─── ما لا يعتمد عليه ────────────────────────────────────────────────────────
 *   PlaylistManager / AudioController / Runtime / Session
 *   React / Hooks / Context / State Management
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   play(muezzin)         ← تشغيل أذان مؤذّن محدد
 *   pause()               ← إيقاف مؤقت
 *   resume()              ← استكمال التشغيل
 *   stop()                ← إيقاف التشغيل
 *   selectMuezzin(m)      ← تحديد مؤذّن بدون تشغيل فوري
 *   getStatus()           ← لقطة فورية لحالة المشغّل
 *   onStatusChange(cb)    ← الاشتراك في تغييرات الحالة
 */

import { audioService }   from '../../lib/audio/service';

import type {
  AudioServiceEvent,
  AudioServiceStatus,
} from '../../lib/audio/service';

import type {
  PlaylistStateChangedPayload,
  PlaylistErrorPayload,
} from '../../lib/audio/playlist/playlist-types';

import type {
  Muezzin,
  AthanPlayerState,
  AthanPlayerStatus,
  AthanPlayerResult,
  AthanStatusCallback,
  AthanUnsubscribe,
} from './athan-types';

// ─── تحويل الحالة ────────────────────────────────────────────────────────────

/** يحوّل AudioServiceState → AthanPlayerState */
function mapState(serviceState: string): AthanPlayerState {
  switch (serviceState) {
    case 'PLAYING': return 'PLAYING';
    case 'PAUSED':  return 'PAUSED';
    case 'ENDED':   return 'ENDED';
    default:        return 'IDLE';
  }
}

/** يبني AthanPlayerStatus من AudioServiceStatus + المؤذّن الحالي + خطأ اختياري */
function buildStatus(
  s:         AudioServiceStatus,
  muezzin:   Muezzin | null,
  errorMsg:  string | null,
  forceState?: AthanPlayerState,
): AthanPlayerStatus {
  const state = forceState ?? (errorMsg ? 'ERROR' : mapState(s.state));
  return {
    state,
    currentMuezzin: muezzin,
    currentTime:    s.currentTime,
    duration:       s.duration,
    isBuffering:    s.isBuffering,
    isPlaying:      state === 'PLAYING',
    isPaused:       state === 'PAUSED',
    error:          errorMsg,
  };
}

// ─── AthanService ─────────────────────────────────────────────────────────────

class AthanService {

  /** المؤذّن الحالي (المُحدَّد أو الذي يُشغَّل) */
  private _currentMuezzin: Muezzin | null = null;

  /** آخر رسالة خطأ */
  private _lastError: string | null = null;

  /** مجموعة callbacks للإخطار عند تغيير الحالة */
  private readonly _callbacks = new Set<AthanStatusCallback>();

  /** دوال إلغاء الاشتراك في AudioService */
  private readonly _serviceSubs: Array<() => void> = [];

  constructor() {
    this._subscribeToService();
  }

  // ── التشغيل ──────────────────────────────────────────────────────────────────

  /**
   * يشغّل أذان مؤذّن محدد.
   * يُوقف أي تشغيل سابق تلقائياً (عبر playSingle داخل AudioService).
   */
  async play(muezzin: Muezzin): Promise<AthanPlayerResult> {
    if (!muezzin.uri) {
      const msg = `ملف الصوت غير متاح حالياً للمؤذّن: ${muezzin.name}`;
      this._currentMuezzin = muezzin;
      this._lastError      = msg;
      this._notify();
      return { success: false, message: msg, error: msg };
    }

    this._currentMuezzin = muezzin;
    this._lastError      = null;

    const result = await audioService.playSingle({
      id:    muezzin.id,
      uri:   muezzin.uri,
      title: muezzin.name,
    });

    if (!result.success) {
      this._lastError = result.error?.message ?? result.message;
      this._notify();
      return {
        success: false,
        message: result.message,
        error:   this._lastError ?? undefined,
      };
    }

    return { success: true, message: result.message };
  }

  /** يوقف التشغيل مؤقتاً */
  pause(): AthanPlayerResult {
    const result = audioService.pause();
    if (!result.success) {
      return { success: false, message: result.message, error: result.error?.message };
    }
    return { success: true, message: result.message };
  }

  /** يستكمل التشغيل من نقطة الإيقاف */
  resume(): AthanPlayerResult {
    const result = audioService.resume();
    if (!result.success) {
      return { success: false, message: result.message, error: result.error?.message };
    }
    return { success: true, message: result.message };
  }

  /** يوقف التشغيل نهائياً */
  async stop(): Promise<AthanPlayerResult> {
    const result = await audioService.stop();
    if (!result.success) {
      return { success: false, message: result.message, error: result.error?.message };
    }
    return { success: true, message: result.message };
  }

  // ── الاختيار ─────────────────────────────────────────────────────────────────

  /**
   * يُحدّد مؤذّناً بدون تشغيل فوري.
   * إذا كان هناك تشغيل جارٍ، يوقفه أولاً.
   */
  async selectMuezzin(muezzin: Muezzin): Promise<void> {
    const current = audioService.getStatus();
    if (current.state === 'PLAYING' || current.state === 'PAUSED') {
      await audioService.stop();
    }
    this._currentMuezzin = muezzin;
    this._lastError      = null;
    this._notify();
  }

  // ── القراءة ──────────────────────────────────────────────────────────────────

  /** يُعيد لقطة فورية لحالة المشغّل */
  getStatus(): AthanPlayerStatus {
    return buildStatus(
      audioService.getStatus(),
      this._currentMuezzin,
      this._lastError,
    );
  }

  // ── الاشتراك ─────────────────────────────────────────────────────────────────

  /**
   * يُسجّل callback يُستدعى عند كل تغيير في حالة المشغّل.
   * @returns دالة إلغاء الاشتراك
   */
  onStatusChange(callback: AthanStatusCallback): AthanUnsubscribe {
    this._callbacks.add(callback);
    return () => {
      this._callbacks.delete(callback);
    };
  }

  // ── الأساليب الداخلية ─────────────────────────────────────────────────────────

  /**
   * يشترك في أحداث AudioService المطلوبة.
   * يُستدعى مرة واحدة في الـ constructor.
   */
  private _subscribeToService(): void {

    // state:changed → يُخطر المستمعين بالحالة الجديدة
    const unsubState = audioService.on<PlaylistStateChangedPayload>(
      'state:changed',
      (_event: AudioServiceEvent<PlaylistStateChangedPayload>) => {
        this._lastError = null;
        this._notify();
      },
    );

    // playback:error → يُحدّث الخطأ ويُخطر المستمعين
    const unsubError = audioService.on<PlaylistErrorPayload>(
      'playback:error',
      (event: AudioServiceEvent<PlaylistErrorPayload>) => {
        this._lastError = event.payload.error.message;
        this._notify();
      },
    );

    this._serviceSubs.push(unsubState, unsubError);
  }

  /** يُرسل الحالة الحالية لجميع المستمعين المسجَّلين */
  private _notify(): void {
    if (this._callbacks.size === 0) return;

    const status = this.getStatus();
    for (const cb of this._callbacks) {
      try {
        cb(status);
      } catch {
        // تجاهل أخطاء المستمعين لمنع تأثيرها على البقية
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const athanService = new AthanService();
