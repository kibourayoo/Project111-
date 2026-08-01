/**
 * audio-session.ts
 * طبقة إدارة جلسة الصوت — Audio Session Layer
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * AudioSession هي الطبقة الوحيدة المسؤولة عن إعداد وإدارة جلسة الصوت
 * على مستوى النظام. لا تعلم شيئاً عن الملفات أو تشغيلها.
 *
 * ─── ما تعتمد عليه ───────────────────────────────────────────────────────────
 *   expo-audio: setAudioModeAsync, setIsAudioActiveAsync
 *
 * ─── ما لا تلمسه مطلقاً ──────────────────────────────────────────────────────
 *   AudioRuntime       ← لا يوجد أي استيراد
 *   AudioStorage       ← لا يوجد أي استيراد
 *   DownloadManager    ← لا يوجد أي استيراد
 *   PackageManager     ← لا يوجد أي استيراد
 *   FileSystem         ← لا يوجد أي استيراد
 *   React / Hooks      ← لا يوجد أي استيراد
 *   UI / Navigation    ← لا يوجد أي استيراد
 *
 * ─── ما تدعمه expo-audio فعلياً في SDK 55 ───────────────────────────────────
 *   ✅ Silent Mode (playsInSilentMode)         ← setAudioModeAsync
 *   ✅ Audio Focus / Interruptions (interruptionMode) ← setAudioModeAsync
 *   ✅ Ducking (interruptionMode: 'duckOthers')       ← setAudioModeAsync
 *   ✅ Background Playback (shouldPlayInBackground)   ← setAudioModeAsync
 *   ✅ Speaker / Earpiece (shouldRouteThroughEarpiece)← setAudioModeAsync
 *   ✅ تفعيل/إيقاف الجلسة                     ← setIsAudioActiveAsync
 *
 * ─── ما لا تدعمه expo-audio (SDK 55) ─────────────────────────────────────────
 *   ❌ أحداث المقاطعة (interruption:begin / end)
 *      السبب: expo-audio لا يكشف AVAudioSession interruption notifications (iOS)
 *             ولا AudioFocusChange callbacks (Android). تُعالَج داخلياً.
 *
 *   ❌ أحداث تغيير مسار الصوت (route:changed)
 *      السبب: AVAudioSession routeChangeNotification (iOS) و
 *             AudioDeviceCallback (Android) غير مكشوفة من expo-audio.
 *
 *   ❌ طلب/إلغاء Audio Focus يدوياً
 *      السبب: يُدار تلقائياً داخل expo-audio بناءً على interruptionMode.
 *
 *   ❌ تحديد iOS AVAudioSession category صراحةً
 *      السبب: مُجرَّد خلف setAudioModeAsync ولا يُكشف مباشرة.
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   configure(config?)           ← تطبيق إعدادات الجلسة
 *   activate()                   ← تفعيل الجلسة (setIsAudioActiveAsync(true))
 *   deactivate()                 ← إيقاف الجلسة (setIsAudioActiveAsync(false))
 *   setInterruptionMode(mode)    ← تغيير سلوك التعارض مع التطبيقات
 *   setBackgroundPlayback(bool)  ← تفعيل/إيقاف التشغيل في الخلفية
 *   setSilentMode(bool)          ← ضبط السلوك في وضع الصمت (iOS)
 *   setAudioRoute(route)         ← تحديد مسار إخراج الصوت
 *   getState()                   ← قراءة حالة الجلسة الحالية
 *   getConfig()                  ← قراءة الإعدادات الحالية
 *   on(type, fn)                 ← الاشتراك في حدث
 *   off(type, fn)                ← إلغاء اشتراك
 *   reset()                      ← إعادة الجلسة للإعدادات الافتراضية
 */

import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

import {
  DEFAULT_SESSION_CONFIG,
} from './audio-session-types';

import type {
  AudioSessionState,
  AudioSessionConfig,
  AudioSessionResult,
  AudioSessionError,
  AudioSessionErrorCode,
  AudioSessionEventType,
  AudioSessionEvent,
  AudioSessionListener,
  AudioSessionUnsubscribe,
  AudioInterruptionMode,
  AudioRoute,
  SessionStateChangedPayload,
  SessionConfiguredPayload,
  SessionErrorPayload,
} from './audio-session-types';

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok<T>(data: T, message: string): AudioSessionResult<T> {
  return { success: true, data, message };
}

function ok0(message: string): AudioSessionResult<void> {
  return { success: true, message };
}

function fail<T = void>(
  code:    AudioSessionErrorCode,
  message: string,
  cause?:  unknown,
): AudioSessionResult<T> {
  const error: AudioSessionError = { code, message, cause };
  return { success: false, message, error };
}

// ─── AudioSession ─────────────────────────────────────────────────────────────

export class AudioSession {

  // ── الحالة الداخلية ─────────────────────────────────────────────────────────

