/**
 * index.ts — download/
 * ─────────────────────────────────────────────────────────────────────────────
 * نقطة التصدير الموحَّدة لطبقة Download Manager.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  DownloadStatus,
  DownloadPriority,
  DownloadJob,
  DownloadProgress,
  DownloadError,
  DownloadResult,
  DownloadQueueItem,
  EnqueueOptions,
} from './download-types';

// ── Queue ────────────────────────────────────────────────────────────────────
export { DownloadQueue, downloadQueue } from './download-queue';

// ── Manager ──────────────────────────────────────────────────────────────────
export { DownloadManager, downloadManager } from './download-manager';

// ── Worker ───────────────────────────────────────────────────────────────────
export type { WorkerState, WorkerResult, WorkerDeps } from './download-worker';
export { DownloadWorker }                              from './download-worker';

// ── Extractor ─────────────────────────────────────────────────────────────────
export type { IZipExtractor, ExtractResult }           from './download-extractor';
export { DownloadExtractor }                           from './download-extractor';

// ── Downloader ────────────────────────────────────────────────────────────────
export type { IDownloader, DownloadSignal }            from './idownloader';
export { DownloaderStub, DownloadCancelledError }      from './idownloader';
export { Downloader }                                  from './downloader';

// ── Events ───────────────────────────────────────────────────────────────────
export type {
  DownloadEventMap,
  DownloadEventName,
  DownloadListener,
  DownloadStartPayload,
  DownloadRetryPayload,
  DownloadProgressPayload,
  DownloadPausePayload,
  DownloadResumePayload,
  DownloadCancelPayload,
  DownloadFinishPayload,
  DownloadErrorPayload,
} from './download-events';
export { DownloadEventBus, downloadEventBus } from './download-events';
