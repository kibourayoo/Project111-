/**
 * download-events.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * نظام الأحداث (Events) لـ Download Manager.
 * يُعرِّف أنواع الأحداث ونظام Subscribe/Unsubscribe.
 *
 * عقد الأحداث (المرحلة 20.1):
 *   onStart    — يُطلق مرة واحدة فقط لكل Job (عند البدء الأول)
 *   onRetry    — يُطلق مع كل إعادة محاولة (ليس onStart)
 *   onProgress — يُطلق عند كل تحديث تقدم (قد يتكرر بعد Retry)
 *   onPause    — يُطلق عند الإيقاف المؤقت
 *   onResume   — يُطلق عند الاستئناف
 *   onCancel   — يُطلق عند الإلغاء
 *   onFinish   — يُطلق عند الاكتمال الناجح
 *   onError    — يُطلق عند الفشل النهائي (بعد استنفاد maxRetries أو فشل التحقق)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DownloadError, DownloadJob, DownloadProgress } from './download-types';

// ─── أنواع payloads الأحداث ───────────────────────────────────────────────────

/** حمولة حدث بدء التنزيل */
export interface DownloadStartPayload {
  readonly job: DownloadJob;
}

/** حمولة حدث تحديث التقدم */
export interface DownloadProgressPayload {
  readonly jobId:    string;
  readonly progress: DownloadProgress;
}

/** حمولة حدث الإيقاف المؤقت */
export interface DownloadPausePayload {
  readonly job: DownloadJob;
}

/** حمولة حدث الاستئناف */
export interface DownloadResumePayload {
  readonly job: DownloadJob;
}

/** حمولة حدث الإلغاء */
export interface DownloadCancelPayload {
  readonly jobId:    string;
  readonly packageId: string;
}

/** حمولة حدث الاكتمال */
export interface DownloadFinishPayload {
  readonly job:           DownloadJob;
  readonly localPath:     string;
  readonly totalDuration: number;
}

/** حمولة حدث الخطأ */
export interface DownloadErrorPayload {
  readonly error:      DownloadError;
  readonly job:        DownloadJob;
  readonly willRetry:  boolean;
}

/**
 * حمولة حدث إعادة المحاولة.
 *
 * يُطلق هذا الحدث بدلاً من onStart عند كل إعادة محاولة.
 * onStart يُطلق مرة واحدة فقط لكل Job (عند البدء الأول).
 *
 * @property jobId      - معرّف الـ Job
 * @property packageId  - معرّف الحزمة
 * @property retryCount - رقم المحاولة الحالية (1 = أول إعادة محاولة)
 * @property maxRetries - الحد الأقصى للمحاولات
 * @property reason     - سبب إعادة المحاولة (رسالة الخطأ إن توفرت)
 */
export interface DownloadRetryPayload {
  readonly jobId:      string;
  readonly packageId:  string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly reason:     string;
}

// ─── خريطة الأحداث ───────────────────────────────────────────────────────────

/**
 * خريطة ربط اسم الحدث بنوع الـ payload الخاص به.
 * تُستخدم لضمان سلامة الأنواع في subscribe/emit.
 */
export interface DownloadEventMap {
  onStart:    DownloadStartPayload;
  onRetry:    DownloadRetryPayload;
  onProgress: DownloadProgressPayload;
  onPause:    DownloadPausePayload;
  onResume:   DownloadResumePayload;
  onCancel:   DownloadCancelPayload;
  onFinish:   DownloadFinishPayload;
  onError:    DownloadErrorPayload;
}

/** أسماء الأحداث المتاحة */
export type DownloadEventName = keyof DownloadEventMap;

/** نوع دالة المستمع لحدث معيّن */
export type DownloadListener<K extends DownloadEventName> =
  (payload: DownloadEventMap[K]) => void;

// ─── DownloadEventBus ─────────────────────────────────────────────────────────

/**
 * ناقل الأحداث (Event Bus) لـ Download Manager.
 *
 * يدعم:
 *   - subscribe()   → تسجيل مستمع لحدث معيّن
 *   - unsubscribe() → إلغاء تسجيل مستمع
 *   - emit()        → إطلاق حدث لجميع المستمعين المسجَّلين
 *   - clear()       → إزالة جميع المستمعين (للاختبار/التنظيف)
 *
 * المرحلة الحالية (19): الهيكل منفَّذ.
 * emit() يُطلق الأحداث فعلياً للمستمعين — لكن لن يُستدعى emit() حتى مرحلة 20.
 */
export class DownloadEventBus {

  /** التخزين الداخلي: eventName → Set of listeners */
  private readonly _listeners: Map<
    DownloadEventName,
    Set<DownloadListener<DownloadEventName>>
  > = new Map();

  // ── subscribe ──────────────────────────────────────────────────────────────

  /**
   * يُسجِّل مستمعاً لحدث معيّن.
   *
   * @param event    - اسم الحدث
   * @param listener - الدالة المُنفَّذة عند إطلاق الحدث
   * @returns دالة unsubscribe للإلغاء التلقائي (لاستخدام useEffect cleanup)
   *
   * مثال:
   * ```ts
   * const unsub = downloadEventBus.subscribe('onProgress', ({ jobId, progress }) => {
   *   console.log(jobId, progress.percent);
   * });
   * return () => unsub(); // cleanup
   * ```
   */
  subscribe<K extends DownloadEventName>(
    event:    K,
    listener: DownloadListener<K>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const listeners = this._listeners.get(event)!;
    listeners.add(listener as DownloadListener<DownloadEventName>);
    return () => this.unsubscribe(event, listener);
  }

  // ── unsubscribe ────────────────────────────────────────────────────────────

  /**
   * يُلغي تسجيل مستمع لحدث معيّن.
   *
   * @param event    - اسم الحدث
   * @param listener - نفس الدالة المُمرَّرة في subscribe
   */
  unsubscribe<K extends DownloadEventName>(
    event:    K,
    listener: DownloadListener<K>,
  ): void {
    this._listeners
      .get(event)
      ?.delete(listener as DownloadListener<DownloadEventName>);
  }

  // ── emit ───────────────────────────────────────────────────────────────────

  /**
   * يُطلق حدثاً لجميع المستمعين المسجَّلين.
   * يُستدعى هذا من DownloadManager في مرحلة 20.
   *
   * @param event   - اسم الحدث
   * @param payload - بيانات الحدث
   */
  emit<K extends DownloadEventName>(
    event:   K,
    payload: DownloadEventMap[K],
  ): void {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) {
      (listener as DownloadListener<K>)(payload);
    }
  }

  // ── clear ──────────────────────────────────────────────────────────────────

  /**
   * يُزيل جميع المستمعين لجميع الأحداث.
   * للتنظيف عند teardown أو في بيئة الاختبار.
   */
  clear(): void {
    this._listeners.clear();
  }

  /**
   * يُزيل جميع المستمعين لحدث واحد فقط.
   *
   * @param event - اسم الحدث
   */
  clearEvent(event: DownloadEventName): void {
    this._listeners.get(event)?.clear();
  }

  /** عدد المستمعين المسجَّلين لحدث معيّن */
  listenerCount(event: DownloadEventName): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const downloadEventBus = new DownloadEventBus();
