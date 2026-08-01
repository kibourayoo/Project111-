/**
 * download-worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * منفّذ Job واحد من البداية للنهاية.
 *
 * المسؤولية الوحيدة:
 *   تنفيذ دورة حياة كاملة لـ DownloadJob:
 *   DOWNLOADING → DOWNLOADED → VALIDATING → INSTALLING → INSTALLED
 *
 * ما يعرفه:
 *   DownloadJob, IDownloader, IZipExtractor, PackageStateMachine,
 *   DownloadEventBus, PackageValidator, AudioRepository — عبر WorkerDeps
 *
 * ما لا يعرفه (محظور صارم):
 *   DownloadQueue, DownloadManager,
 *   Registry, AudioStorage (مباشرة)
 *   ← يصل إليها عبر WorkerDeps فقط (Dependency Inversion)
 *
 * Pause / Resume / Cancel:
 *   تعمل عبر flags + Promise resolver بدون Threads أو Networking.
 *
 * Retry:
 *   يُعيد الدورة الكاملة حتى maxRetries.
 *   عند الاستنفاد ينتقل إلى FAILED.
 *
 * Cleanup:
 *   يُنفَّذ دائماً في finally (نجاح/فشل/إلغاء):
 *   - يحذف ZIP المؤقت (deps.removeTempJob).
 *   - يحذف مجلد الاستخراج المؤقت من cache (deps.removeExtractedDir).
 *   - لا يحذف الملفات المثبتة في documentDirectory.
 *
 * المرحلة الحالية (23):
 *   Downloader + Extractor + PackageValidator + AudioRepository مفعّلون.
 *   دورة الحياة كاملة من DOWNLOADING حتى INSTALLED.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { File }                             from 'expo-file-system';
import type { DownloadJob, DownloadProgress } from './download-types';
import type { IDownloader }                   from './idownloader';
import { DownloadCancelledError }             from './idownloader';
import type { IZipExtractor }                 from './download-extractor';
import type { DownloadEventBus }              from './download-events';
import type { PackageStateMachine }           from '../package-state';
import type { AudioPackage }                  from '../audio-manifest';
import type { InstalledPackageInfo }          from '../audio-storage';
import type { PackageValidationResult }       from '../package-validator';
import type { AudioRepositoryResult }         from '../audio-repository';
import type { AudioType }                     from '../audio-types';

// ─── WorkerState ──────────────────────────────────────────────────────────────

/** الحالة الداخلية للـ Worker (مستقلة عن PackageState) */
export type WorkerState = 'idle' | 'running' | 'paused' | 'done';

// ─── WorkerResult ─────────────────────────────────────────────────────────────

/**
 * نتيجة يُعيدها run() بعد انتهاء Worker.
 * يستخدمها DownloadManager لاتخاذ القرار التالي.
 */
export interface WorkerResult {
  readonly outcome: 'finished' | 'failed' | 'cancelled';
  readonly job:     DownloadJob;
}

// ─── WorkerDeps ───────────────────────────────────────────────────────────────

/**
 * التبعيات المُحقنة في Worker (Dependency Inversion).
 *
 * Worker يعرف فقط: IDownloader، IZipExtractor، PackageValidator،
 *                  AudioRepository، StateMachine، EventBus.
 * Worker ممنوع من معرفة: Registry، AudioStorage، DownloadQueue.
 */
export interface WorkerDeps {
  /** طبقة التنزيل (Stub في مرحلة 20، حقيقي منذ مرحلة 21) */
  downloader: IDownloader;

  /** طبقة فك الضغط (حقيقي منذ مرحلة 22) */
  extractor: IZipExtractor;

  /** StateMachine في الذاكرة — يُستخدم الحقيقي دائماً */
  stateMachine: PackageStateMachine;

  /** EventBus — يُستخدم الحقيقي دائماً (pub/sub خالص) */
  eventBus: DownloadEventBus;

  /**
   * التحقق من صحة ملف ZIP المحمَّل (قبل الاستخراج).
   * Stub في مرحلة 22–23: يُعيد { valid: true, errors: [] } دائماً.
   * TODO (مرحلة مستقبلية): فحص SHA-256 حقيقي للملف.
   */
  validatePackage: (job: DownloadJob) => Promise<{ valid: boolean; errors: string[] }>;

