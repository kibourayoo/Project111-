/**
 * audio-controller.ts
 * طبقة التنسيق — Audio Controller Layer
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * AudioController هو نقطة الدخول الوحيدة لمنظومة الصوت.
 * يُنسّق بين AudioSession وAudioRuntime دون أن تعرف إحداهما الأخرى.
 *
 * ─── ما يعتمد عليه ───────────────────────────────────────────────────────────
 *   audioSession (singleton) ← من طبقة Session
 *   audioRuntime (singleton) ← من طبقة Runtime
 *
 * ─── ما لا يلمسه مطلقاً ──────────────────────────────────────────────────────
 *   expo-audio مباشرة  ← لا يوجد أي استيراد
 *   FileSystem         ← لا يوجد أي استيراد
 *   AudioStorage       ← لا يوجد أي استيراد
 *   DownloadManager    ← لا يوجد أي استيراد
 *   PackageManager     ← لا يوجد أي استيراد
 *   React / Hooks      ← لا يوجد أي استيراد
 *   UI / Navigation    ← لا يوجد أي استيراد
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   activateSession()    ← تفعيل جلسة الصوت عبر Session
 *   deactivateSession()  ← إيقاف جلسة الصوت
 *   load(uri)            ← تحميل ملف صوتي (يُفعّل Session تلقائياً)
 *   play(uri?)           ← تشغيل (مع تحميل إن أُعطي URI)
 *   pause()              ← إيقاف مؤقت
 *   resume()             ← استئناف التشغيل
 *   stop()               ← إيقاف كامل (يحتفظ بالجلسة)
 *   seek(s)              ← الانتقال لموضع بالثواني
 *   setRate(r)           ← تغيير سرعة التشغيل
 *   setVolume(v)         ← تغيير مستوى الصوت
 *   getStatus()          ← لقطة شاملة تجمع Runtime + Session
 *   on(type, fn)         ← الاشتراك في حدث
 *   off(type, fn)        ← إلغاء اشتراك
 *   dispose()            ← تحرير كل الموارد + إيقاف Session
 *
 * ─── تدفق play() ─────────────────────────────────────────────────────────────
 *   1. هل الجلسة مفعَّلة؟ → إذا لا: activateSession()
 *   2. هل أُعطي URI؟     → إذا نعم: audioRuntime.load(uri)
 *   3. audioRuntime.play()
 *
 * ─── تدفق stop() ─────────────────────────────────────────────────────────────
 *   audioRuntime.stop() فقط — الجلسة تبقى مفعَّلة
 *
 * ─── تدفق dispose() ──────────────────────────────────────────────────────────
 *   audioRuntime.dispose() + audioSession.deactivate() + مسح _listeners
 */

import { audioSession } from '../session';
import { audioRuntime }  from '../runtime';

import type { AudioSession }   from '../session';
import type { AudioRuntime }   from '../runtime';
import type {
  AudioRuntimeEvent,
  PlaybackProgressPayload,
  StateChangedPayload   as RuntimeStateChangedPayload,
  PlaybackErrorPayload  as RuntimeErrorPayload,
} from '../runtime';
import type { AudioSessionEvent } from '../session';

import type {
  AudioControllerState,
  AudioControllerStatus,
  AudioControllerResult,
  AudioControllerError,
  AudioControllerErrorCode,
  AudioControllerEventType,
  AudioControllerEvent,
  AudioControllerListener,
  AudioControllerUnsubscribe,
  ControllerStateChangedPayload,
  ControllerProgressPayload,
  ControllerErrorPayload,
} from './audio-controller-types';

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok0(message: string): AudioControllerResult<void> {
  return { success: true, message };
}

function fail<T = void>(
  code:    AudioControllerErrorCode,
  message: string,
  cause?:  unknown,
): AudioControllerResult<T> {
  const error: AudioControllerError = { code, message, cause };
  return { success: false, message, error };
}

// ─── AudioController ──────────────────────────────────────────────────────────

export class AudioController {

  // ── الحالة الداخلية ─────────────────────────────────────────────────────────

