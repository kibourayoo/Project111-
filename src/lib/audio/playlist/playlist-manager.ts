/**
 * src/lib/audio/playlist/playlist-manager.ts
 *
 * طبقة إدارة قائمة التشغيل (Playlist / Queue).
 * تعتمد فقط على AudioController — لا تعرف شيئاً عن Runtime أو Session
 * أو FileSystem أو Download أو PackageManager.
 *
 * المعمارية:
 *
 *   UI
 *   ↓
 *   PlaylistManager   ← هذا الملف
 *   ↓
 *   AudioController
 *   ↙            ↘
 *   AudioSession   AudioRuntime
 *
 * واجهة عامة:
 *
 *   ── إدارة Queue ──
 *   setQueue(items)        ← يستبدل القائمة بالكامل (async)
 *   add(item)              ← يُضيف في النهاية (sync)
 *   addNext(item)          ← يُضيف بعد المسار الحالي (sync)
 *   remove(id)             ← يحذف عنصراً بمعرّفه (sync)
 *   clear()                ← يمسح القائمة كاملاً (async)
 *   move(from, to)         ← يُعيد ترتيب عنصر (sync)
 *
 *   ── التنقل ──
 *   play(index?)           ← يشغل من فهرس محدد أو من الأول (async)
 *   playCurrent()          ← يشغل العنصر الحالي (async)
 *   next()                 ← ينتقل للتالي ويشغله (async)
 *   previous()             ← ينتقل للسابق ويشغله (async)
 *
 *   ── القراءة ──
 *   getQueue()             ← نسخة للقراءة فقط
 *   getCurrent()           ← العنصر الحالي أو null
 *   getCurrentIndex()      ← الفهرس الحالي أو 1-
 *   getStatus()            ← لقطة كاملة
 *   hasNext()
 *   hasPrevious()
 *
 *   ── الأحداث ──
 *   on(type, listener)     ← تسجيل مستمع
 *   off(type, listener)    ← إلغاء مستمع
 *
 *   ── دورة الحياة ──
 *   dispose()              ← تنظيف الاشتراكات
 */

import { audioController } from '../controller';

import type {
  AudioControllerEvent,
  ControllerProgressPayload,
  ControllerErrorPayload,
} from '../controller';

import type {
  PlaylistItem,
  PlaylistState,
  PlaylistStatus,
  PlaylistResult,
  PlaylistError,
  PlaylistErrorCode,
  PlaylistEventType,
  PlaylistEvent,
  PlaylistListener,
  PlaylistUnsubscribe,
  PlaylistStateChangedPayload,
  PlaylistTrackChangedPayload,
  PlaylistQueueChangedPayload,
  PlaylistErrorPayload,
} from './playlist-types';

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok<T>(data: T, message: string): PlaylistResult<T> {
  return { success: true, data, message };
}

function ok0(message: string): PlaylistResult<void> {
  return { success: true, message };
}

function fail<T = void>(
  code:    PlaylistErrorCode,
  message: string,
  cause?:  unknown,
): PlaylistResult<T> {
  const error: PlaylistError = { code, message, cause };
  return { success: false, message, error };
}

// ─── PlaylistManager ──────────────────────────────────────────────────────────

export class PlaylistManager {

  // ── الحالة الداخلية ─────────────────────────────────────────────────────────

  private _queue:           PlaylistItem[] = [];
  private _currentIndex:    number         = -1;
  private _state:           PlaylistState  = 'EMPTY';
  private _disposed:        boolean        = false;
  /**
   * حارس التزامن: يمنع تنفيذ أكثر من عملية انتقال في نفس الوقت.
   * تُعيّنه _executeNavigation وتُعيد ضبطه في finally.
   * يستخدمه أيضاً handler الـ playback:ended لمنع Double Advance.
   */
  private _isTransitioning: boolean        = false;

  /** خريطة مستمعي الأحداث الداخلية */
  private readonly _listeners = new Map<
    PlaylistEventType,
    Set<PlaylistListener<unknown>>
  >();