  /**
   * التحقق من صحة بيانات manifest.json داخل المجلد المستخرج (بعد الاستخراج).
   * حقيقي منذ مرحلة 23 — يستدعي packageValidator.validatePackage().
   */
  validateManifest: (pkg: AudioPackage) => PackageValidationResult;

  /**
   * تثبيت الحزمة عبر AudioRepository (FileSystem + Registry).
   * حقيقي منذ مرحلة 23 — يستدعي audioRepository.installFromExtracted().
   * extractedPath: مسار نظام الملفات (بدون file://) من ExtractResult.
   */
  installPackage: (info: InstalledPackageInfo, extractedPath: string) => Promise<AudioRepositoryResult<void>>;

  /**
   * حذف ملف ZIP المؤقت الخاص بالـ Job.
   * حقيقي منذ مرحلة 23 — يستدعي audioStorage.removeTempJob().
   */
  removeTempJob: (jobId: string) => Promise<void>;

  /**
   * حذف مجلد الاستخراج المؤقت من cache.
   * حقيقي منذ مرحلة 23 — يحذف {cache}/audio/packages/{type}/{packageId}.
   */
  removeExtractedDir: (type: AudioType, packageId: string) => void;
}

// ─── DownloadWorker ───────────────────────────────────────────────────────────

export class DownloadWorker {

  // ── الحالة الداخلية ─────────────────────────────────────────────────────────

  private _workerState: WorkerState = 'idle';
  private _cancelled:   boolean     = false;
  private _paused:      boolean     = false;

  /** قائمة Resolvers تنتظر استدعاء resume() */
  private _resumeResolvers: Array<() => void> = [];

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(
    private readonly job:  DownloadJob,
    private readonly deps: WorkerDeps,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /** الحالة الحالية للـ Worker */
  get state(): WorkerState {
    return this._workerState;
  }

  /**
   * يُشغّل دورة الحياة الكاملة للـ Job.
   * DOWNLOADING → DOWNLOADED → VALIDATING → INSTALLING → INSTALLED
   * مع Retry عند الفشل و Cleanup في جميع الحالات.
   *
   * onStart يُطلق هنا مرة واحدة فقط قبل _executeWithRetry().
   * onRetry يُطلق داخل _executeWithRetry() عند كل إعادة محاولة.
   */
  async run(): Promise<WorkerResult> {
    this._workerState = 'running';
    this.job.startedAt = Date.now();
    this.job.status    = 'running';

    // onStart مرة واحدة فقط لكل Job — خارج حلقة Retry
    this.deps.eventBus.emit('onStart', { job: this.job });

    try {
      await this._executeWithRetry();
      return this._buildResult('finished');
    } catch (err) {
      if (this._cancelled || err instanceof DownloadCancelledError) {
        return this._buildResult('cancelled');
      }
      return this._buildResult('failed');
    } finally {
      await this._cleanup();
      this._workerState = 'done';
      this.job.finishedAt = Date.now();
    }
  }

  /**
   * يُوقف التنفيذ مؤقتاً.
   * لن يُستأنف حتى استدعاء resume().
   */
  pause(): void {
    if (this._workerState !== 'running') return;
    this._paused      = true;
    this._workerState = 'paused';
    this.job.status   = 'paused';

    this.deps.eventBus.emit('onPause', { job: this.job });
  }

  /**
   * يستأنف التنفيذ بعد pause().
   */
  resume(): void {
    if (this._workerState !== 'paused') return;
    this._paused      = false;
    this._workerState = 'running';
    this.job.status   = 'running';

    // إيقاظ كل المنتظرين
    const resolvers = this._resumeResolvers.splice(0);
    for (const resolve of resolvers) resolve();

    this.deps.eventBus.emit('onResume', { job: this.job });
  }

  /**
   * يُلغي التنفيذ فوراً.
   * يُوقظ أي pause منتظر ليتمكن run() من الخروج.
   */
  cancel(): void {
    if (this._workerState === 'done') return;
    this._cancelled   = true;
    this._paused      = false; // إيقاظ من pause إذا كان منتظراً
    this._workerState = 'done';
    this.job.status   = 'cancelled';

    // إيقاظ resolvers حتى يتمكن _checkCancelOrPause من إلقاء خطأ
    const resolvers = this._resumeResolvers.splice(0);
    for (const resolve of resolvers) resolve();

    this.deps.eventBus.emit('onCancel', {
      jobId:     this.job.id,
      packageId: this.job.packageId,
    });
  }

  // ── Retry Loop ──────────────────────────────────────────────────────────────

  /**
   * يُشغّل Workflow مع منطق Retry.
   * عند فشل خطوة DOWNLOADING: يُزيد retryCount، يُطلق onRetry، ويُعيد المحاولة.
   * عند استنفاد maxRetries: يُلقي الخطأ الأخير.
   *
   * onStart لا يُطلق هنا — أُطلق مرة واحدة في run().
   * onRetry يُطلق هنا عند كل إعادة محاولة.
   */
  private async _executeWithRetry(): Promise<void> {
    let lastError: unknown;

    for (;;) {
      await this._checkCancelOrPause();

      try {
        await this._stepDownloading();
        await this._checkCancelOrPause();
        await this._stepDownloaded();
        await this._checkCancelOrPause();
        await this._stepValidating();
        await this._checkCancelOrPause();
        await this._stepInstalling();
        await this._checkCancelOrPause();
        await this._stepInstalled();
        return; // ✅ نجاح كامل
      } catch (err) {
        if (this._cancelled || err instanceof DownloadCancelledError) throw err;

        lastError = err;
        this.job.retryCount++;

        if (this.job.retryCount <= this.job.maxRetries) {
          // أعد الحالة إلى NOT_INSTALLED
          this.deps.stateMachine.reset(this.job.packageId, this.job.type);

          // استخرج رسالة السبب من الخطأ إن توفرت
          const reason = lastError instanceof Error
            ? lastError.message
            : `خطأ غير معروف في المحاولة ${this.job.retryCount}`;

          this.job.error = {
            code:    'RETRY',
            message: `فشل التنزيل — إعادة المحاولة ${this.job.retryCount}/${this.job.maxRetries}`,
            jobId:   this.job.id,
            cause:   err,
          };

          // onRetry بدلاً من onStart لكل إعادة محاولة
          this.deps.eventBus.emit('onRetry', {
            jobId:      this.job.id,
            packageId:  this.job.packageId,
            retryCount: this.job.retryCount,
            maxRetries: this.job.maxRetries,
            reason,
          });

          await this._yield();
          continue;
        }

        // استُنفدت المحاولات
        break;
      }
    }

    // وصل هنا = استُنفد maxRetries
    this.job.status = 'failed';
    this.job.error  = {
      code:    'MAX_RETRIES_EXCEEDED',
      message: `فشل التنزيل بعد ${this.job.maxRetries} محاولة`,
      jobId:   this.job.id,
      cause:   lastError,
    };

    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'FAILED',
      { message: this.job.error.message },
    );

    this.deps.eventBus.emit('onError', {
      error:     this.job.error,
      job:       this.job,
      willRetry: false,
    });

    throw new Error(this.job.error.message);
  }