  private _state:  AudioSessionState  = 'UNINITIALIZED';
  private _config: AudioSessionConfig = { ...DEFAULT_SESSION_CONFIG };

  /** خريطة المستمعين: نوع الحدث → مجموعة دوال الاستماع */
  private readonly _listeners = new Map<
    AudioSessionEventType,
    Set<AudioSessionListener<unknown>>
  >();

  // ── configure ───────────────────────────────────────────────────────────────

  /**
   * يُطبّق إعدادات جلسة الصوت عبر expo-audio setAudioModeAsync.
   * إذا لم تُمرَّر إعدادات يستخدم DEFAULT_SESSION_CONFIG.
   *
   * @param config إعدادات جزئية أو كاملة — تُدمج مع الإعدادات الحالية
   */
  async configure(config?: Partial<AudioSessionConfig>): Promise<AudioSessionResult<void>> {
    try {
      // دمج الإعدادات الجديدة مع الحالية
      const merged: AudioSessionConfig = {
        ...this._config,
        ...(config ?? {}),
      };

      await setAudioModeAsync({
        interruptionMode:           merged.interruptionMode,
        playsInSilentMode:          merged.playsInSilentMode,
        shouldPlayInBackground:     merged.shouldPlayInBackground,
        shouldRouteThroughEarpiece: merged.audioRoute === 'earpiece',
        // allowsRecording لا تُعدِّله Session — تبقى false (القيمة الافتراضية)
        allowsRecording:            false,
      });

      this._config = merged;

      // الانتقال لـ CONFIGURED إذا كانت UNINITIALIZED أو DEACTIVATED
      if (this._state === 'UNINITIALIZED' || this._state === 'DEACTIVATED') {
        this._transition('CONFIGURED');
      }

      const payload: SessionConfiguredPayload = { config: this._config };
      this._emit<SessionConfiguredPayload>('session:configured', payload);

      return ok0('تم ضبط إعدادات جلسة الصوت');
    } catch (err) {
      this._transition('ERROR');
      this._emitError('CONFIGURE_FAILED', 'فشل ضبط إعدادات جلسة الصوت', err);
      return fail('CONFIGURE_FAILED', 'فشل ضبط إعدادات جلسة الصوت', err);
    }
  }

  // ── activate ────────────────────────────────────────────────────────────────

  /**
   * يُفعّل جلسة الصوت عبر setIsAudioActiveAsync(true).
   * يُطبّق الإعدادات الحالية تلقائياً قبل التفعيل إن لم تُهيَّأ بعد.
   */
  async activate(): Promise<AudioSessionResult<void>> {
    try {
      // تهيئة تلقائية إن لم تُهيَّأ بعد
      if (this._state === 'UNINITIALIZED') {
        const configResult = await this.configure();
        if (!configResult.success) return configResult;
      }

      await setIsAudioActiveAsync(true);
      this._transition('ACTIVE');
      this._emit('session:activated', undefined);

      return ok0('تم تفعيل جلسة الصوت');
    } catch (err) {
      this._transition('ERROR');
      this._emitError('ACTIVATE_FAILED', 'فشل تفعيل جلسة الصوت', err);
      return fail('ACTIVATE_FAILED', 'فشل تفعيل جلسة الصوت', err);
    }
  }

  // ── deactivate ──────────────────────────────────────────────────────────────

  /**
   * يُوقف جلسة الصوت عبر setIsAudioActiveAsync(false).
   * يُحرّر Audio Focus ويُوقف جميع التشغيل على مستوى النظام.
   */
  async deactivate(): Promise<AudioSessionResult<void>> {
    try {
      await setIsAudioActiveAsync(false);
      this._transition('DEACTIVATED');
      this._emit('session:deactivated', undefined);

      return ok0('تم إيقاف جلسة الصوت');
    } catch (err) {
      this._emitError('DEACTIVATE_FAILED', 'فشل إيقاف جلسة الصوت', err);
      return fail('DEACTIVATE_FAILED', 'فشل إيقاف جلسة الصوت', err);
    }
  }

  // ── setInterruptionMode ──────────────────────────────────────────────────────

  /**
   * يُحدِّث سلوك التعارض مع التطبيقات الأخرى.
   *
   *   mixWithOthers ← يعمل الصوت بالتوازي (بدون Audio Focus)
   *   doNotMix      ← يوقف صوت التطبيقات الأخرى (Focus حصري)
   *   duckOthers    ← يخفّض صوت التطبيقات الأخرى (Ducking)
   */
  async setInterruptionMode(
    mode: AudioInterruptionMode,
  ): Promise<AudioSessionResult<void>> {
    return this.configure({ interruptionMode: mode });
  }

  // ── setBackgroundPlayback ────────────────────────────────────────────────────

