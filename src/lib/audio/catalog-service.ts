/**
 * catalog-service.ts
 * طبقة الكتالوج — قراءة قائمة الحزم المتاحة من CatalogSource
 *
 * ─── المبدأ ──────────────────────────────────────────────────────────────────
 * CatalogService لا يعرف مصدر البيانات — يتلقّاها عبر CatalogSource.
 * هذا يتيح استبدال LocalCatalogSource بـ CloudflareCatalogSource
 * دون تعديل أي سطر من CatalogService أو AudioRepository.
 *
 * ─── الطبقات ─────────────────────────────────────────────────────────────────
 *
 *   AudioRepository
 *       ↓
 *   CatalogService
 *       ↓
 *   CatalogSource (Interface)
 *       ↓
 *   LocalCatalogSource       ← الحالية (SAMPLE_MANIFEST)
 *   CloudflareCatalogSource  ← (fetch من R2)
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - CatalogService لا يعرف Repository أو Storage أو Registry أو FileSystem
 * - الترتيب يعتمد دائماً على sortOrder وليس ترتيب المصفوفة
 * - title و description من نوع LocalizedString — لا يوجد منطق ترجمة هنا
 * - مقارنة الكتالوج بالحزم المثبتة (compareWithInstalled) موجودة في AudioRepository
 */

import type { AudioPackage, Category, Manifest } from './audio-manifest';
import { SAMPLE_MANIFEST } from './audio-manifest';
import type { AudioType } from './audio-types';

// ─── مساعد الترتيب ────────────────────────────────────────────────────────────

/**
 * يرتّب أي مصفوفة حسب حقل sortOrder تصاعدياً
 * لا يُعدّل المصفوفة الأصلية
 */
function sortBySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── CatalogSource (Interface) ────────────────────────────────────────────────

/**
 * عقد مصدر الكتالوج — أي تنفيذ يُعيد Manifest
 *
 * LocalCatalogSource      → يقرأ SAMPLE_MANIFEST مباشرة
 * CloudflareCatalogSource → يجلب index.json من Cloudflare R2
 */
export interface CatalogSource {
  getCatalog(): Promise<Manifest>;
}

// ─── LocalCatalogSource ───────────────────────────────────────────────────────

/**
 * مصدر الكتالوج المحلي — يقرأ SAMPLE_MANIFEST الموجود في الكود
 * لا يستخدم الإنترنت
 */
export class LocalCatalogSource implements CatalogSource {
  async getCatalog(): Promise<Manifest> {
    return SAMPLE_MANIFEST;
  }
}

// ─── PackageComparisonResult ──────────────────────────────────────────────────

/** نتيجة مقارنة حزمة واحدة بين الكتالوج والـ Registry */
export interface PackageComparisonResult {
  /** معرّف الحزمة */
  id: string;
  /** نوع المحتوى الصوتي */
  type: AudioType;
  /** هل الحزمة مثبتة على الجهاز؟ */
  installed: boolean;
  /** النسخة المثبتة (null إذا لم تكن مثبتة) */
  installedVersion: string | null;
  /** النسخة المتاحة في الكتالوج */
  remoteVersion: string;
  /** هل تحتاج الحزمة إلى تحديث؟ */
  needsUpdate: boolean;
  /** هل الحزمة مهجورة في الكتالوج؟ */
  deprecated: boolean;
}

// ─── CatalogTestReport ────────────────────────────────────────────────────────

export interface CatalogTestReport {
  totalPackages: number;
  totalCategories: number;
  featuredPackages: number;
  activePackages: number;
}

// ─── CatalogService ───────────────────────────────────────────────────────────

export class CatalogService {
  private readonly source: CatalogSource;

  constructor(source: CatalogSource = new LocalCatalogSource()) {
    this.source = source;
  }

  // ── Manifest كامل ────────────────────────────────────────────────────────

  /**
   * يُعيد الـ Manifest كاملاً من المصدر المحدد
   */
  async getCatalog(): Promise<Manifest> {
    return this.source.getCatalog();
  }

  // ── Categories ────────────────────────────────────────────────────────────

  /**
   * يُعيد قائمة التصنيفات مرتّبة حسب sortOrder
   * يقرأها من Manifest مباشرة — لا يُنشئها من packages
   */
  async getCategories(): Promise<Category[]> {
    const catalog = await this.source.getCatalog();
    return sortBySortOrder(catalog.categories);
  }

  /**
   * يُعيد التصنيفات المفعّلة فقط (enabled: true) مرتّبة حسب sortOrder
   */
  async getEnabledCategories(): Promise<Category[]> {
    const categories = await this.getCategories();
    return categories.filter((c) => c.enabled);
  }

  // ── Packages ──────────────────────────────────────────────────────────────

  /**
   * يُعيد جميع الحزم مرتّبة حسب sortOrder
   */
  async getPackages(): Promise<AudioPackage[]> {
    const catalog = await this.source.getCatalog();
    return sortBySortOrder(catalog.packages);
  }

  /**
   * يُعيد الحزم المُصفّاة حسب النوع مرتّبة حسب sortOrder
   */
  async getPackagesByType(type: AudioType): Promise<AudioPackage[]> {
    const packages = await this.getPackages();
    return packages.filter((p) => p.type === type);
  }

  /**
   * يُعيد حزمة واحدة بالـ id والـ type، أو null إذا لم تُوجد
   */
  async getPackage(id: string, type: AudioType): Promise<AudioPackage | null> {
    const packages = await this.getPackages();
    return packages.find((p) => p.id === id && p.type === type) ?? null;
  }

  /**
   * يُعيد الحزم المميزة (featured: true) مرتّبة حسب sortOrder
   */
  async getFeaturedPackages(): Promise<AudioPackage[]> {
    const packages = await this.getPackages();
    return packages.filter((p) => p.featured);
  }

  /**
   * يُعيد الحزم غير المهجورة فقط (deprecated: false) مرتّبة حسب sortOrder
   */
  async getActivePackages(): Promise<AudioPackage[]> {
    const packages = await this.getPackages();
    return packages.filter((p) => !p.deprecated);
  }
}

// ─── singleton (يستخدم LocalCatalogSource افتراضياً) ─────────────────────────
export const catalogService = new CatalogService();

// ─── Test Function ────────────────────────────────────────────────────────────

/**
 * اختبار المرحلة السابعة عشرة:
 * قراءة الكتالوج فقط — CatalogService لا يعرف Registry
 */
export async function testCatalog(): Promise<CatalogTestReport> {
  const [packages, categories] = await Promise.all([
    catalogService.getPackages(),
    catalogService.getCategories(),
  ]);

  return {
    totalPackages:   packages.length,
    totalCategories: categories.length,
    featuredPackages: packages.filter((p) => p.featured).length,
    activePackages:   packages.filter((p) => !p.deprecated).length,
  };
}
