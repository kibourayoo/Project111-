/**
 * src/features/athan/storage/index.ts
 * نقطة تصدير موحّدة لطبقة التخزين المحلي.
 */
export { storageService }                    from './storage-service';
export type { StoredVoiceRecord, StorageResult } from './storage-types';
export { storageOk, storageOk0, storageFail }    from './storage-types';