  /** دوال إلغاء الاشتراك في أحداث AudioController */
  private readonly _controllerUnsubs: Array<() => void> = [];

  // ── Constructor ──────────────────────────────────────────────────────────────

  constructor() {
    this._subscribeToController();
  }

  // ── إدارة Queue ──────────────────────────────────────────────────────────────

  /**
   * يستبدل قائمة التشغيل بالكامل.
   * يوقف التشغيل الحالي إن وجد ثم يُعيّن القائمة الجديدة.
   * الفهرس الحالي يُعاد لـ 0 إن كانت القائمة غير فارغة، أو 1- إن كانت فارغة.
   */
  async setQueue(items: PlaylistItem[]): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (this._isTransitioning) {
      return fail(
        'TRANSITION_IN_PROGRESS',
        'عملية انتقال جارية — يُرجى الانتظار حتى تنتهي العملية الحالية.',
      );
    }

    const validated = this._validateItems(items);
    if (!validated.success) return validated;

    // أوقف التشغيل إن كان جارياً
    if (this._state === 'PLAYING' || this._state === 'PAUSED') {
      await audioController.stop();
    }

    this._queue        = [...items];
    this._currentIndex = items.length > 0 ? 0 : -1;
    this._transition(items.length > 0 ? 'READY' : 'EMPTY');
    this._emitQueueChanged();