  /**
   * يُفعّل أو يُوقف التشغيل في الخلفية.
   *
   * ملاحظة: يتطلب إعداد config plugin في app.json على Android.
   * على iOS يُفعَّل عبر expo-audio config plugin تلقائياً.
   */
  async setBackgroundPlayback(enabled: boolean): Promise<AudioSessionResult<void>> {
    return this.configure({ shouldPlayInBackground: enabled });
  }

  // ── setSilentModeBehavior ───────────────────────────────────────────────────

  /**
   * يُحدِّد سلوك الصوت عند تفعيل وضع الصمت (iOS فقط).
   *
   *   true  ← يستمر الصوت رغم الصمت
   *   false ← يصمت مع الهاتف
   *
   * ملاحظة: يُتجاهَل هذا الإعداد على Android والـ Web.
   */
  async setSilentModeBehavior(playsInSilent: boolean): Promise<AudioSessionResult<void>> {
    return this.configure({ playsInSilentMode: playsInSilent });
  }

  // ── setAudioRoute ───────────────────────────────────────────────────────────

  /**
   * يُحدِّد مسار إخراج الصوت.
   *
   *   speaker  ← مكبر الصوت الخارجي (الافتراضي)
   *   earpiece ← سماعة الأذن الداخلية
   *
   * ملاحظة: يُطبَّق فعلياً على iOS فقط عند allowsRecording = true.
   * على Android والـ Web يُتجاهَل من قِبَل expo-audio.
   */
  async setAudioRoute(route: AudioRoute): Promise<AudioSessionResult<void>> {
    return this.configure({ audioRoute: route });
  }

  // ── getState ─────────────────────────────────────────────────────────────────

  /**
   * يُعيد حالة الجلسة الحالية.
   */
  getState(): AudioSessionState {
    return this._state;
  }

  // ── getConfig ────────────────────────────────────────────────────────────────

  /**
   * يُعيد نسخة من الإعدادات المطبَّقة حالياً (immutable snapshot).
   */
  getConfig(): Readonly<AudioSessionConfig> {
    return { ...this._config };
  }

  // ── reset ────────────────────────────────────────────────────────────────────

  /**
   * يُعيد الجلسة إلى الإعدادات الافتراضية ويُوقف تفعيلها.
   */
  async reset(): Promise<AudioSessionResult<void>> {
    try {
      await setIsAudioActiveAsync(false);
      const configResult = await this.configure({ ...DEFAULT_SESSION_CONFIG });
      if (!configResult.success) return configResult;

      this._transition('CONFIGURED');
      return ok0('تم إعادة إعدادات جلسة الصوت للافتراضية');
    } catch (err) {
      return fail('CONFIGURE_FAILED', 'فشل إعادة إعدادات الجلسة', err);
    }
  }

  // ── on ───────────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لنوع حدث محدد.
   * @returns دالة إلغاء الاشتراك
   */
  on<TPayload = unknown>(
    type:     AudioSessionEventType,
    listener: AudioSessionListener<TPayload>,
  ): AudioSessionUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener as AudioSessionListener<unknown>);

    return () => {
      this._listeners.get(type)?.delete(listener as AudioSessionListener<unknown>);
    };
  }

  // ── off ──────────────────────────────────────────────────────────────────────

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     AudioSessionEventType,
    listener: AudioSessionListener<TPayload>,
  ): void {
    this._listeners.get(type)?.delete(listener as AudioSessionListener<unknown>);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * يُغيّر الحالة الداخلية ويُصدر state:changed إذا تغيّرت فعلاً.
   */
  private _transition(next: AudioSessionState): void {
    if (this._state === next) return;

    const payload: SessionStateChangedPayload = {
      previousState: this._state,
      currentState:  next,
    };
    this._state = next;
    this._emit<SessionStateChangedPayload>('state:changed', payload);
  }

  /**
   * يُصدر حدثاً لجميع المستمعين المسجَّلين على هذا النوع.
   */
  private _emit<TPayload = unknown>(
    type:    AudioSessionEventType,
    payload: TPayload,
  ): void {
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    const event: AudioSessionEvent<TPayload> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      try {
        (listener as AudioSessionListener<TPayload>)(event);
      } catch {
        // عزل أخطاء المستمعين لمنع تعطّل Session
      }
    }
  }

  /**
   * يُصدر حدث session:error ويُلف الخطأ في البنية الموحدة.
   */
  private _emitError(
    code:    AudioSessionErrorCode,
    message: string,
    cause?:  unknown,
  ): void {
    const payload: SessionErrorPayload = {
      error: { code, message, cause },
    };
    this._emit<SessionErrorPayload>('session:error', payload);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * النسخة الوحيدة من AudioSession للتطبيق بأكمله.
 *
 * الاستخدام المُوصى به:
 *   // عند بدء التطبيق
 *   await audioSession.activate();
 *
 *   // عند الحاجة للتشغيل في الخلفية
 *   await audioSession.setBackgroundPlayback(true);
 *
 *   // عند إغلاق التطبيق
 *   await audioSession.deactivate();
 */
export const audioSession = new AudioSession();
