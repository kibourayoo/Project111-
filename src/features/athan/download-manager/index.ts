/**
 * src/features/athan/download-manager/index.ts
 * نقطة تصدير موحّدة لـ Download Manager Layer.
 */
export { downloadManager }          from './download-manager';
export type {
  DownloadEntry,
  DownloadStatus,
  DownloadStatusChangedEvent,
  DownloadProgressEvent,
  StatusChangedListener,
  ProgressListener,
  ManagerResult,
  ManagerUnsubscribe,
}                                   from './download-manager-types';
export { mgrOk, mgrOk0, mgrFail }  from './download-manager-types';
