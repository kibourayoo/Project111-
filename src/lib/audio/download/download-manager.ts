/**
 * download-manager.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrator للتنزيل — مسؤوليته الوحيدة إدارة دورة حياة Jobs.
 *
 * ما يفعله:
 *   - enqueue / start / pause / resume / cancel / cancelAll
 *   - اختيار الـ Job التالي من Queue
 *   - ضمان Worker واحد فقط يعمل في نفس الوقت
 *
 * ما لا يفعله (محظور صارم):
 *   - لا Download / Networking / fetch
 *   - لا Validation
 *   - لا Installation
 *   - لا Registry / Storage مباشرة
 *   كل ذلك داخل DownloadWorker حصراً.
 *
 * Worker Ownership:
 *   _activeWorker هو الضمان الوحيد — إذا كان غير null يرفض إنشاء Worker ثانٍ.
 *
 * المرحلة الحالية (23):
 *   Downloader + Extractor + PackageValidator + AudioRepository مفعّلون.
 *   دورة الحياة كاملة من DOWNLOADING حتى INSTALLED.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Directory, Paths }              from 'expo-file-system';
import type { AudioType }                from '../audio-types';
import { packageStateMachine }           from '../package-state';
import { packageValidator }              from '../package-validator';
import { audioRepository }              from '../audio-repository';
import { audioStorage }                  from '../audio-storage';
import { DownloadQueue }                 from './download-queue';
import { DownloadEventBus, downloadEventBus } from './download-events';
import { DownloadWorker }                from './download-worker';
import type { WorkerDeps, WorkerResult } from './download-worker';
import { Downloader }                    from './downloader';
import { DownloadExtractor }             from './download-extractor';
import type {
  DownloadJob,
  DownloadQueueItem,
  DownloadResult,
  EnqueueOptions,
}                                        from './download-types';

// ─── makeJobId ────────────────────────────────────────────────────────────────

/**
 * يُولّد معرّفاً فريداً للـ Job بدون مكتبات خارجية.
 * الصيغة: {packageId}-{type}-{timestamp}-{random4}
 */