  // ── خطوات Workflow ───────────────────────────────────────────────────────────

  /** الخطوة 1: DOWNLOADING — يستدعي Downloader (Stub في مرحلة 20) */
  private async _stepDownloading(): Promise<void> {
    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'DOWNLOADING',
      { progress: 0, message: 'جارٍ التحميل...' },
    );

    // onStart لا يُطلق هنا — أُطلق مرة واحدة في run() قبل _executeWithRetry()
    // onRetry يُطلق في _executeWithRetry() عند كل إعادة محاولة

    const destPath = `audio/temp/${this.job.id}.zip`;

    // Live Signal — getter يقرأ this._cancelled مباشرة في كل لحظة.
    // يضمن أن Downloader يرى cancel() فور استدعائه، لا بعد انتهاء التنزيل.
    const self = this;

    await this.deps.downloader.download(
      this.job.id,
      this.job.downloadUrl,
      destPath,
      (downloaded, total) => {
        if (!self._cancelled) this._onProgress(downloaded, total);
      },
      { get cancelled() { return self._cancelled; } },
    );

    if (this._cancelled) throw new DownloadCancelledError(this.job.id);
  }

  /** الخطوة 2: DOWNLOADED — اكتمل التنزيل في audio/temp/ */
  private async _stepDownloaded(): Promise<void> {
    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'DOWNLOADED',
      { progress: 100, message: 'اكتمل التحميل — جاهز للتحقق' },
    );

    this._updateProgress(100, 100);
    await this._yield();
  }

  /** الخطوة 3: VALIDATING — يتحقق من سلامة الحزمة */
  private async _stepValidating(): Promise<void> {
    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'VALIDATING',
      { progress: 100, message: 'جارٍ التحقق من سلامة الملف...' },
    );

    await this._yield();

    const result = await this.deps.validatePackage(this.job);

    if (!result.valid) {
      this.deps.stateMachine.setState(
        this.job.packageId,
        this.job.type,
        'CORRUPTED',
        { message: result.errors.join(' | ') },
      );

      const error = {
        code:    'VALIDATION_FAILED',
        message: result.errors.join(' | '),
        jobId:   this.job.id,
      };

      this.deps.eventBus.emit('onError', {
        error,
        job:       this.job,
        willRetry: false, // فشل التحقق لا يُعاد فيه المحاولة
      });

      throw new Error(error.message);
    }
  }

  /** الخطوة 4: INSTALLING — يفك ضغط ZIP، يقرأ manifest، يتحقق، يُثبّت */
  private async _stepInstalling(): Promise<void> {
    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'INSTALLING',
      { progress: 100, message: 'جارٍ فك الضغط...' },
    );

    await this._yield();

    // ── 1. فك الضغط ────────────────────────────────────────────────────────────
    const zipPath  = `audio/temp/${this.job.id}.zip`;
    const destPath = `audio/packages/${this.job.type}/${this.job.packageId}`;

    const extractResult = await this.deps.extractor.extract(zipPath, destPath);

    if (!extractResult.success) {
      throw new Error(extractResult.error ?? 'فشل فك الضغط');
    }

    // ── 2. قراءة manifest.json من المجلد المستخرج ──────────────────────────────
    // المصدر الوحيد لبيانات الحزمة — لا نعتمد على DownloadJob
    const pkg = await this._readExtractedManifest(extractResult.extractedPath);

    // ── 3. التحقق من صحة بيانات الحزمة ───────────────────────────────────────
    const validation = this.deps.validateManifest(pkg);

    if (!validation.valid) {
      this.deps.stateMachine.setState(
        this.job.packageId,
        this.job.type,
        'FAILED',
        { message: validation.errors.join(' | ') },
      );

      const error = {
        code:    'MANIFEST_INVALID',
        message: validation.errors.join(' | '),
        jobId:   this.job.id,
      };

      this.deps.eventBus.emit('onError', {
        error,
        job:       this.job,
        willRetry: false,
      });

      throw new Error(error.message);
    }

    // ── 4. بناء InstalledPackageInfo من بيانات manifest ───────────────────────
    const packageInfo: InstalledPackageInfo = {
      id:          pkg.id,
      type:        pkg.type,
      title:       pkg.title.ar,
      author:      pkg.author,
      version:     pkg.version,
      sizeBytes:   pkg.sizeBytes,
      installedAt: new Date().toISOString(),
      checksum:    pkg.checksum,
      state:       'INSTALLED',
    };

    // ── 5. التثبيت عبر AudioRepository فقط ───────────────────────────────────
    // Repository هو المسؤول الوحيد عن نقل الملفات والتنسيق مع Registry.
    // Worker لا يستدعي AudioStorage أو Registry مباشرة.
    // extractedPath يُمرَّر حتى يعرف Repository أين توجد الملفات المصدر.
    const installResult = await this.deps.installPackage(packageInfo, extractResult.extractedPath);

    if (!installResult.success) {
      this.deps.stateMachine.setState(
        this.job.packageId,
        this.job.type,
        'FAILED',
        { message: installResult.message },
      );

      const error = {
        code:    'INSTALL_FAILED',
        message: installResult.message,
        jobId:   this.job.id,
      };

      this.deps.eventBus.emit('onError', {
        error,
        job:       this.job,
        willRetry: false,
      });

      throw new Error(error.message);
    }
  }

  // ── مساعد: قراءة manifest.json من المجلد المستخرج ────────────────────────────

  /**
   * يقرأ manifest.json من المجلد المستخرج ويُعيد AudioPackage.
   *
   * @param extractedPath - المسار المطلق للمجلد المستخرج (بدون file://)
   *                        كما يُعيده DownloadExtractor.extract()
   * @throws إذا لم يكن manifest.json موجوداً أو لم يكن JSON صالحاً
   */
  private async _readExtractedManifest(extractedPath: string): Promise<AudioPackage> {
    const manifestUri = `file://${extractedPath}/manifest.json`;
    const file = new File(manifestUri);

    if (!file.exists) {
      throw new Error(`manifest.json غير موجود في المجلد المستخرج: ${extractedPath}`);
    }

    const raw = await file.text();
    return JSON.parse(raw) as AudioPackage;
  }

  /** الخطوة 5: INSTALLED — تسجيل في Registry وإطلاق onFinish */
  private async _stepInstalled(): Promise<void> {
    this.deps.stateMachine.setState(
      this.job.packageId,
      this.job.type,
      'INSTALLED',
      { progress: 100, message: 'تم التثبيت بنجاح' },
    );

    this.job.status   = 'finished';
    this.job.progress = this._buildProgress(100, 100);

    this.deps.eventBus.emit('onFinish', {
      job:           this.job,
      localPath:     `audio/packages/${this.job.type}/${this.job.packageId}/`,
      totalDuration: this.job.startedAt ? Date.now() - this.job.startedAt : 0,
    });
  }

  // ── مساعدات Progress ─────────────────────────────────────────────────────────

  /** يُحدّث progress على job ويُطلق حدث onProgress */
  private _onProgress(downloaded: number, total: number): void {
    this._updateProgress(downloaded, total);
    this.deps.eventBus.emit('onProgress', {
      jobId:    this.job.id,
      progress: this.job.progress!,
    });
  }

  private _updateProgress(downloaded: number, total: number): void {
    this.job.progress = this._buildProgress(downloaded, total);

    // تحديث PackageState.progress أثناء DOWNLOADING
    const pkgState = this.deps.stateMachine.getState(this.job.packageId, this.job.type);
    if (pkgState.state === 'DOWNLOADING') {
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      this.deps.stateMachine.setState(
        this.job.packageId,
        this.job.type,
        'DOWNLOADING',
        { progress: percent },
      );
    }
  }

  private _buildProgress(downloaded: number, total: number): DownloadProgress {
    const elapsedMs       = this.job.startedAt ? Date.now() - this.job.startedAt : 0;
    // متوسط السرعة الكلي: bytes منذ بداية الـ Job (مقبول لعرضه للمستخدم)
    const bytesPerSecond  = elapsedMs > 0
      ? Math.round((downloaded / elapsedMs) * 1_000)
      : 0;
    return {
      bytesDownloaded: downloaded,
      totalBytes:      total,
      percent:         total > 0 ? Math.round((downloaded / total) * 100) : 0,
      bytesPerSecond,
      elapsedMs,
    };
  }

  // ── Pause / Cancel Check ─────────────────────────────────────────────────────

  /**
   * نقطة تفتيش بين الخطوات.
   * - إذا كان مُلغى: يُلقي DownloadCancelledError فوراً.
   * - إذا كان متوقفاً: ينتظر حتى استدعاء resume().
   */
  private async _checkCancelOrPause(): Promise<void> {
    if (this._cancelled) throw new DownloadCancelledError(this.job.id);
    if (this._paused) {
      await new Promise<void>((resolve) => {
        this._resumeResolvers.push(resolve);
      });
      // بعد الاستيقاظ — تحقق مرة أخرى من الإلغاء
      if (this._cancelled) throw new DownloadCancelledError(this.job.id);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  /**
   * يُنفَّذ دائماً في finally (نجاح / فشل / إلغاء).
   *
   * يحذف:
   *   1. ملف ZIP المؤقت: {cache}/audio/temp/{jobId}.zip
   *   2. مجلد الاستخراج المؤقت: {cache}/audio/packages/{type}/{packageId}
   *
   * لا يحذف:
   *   - الحزمة المثبتة في documentDirectory (إن نجح installPackage)
   *   - ملفات Jobs أخرى
   *
   * أي خطأ في الـ Cleanup يُبتلع — لا يُفشل الـ Job.
   */
  private async _cleanup(): Promise<void> {
    try {
      await this.deps.removeTempJob(this.job.id);
    } catch {
      // Cleanup لا يُفشل الـ Job أبداً
    }

    try {
      this.deps.removeExtractedDir(this.job.type, this.job.packageId);
    } catch {
      // Cleanup لا يُفشل الـ Job أبداً
    }
  }

  // ── نتيجة ───────────────────────────────────────────────────────────────────

  private _buildResult(outcome: WorkerResult['outcome']): WorkerResult {
    return { outcome, job: this.job };
  }

  // ── مساعد Async ─────────────────────────────────────────────────────────────

  /** يُسلّم دور التنفيذ للـ event loop للدورة التالية */
  private _yield(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