    return ok0('تم تعيين قائمة التشغيل');
  }

  /**
   * يُضيف عنصراً في نهاية القائمة.
   * إذا كانت القائمة فارغة يصبح هذا العنصر هو الحالي.
   */
  add(item: PlaylistItem): PlaylistResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const validItem = this._validateItem(item);
    if (!validItem.success) return validItem;

    const wasEmpty = this._queue.length === 0;
    this._queue.push(item);

    if (wasEmpty) {
      this._currentIndex = 0;
      this._transition('READY');
    }

    this._emitQueueChanged();
    return ok0(`تم إضافة "${item.title ?? item.id}" للقائمة`);
  }

  /**
   * يُضيف عنصراً مباشرةً بعد المسار الحالي.
   * مفيد لـ "تشغيل التالي مباشرة".
   */
  addNext(item: PlaylistItem): PlaylistResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const validItem = this._validateItem(item);
    if (!validItem.success) return validItem;

    if (this._queue.length === 0) {
      // القائمة فارغة — يصبح العنصر الأول
      this._queue.push(item);
      this._currentIndex = 0;
      this._transition('READY');
    } else {
      // أدخل بعد الفهرس الحالي
      const insertAt = this._currentIndex + 1;
      this._queue.splice(insertAt, 0, item);
    }

    this._emitQueueChanged();
    return ok0(`تم إضافة "${item.title ?? item.id}" كالتالي مباشرة`);
  }

  /**
   * يحذف عنصراً من القائمة بمعرّفه.
   * إذا كان العنصر المحذوف هو المسار الجاري تشغيله أو الموقوف،
   * يُوقف الصوت فوراً (fire & forget) وينتقل للحالة الصحيحة.
   */
  remove(id: string): PlaylistResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    const idx = this._queue.findIndex(item => item.id === id);
    if (idx === -1) {
      return fail('INDEX_OUT_OF_RANGE', `لا يوجد عنصر بالمعرف: ${id}`);
    }

    // هل العنصر المحذوف هو المُشغَّل/الموقوف حالياً؟
    const removingActive =
      idx === this._currentIndex &&
      (this._state === 'PLAYING' || this._state === 'PAUSED');

    this._queue.splice(idx, 1);

    // تعديل currentIndex وتحديد الحالة المستهدفة
    let nextState: PlaylistState | null = null;

    if (this._queue.length === 0) {
      this._currentIndex = -1;
      nextState          = 'EMPTY';
    } else if (idx < this._currentIndex) {
      // حُذف عنصر قبل الحالي — نُنزل الفهرس بمقدار 1
      this._currentIndex--;
    } else if (idx === this._currentIndex) {
      // حُذف العنصر الحالي — نتمسك بنفس الفهرس (يصبح التالي الآن)
      if (this._currentIndex >= this._queue.length) {
        this._currentIndex = this._queue.length - 1;
      }
    }

    // إذا كان المحذوف هو المسار النشط — أوقف الصوت وعدّل الحالة
    if (removingActive) {
      // fire & forget — لا ننتظر حتى لا نكسر واجهة sync
      audioController.stop().catch(() => {});
      // الحالة الجديدة: READY إن بقيت عناصر، EMPTY إن فرغت القائمة
      if (nextState === null) {
        nextState = this._queue.length > 0 ? 'READY' : 'EMPTY';
      }
    }

    if (nextState !== null) {
      this._transition(nextState);
    }

    this._emitQueueChanged();
    return ok0(`تم حذف العنصر: ${id}`);
  }

  /**
   * يمسح القائمة كاملاً ويوقف التشغيل.
   */
  async clear(): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (this._isTransitioning) {
      return fail(
        'TRANSITION_IN_PROGRESS',
        'عملية انتقال جارية — يُرجى الانتظار حتى تنتهي العملية الحالية.',
      );
    }

    if (this._state === 'PLAYING' || this._state === 'PAUSED') {
      await audioController.stop();
    }

    this._queue        = [];
    this._currentIndex = -1;
    this._transition('EMPTY');
    this._emitQueueChanged();

    return ok0('تم مسح قائمة التشغيل');
  }

  /**
   * يُعيد ترتيب عنصر من فهرس `from` إلى فهرس `to`.
   * يُعدّل الفهرس الحالي إذا كان أحد الفهارس المتأثرة هو العنصر الحالي.
   */
  move(from: number, to: number): PlaylistResult<void> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (from === to) return ok0('لا يوجد تغيير في الترتيب');

    if (
      from < 0 || from >= this._queue.length ||
      to   < 0 || to   >= this._queue.length
    ) {
      return fail(
        'MOVE_FAILED',
        `فهرس التحريك خارج النطاق: from=${from}, to=${to}, length=${this._queue.length}`,
      );
    }

    const [item] = this._queue.splice(from, 1);
    this._queue.splice(to, 0, item);

    // تحديث currentIndex
    if (this._currentIndex === from) {
      this._currentIndex = to;
    } else if (from < this._currentIndex && to >= this._currentIndex) {
      this._currentIndex--;
    } else if (from > this._currentIndex && to <= this._currentIndex) {
      this._currentIndex++;
    }

    this._emitQueueChanged();
    return ok0(`تم تحريك العنصر من ${from} إلى ${to}`);
  }

  // ── التنقل ───────────────────────────────────────────────────────────────────

  /**
   * يشغل من فهرس محدد، أو من الفهرس 0 إن لم يُعطَ فهرس.
   * يُعدّل currentIndex ثم يستدعي _playCurrentCore() داخل Lock.
   */
  async play(index?: number): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (this._queue.length === 0) {
      return fail('EMPTY_QUEUE', 'القائمة فارغة — لا يمكن التشغيل');
    }

    const targetIndex = index !== undefined ? index : Math.max(0, this._currentIndex);

    if (targetIndex < 0 || targetIndex >= this._queue.length) {
      return fail(
        'INDEX_OUT_OF_RANGE',
        `الفهرس ${targetIndex} خارج النطاق (0–${this._queue.length - 1})`,
      );
    }

    return this._executeNavigation(async () => {
      const previousIndex = this._currentIndex;
      this._currentIndex  = targetIndex;
      if (previousIndex !== this._currentIndex) {
        this._emitTrackChanged(previousIndex);
      }
      return this._playCurrentCore();
    });
  }

  /**
   * يشغل العنصر الحالي عبر AudioController.
   * يكتسب Transition Lock — لا يُستدعى داخل _executeNavigation.
   */
  async playCurrent(): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;
    return this._executeNavigation(() => this._playCurrentCore());
  }

  /**
   * ينتقل للعنصر التالي ويشغله — داخل Transition Lock.
   */
  async next(): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (!this.hasNext()) {
      return fail('NO_NEXT', 'لا يوجد مسار تالٍ في القائمة');
    }

    return this._executeNavigation(async () => {
      const previousIndex = this._currentIndex;
      this._currentIndex++;
      this._emitTrackChanged(previousIndex);
      return this._playCurrentCore();
    });
  }

  /**
   * ينتقل للعنصر السابق ويشغله — داخل Transition Lock.
   */
  async previous(): Promise<PlaylistResult<void>> {
    const disposed = this._checkDisposed();
    if (disposed) return disposed;

    if (!this.hasPrevious()) {
      return fail('NO_PREVIOUS', 'لا يوجد مسار سابق في القائمة');
    }

    return this._executeNavigation(async () => {
      const previousIndex = this._currentIndex;
      this._currentIndex--;
      this._emitTrackChanged(previousIndex);
      return this._playCurrentCore();
    });
  }

  // ── القراءة ──────────────────────────────────────────────────────────────────

  /** يُعيد نسخة للقراءة فقط من قائمة التشغيل */
  getQueue(): readonly PlaylistItem[] {
    return this._queue;
  }

  /** يُعيد العنصر الحالي أو null إذا كانت القائمة فارغة */
  getCurrent(): PlaylistItem | null {
    if (this._currentIndex < 0 || this._currentIndex >= this._queue.length) {
      return null;
    }
    return this._queue[this._currentIndex];
  }

  /** يُعيد الفهرس الحالي أو 1- إذا كانت القائمة فارغة */
  getCurrentIndex(): number {
    return this._currentIndex;
  }

  /** هل يوجد عنصر تالٍ؟ */
  hasNext(): boolean {
    return this._currentIndex < this._queue.length - 1;
  }

  /** هل يوجد عنصر سابق؟ */
  hasPrevious(): boolean {
    return this._currentIndex > 0;
  }

  /** لقطة كاملة لحالة PlaylistManager */
  getStatus(): PlaylistStatus {
    return {
      state:        this._state,
      queue:        [...this._queue],
      currentIndex: this._currentIndex,
      current:      this.getCurrent(),
      hasNext:      this.hasNext(),
      hasPrevious:  this.hasPrevious(),
      totalCount:   this._queue.length,
    };
  }

  // ── الأحداث ──────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لنوع حدث محدد.
   * @returns دالة إلغاء الاشتراك
   */
  on<TPayload = unknown>(
    type:     PlaylistEventType,
    listener: PlaylistListener<TPayload>,
  ): PlaylistUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener as PlaylistListener<unknown>);

    return () => {
      this._listeners.get(type)?.delete(listener as PlaylistListener<unknown>);
    };
  }

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     PlaylistEventType,
    listener: PlaylistListener<TPayload>,
  ): void {
    this._listeners.get(type)?.delete(listener as PlaylistListener<unknown>);
  }

  // ── دورة الحياة ──────────────────────────────────────────────────────────────

  /**
   * يُحرّر جميع الاشتراكات في AudioController
   * ويمسح الحالة الداخلية.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed        = true;
    this._isTransitioning = false; // أطلق أي Lock معلّق قبل التنظيف

    for (const unsub of this._controllerUnsubs) {
      try { unsub(); } catch { /* تجاهل أخطاء إلغاء الاشتراك */ }
    }
    this._controllerUnsubs.length = 0;
    this._listeners.clear();
    this._queue        = [];
    this._currentIndex = -1;
    this._state        = 'EMPTY';
  }

  // ── الأساليب الداخلية (Private) ─────────────────────────────────────────────

  /**
   * يشترك في أحداث AudioController المطلوبة فقط.
   * يُستدعى مرة واحدة في الـ constructor.
   *
   * أحداث مُتابَعة:
   *   playback:ended   ← للانتقال التلقائي للتالي
   *   playback:paused  ← لمزامنة حالة PAUSED
   *   playback:resumed ← لمزامنة حالة PLAYING
   *   playback:stopped ← لمزامنة حالة READY
   *   playback:error   ← لإعادة بث الخطأ
   */
  private _subscribeToController(): void {

    // ── playback:ended → انتقال تلقائي أو ENDED ───────────────────────────────
    const unsubEnded = audioController.on(
      'playback:ended',
      (_event: AudioControllerEvent<unknown>) => {
        if (this._state !== 'PLAYING') return;
        // منع Double Advance: إذا كان Lock محجوزاً بعملية انتقال أخرى، نتجاهل الحدث
        if (this._isTransitioning) return;

        if (this.hasNext()) {
          // احجز Lock يدوياً (handler ليس async — لا يمكن استخدام _executeNavigation)
          this._isTransitioning      = true;
          const previousIndex        = this._currentIndex;
          this._currentIndex++;
          this._emitTrackChanged(previousIndex);
          // تشغيل المسار التالي تلقائياً — fire & forget
          audioController.play(this._queue[this._currentIndex].uri)
            .then(result => {
              if (!result.success) {
                this._transition('READY');
                const errPayload: PlaylistErrorPayload = {
                  error: {
                    code:    'PLAY_FAILED',
                    message: result.message,
                    cause:   result.error?.cause,
                  },
                };
                this._emit<PlaylistErrorPayload>('playback:error', errPayload);
              }
            })
            .catch(() => { /* مغطّى بالـ result أعلاه */ })
            .finally(() => {
              // أطلق Lock بعد انتهاء عملية التشغيل (نجاحاً أو فشلاً)
              this._isTransitioning = false;
            });
        } else {
          this._transition('ENDED');
          this._emit('playlist:ended', undefined);
        }
      },
    );

    // ── playback:paused → مزامنة PAUSED ──────────────────────────────────────
    const unsubPaused = audioController.on(
      'playback:paused',
      (_event: AudioControllerEvent<unknown>) => {
        if (this._state === 'PLAYING') {
          this._transition('PAUSED');
        }
      },
    );

    // ── playback:resumed → مزامنة PLAYING ────────────────────────────────────
    const unsubResumed = audioController.on(
      'playback:resumed',
      (_event: AudioControllerEvent<unknown>) => {
        if (this._state === 'PAUSED') {
          this._transition('PLAYING');
        }
      },
    );

    // ── playback:stopped → مزامنة READY ──────────────────────────────────────
    const unsubStopped = audioController.on(
      'playback:stopped',
      (_event: AudioControllerEvent<unknown>) => {
        if (this._state === 'PLAYING' || this._state === 'PAUSED') {
          this._transition(this._queue.length > 0 ? 'READY' : 'EMPTY');
        }
      },
    );

    // ── playback:error → إعادة بث الخطأ ──────────────────────────────────────
    const unsubError = audioController.on<ControllerErrorPayload>(
      'playback:error',
      (event: AudioControllerEvent<ControllerErrorPayload>) => {
        if (this._state === 'PLAYING') {
          this._transition('READY');
        }
        const errPayload: PlaylistErrorPayload = {
          error: {
            code:    'PLAY_FAILED',
            message: event.payload?.error.message ?? 'خطأ في التشغيل',
            cause:   event.payload?.error.cause,
          },
        };
        this._emit<PlaylistErrorPayload>('playback:error', errPayload);
      },
    );

    this._controllerUnsubs.push(
      unsubEnded, unsubPaused, unsubResumed, unsubStopped, unsubError,
    );
  }

  /**
   * يُغيّر الحالة الداخلية ويُصدر state:changed إذا تغيّرت فعلاً.
   */
  private _transition(next: PlaylistState): void {
    if (this._state === next) return;

    const payload: PlaylistStateChangedPayload = {
      previousState: this._state,
      currentState:  next,
    };
    this._state = next;
    this._emit<PlaylistStateChangedPayload>('state:changed', payload);
  }

  // ── Transition Lock & Core Play ───────────────────────────────────────────────

  /**
   * ينفّذ دالة انتقال بعد التحقق من Lock وحجزه.
   * يُطلق Lock في finally بغض النظر عن النتيجة.
   *
   * يُستخدَم بواسطة: play() / playCurrent() / next() / previous().
   * لا يُستخدَم داخل playback:ended handler (لأنه ليس async).
   */
  private async _executeNavigation<T>(
    fn: () => Promise<PlaylistResult<T>>,
  ): Promise<PlaylistResult<T>> {
    if (this._isTransitioning) {
      return fail<T>(
        'TRANSITION_IN_PROGRESS',
        'عملية انتقال جارية — يُرجى الانتظار حتى تنتهي العملية الحالية.',
      );
    }
    this._isTransitioning = true;
    try {
      return await fn();
    } finally {
      this._isTransitioning = false;
    }
  }

  /**
   * النواة الداخلية لتشغيل العنصر الحالي.
   * لا تحجز Lock — تُستدعى دائماً من داخل _executeNavigation.
   */
  private async _playCurrentCore(): Promise<PlaylistResult<void>> {
    if (this._queue.length === 0 || this._currentIndex < 0) {
      return fail('EMPTY_QUEUE', 'لا يوجد عنصر حالي — القائمة فارغة');
    }

    const item   = this._queue[this._currentIndex];
    const result = await audioController.play(item.uri);

    if (!result.success) {
      this._transition('READY');
      return fail('PLAY_FAILED', result.message, result.error?.cause);
    }

    this._transition('PLAYING');
    return ok0(`جاري تشغيل: ${item.title ?? item.uri}`);
  }

  /**
   * يُصدر حدث track:changed عند تغيّر المسار الحالي.
   */
  private _emitTrackChanged(previousIndex: number): void {
    const payload: PlaylistTrackChangedPayload = {
      previousIndex,
      currentIndex: this._currentIndex,
      item:         this.getCurrent(),
    };
    this._emit<PlaylistTrackChangedPayload>('track:changed', payload);
  }

  /**
   * يُصدر حدث queue:changed عند أي تعديل على القائمة.
   */
  private _emitQueueChanged(): void {
    const payload: PlaylistQueueChangedPayload = {
      queue:      [...this._queue],
      totalCount: this._queue.length,
    };
    this._emit<PlaylistQueueChangedPayload>('queue:changed', payload);
  }

  /**
   * يُصدر حدثاً لجميع المستمعين المسجَّلين على هذا النوع.
   */
  private _emit<TPayload = unknown>(
    type:    PlaylistEventType,
    payload: TPayload,
  ): void {
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    const event: PlaylistEvent<TPayload> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      try {
        (listener as PlaylistListener<TPayload>)(event);
      } catch {
        // عزل أخطاء المستمعين لمنع تعطّل PlaylistManager
      }
    }
  }

  /**
   * يتحقق من حالة dispose ويُعيد خطأ موحداً إذا كان Manager قد تُخُلِّص منه.
   */
  private _checkDisposed(): PlaylistResult<void> | null {
    if (!this._disposed) return null;
    return fail(
      'PLAYLIST_DISPOSED',
      'لا يمكن استخدام PlaylistManager بعد استدعاء dispose().',
    );
  }

  /**
   * يتحقق من صلاحية قائمة عناصر.
   */
  private _validateItems(items: PlaylistItem[]): PlaylistResult<void> {
    for (const item of items) {
      const check = this._validateItem(item);
      if (!check.success) return check;
    }
    return ok0('صالح');
  }

  /**
   * يتحقق من صلاحية عنصر واحد.
   */
  private _validateItem(item: PlaylistItem): PlaylistResult<void> {
    if (!item || !item.id || !item.id.trim()) {
      return fail('INVALID_ITEM', 'العنصر يجب أن يحتوي على id صالح');
    }
    if (!item.uri || !item.uri.trim()) {
      return fail('INVALID_ITEM', `العنصر "${item.id}" يجب أن يحتوي على uri صالح`);
    }
    return ok0('صالح');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * النسخة الوحيدة من PlaylistManager للتطبيق بأكمله.
 * هذا هو المدخل الذي يستخدمه UI لإدارة قوائم التشغيل.
 *
 * الاستخدام:
 *   import { playlistManager } from '@/lib/audio';
 *
 *   await playlistManager.setQueue([...]);
 *   await playlistManager.play();
 *   await playlistManager.next();
 */
export const playlistManager = new PlaylistManager();
