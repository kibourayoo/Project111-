/**
 * audio-repository.ts
 * Facade موحّد — نقطة الدخول الوحيدة لإدارة المحتوى الصوتي
 *
 * ─── المبدأ ──────────────────────────────────────────────────────────────────
 * لا تتعامل أي شاشة أو خدمة خارجية مباشرة مع:
 *   - AudioStorageService
 *   - RegistryService
 *   - FileSystem
 *
 * بل تستخدم AudioRepository فقط.
 *
 * ─── الطبقات ─────────────────────────────────────────────────────────────────
 *
 *   UI / Screens
 *       ↓
 *   AudioRepository   ← هذا الملف (Facade)
 *       ↓          ↓
 *   AudioStorageService   RegistryService
 *       ↓
 *   expo-file-system (Directory / File)
 *
 * ─── التنسيق بين Storage وRegistry ──────────────────────────────────────────
 * AudioRepository هو المسؤول الوحيد عن تنسيق:
 *   installLocalPackage  → Storage (كتابة الملفات) + Registry (تسجيل الحزمة)
 *   removePackage        → Storage (حذف الملفات)  + Registry (حذف السجل)
 * لا يُجري Storage أي عمليات على Registry بشكل مباشر.
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - لا يحتوي على أي منطق جديد — يُفوّض ويُنسّق فقط
 * - كل دالة تُعيد AudioRepositoryResult<T>
 * - لا شبكة، لا ZIP، لا AsyncStorage
 */

import type { InstalledPackageInfo, StorageReport } from './audio-storage';
import { audioStorage } from './audio-storage';
import type { InstalledRegistry } from './audio-registry';
import { registryService } from './audio-registry';
import type { AudioType } from './audio-types';
import type { AudioPackage } from './audio-manifest';
import { catalogService } from './catalog-service';

// ─── PackageComparisonResult ──────────────────────────────────────────────────

/** نتيجة مقارنة حزمة واحدة بين الكتالوج والـ Registry */
export interface PackageComparisonResult {
  id: string;
  type: AudioType;
  installed: boolean;
  installedVersion: string | null;
  remoteVersion: string;
  needsUpdate: boolean;
  deprecated: boolean;
}

// ─── AudioRepositoryResult ───────────────────────────────────────────────────

/**
 * نتيجة موحّدة لجميع عمليات Repository
 *
 * نمط الاستخدام:
 *   const result = await audioRepository.getInstalledPackages();
 *   if (result.success) { ... result.data ... }
 *   else { console.error(result.message); }
 */
export interface AudioRepositoryResult<T = void> {
  /** هل نجحت العملية؟ */
  success: boolean;
  /** البيانات المُعادة عند النجاح */
  data?: T;
  /** الخطأ الأصلي عند الفشل */
  error?: unknown;
  /** رسالة وصفية للمطوّر */
  message: string;
}

// ─── مساعد داخلي لبناء النتائج ────────────────────────────────────────────────

function ok<T>(data: T, message = 'success'): AudioRepositoryResult<T> {
  return { success: true, data, message };
}

function ok0(message = 'success'): AudioRepositoryResult<void> {
  return { success: true, message };
}

function fail<T = void>(error: unknown, message?: string): AudioRepositoryResult<T> {
  const msg = message ?? (error instanceof Error ? error.message : String(error));
  return { success: false, error, message: msg };
}

// ─── AudioRepository ──────────────────────────────────────────────────────────

export class AudioRepository {

  // ── تهيئة النظام ─────────────────────────────────────────────────────────

  /**
   * يُهيّئ هيكل التخزين + Registry عند أول تشغيل
   * آمن للاستدعاء أكثر من مرة
   */
  async initialize(): Promise<AudioRepositoryResult<StorageReport>> {
    try {
      await audioStorage.initializeStorage();
      await registryService.createRegistryIfNeeded();
      const report = await audioStorage.verifyStorage();
      return ok(report, 'تم تهيئة نظام التخزين بنجاح');
    } catch (e) {
      return fail(e, 'فشل تهيئة نظام التخزين');
    }
  }

  // ── قراءة البيانات من Registry ──────────────────────────────────────────────

  /**
   * يُعيد جميع الحزم المثبتة من Registry
   */
  async getInstalledPackages(): Promise<AudioRepositoryResult<InstalledPackageInfo[]>> {
    try {
      const packages = await registryService.getInstalledPackages();
      return ok(packages, `تم جلب ${packages.length} حزمة مثبتة`);
    } catch (e) {
      return fail(e, 'فشل جلب الحزم المثبتة');
    }
  }

