/**
 * download-queue.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * إدارة قائمة الانتظار (Queue) لطلبات التنزيل.
 * المسؤولية الوحيدة: إضافة / إزالة / ترتيب / استعراض Jobs.
 * لا يُنفّذ أي تنزيل — منطق Queue خالص.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  DownloadJob,
  DownloadPriority,
  DownloadQueueItem,
} from './download-types';

// ─── ترتيب الأولوية ───────────────────────────────────────────────────────────

/** قيمة رقمية لكل مستوى أولوية — كلما ارتفعت القيمة كلما تقدّم الـ Job */
const PRIORITY_WEIGHT: Record<DownloadPriority, number> = {
  high:   3,
  normal: 2,
  low:    1,
};

// ─── DownloadQueue ────────────────────────────────────────────────────────────

/**
 * قائمة انتظار مُرتَّبة لـ DownloadJobs.
 *
 * ترتيب الـ Jobs:
 *   1. أولاً بالأولوية (high → normal → low)
 *   2. عند التساوي بوقت الإنشاء (createdAt) — الأقدم أولاً (FIFO)
 */
export class DownloadQueue {

  /** التخزين الداخلي — Map لضمان O(1) بالبحث بالـ id */
  private readonly _jobs: Map<string, DownloadJob> = new Map();

  // ── إضافة ─────────────────────────────────────────────────────────────────

  /**
   * يُضيف Job جديداً إلى الـ Queue.
   * إذا كان Job بنفس الـ id موجوداً مسبقاً يُتجاهل الطلب.
   *
   * @param job - الـ Job المراد إضافته
   * @returns true إذا أُضيف، false إذا كان موجوداً مسبقاً
   */
  enqueue(job: DownloadJob): boolean {
    if (this._jobs.has(job.id)) {
      return false;
    }
    this._jobs.set(job.id, job);
    return true;
  }

  // ── إزالة ─────────────────────────────────────────────────────────────────

  /**
   * يُزيل Job من الـ Queue بالـ id.
   *
   * @param id - معرّف الـ Job
   * @returns true إذا وُجد وأُزيل، false إذا لم يُوجد
   */
  dequeue(id: string): boolean {
    return this._jobs.delete(id);
  }

  /**
   * يُزيل جميع Jobs من الـ Queue.
   */
  clear(): void {
    this._jobs.clear();
  }

  // ── استعراض ───────────────────────────────────────────────────────────────

  /**
   * يُعيد الـ Job ذو الأعلى أولوية (التالي للتنزيل) دون إزالته.
   * يُعيد null إذا كانت الـ Queue فارغة.
   */
  peek(): DownloadJob | null {
    const sorted = this._sorted();
    return sorted[0] ?? null;
  }

  /**
   * يُعيد Job بالـ id إذا وُجد.
   */
  get(id: string): DownloadJob | null {
    return this._jobs.get(id) ?? null;
  }

  /**
   * يُعيد قائمة DownloadQueueItem مُرتَّبة حسب الأولوية.
   * للعرض الخارجي فقط (UI, logs).
   */
  items(): DownloadQueueItem[] {
    return this._sorted().map((job, index) => ({
      id:        job.id,
      packageId: job.packageId,
      type:      job.type,
      priority:  job.priority,
      status:    job.status,
      progress:  job.progress,
      position:  index + 1,
    }));
  }

  /**
   * يُعيد نسخة مُرتَّبة من جميع Jobs (للاستخدام الداخلي).
   */
  all(): DownloadJob[] {
    return this._sorted();
  }

  // ── معلومات ───────────────────────────────────────────────────────────────

  /** عدد الـ Jobs في الـ Queue */
  get size(): number {
    return this._jobs.size;
  }

  /** هل الـ Queue فارغة؟ */
  get isEmpty(): boolean {
    return this._jobs.size === 0;
  }

  /**
   * هل يوجد Job بهذا الـ packageId بأي حالة؟
   */
  hasPackage(packageId: string): boolean {
    for (const job of this._jobs.values()) {
      if (job.packageId === packageId) return true;
    }
    return false;
  }

  // ── داخلي ─────────────────────────────────────────────────────────────────

  /**
   * يُعيد Jobs مُرتَّبة: الأولوية الأعلى أولاً، عند التساوي الأقدم أولاً.
   */
  private _sorted(): DownloadJob[] {
    return Array.from(this._jobs.values()).sort((a, b) => {
      const priorityDiff =
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const downloadQueue = new DownloadQueue();
