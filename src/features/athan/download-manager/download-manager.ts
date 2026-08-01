/**
 * src/features/athan/download-manager/download-manager.ts
 *
 * DownloadManager — إدارة حالة عمليات التحميل في الذاكرة.
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 *   register(id)           ← تسجيل مؤذّن جديد للتتبع
 *   start(id)              ← PENDING → DOWNLOADING
 *   updateProgress(id, p)  ← تحديث نسبة التقدم (0–1)
 *   complete(id)           ← DOWNLOADING → COMPLETED
 *   fail(id, msg)          ← * → FAILED
 *   cancel(id)             ← PENDING|DOWNLOADING → CANCELLED
 *   reset(id)              ← إعادة الحالة إلى IDLE
 *   getEntry(id)           ← قراءة سجل مؤذّن واحد
 *   getAll()               ← قراءة جميع السجلات
 *   isActive(id)           ← هل عملية التحميل جارية؟
 *   onStatusChanged(cb)    ← الاشتراك في تغييرات الحالة
 *   onProgress(cb)         ← الاشتراك في تحديثات التقدم
 *
 * ─── ما لا يفعله ─────────────────────────────────────────────────────────────
 * - لا يتواصل مع الشبكة أو Cloudflare
 * - لا يستخدم FileSystem
 * - لا يعرف UI أو DownloadService أو AudioService
 * - لا ينفّذ أي تحميل فعلي
 *
 * ─── ضمانات الاتساق ──────────────────────────────────────────────────────────
 * - منع تسجيل نفس المؤذّن مرتين في الحالات النشطة
 * - انتقالات الحالة محمية — لا يمكن الانتقال بشكل غير منطقي
 * - الأحداث تُصدَر دائماً بعد تغيير الحالة
 */

import type {
  DownloadEntry,
  DownloadStatus,
  DownloadStatusChangedEvent,
  DownloadProgressEvent,
  StatusChangedListener,
  ProgressListener,
  ManagerResult,
  ManagerUnsubscribe,
} from './download-manager-types';

import { mgrOk, mgrOk0, mgrFail } from './download-manager-types';

// ─── الحالات النشطة (تمنع التسجيل المزدوج) ────────────────────────────────────

const ACTIVE_STATUSES: ReadonlySet<DownloadStatus> = new Set([
  'PENDING',
  'DOWNLOADING',
]);

// ─── DownloadManager ──────────────────────────────────────────────────────────

class DownloadManager {

  /** خريطة الحالات في الذاكرة (id → DownloadEntry) */
  private readonly _entries = new Map<string, DownloadEntry>();

  /** مستمعو تغييرات الحالة */
  private readonly _statusListeners = new Set<StatusChangedListener>();

  /** مستمعو تحديثات التقدم */
  private readonly _progressListeners = new Set<ProgressListener>();

  // ── register ─────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مؤذّناً للتتبع بحالة IDLE.
   *
   * إذا كان المؤذّن في حالة نشطة (PENDING/DOWNLOADING) يُعيد فشلاً
   * لمنع تنزيله مرتين.
   *
   * إذا كان موجوداً بحالة غير نشطة (COMPLETED/FAILED/CANCELLED)
   * يُعيد نجاحاً دون تغيير.
   */
  register(id: string): ManagerResult<DownloadEntry> {
    const existing = this._entries.get(id);

    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      return mgrFail(
        `المؤذّن "${id}" لديه عملية تحميل نشطة (${existing.status}) — لا يمكن التسجيل مجدداً`,
      );
    }

    if (existing) {
      return mgrOk(existing, `المؤذّن "${id}" مسجَّل مسبقاً بحالة ${existing.status}`);
    }

