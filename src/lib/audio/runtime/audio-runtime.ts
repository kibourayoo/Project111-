/**
 * audio-runtime.ts
 * طبقة تشغيل الصوت — Audio Runtime Layer
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * AudioRuntime هي الواجهة الوحيدة التي تستخدمها واجهة التطبيق لتشغيل الصوت.
 * تُغلّف expo-audio وتُخفي تفاصيله خلف API موحد وآمن.
 *
 * ─── ما تعتمد عليه ───────────────────────────────────────────────────────────
 *   expo-audio (createAudioPlayer, AudioPlayer, AudioStatus) فقط
 *
 * ─── ما لا تلمسه مطلقاً ──────────────────────────────────────────────────────
 *   FileSystem         ← لا يوجد أي وصول مباشر
 *   AudioStorage       ← لا يوجد أي استيراد
 *   DownloadManager    ← لا يوجد أي استيراد
 *   PackageManager     ← لا يوجد أي استيراد
 *   React / Hooks      ← لا يوجد أي استيراد
 *   UI / Navigation    ← لا يوجد أي استيراد
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   load(uri)       ← تحميل ملف صوتي من مسار محلي أو URL
 *   play()          ← بدء التشغيل
 *   pause()         ← إيقاف مؤقت
 *   resume()        ← استئناف من موضع الإيقاف
 *   stop()          ← إيقاف كامل وإعادة للبداية
 *   seek(s)         ← الانتقال لموضع بالثواني
 *   setRate(r)      ← تغيير سرعة التشغيل (0.1–2.0)
 *   setVolume(v)    ← تغيير مستوى الصوت (0.0–1.0)
 *   getState()      ← قراءة حالة التشغيل الحالية
 *   getStatus()     ← قراءة لقطة شاملة للحالة
 *   on(type, fn)    ← الاشتراك في حدث، يُعيد دالة إلغاء
 *   off(type, fn)   ← إلغاء اشتراك يدوي
 *   dispose()       ← تحرير الموارد
 */

import { createAudioPlayer }                        from 'expo-audio';
import type { AudioPlayer, AudioEvents, AudioStatus } from 'expo-audio';

import type {
  AudioPlaybackState,
  AudioRuntimeStatus,
  AudioRuntimeResult,
  AudioRuntimeError,
  AudioRuntimeErrorCode,
  AudioRuntimeEventType,
  AudioRuntimeEvent,
  AudioRuntimeListener,
  AudioRuntimeUnsubscribe,
  PlaybackProgressPayload,
  StateChangedPayload,
  PlaybackErrorPayload,
} from './audio-runtime-types';

// ─── حدود القيم المقبولة ──────────────────────────────────────────────────────

const RATE_MIN   = 0.1;
const RATE_MAX   = 2.0;
const VOLUME_MIN = 0.0;
const VOLUME_MAX = 1.0;

/** فترة التحديث الافتراضية بالـ ms لأحداث playback:progress */
const DEFAULT_UPDATE_INTERVAL_MS = 500;

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok<T>(data: T, message: string): AudioRuntimeResult<T> {
  return { success: true, data, message };
}

function ok0(message: string): AudioRuntimeResult<void> {
  return { success: true, message };
}

function fail<T = void>(
  code:    AudioRuntimeErrorCode,
  message: string,
  cause?:  unknown,
): AudioRuntimeResult<T> {
  const error: AudioRuntimeError = { code, message, cause };
  return { success: false, message, error };
}

// ─── AudioRuntime ─────────────────────────────────────────────────────────────

export class AudioRuntime {

  // ── الحالة الداخلية ─────────────────────────────────────────────────────────

  private _player:       AudioPlayer | null           = null;
  private _state:        AudioPlaybackState            = 'IDLE';
  private _uri:          string | null                 = null;
  private _subscription: { remove(): void } | null     = null;

  /** خريطة المستمعين: نوع الحدث → مجموعة دوال الاستماع */
  private readonly _listeners = new Map<
    AudioRuntimeEventType,
    Set<AudioRuntimeListener<unknown>>
  >();

  // ── load ────────────────────────────────────────────────────────────────────