  /**
   * يُعيد حزمة واحدة من Registry أو null إذا لم تكن موجودة
   */
  async getInstalledPackage(
    id: string,
    type: AudioType,
  ): Promise<AudioRepositoryResult<InstalledPackageInfo | null>> {
    try {
      const pkg = await registryService.getInstalledPackage(id, type);
      return ok(pkg, pkg ? `تم العثور على الحزمة: ${id}` : `الحزمة غير موجودة: ${id}`);
    } catch (e) {
      return fail(e, `فشل جلب الحزمة: ${id}`);
    }
  }

  /**
   * يتحقق من تثبيت الحزمة (من Registry فقط)
   */
  async isInstalled(
    id: string,
    type: AudioType,
  ): Promise<AudioRepositoryResult<boolean>> {
    try {
      const installed = await registryService.isInstalled(id, type);
      return ok(installed, installed ? `الحزمة مثبتة: ${id}` : `الحزمة غير مثبتة: ${id}`);
    } catch (e) {
      return fail(e, `فشل التحقق من تثبيت الحزمة: ${id}`);
    }
  }

  // ── عمليات التثبيت والحذف ──────────────────────────────────────────────────

  /**
   * يُثبّت حزمة محلية (FileSystem + Registry)
   * Repository هو المنسّق: يكتب الملفات أولاً ثم يسجّل في Registry
   */
  async installLocalPackage(
    packageInfo: InstalledPackageInfo,
  ): Promise<AudioRepositoryResult<void>> {
    try {
      // 1. كتابة الملفات عبر Storage
      await audioStorage.installLocalPackage(packageInfo);
      // 2. تسجيل الحزمة في Registry
      await registryService.addOrUpdatePackage(packageInfo);
      return ok0(`تم تثبيت الحزمة بنجاح: ${packageInfo.id}`);
    } catch (e) {
      return fail(e, `فشل تثبيت الحزمة: ${packageInfo.id}`);
    }
  }

  /**
   * يُثبّت حزمة من مجلد الاستخراج المؤقت (الحالة الحقيقية منذ مرحلة 23).
   *
   * الترتيب الصارم:
   *   1. نسخ جميع الملفات من extractedPath إلى documentDirectory (عبر Storage).
   *   2. تحديث Registry فقط بعد نجاح النسخ الكامل.
   *
   * Rollback تلقائي:
   *   إذا فشل النسخ في أي ملف — Storage يتولى Rollback.
   *   Registry لا يُحدَّث أبداً عند الفشل.
   *
   * @param packageInfo   - بيانات الحزمة (مشتقة من manifest.json)
   * @param extractedPath - مسار نظام الملفات المطلق (بدون file://)
   *                        كما يُعيده DownloadExtractor.extract()
   */
  async installFromExtracted(
    packageInfo:   InstalledPackageInfo,
    extractedPath: string,
  ): Promise<AudioRepositoryResult<void>> {
    try {
      // 1. نقل الملفات (+ كتابة manifest) عبر Storage
      await audioStorage.copyPackageFromExtracted(
        extractedPath,
        packageInfo.type,
        packageInfo.id,
        packageInfo,
      );
      // 2. تسجيل الحزمة في Registry بعد نجاح النسخ
      await registryService.addOrUpdatePackage(packageInfo);
      return ok0(`تم تثبيت الحزمة بنجاح: ${packageInfo.id}`);
    } catch (e) {
      return fail(e, `فشل تثبيت الحزمة: ${packageInfo.id}`);
    }
  }

  /**
   * يحذف حزمة من FileSystem و Registry معاً
   * Repository هو المنسّق: يحذف الملفات أولاً ثم يحذف سجل Registry
   */
  async removePackage(
    id: string,
    type: AudioType,
  ): Promise<AudioRepositoryResult<void>> {
    try {
      // 1. حذف الملفات عبر Storage
      await audioStorage.removeInstalledPackage(type, id);
      // 2. حذف سجل Registry
      await registryService.removePackage(id, type);
      return ok0(`تم حذف الحزمة بنجاح: ${id}`);
    } catch (e) {
      return fail(e, `فشل حذف الحزمة: ${id}`);
    }
  }

  /**
   * يقرأ package-info.json من FileSystem مباشرة (عبر AudioStorage).
   * يُستخدم من verify() للتحقق من وجود الملف وقابلية قراءته على القرص.
   * @throws عبر AudioRepositoryResult.error إذا كان الملف غير موجود أو تالفاً
   */
  async readPackageInfo(
    id:   string,
    type: AudioType,
  ): Promise<AudioRepositoryResult<InstalledPackageInfo>> {
    try {
      const info = await audioStorage.readPackageInfo(type, id);
      return ok(info, `تمت قراءة package-info.json بنجاح: ${id}`);
    } catch (e) {
      return fail(e, `تعذّرت قراءة package-info.json: ${id}`);
    }
  }