  private _state:    AudioControllerState = 'IDLE';
  /** هل تم استدعاء dispose()؟ — يمنع إعادة الاستخدام بعد التخلص */
  private _disposed: boolean              = false;

  /** خريطة المستمعين: نوع الحدث → مجموعة دوال الاستماع */
  private readonly _listeners = new Map<
    AudioControllerEventType,
    Set<AudioControllerListener<unknown>>
  >();

  /** دوال إلغاء الاشتراك في أحداث Runtime وSession */
  private readonly _internalUnsubs: Array<() => void> = [];

  // ── Constructor ─────────────────────────────────────────────────────────────

  /**
   * @param session نسخة AudioSession (الافتراضي: singleton)
   * @param runtime نسخة AudioRuntime (الافتراضي: singleton)
   */
  constructor(
    private readonly session: AudioSession = audioSession,
    private readonly runtime: AudioRuntime  = audioRuntime,
  ) {
    this._subscribeToRuntime();
    this._subscribeToSession();
  }

  // ── activateSession ──────────────────────────────────────────────────────────

  /**
   * يُفعّل جلسة الصوت عبر AudioSession.
   * يجب استدعاؤه عند بدء التطبيق أو قبل أي عملية تشغيل.
   */
  async activateSession(): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = await this.session.activate();
    if (!result.success) {
      return fail(
        'SESSION_ACTIVATE_FAILED',
        result.message,
        result.error?.cause,
      );
    }
    this._transition('SESSION_ACTIVE');
    // لا emit يدوي — الحدث يصل عبر _subscribeToSession()
    return ok0('تم تفعيل جلسة الصوت');
  }

  // ── deactivateSession ────────────────────────────────────────────────────────

  /**
   * يُوقف جلسة الصوت.
   * يُستدعى عند إغلاق التطبيق أو عند الحاجة لتحرير Audio Focus.
   */
  async deactivateSession(): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = await this.session.deactivate();
    if (!result.success) {
      return fail(
        'SESSION_DEACTIVATE_FAILED',
        result.message,
        result.error?.cause,
      );
    }
    const sessionState = this._state;
    if (sessionState === 'SESSION_ACTIVE') {
      this._transition('IDLE');
    }
    // لا emit يدوي — الحدث يصل عبر _subscribeToSession()
    return ok0('تم إيقاف جلسة الصوت');
  }

  // ── load ────────────────────────────────────────────────────────────────────

  /**
   * يُحمّل ملفاً صوتياً.
   * يُفعّل الجلسة تلقائياً إن لم تكن مفعَّلة.
   *
   * @param uri مسار الملف الصوتي المحلي أو الرابط
   */
  async load(uri: string): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const sessionCheck = await this._ensureSessionActive();
    if (sessionCheck) return sessionCheck;

    // 2. تحميل الملف عبر Runtime
    const loadResult = await this.runtime.load(uri);
    if (!loadResult.success) {
      return fail('LOAD_FAILED', loadResult.message, loadResult.error?.cause);
    }

    this._transition('LOADED');
    return ok0(`تم تحميل الملف الصوتي: ${uri}`);
  }

  // ── play ────────────────────────────────────────────────────────────────────

  /**
   * يُشغّل الصوت.
   * إذا أُعطي URI: يُحمّل الملف أولاً ثم يُشغّله.
   * إذا لم يُعطَ URI: يُشغّل الملف المحمَّل حالياً.
   *
   * يُفعّل الجلسة تلقائياً إن لم تكن مفعَّلة.
   *
   * @param uri مسار اختياري — إن أُعطي يُحمَّل ويُشغَّل
   */
  async play(uri?: string): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const sessionCheck = await this._ensureSessionActive();
    if (sessionCheck) return sessionCheck;

    // 2. تحميل ملف جديد إن أُعطي URI
    if (uri) {
      const loadResult = await this.runtime.load(uri);
      if (!loadResult.success) {
        return fail('LOAD_FAILED', loadResult.message, loadResult.error?.cause);
      }
    }

    // 3. تشغيل عبر Runtime
    const playResult = this.runtime.play();
    if (!playResult.success) {
      return fail('PLAY_FAILED', playResult.message, playResult.error?.cause);
    }

    this._transition('PLAYING');
    return ok0('بدأ تشغيل الصوت');
  }

  // ── pause ───────────────────────────────────────────────────────────────────

  /**
   * يُوقف التشغيل مؤقتاً مع الاحتفاظ بالموضع.
   */
  pause(): AudioControllerResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = this.runtime.pause();
    if (!result.success) {
      return fail('PAUSE_FAILED', result.message, result.error?.cause);
    }
    this._transition('PAUSED');
    return ok0('تم الإيقاف المؤقت');
  }

  // ── resume ──────────────────────────────────────────────────────────────────

  /**
   * يستأنف التشغيل من موضع الإيقاف المؤقت.
   */
  resume(): AudioControllerResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = this.runtime.resume();
    if (!result.success) {
      return fail('RESUME_FAILED', result.message, result.error?.cause);
    }
    this._transition('PLAYING');
    return ok0('استُؤنف التشغيل');
  }

  // ── stop ────────────────────────────────────────────────────────────────────

  /**
   * يُوقف التشغيل ويُعيد الموضع للبداية.
   * الجلسة تبقى مفعَّلة — لا تُغلق.
   */
  async stop(): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = await this.runtime.stop();
    if (!result.success) {
      return fail('STOP_FAILED', result.message, result.error?.cause);
    }
    this._transition('STOPPED');
    return ok0('تم إيقاف التشغيل');
  }

  // ── seek ────────────────────────────────────────────────────────────────────

  /**
   * ينتقل إلى موضع محدد بالثواني.
   * @param positionSeconds الموضع المطلوب (≥ 0)
   */
  async seek(positionSeconds: number): Promise<AudioControllerResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = await this.runtime.seek(positionSeconds);
    if (!result.success) {
      return fail('SEEK_FAILED', result.message, result.error?.cause);
    }
    return ok0(`تم الانتقال إلى ${positionSeconds}s`);
  }

  // ── setRate ─────────────────────────────────────────────────────────────────

  /**
   * يضبط سرعة التشغيل.
   * @param rate النطاق: 0.1 – 2.0
   */
  setRate(rate: number): AudioControllerResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = this.runtime.setRate(rate);
    if (!result.success) {
      return fail('SET_RATE_FAILED', result.message, result.error?.cause);
    }
    return ok0(`تم ضبط السرعة على ${rate}x`);
  }

  // ── setVolume ───────────────────────────────────────────────────────────────

  /**
   * يضبط مستوى الصوت.
   * @param volume النطاق: 0.0 – 1.0
   */
  setVolume(volume: number): AudioControllerResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const result = this.runtime.setVolume(volume);
    if (!result.success) {
      return fail('SET_VOLUME_FAILED', result.message, result.error?.cause);
    }
    return ok0(`تم ضبط مستوى الصوت على ${volume}`);
  }

  // ── getStatus ───────────────────────────────────────────────────────────────

  /**
   * يُعيد لقطة شاملة تجمع حالة Runtime وSession معاً.
   * هذا هو الكائن الوحيد الذي يحتاجه UI.
   */
  getStatus(): AudioControllerStatus {
    const runtimeStatus  = this.runtime.getStatus();
    const sessionState   = this.session.getState();

    return {
      state:        this._state,
      sessionActive: sessionState === 'ACTIVE',
      currentTime:  runtimeStatus.currentTime,
      duration:     runtimeStatus.duration,
      rate:         runtimeStatus.rate,
      volume:       runtimeStatus.volume,
      isLoaded:     runtimeStatus.isLoaded,
      isBuffering:  runtimeStatus.isBuffering,
      uri:          runtimeStatus.uri,
    };
  }

  // ── on ──────────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لنوع حدث محدد.
   * @returns دالة إلغاء الاشتراك
   */
  on<TPayload = unknown>(
    type:     AudioControllerEventType,
    listener: AudioControllerListener<TPayload>,
  ): AudioControllerUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener as AudioControllerListener<unknown>);

    return () => {
      this._listeners.get(type)?.delete(listener as AudioControllerListener<unknown>);
    };
  }

  // ── off ─────────────────────────────────────────────────────────────────────

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     AudioControllerEventType,
    listener: AudioControllerListener<TPayload>,
  ): void {
    this._listeners.get(type)?.delete(listener as AudioControllerListener<unknown>);
  }

  // ── dispose ─────────────────────────────────────────────────────────────────

  /**
   * يُحرّر جميع الموارد:
   *   1. dispose() على Runtime (يُزيل المشغّل من الذاكرة)
   *   2. deactivate() على Session (يُحرّر Audio Focus)
   *   3. يُزيل جميع الاشتراكات الداخلية
   *   4. يمسح _listeners (مستمعو UI)
   */
  async dispose(): Promise<void> {
    if (this._disposed) return; // منع التشغيل المزدوج
    this._disposed = true;
    try {
      // 1. تحرير Runtime
      await this.runtime.dispose();

      // 2. إيقاف Session
      await this.session.deactivate();

    } catch {
      // تجاهل أخطاء التنظيف
    } finally {
      // 3. إلغاء الاشتراكات الداخلية في Runtime وSession
      for (const unsub of this._internalUnsubs) {
        try { unsub(); } catch { /* تجاهل */ }
      }
      this._internalUnsubs.length = 0;

      // 4. مسح مستمعي UI
      this._listeners.clear();

      this._state = 'IDLE';
    }
  }

  // ── الأساليب الداخلية (Private) ─────────────────────────────────────────────

  /**
   * يتحقق من تفعيل الجلسة ويُفعّلها تلقائياً إن لم تكن.
   * @returns null إذا الجلسة جاهزة، أو نتيجة خطأ
   */
  private async _ensureSessionActive(): Promise<AudioControllerResult<void> | null> {
    const sessionState = this.session.getState();
    if (sessionState === 'ACTIVE') return null;

    const result = await this.session.activate();
    if (!result.success) {
      return fail(
        'SESSION_ACTIVATE_FAILED',
        `فشل تفعيل الجلسة تلقائياً: ${result.message}`,
        result.error?.cause,
      );
    }
    // لا emit يدوي — الحدث يصل عبر _subscribeToSession()
    return null;
  }

  /**
   * يتحقق من حالة dispose ويُعيد خطأ موحداً إذا كان Controller قد تُخُلِّص منه.
   * @returns نتيجة خطأ إذا disposed، أو null إذا كان بإمكان الدالة المتابعة
   */
  private _checkDisposed(): AudioControllerResult<void> | null {
    if (!this._disposed) return null;
    return fail(
      'CONTROLLER_DISPOSED',
      'لا يمكن استخدام AudioController بعد استدعاء dispose(). أنشئ نسخة جديدة إذا لزم الأمر.',
    );
  }

  /**
   * يُغيّر حالة Controller الداخلية ويُصدر `state:changed` إذا تغيّرت.
   */
  private _transition(next: AudioControllerState): void {
    if (this._state === next) return;

    const payload: ControllerStateChangedPayload = {
      previousState: this._state,
      currentState:  next,
    };
    this._state = next;
    this._emit<ControllerStateChangedPayload>('state:changed', payload);
  }

  /**
   * يُصدر حدثاً لجميع المستمعين المسجَّلين على هذا النوع.
   */
  private _emit<TPayload = unknown>(
    type:    AudioControllerEventType,
    payload: TPayload,
  ): void {
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    const event: AudioControllerEvent<TPayload> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      try {
        (listener as AudioControllerListener<TPayload>)(event);
      } catch {
        // عزل أخطاء المستمعين
      }
    }
  }

  /**
   * يشترك في أحداث AudioRuntime ويُعيد إصدارها كأحداث Controller.
   * يُستدعى مرة واحدة في الـ constructor.
   */
  private _subscribeToRuntime(): void {
    // ── playback:progress ────────────────────────────────────────────────────
    const unsubProgress = this.runtime.on<PlaybackProgressPayload>(
      'playback:progress',
      (event: AudioRuntimeEvent<PlaybackProgressPayload>) => {
        const payload = event.payload;
        if (!payload) return;
        const progress: ControllerProgressPayload = {
          currentTime: payload.currentTime,
          duration:    payload.duration,
          state:       this._state,
        };
        this._emit<ControllerProgressPayload>('playback:progress', progress);
      },
    );

    // ── playback:ended ────────────────────────────────────────────────────────
    const unsubEnded = this.runtime.on(
      'playback:ended',
      () => {
        this._transition('ENDED');
        this._emit('playback:ended', undefined);
      },
    );

    // ── playback:error ────────────────────────────────────────────────────────
    const unsubError = this.runtime.on<RuntimeErrorPayload>(
      'playback:error',
      (event: AudioRuntimeEvent<RuntimeErrorPayload>) => {
        this._transition('ERROR');
        const controllerError: AudioControllerError = {
          code:    'PLAY_FAILED',
          message: event.payload?.error.message ?? 'خطأ في التشغيل',
          cause:   event.payload?.error.cause,
        };
        const errorPayload: ControllerErrorPayload = { error: controllerError };
        this._emit<ControllerErrorPayload>('playback:error', errorPayload);
      },
    );

    // ── state:changed (من Runtime) ────────────────────────────────────────────
    const unsubState = this.runtime.on<RuntimeStateChangedPayload>(
      'state:changed',
      (event: AudioRuntimeEvent<RuntimeStateChangedPayload>) => {
        const runtimeState = event.payload?.currentState;
        // ترجمة حالة Runtime → حالة Controller
        switch (runtimeState) {
          case 'PLAYING':  this._transition('PLAYING');  break;
          case 'PAUSED':   this._transition('PAUSED');   break;
          case 'STOPPED':  this._transition('STOPPED');  break;
          case 'ENDED':    this._transition('ENDED');    break;
          case 'ERROR':    this._transition('ERROR');    break;
          default: break;
        }
      },
    );

    // ── playback:started / paused / resumed / stopped ─────────────────────────
    const unsubStarted  = this.runtime.on('playback:started',  () => this._emit('playback:started',  undefined));
    const unsubPaused   = this.runtime.on('playback:paused',   () => this._emit('playback:paused',   undefined));
    const unsubResumed  = this.runtime.on('playback:resumed',  () => this._emit('playback:resumed',  undefined));
    const unsubStopped  = this.runtime.on('playback:stopped',  () => this._emit('playback:stopped',  undefined));

    this._internalUnsubs.push(
      unsubProgress, unsubEnded, unsubError, unsubState,
      unsubStarted, unsubPaused, unsubResumed, unsubStopped,
    );
  }

  /**
   * يشترك في أحداث AudioSession ويُعيد إصدارها كأحداث Controller.
   * يُستدعى مرة واحدة في الـ constructor.
   */
  private _subscribeToSession(): void {
    const unsubActivated = this.session.on(
      'session:activated',
      (_event: AudioSessionEvent<unknown>) => {
        this._emit('session:activated', undefined);
      },
    );

    const unsubDeactivated = this.session.on(
      'session:deactivated',
      (_event: AudioSessionEvent<unknown>) => {
        this._emit('session:deactivated', undefined);
      },
    );

    this._internalUnsubs.push(unsubActivated, unsubDeactivated);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * النسخة الوحيدة من AudioController للتطبيق بأكمله.
 * هذا هو المدخل الوحيد الذي يستخدمه UI لمنظومة الصوت.
 *
 * مثال الاستخدام من UI:
 *   import { audioController } from '@/lib/audio';
 *
 *   await audioController.play('file:///path/to/audio.mp3');
 *   audioController.pause();
 *   audioController.on('playback:progress', (e) => updateUI(e.payload));
 *   await audioController.dispose();
 */
export const audioController = new AudioController();
