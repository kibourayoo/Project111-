/**
 * src/features/athan/cloudflare/index.ts
 * نقطة تصدير موحّدة لطبقة Cloudflare.
 */
export { cloudflareClient, ENDPOINTS } from './cloudflare-client';
export type {
  CloudflareCatalogItem,
  CloudflareMetadata,
  CloudflareResult,
  RemoteChecksum,
  RemoteVersion,
  RemoteVoice,
} from './cloudflare-types';
export { cfOk, cfFail } from './cloudflare-types';