  // ── تشخيص ─────────────────────────────────────────────────────────────────

  /**
   * يتحقق من سلامة هيكل التخزين
   */
  async verifyStorage(): Promise<AudioRepositoryResult<StorageReport>> {
    try {
      const report = await audioStorage.verifyStorage();
      return ok(report, 'تم التحقق من هيكل التخزين');
    } catch (e) {
      return fail(e, 'فشل التحقق من هيكل التخزين');
    }
  }

  /**
   * يُعيد Registry كاملاً (للتشخيص)
   */
  async getRegistry(): Promise<AudioRepositoryResult<InstalledRegistry>> {
    try {
      const registry = await registryService.loadRegistry();
      return ok(registry, 'تم جلب Registry بنجاح');
    } catch (e) {
      return fail(e, 'فشل جلب Registry');
    }
  }

  // ── مقارنة الكتالوج بالمثبت ──────────────────────────────────────────────

  /**
   * يقارن كل حزمة في الكتالوج بما هو مثبت في Registry
   * Repository هو المكان الصحيح لهذه العملية:
   * يعرف الكتالوج (عبر CatalogService) + الحزم المثبتة (عبر RegistryService)
   */
  async compareWithInstalled(): Promise<AudioRepositoryResult<PackageComparisonResult[]>> {
    try {
      const [packages, installedPackages] = await Promise.all([
        catalogService.getPackages(),
        registryService.getInstalledPackages(),
      ]);

      const results: PackageComparisonResult[] = packages.map((pkg) => {
        const installedPkg =
          installedPackages.find((p) => p.id === pkg.id && p.type === pkg.type) ?? null;
        const installedVersion = installedPkg?.version ?? null;
        const needsUpdate = installedPkg !== null && installedVersion !== pkg.version;
        return {
          id:               pkg.id,
          type:             pkg.type,
          installed:        installedPkg !== null,
          installedVersion,
          remoteVersion:    pkg.version,
          needsUpdate,
          deprecated:       pkg.deprecated,
        };
      });

      return ok(results, `تمت مقارنة ${results.length} حزمة`);
    } catch (e) {
      return fail(e, 'فشل مقارنة الكتالوج بالحزم المثبتة');
    }
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const audioRepository = new AudioRepository();

// ─── نتيجة اختبار Repository ─────────────────────────────────────────────────

export interface RepositoryTestReport {
  initSuccess: boolean;
  installSuccess: boolean;
  packagesAfterInstall: number;
  isInstalledAfterInstall: boolean;
  removeSuccess: boolean;
  packagesAfterRemove: number;
}

/**
 * اختبار المرحلة الثامنة — دورة حياة كاملة عبر AudioRepository:
 * initialize → installLocalPackage → getInstalledPackages
 * → isInstalled → removePackage → getInstalledPackages
 */
export async function testRepository(): Promise<RepositoryTestReport> {
  const testPkg: InstalledPackageInfo = {
    id: 'husary',
    type: 'adhan',
    title: 'أذان الشيخ محمود خليل الحصري',
    author: 'محمود خليل الحصري',
    version: '1.0.0',
    sizeBytes: 0,
    installedAt: new Date().toISOString(),
    checksum: 'sha256:repo-test',
    state: 'INSTALLED',
  };

  const report: RepositoryTestReport = {
    initSuccess: false,
    installSuccess: false,
    packagesAfterInstall: 0,
    isInstalledAfterInstall: false,
    removeSuccess: false,
    packagesAfterRemove: 0,
  };

  // 1. تهيئة
  const initResult = await audioRepository.initialize();
  report.initSuccess = initResult.success;

  // 2. تثبيت
  const installResult = await audioRepository.installLocalPackage(testPkg);
  report.installSuccess = installResult.success;

  // 3. جلب الحزم
  const listResult = await audioRepository.getInstalledPackages();
  report.packagesAfterInstall = listResult.data?.length ?? 0;

  // 4. التحقق من التثبيت
  const checkResult = await audioRepository.isInstalled(testPkg.id, testPkg.type);
  report.isInstalledAfterInstall = checkResult.data ?? false;

  // 5. حذف الحزمة
  const removeResult = await audioRepository.removePackage(testPkg.id, testPkg.type);
  report.removeSuccess = removeResult.success;

  // 6. جلب الحزم بعد الحذف
  const listAfter = await audioRepository.getInstalledPackages();
  report.packagesAfterRemove = listAfter.data?.length ?? 0;

  return report;
}
