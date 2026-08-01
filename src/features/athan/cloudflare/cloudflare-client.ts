/**
 * src/features/athan/cloudflare/cloudflare-client.ts
 *
 * CloudflareClient -- الطبقة الوحيدة التي تتواصل مع Cloudflare.
 *
 * الاعداد:
 *   EXPO_PUBLIC_CF_BASE_URL=https://your-bucket.r2.dev  في ملف .env
 *
 * ما لا يفعله:
 * - لا يشغل صوت
 * - لا يحفظ ملفات
 * - لا يعرف AsyncStorage او FileSystem او UI
 */



import type {
  CloudflareCatalogItem,
  CloudflareMetadata,
  CloudflareResult,
} from './cloudflare-types';

import { cfOk, cfFail } from './cloudflare-types';

// --- اعداد الاتصال ---

const BASE_URL: string = process.env.EXPO_PUBLIC_CF_BASE_URL ?? '';

const TIMEOUT_MS = 10_000;

export const ENDPOINTS = {
  catalog:     `${BASE_URL}/api/athan/catalog`,
  metadata:    (id: string) => `${BASE_URL}/api/athan/voices/${encodeURIComponent(id)}`,
  downloadUrl: (id: string) => `${BASE_URL}/api/athan/voices/${encodeURIComponent(id)}/download`,
} as const;

// --- دالة مساعدة: طلب HTTP مع مهلة ---

async function cfFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- CloudflareClient ---

class CloudflareClient {

  /** يجلب قائمة المؤذنين المتاحين للتحميل */
  async fetchCatalog(): Promise<CloudflareResult<CloudflareCatalogItem[]>> {
    if (!BASE_URL) return cfFail('NOT_CONFIGURED -- اضبط EXPO_PUBLIC_CF_BASE_URL');
    try {
      const res = await cfFetch(ENDPOINTS.catalog);
      if (!res.ok) return cfFail(`HTTP ${res.status} -- فشل جلب الكتالوج`);
      const data = await res.json() as CloudflareCatalogItem[];
      return cfOk(data, `تم جلب ${data.length} مؤذن`);
    } catch (err) {
      return cfFail('فشل الاتصال', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** يجلب البيانات التفصيلية لمؤذن محدد */
  async fetchMetadata(id: string): Promise<CloudflareResult<CloudflareMetadata>> {
    if (!BASE_URL) return cfFail('NOT_CONFIGURED -- اضبط EXPO_PUBLIC_CF_BASE_URL');
    try {
      const res = await cfFetch(ENDPOINTS.metadata(id));
      if (!res.ok) return cfFail(`HTTP ${res.status} -- فشل جلب بيانات "${id}"`);
      const data = await res.json() as CloudflareMetadata;
      return cfOk(data);
    } catch (err) {
      return cfFail(`فشل الاتصال لجلب بيانات "${id}"`, err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * يجلب رابط التحميل المباشر لمؤذن محدد.
   * يتوقع استجابة JSON بالشكل { url: "..." } او يستخدم الرابط المباشر.
   */
  async fetchDownloadUrl(id: string): Promise<CloudflareResult<string>> {
    if (!BASE_URL) return cfFail('NOT_CONFIGURED -- اضبط EXPO_PUBLIC_CF_BASE_URL');
    try {
      const res = await cfFetch(ENDPOINTS.downloadUrl(id));
      if (!res.ok) return cfFail(`HTTP ${res.status} -- فشل جلب رابط "${id}"`);
      try {
        const body = await res.json() as { url?: string };
        if (body.url) return cfOk(body.url);
      } catch {
        // الاستجابة ليست JSON -- استخدام الرابط المباشر
      }
      return cfOk(ENDPOINTS.downloadUrl(id));
    } catch (err) {
      return cfFail(`فشل الاتصال لجلب رابط "${id}"`, err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// --- Singleton ---

export const cloudflareClient = new CloudflareClient();
