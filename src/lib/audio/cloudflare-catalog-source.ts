/**
 * cloudflare-catalog-source.ts
 * تنفيذ CatalogSource يقرأ index.json من Cloudflare R2
 *
 * ─── المسؤولية الوحيدة ───────────────────────────────────────────────────────
 * تحميل index.json → تحويله إلى Manifest → إرجاعه
 *
 * لا يقوم بأي:
 *   - تحميل للحزم الصوتية
 *   - تخزين مؤقت (Caching)
 *   - كتابة على FileSystem
 *   - تثبيت أو حذف
 *   - Validation للحزم
 *
 * ─── الاستبدال ───────────────────────────────────────────────────────────────
 * لاستخدام هذا المصدر بدلاً من LocalCatalogSource:
 *
 *   import { CloudflareCatalogSource } from './cloudflare-catalog-source';
 *   const catalog = new CatalogService(new CloudflareCatalogSource());
 *
 * لا يتغير أي شيء في CatalogService أو بقية النظام.
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - CATALOG_URL: Placeholder حالياً — استبدله بالرابط الحقيقي لاحقاً
 * - لا يوجد fallback عند الفشل — يرمي Error واضح
 * - يستخدم expo/fetch (متوافق مع Expo SDK 55)
 */

import { fetch } from 'expo/fetch';
import type { Manifest } from './audio-manifest';
import { isManifestValid } from './audio-manifest';
import type { CatalogSource } from './catalog-service';

// ─── CATALOG_URL ──────────────────────────────────────────────────────────────
/**
 * TODO: استبدل هذا الـ Placeholder برابط Cloudflare R2 الحقيقي
 * مثال: 'https://your-bucket.r2.dev/audio/index.json'
 */
export const CATALOG_URL = 'https://example.com/index.json';

// ─── CloudflareCatalogSource ──────────────────────────────────────────────────

export class CloudflareCatalogSource implements CatalogSource {
  private readonly url: string;

  /**
   * @param url رابط index.json (افتراضي: CATALOG_URL)
   * يمكن تمرير رابط مختلف في الاختبارات
   */
  constructor(url: string = CATALOG_URL) {
    this.url = url;
  }

  /**
   * يُحمّل index.json من Cloudflare R2 ويُعيد Manifest
   * @throws {Error} إذا فشل الاتصال أو كان الرد غير صالح
   */
  async getCatalog(): Promise<Manifest> {
    let response: Response;

    try {
      response = await fetch(this.url);
    } catch (networkError) {
      throw new Error(
        `فشل الاتصال بـ Cloudflare R2: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `فشل تحميل index.json: HTTP ${response.status} ${response.statusText} (${this.url})`,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('فشل تحليل index.json: الملف ليس JSON صالحاً');
    }

    if (!isManifestValid(data)) {
      throw new Error('index.json غير صالح: لا يطابق مخطط AudioManifest');
    }

    return data;
  }
}

// ─── CloudflareCatalogTestReport ──────────────────────────────────────────────

export interface CloudflareCatalogTestReport {
  /** هل تم الاتصال بـ Cloudflare R2 بنجاح؟ */
  fetchSuccess: boolean;
  /** هل الـ Manifest الذي أُعيد صالح؟ */
  manifestValid: boolean;
  /** عدد الحزم في الكتالوج */
  packageCount: number;
  /** رسالة الخطأ إذا فشلت العملية */
  errorMessage: string | null;
}

/**
 * اختبار المرحلة الثانية عشرة:
 * استدعاء getCatalog() → التأكد من صحة الـ Manifest → تقرير
 *
 * ⚠️ هذا الاختبار يتطلب اتصالاً بالإنترنت وCATALOG_URL صحيحاً
 * حالياً سيفشل لأن CATALOG_URL هو Placeholder
 */
export async function testCloudflareCatalog(): Promise<CloudflareCatalogTestReport> {
  const source = new CloudflareCatalogSource();

  try {
    const manifest = await source.getCatalog();
    return {
      fetchSuccess:  true,
      manifestValid: isManifestValid(manifest),
      packageCount:  manifest.packages.length,
      errorMessage:  null,
    };
  } catch (err) {
    return {
      fetchSuccess:  false,
      manifestValid: false,
      packageCount:  0,
      errorMessage:  err instanceof Error ? err.message : String(err),
    };
  }
}