  /**
   * يُحمّل ملفاً صوتياً من URI محلي أو رابط.
   * إذا كان يوجد ملف محمَّل سابقاً، يُتخلَّص منه أولاً.
   *
   * @param uri مسار ملف صوتي محلي (file://) أو رابط HTTPS
   */
  async load(uri: string): Promise<AudioRuntimeResult<void>> {
    try {
      // 1. تنظيف المشغّل السابق إن وجد
      if (this._player) {
        await this._releasePlayer();
      }

      // 2. تحديث الحالة لـ LOADING
      this._transition('LOADING');
      this._uri = uri;

      // 3. إنشاء مشغّل جديد
      this._player = createAudioPlayer(
        { uri },
        { updateInterval: DEFAULT_UPDATE_INTERVAL_MS },
      );

      // 4. الاشتراك في أحداث expo-audio
      // cast مطلوب: TypeScript لا يتتبع سلسلة الوراثة SharedObject→EventEmitter
      // عبر مسار pnpm العميق، لكن addListener موجود وقت التشغيل.
      type PlayerWithListener = {
        addListener(
          event: keyof AudioEvents,
          listener: (status: AudioStatus) => void,
        ): { remove(): void };
      };
      this._subscription = (this._player as unknown as PlayerWithListener).addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => this._onStatusUpdate(status),
      );

      this._transition('READY');
      return ok0(`تم تحميل الملف الصوتي: ${uri}`);
    } catch (err) {
      this._transition('ERROR');
      this._emitError('LOAD_FAILED', `فشل تحميل الملف الصوتي: ${uri}`, err);
      return fail('LOAD_FAILED', `فشل تحميل الملف الصوتي: ${uri}`, err);
    }
  }

  // ── play ────────────────────────────────────────────────────────────────────

  /**
   * يبدأ تشغيل الملف الصوتي المحمَّل.
   * يجب استدعاء load() أولاً.
   */
  play(): AudioRuntimeResult<void> {
    const check = this._requirePlayer('play');
    if (check) return check;

    try {
      this._player!.play();
      this._transition('PLAYING');
      this._emit('playback:started', undefined);
      return ok0('بدأ تشغيل الصوت');
    } catch (err) {
      this._transition('ERROR');
      this._emitError('PLAYBACK_FAILED', 'فشل بدء التشغيل', err);
      return fail('PLAYBACK_FAILED', 'فشل بدء التشغيل', err);
    }
  }

  // ── pause ───────────────────────────────────────────────────────────────────

  /**
   * يوقف التشغيل مؤقتاً مع الاحتفاظ بالموضع الحالي.
   */
  pause(): AudioRuntimeResult<void> {
    const check = this._requirePlayer('pause');
    if (check) return check;

    try {
      this._player!.pause();
      this._transition('PAUSED');
      this._emit('playback:paused', undefined);
      return ok0('تم الإيقاف المؤقت');
    } catch (err) {
      return fail('PLAYBACK_FAILED', 'فشل الإيقاف المؤقت', err);
    }
  }

  // ── resume ──────────────────────────────────────────────────────────────────

  /**
   * يستأنف التشغيل من موضع الإيقاف المؤقت.
   */
  resume(): AudioRuntimeResult<void> {
    const check = this._requirePlayer('resume');
    if (check) return check;

    try {
      this._player!.play();
      this._transition('PLAYING');
      this._emit('playback:resumed', undefined);
      return ok0('استُؤنف التشغيل');
    } catch (err) {
      this._transition('ERROR');
      this._emitError('PLAYBACK_FAILED', 'فشل استئناف التشغيل', err);
      return fail('PLAYBACK_FAILED', 'فشل استئناف التشغيل', err);
    }
  }

  // ── stop ────────────────────────────────────────────────────────────────────

  /**
   * يوقف التشغيل ويُعيد الموضع إلى البداية (0).
   */
  async stop(): Promise<AudioRuntimeResult<void>> {
    const check = this._requirePlayer('stop');
    if (check) return check;

    try {
      this._player!.pause();
      await this._player!.seekTo(0);
      this._transition('STOPPED');
      this._emit('playback:stopped', undefined);
      return ok0('تم إيقاف التشغيل والعودة للبداية');
    } catch (err) {
      return fail('PLAYBACK_FAILED', 'فشل إيقاف التشغيل', err);
    }
  }

  // ── seek ────────────────────────────────────────────────────────────────────

  /**
   * ينتقل إلى موضع محدد بالثواني.
   * @param positionSeconds الموضع المطلوب (≥ 0 وأقل من المدة الكلية)
   */
  async seek(positionSeconds: number): Promise<AudioRuntimeResult<void>> {
    const check = this._requirePlayer('seek');
    if (check) return check;

    if (positionSeconds < 0) {
      return fail(
        'SEEK_OUT_OF_RANGE',
        `الموضع المطلوب سالب: ${positionSeconds}`,
      );
    }

    const duration = this._player!.duration ?? 0;
    if (duration > 0 && positionSeconds > duration) {
      return fail(
        'SEEK_OUT_OF_RANGE',
        `الموضع ${positionSeconds}s يتجاوز المدة الكلية ${duration}s`,
      );
    }

    try {
      await this._player!.seekTo(positionSeconds);
      return ok0(`تم الانتقال إلى ${positionSeconds}s`);
    } catch (err) {
      return fail('PLAYBACK_FAILED', `فشل الانتقال إلى ${positionSeconds}s`, err);
    }
  }

  // ── setRate ─────────────────────────────────────────────────────────────────

  /**
   * يضبط سرعة التشغيل.
   * @param rate النطاق المقبول: 0.1 – 2.0 (1.0 = سرعة طبيعية)
   */
  setRate(rate: number): AudioRuntimeResult<void> {
    const check = this._requirePlayer('setRate');
    if (check) return check;

    if (rate < RATE_MIN || rate > RATE_MAX) {
      return fail(
        'INVALID_RATE',
        `معدل التشغيل ${rate} خارج النطاق المسموح (${RATE_MIN}–${RATE_MAX})`,
      );
    }

    try {
      this._player!.setPlaybackRate(rate);
      return ok0(`تم ضبط معدل التشغيل على ${rate}x`);
    } catch (err) {
      return fail('PLAYBACK_FAILED', `فشل ضبط معدل التشغيل`, err);
    }
  }

  // ── setVolume ───────────────────────────────────────────────────────────────

  /**
   * يضبط مستوى الصوت.
   * @param volume النطاق المقبول: 0.0 (صامت) – 1.0 (أقصى صوت)
   */
  setVolume(volume: number): AudioRuntimeResult<void> {
    const check = this._requirePlayer('setVolume');
    if (check) return check;

    if (volume < VOLUME_MIN || volume > VOLUME_MAX) {
      return fail(
        'INVALID_VOLUME',
        `مستوى الصوت ${volume} خارج النطاق المسموح (${VOLUME_MIN}–${VOLUME_MAX})`,
      );
    }

    try {
      this._player!.volume = volume;
      return ok0(`تم ضبط مستوى الصوت على ${volume}`);
    } catch (err) {
      return fail('PLAYBACK_FAILED', 'فشل ضبط مستوى الصوت', err);
    }
  }

  // ── getState ────────────────────────────────────────────────────────────────

  /**
   * يُعيد حالة التشغيل الحالية.
   */
  getState(): AudioPlaybackState {
    return this._state;
  }

  // ── getStatus ───────────────────────────────────────────────────────────────

  /**
   * يُعيد لقطة شاملة لحالة التشغيل الحالية.
   */
  getStatus(): AudioRuntimeStatus {
    const player = this._player;
    return {
      state:       this._state,
      currentTime: player?.currentTime   ?? 0,
      duration:    player?.duration      ?? 0,
      rate:        player?.playbackRate  ?? 1.0,
      volume:      player?.volume        ?? 1.0,
      isLoaded:    player?.isLoaded      ?? false,
      isBuffering: player?.isBuffering   ?? false,
      uri:         this._uri,
    };
  }

  // ── on ──────────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لنوع حدث محدد.
   * @returns دالة إلغاء الاشتراك — استدعِها لإيقاف الاستماع
   */
  on<TPayload = unknown>(
    type:     AudioRuntimeEventType,
    listener: AudioRuntimeListener<TPayload>,
  ): AudioRuntimeUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener as AudioRuntimeListener<unknown>);

    return () => {
      this._listeners.get(type)?.delete(listener as AudioRuntimeListener<unknown>);
    };
  }

  // ── off ─────────────────────────────────────────────────────────────────────

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     AudioRuntimeEventType,
    listener: AudioRuntimeListener<TPayload>,
  ): void {
    this._listeners.get(type)?.delete(listener as AudioRuntimeListener<unknown>);
  }

  // ── dispose ─────────────────────────────────────────────────────────────────

  /**
   * يُحرّر جميع الموارد (المشغّل، الاشتراكات، المستمعون).
   * يجب استدعاؤه عند عدم الحاجة للـ Runtime مجدداً.
   */
  async dispose(): Promise<void> {
    try {
      await this._releasePlayer();
    } catch {
      // نتجاهل أخطاء التنظيف — الهدف تحرير الموارد بقدر الإمكان
    } finally {
      this._listeners.clear();
      this._uri   = null;
      this._state = 'IDLE';
    }
  }

  // ── الأساليب الداخلية (Private) ─────────────────────────────────────────────

  /**
   * يُحرّر المشغّل الحالي ويُلغي الاشتراكات المرتبطة به.
   */
  private async _releasePlayer(): Promise<void> {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
    if (this._player) {
      try {
        this._player.remove();
      } catch {
        // تجاهل أخطاء remove
      }
      this._player = null;
    }
  }

  /**
   * يُغيّر الحالة الداخلية ويُصدر حدث `state:changed` إذا تغيّرت فعلاً.
   */
  private _transition(next: AudioPlaybackState): void {
    if (this._state === next) return;

    const payload: StateChangedPayload = {
      previousState: this._state,
      currentState:  next,
    };
    this._state = next;
    this._emit<StateChangedPayload>('state:changed', payload);
  }

  /**
   * يُعالج أحداث `playbackStatusUpdate` القادمة من expo-audio.
   */
  private _onStatusUpdate(status: AudioEvents['playbackStatusUpdate'] extends (s: infer S) => void ? S : never): void {
    // تحديث الحالة الداخلية بناءً على expo-audio
    if (status.didJustFinish) {
      this._transition('ENDED');
      this._emit('playback:ended', undefined);
      return;
    }

    if (status.playing && this._state !== 'PLAYING') {
      this._transition('PLAYING');
    } else if (!status.playing && status.isLoaded && this._state === 'PLAYING') {
      this._transition('PAUSED');
    }

    // إصدار حدث التقدم الدوري
    const progressPayload: PlaybackProgressPayload = {
      currentTime: status.currentTime,
      duration:    status.duration,
      state:       this._state,
    };
    this._emit<PlaybackProgressPayload>('playback:progress', progressPayload);
  }

  /**
   * يُصدر حدثاً لجميع المستمعين المسجَّلين على هذا النوع.
   */
  private _emit<TPayload = unknown>(
    type:     AudioRuntimeEventType,
    payload:  TPayload,
  ): void {
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    const event: AudioRuntimeEvent<TPayload> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      try {
        (listener as AudioRuntimeListener<TPayload>)(event);
      } catch {
        // عزل أخطاء المستمعين لمنع تعطّل Runtime
      }
    }
  }

  /**
   * يُصدر حدث `playback:error` ويُلف الخطأ في البنية الموحدة.
   */
  private _emitError(
    code:    AudioRuntimeErrorCode,
    message: string,
    cause?:  unknown,
  ): void {
    const payload: PlaybackErrorPayload = {
      error: { code, message, cause },
    };
    this._emit<PlaybackErrorPayload>('playback:error', payload);
  }

  /**
   * يتحقق من وجود مشغّل نشط، ويُعيد خطأ موحداً إذا لم يوجد.
   * @returns null إذا كان المشغّل موجوداً، أو AudioRuntimeResult<void> يحتوي الخطأ
   */
  private _requirePlayer(operation: string): AudioRuntimeResult<void> | null {
    if (this._player && this._uri) return null;
    return fail(
      'NOT_LOADED',
      `لا يمكن تنفيذ "${operation}" — لم يُحمَّل أي ملف صوتي بعد. استدعِ load() أولاً.`,
    );
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────

/**
 * النسخة الوحيدة من AudioRuntime للتطبيق بأكمله.
 * واجهة التطبيق تستخدم هذه النسخة دائماً.
 */
export const audioRuntime = new AudioRuntime();