    const entry: DownloadEntry = {
      id,
      status:   'IDLE',
      progress: 0,
    };
    this._entries.set(id, entry);
    return mgrOk(entry, `تم تسجيل المؤذّن "${id}"`);
  }

  // ── start ────────────────────────────────────────────────────────────────────

  /**
   * ينقل المؤذّن من IDLE/PENDING إلى DOWNLOADING.
   * يُسجَّل تلقائياً إذا لم يكن موجوداً.
   */
  start(id: string): ManagerResult<void> {
    const entry = this._ensureEntry(id);

    if (ACTIVE_STATUSES.has(entry.status) && entry.status === 'DOWNLOADING') {
      return mgrFail(`المؤذّن "${id}" يُحمَّل بالفعل`);
    }

    if (entry.status === 'COMPLETED') {
      return mgrFail(`المؤذّن "${id}" محمَّل بالفعل — استخدم reset() أولاً للإعادة`);
    }

    this._transition(entry, 'DOWNLOADING', { startedAt: new Date().toISOString() });
    return mgrOk0(`بدأ تحميل المؤذّن "${id}"`);
  }

  // ── updateProgress ───────────────────────────────────────────────────────────

  /**
   * يُحدِّث نسبة التقدم أثناء التحميل.
   * لا يُصدِر حدث state:changed — يُصدِر حدث progress فقط.
   */
  updateProgress(id: string, progress: number): ManagerResult<void> {
    const entry = this._entries.get(id);
    if (!entry) return mgrFail(`المؤذّن "${id}" غير مسجَّل`);
    if (entry.status !== 'DOWNLOADING') {
      return mgrFail(`لا يمكن تحديث التقدم — الحالة الحالية: ${entry.status}`);
    }

    const clamped    = Math.min(1, Math.max(0, progress));
    entry.progress   = clamped;

    this._emitProgress({ id, progress: clamped });
    return mgrOk0();
  }

  // ── complete ─────────────────────────────────────────────────────────────────

  /** ينقل المؤذّن من DOWNLOADING إلى COMPLETED */
  complete(id: string): ManagerResult<void> {
    const entry = this._entries.get(id);
    if (!entry) return mgrFail(`المؤذّن "${id}" غير مسجَّل`);
    if (entry.status !== 'DOWNLOADING') {
      return mgrFail(`لا يمكن إكمال التحميل — الحالة الحالية: ${entry.status}`);
    }

    this._transition(entry, 'COMPLETED', {
      progress:   1,
      finishedAt: new Date().toISOString(),
    });
    return mgrOk0(`اكتمل تحميل المؤذّن "${id}"`);
  }

  // ── fail ─────────────────────────────────────────────────────────────────────

  /** ينقل المؤذّن إلى FAILED من أي حالة نشطة */
  fail(id: string, errorMessage: string): ManagerResult<void> {
    const entry = this._entries.get(id);
    if (!entry) return mgrFail(`المؤذّن "${id}" غير مسجَّل`);

    if (!ACTIVE_STATUSES.has(entry.status)) {
      return mgrFail(`لا يمكن تسجيل فشل — الحالة الحالية: ${entry.status}`);
    }

    this._transition(entry, 'FAILED', {
      errorMessage,
      finishedAt: new Date().toISOString(),
    });
    return mgrOk0(`فشل تحميل المؤذّن "${id}": ${errorMessage}`);
  }

  // ── cancel ───────────────────────────────────────────────────────────────────

  /** يُلغي عملية تحميل من PENDING أو DOWNLOADING */
  cancel(id: string): ManagerResult<void> {
    const entry = this._entries.get(id);
    if (!entry) return mgrFail(`المؤذّن "${id}" غير مسجَّل`);

    if (!ACTIVE_STATUSES.has(entry.status)) {
      return mgrFail(`لا يمكن الإلغاء — الحالة الحالية: ${entry.status}`);
    }

    this._transition(entry, 'CANCELLED', {
      finishedAt: new Date().toISOString(),
    });
    return mgrOk0(`تم إلغاء تحميل المؤذّن "${id}"`);
  }

  // ── reset ────────────────────────────────────────────────────────────────────

  /**
   * يُعيد حالة المؤذّن إلى IDLE.
   * مفيد لإعادة المحاولة بعد FAILED أو CANCELLED.
   * لا يعمل على DOWNLOADING (يجب الإلغاء أولاً).
   */
  reset(id: string): ManagerResult<void> {
    const entry = this._entries.get(id);
    if (!entry) return mgrFail(`المؤذّن "${id}" غير مسجَّل`);

    if (entry.status === 'DOWNLOADING') {
      return mgrFail(`لا يمكن إعادة الضبط أثناء التحميل — استخدم cancel() أولاً`);
    }

    this._transition(entry, 'IDLE', {
      progress:     0,
      errorMessage: undefined,
      startedAt:    undefined,
      finishedAt:   undefined,
    });
    return mgrOk0(`تمت إعادة ضبط حالة المؤذّن "${id}"`);
  }

  // ── getEntry ─────────────────────────────────────────────────────────────────

  /** يُعيد سجل مؤذّن واحد. null إذا لم يكن مسجَّلاً. */
  getEntry(id: string): DownloadEntry | null {
    return this._entries.get(id) ?? null;
  }

  // ── getAll ───────────────────────────────────────────────────────────────────

  /** يُعيد جميع السجلات المُسجَّلة */
  getAll(): DownloadEntry[] {
    return [...this._entries.values()];
  }

  // ── isActive ─────────────────────────────────────────────────────────────────

  /** هل يوجد تحميل نشط (PENDING أو DOWNLOADING) لهذا المؤذّن؟ */
  isActive(id: string): boolean {
    const entry = this._entries.get(id);
    return !!entry && ACTIVE_STATUSES.has(entry.status);
  }

  // ── onStatusChanged ──────────────────────────────────────────────────────────

  /**
   * الاشتراك في تغييرات الحالة.
   * يُعيد دالة إلغاء الاشتراك.
   */
  onStatusChanged(listener: StatusChangedListener): ManagerUnsubscribe {
    this._statusListeners.add(listener);
    return () => { this._statusListeners.delete(listener); };
  }

  // ── onProgress ───────────────────────────────────────────────────────────────

  /**
   * الاشتراك في تحديثات التقدم.
   * يُعيد دالة إلغاء الاشتراك.
   */
  onProgress(listener: ProgressListener): ManagerUnsubscribe {
    this._progressListeners.add(listener);
    return () => { this._progressListeners.delete(listener); };
  }

  // ── خاص: _ensureEntry ────────────────────────────────────────────────────────

  /** يُعيد السجل الموجود أو يُنشئ واحداً بحالة IDLE */
  private _ensureEntry(id: string): DownloadEntry {
    if (!this._entries.has(id)) {
      this.register(id);
    }
    return this._entries.get(id)!;
  }

  // ── خاص: _transition ─────────────────────────────────────────────────────────

  /** يُغيّر حالة سجل ويُصدِر الحدث */
  private _transition(
    entry:   DownloadEntry,
    next:    DownloadStatus,
    patch:   Partial<DownloadEntry> = {},
  ): void {
    const previous = entry.status;
    Object.assign(entry, patch, { status: next });

    const event: DownloadStatusChangedEvent = {
      id:       entry.id,
      previous,
      current:  next,
      entry:    { ...entry },
    };
    this._emitStatus(event);
  }

  // ── خاص: إصدار الأحداث ───────────────────────────────────────────────────────

  private _emitStatus(event: DownloadStatusChangedEvent): void {
    for (const listener of this._statusListeners) {
      listener(event);
    }
  }

  private _emitProgress(event: DownloadProgressEvent): void {
    for (const listener of this._progressListeners) {
      listener(event);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const downloadManager = new DownloadManager();