function makeJobId(packageId: string, type: AudioType): string {
  const rand = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${packageId}-${type}-${Date.now()}-${rand}`;
}

// ─── buildDeps ────────────────────────────────────────────────────────────────

/**
 * يبني WorkerDeps للمرحلة 23 — دورة حياة كاملة.
 *
 * Downloader     → Downloader الحقيقي (fetch + expo-file-system)
 * extractor      → DownloadExtractor الحقيقي (react-native-zip-archive)
 * validateManifest → packageValidator.validatePackage() (بدون فحص هيكل ملفات)
 * installPackage → audioRepository.installLocalPackage()
 * removeTempJob  → audioStorage.removeTempJob()
 * removeExtractedDir → حذف مجلد الاستخراج من cache
 * validatePackage → Stub — فحص SHA-256 للـ ZIP (TODO مرحلة مستقبلية)
 */
function buildDeps(eventBus: DownloadEventBus): WorkerDeps {
  return {
    downloader: new Downloader(),
    extractor:  new DownloadExtractor(),
    stateMachine: packageStateMachine,
    eventBus,

    validatePackage: async (_job) => ({
      // TODO (مرحلة مستقبلية): SHA-256 للـ ZIP قبل الاستخراج
      valid:  true,
      errors: [],
    }),

    validateManifest: (pkg) =>
      packageValidator.validatePackage(pkg, undefined, false),

    installPackage: (info, extractedPath) =>
      audioRepository.installFromExtracted(info, extractedPath),

    removeTempJob: async (jobId) => {
      audioStorage.removeTempJob(jobId);
    },

    removeExtractedDir: (type, packageId) => {
      const dir = new Directory(Paths.cache, 'audio', 'packages', type, packageId);
      if (dir.exists) dir.delete();
    },
  };
}

// ─── DownloadManager ──────────────────────────────────────────────────────────

/**
 * Orchestrator الرئيسي لنظام التنزيل.
 *
 * الضمانات المعمارية:
 *   1. Worker واحد فقط: guard على _activeWorker !== null في _processNext()
 *   2. DownloadManager لا يعرف تفاصيل التنفيذ (Downloader/Validator/Repository)
 *   3. جميع الـ deps تُحقَن عبر WorkerDeps (قابلة للاستبدال في مرحلة 21)
 */
export class DownloadManager {

  private readonly _queue:    DownloadQueue;
  private readonly _eventBus: DownloadEventBus;

  /**
   * المالك الوحيد للـ Worker الحالي.
   * null = لا يوجد Worker يعمل الآن.
   * هذا الحقل هو الضمان الوحيد لمنع Workers متعددة.
   */
  private _activeWorker: DownloadWorker | null = null;

  /** Job الذي يعمل Worker حالياً عليه (للاستعراض السريع) */
  private _activeJob: DownloadJob | null = null;

  constructor(
    queue:    DownloadQueue    = new DownloadQueue(),
    eventBus: DownloadEventBus = downloadEventBus,
  ) {
    this._queue    = queue;
    this._eventBus = eventBus;
  }

  // ── enqueue ────────────────────────────────────────────────────────────────

  /**
   * يُضيف حزمة صوتية إلى Queue التنزيل.
   *
   * الحراسات:
   *   1. يرفض إذا كان packageId موجوداً في Queue حالياً
   *   2. يُنشئ jobId فريداً
   *   3. يُضيف Job بحالة 'pending'
   *   4. يستدعي _processNext() تلقائياً إذا لم يكن Worker يعمل
   */
  enqueue(
    packageId:   string,
    type:        AudioType,
    downloadUrl: string,
    options?:    EnqueueOptions,
  ): DownloadResult {
    // حارس: لا تُضيف نفس الحزمة مرتين
    if (this._queue.hasPackage(packageId)) {
      const dupError = {
        code:    'ALREADY_QUEUED',
        message: `الحزمة موجودة بالفعل في Queue: ${packageId}`,
        jobId:   '',
      };
      return { success: false, jobId: '', error: dupError };
    }

    const jobId = makeJobId(packageId, type);

    const job: DownloadJob = {
      id:          jobId,
      packageId,
      type,
      downloadUrl,
      priority:    options?.priority   ?? 'normal',
      maxRetries:  options?.maxRetries ?? 3,
      status:      'pending',
      progress:    null,
      retryCount:  0,
      createdAt:   Date.now(),
      startedAt:   null,
      finishedAt:  null,
      error:       null,
    };

    this._queue.enqueue(job);

    // ابدأ التشغيل تلقائياً إذا لم يكن Worker يعمل
    void this._processNext();

    return { success: true, jobId, error: null };
  }

  // ── start ──────────────────────────────────────────────────────────────────

  /**
   * يبدأ معالجة Queue يدوياً.
   * لا تأثير إذا كان Worker يعمل أو كانت Queue فارغة.
   */
  async start(): Promise<void> {
    await this._processNext();
  }

  // ── pause ──────────────────────────────────────────────────────────────────

  /**
   * يُوقف الـ Worker الحالي مؤقتاً.
   * لا تأثير إذا لم يكن هناك Worker يعمل.
   */
  pause(): void {
    this._activeWorker?.pause();
  }

  // ── resume ─────────────────────────────────────────────────────────────────

  /**
   * يستأنف الـ Worker المتوقف مؤقتاً.
   * إذا لم يكن هناك Worker نشط يحاول _processNext().
   */
  async resume(): Promise<void> {
    if (this._activeWorker) {
      this._activeWorker.resume();
    } else {
      await this._processNext();
    }
  }

  // ── cancel ─────────────────────────────────────────────────────────────────

  /**
   * يُلغي Job بالـ id.
   *   - إذا كان هو الـ Job الجاري: يُلغي الـ Worker ويُزيله من Queue.
   *   - إذا كان في انتظار الدور: يُزيله من Queue مباشرة.
   */
  cancel(jobId: string): void {
    // إذا كان هو الـ Job الجاري
    if (this._activeJob?.id === jobId) {
      this._activeWorker?.cancel();
      // Worker سيُنهي run() وسيستدعي _onWorkerDone تلقائياً
      return;
    }

    // إذا كان في انتظار الدور فقط
    const job = this._queue.get(jobId);
    if (job) {
      job.status = 'cancelled';
      this._queue.dequeue(jobId);
      this._eventBus.emit('onCancel', {
        jobId,
        packageId: job.packageId,
      });
    }
  }

  // ── cancelAll ──────────────────────────────────────────────────────────────

  /**
   * يُلغي جميع Jobs (الجاري + المنتظرين) ويُنظّف temp/ كاملاً.
   * هذا هو الموقف الوحيد الذي يُستدعى فيه clearTemp().
   */
  cancelAll(): void {
    // إلغاء الـ Worker الجاري
    if (this._activeWorker) {
      this._activeWorker.cancel();
    }

    // إلغاء المنتظرين وإطلاق أحداثهم
    for (const job of this._queue.all()) {
      if (job.id === this._activeJob?.id) continue; // Worker سيتولى إلغاءه
      job.status = 'cancelled';
      this._eventBus.emit('onCancel', {
        jobId:     job.id,
        packageId: job.packageId,
      });
    }

    this._queue.clear();

    // TODO (مرحلة 21): audioStorage.clearTemp() — هنا فقط (ليس في Worker)
  }

  // ── استعراض ───────────────────────────────────────────────────────────────

  /** يُعيد الـ Job الجاري حالياً أو null */
  currentJob(): DownloadJob | null {
    return this._activeJob;
  }

  /** يُعيد قائمة Jobs المُرتَّبة في الـ Queue (للعرض) */
  queue(): DownloadQueueItem[] {
    return this._queue.items();
  }

  /** هل يوجد Worker يعمل الآن؟ */
  isRunning(): boolean {
    return this._activeWorker !== null;
  }

  /** عدد الـ Jobs في الـ Queue (بما فيها الجاري) */
  get queueSize(): number {
    return this._queue.size;
  }

  // ── _processNext ───────────────────────────────────────────────────────────

  /**
   * ينظر في Queue ويُشغّل الـ Job التالي.
   *
   * الضمانات:
   *   1. Worker واحد فقط: guard على _activeWorker !== null
   *   2. _activeWorker يُصفَّر دائماً في finally — في جميع المسارات:
   *      Success / Failed / Cancelled / Exception غير متوقعة
   */
  private async _processNext(): Promise<void> {
    // ─── الضمان: Worker واحد فقط ─────────────────────────────────────────────
    if (this._activeWorker !== null) return;

    const job = this._queue.peek();
    if (!job) return;

    const deps   = buildDeps(this._eventBus);
    const worker = new DownloadWorker(job, deps);

    // تسجيل الـ Worker كـ active قبل await لمنع race condition
    this._activeWorker = worker;
    this._activeJob    = job;

    let result: WorkerResult | undefined;
    try {
      result = await worker.run();
    } finally {
      // ─── النقطة الوحيدة لتصفير _activeWorker ────────────────────────────────
      // تُنفَّذ في جميع المسارات: نجاح، فشل، إلغاء، أي Exception غير متوقعة
      this._cleanupActiveWorker();
    }

    // result مضمون هنا لأن worker.run() لا يُلقي أبداً
    await this._onWorkerDone(result!);
  }

  // ── _onWorkerDone ──────────────────────────────────────────────────────────

  /**
   * يُستدعى بعد انتهاء Worker وتصفير _activeWorker (من finally أعلاه).
   * يُزيل Job من Queue ثم يُشغّل الـ Job التالي.
   */
  private async _onWorkerDone(result: WorkerResult): Promise<void> {
    this._queue.dequeue(result.job.id);
    // ملاحظة: _cleanupActiveWorker() استُدعيت بالفعل في finally أعلاه
    await this._processNext();
  }

  // ── _cleanupActiveWorker ───────────────────────────────────────────────────

  private _cleanupActiveWorker(): void {
    this._activeWorker = null;
    this._activeJob    = null;
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const downloadManager = new DownloadManager();
