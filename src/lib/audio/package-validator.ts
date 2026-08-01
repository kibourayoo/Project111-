/**
 * package-validator.ts
 * التحقق من صحة الحزم الصوتية — مستقل تماماً
 *
 * ─── المبدأ ──────────────────────────────────────────────────────────────────
 * PackageValidator لا يُثبّت ولا يُحمّل أي شيء.
 * وظيفته الوحيدة: التحقق من صحة الحزمة قبل أي عملية تثبيت.
 *
 * ─── مكان الاستخدام ──────────────────────────────────────────────────────────
 * قبل كل installLocalPackage():
 *   const result = await packageValidator.validatePackage(pkg);
 *   if (!result.valid) { ... عرض الأخطاء ... return; }
 *   await audioRepository.installLocalPackage(info);
 *
 * ─── الدوال ──────────────────────────────────────────────────────────────────
 *   validateManifestHeader()   ← حقول Manifest الجذرية (catalogVersion، categories…)
 *   validateCategory()         ← حقول Category (id، title، description…)
 *   validateManifest()         ← حقول AudioPackage (Schema النهائي)
 *   validateChecksum()         ← مقارنة القيم (TODO: SHA-256 حقيقي لاحقاً)
 *   validateStructure()        ← وجود manifest.json + audio/ + assets/
 *   validateMinimumAppVersion() ← مقارنة إصدار التطبيق
 *   validatePackage()          ← يجمع جميع النتائج
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - لا يوجد Download أو ZIP أو fetch أو axios
 * - validateChecksum يحتاج SHA-256 حقيقي في مرحلة لاحقة
 * - validateStructure يستخدم expo-file-system للفحص فقط
 */

import { Directory, File, Paths } from 'expo-file-system';
import type { AudioPackage, Category, LocalizedString, Manifest, PackageLicense } from './audio-manifest';
import { SAMPLE_MANIFEST } from './audio-manifest';
import type { InstalledPackageInfo } from './audio-storage';
import {
  AUDIO_ROOT,
  PACKAGES_DIRECTORY,
  AUDIO_DIRECTORY,
  ASSETS_DIRECTORY,
  MANIFEST_FILENAME,
} from './storage-layout';

// ─── قيم الرخصة الصالحة ───────────────────────────────────────────────────────

const VALID_LICENSES: PackageLicense[] = [
  'public-domain',
  'cc-by',
  'cc-by-nc',
  'proprietary',
  'unknown',
];

// ─── إصدار التطبيق الحالي ─────────────────────────────────────────────────────
/**
 * TODO: استبدل هذا الثابت بقراءة حقيقية من expo-constants عند الحاجة
 * مثال: import Constants from 'expo-constants';
 *        Constants.expoConfig?.version ?? '1.0.0'
 */
const CURRENT_APP_VERSION = '1.0.0';

// ─── PackageValidationResult ──────────────────────────────────────────────────

export interface PackageValidationResult {
  /** هل الحزمة صالحة للتثبيت؟ (تمر بجميع الفحوصات الإلزامية) */
  valid: boolean;
  /** قائمة أخطاء تمنع التثبيت */
  errors: string[];
  /** قائمة تحذيرات لا تمنع التثبيت */
  warnings: string[];
  /** هل الـ checksum صحيح؟ */
  checksumValid: boolean;
  /** هل بيانات manifest صحيحة؟ */
  manifestValid: boolean;
  /** هل هيكل مجلدات الحزمة صحيح؟ */
  structureValid: boolean;
  /** هل إصدار التطبيق متوافق مع الحد الأدنى المطلوب؟ */
  appVersionCompatible: boolean;
}

// ─── مساعد semver بسيط ───────────────────────────────────────────────────────

/**
 * يقارن نسختين بصيغة "MAJOR.MINOR.PATCH"
 * يُعيد: سالب إذا a < b، موجب إذا a > b، صفر إذا متساويتان
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

// ─── مسارات FileSystem للفحص الهيكلي ─────────────────────────────────────────

function pkgDirectory(type: string, id: string): Directory {
  return new Directory(Paths.document, AUDIO_ROOT, PACKAGES_DIRECTORY, type, id);
}

function pkgManifestFile(type: string, id: string): File {
  return new File(pkgDirectory(type, id), MANIFEST_FILENAME);
}

function pkgAudioDir(type: string, id: string): Directory {
  return new Directory(pkgDirectory(type, id), AUDIO_DIRECTORY);
}

function pkgAssetsDir(type: string, id: string): Directory {
  return new Directory(pkgDirectory(type, id), ASSETS_DIRECTORY);
}

// ─── مساعد LocalizedString ────────────────────────────────────────────────────

/**
 * يتحقق من أن LocalizedString صالح: موجود وله حقل `ar` غير فارغ
 */
function isLocalizedStringValid(ls: LocalizedString | undefined): boolean {
  return (
    ls !== null &&
    ls !== undefined &&
    typeof ls === 'object' &&
    typeof ls.ar === 'string' &&
    ls.ar.trim().length > 0
  );
}

// ─── PackageValidator ─────────────────────────────────────────────────────────

export class PackageValidator {

  // ── 1. validateManifestHeader ──────────────────────────────────────────────

  /**
   * يتحقق من حقول جذر Manifest (index.json)
   * يفحص: schemaVersion, catalogVersion, generatedAt,
   *        minimumSupportedAppVersion, totalPackages, categories, packages
   */
  validateManifestHeader(manifest: Manifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.schemaVersion?.trim())
      errors.push('schemaVersion مفقود أو فارغ');

    if (typeof manifest.catalogVersion !== 'number' || manifest.catalogVersion < 0)
      errors.push('catalogVersion يجب أن يكون رقماً موجباً');

    if (!manifest.generatedAt?.trim())
      errors.push('generatedAt مفقود أو فارغ');

    if (!manifest.minimumSupportedAppVersion?.trim())
      errors.push('minimumSupportedAppVersion مفقود أو فارغ');

    if (typeof manifest.totalPackages !== 'number' || manifest.totalPackages < 0)
      errors.push('totalPackages يجب أن يكون رقماً غير سالب');

    if (!Array.isArray(manifest.categories) || manifest.categories.length === 0)
      errors.push('categories مفقودة أو فارغة');

    if (!Array.isArray(manifest.packages))
      errors.push('packages يجب أن تكون مصفوفة');

    // تحقق من تطابق totalPackages مع الحزم الفعلية
    if (
      Array.isArray(manifest.packages) &&
      typeof manifest.totalPackages === 'number' &&
      manifest.packages.length !== manifest.totalPackages
    ) {
      errors.push(
        `totalPackages (${manifest.totalPackages}) لا يتطابق مع عدد الحزم الفعلي (${manifest.packages.length})`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  // ── 2. validateCategory ────────────────────────────────────────────────────

  /**
   * يتحقق من حقول Category
   * يفحص: id, title (LocalizedString), description (LocalizedString), sortOrder, enabled
   */
  validateCategory(cat: Category): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!cat.id?.trim())
      errors.push('category.id مفقود أو فارغ');

    if (!isLocalizedStringValid(cat.title))
      errors.push(`category[${cat.id}].title.ar مفقود أو فارغ`);

    if (!isLocalizedStringValid(cat.description))
      errors.push(`category[${cat.id}].description.ar مفقود أو فارغ`);

    if (typeof cat.sortOrder !== 'number')
      errors.push(`category[${cat.id}].sortOrder يجب أن يكون رقماً`);

    if (typeof cat.enabled !== 'boolean')
      errors.push(`category[${cat.id}].enabled يجب أن يكون boolean`);

    return { valid: errors.length === 0, errors };
  }

  // ── 3. validateManifest ────────────────────────────────────────────────────

  /**
   * يتحقق من جميع حقول AudioPackage الإلزامية (Schema النهائي)
   */
  validateManifest(pkg: AudioPackage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ── الهوية ───────────────────────────────────────────────────────────────
    if (!pkg.id?.trim())
      errors.push('id مفقود أو فارغ');
    if (!pkg.type?.trim())
      errors.push('type مفقود أو فارغ');
    if (!pkg.folderName?.trim())
      errors.push('folderName مفقود أو فارغ');

    // ── المحتوى ──────────────────────────────────────────────────────────────
    if (!isLocalizedStringValid(pkg.title))
      errors.push('title.ar مفقود أو فارغ (LocalizedString)');
    if (!pkg.author?.trim())
      errors.push('author مفقود أو فارغ');
    if (!pkg.language?.trim())
      errors.push('language مفقود أو فارغ');
    if (!pkg.origin?.trim())
      errors.push('origin مفقود أو فارغ');

    // ── الإصدار ──────────────────────────────────────────────────────────────
    if (!pkg.version?.trim())
      errors.push('version مفقود أو فارغ');
    if (!pkg.releaseDate?.trim())
      errors.push('releaseDate مفقود أو فارغ');
    if (!pkg.updatedAt?.trim())
      errors.push('updatedAt مفقود أو فارغ');
    if (!pkg.minimumAppVersion?.trim())
      errors.push('minimumAppVersion مفقود أو فارغ');

    // ── الملفات ──────────────────────────────────────────────────────────────
    if (!pkg.checksum?.trim())
      errors.push('checksum مفقود أو فارغ');
    if (typeof pkg.sizeBytes !== 'number' || pkg.sizeBytes <= 0)
      errors.push('sizeBytes يجب أن يكون رقماً موجباً');
    if (!pkg.builtIn && !pkg.downloadUrl)
      errors.push('downloadUrl مفقود لحزمة غير مدمجة');
    if (pkg.previewUrl !== undefined && !pkg.previewUrl.trim())
      errors.push('previewUrl فارغ (يجب أن يكون URL صحيح أو undefined)');

    // ── الاكتشاف ─────────────────────────────────────────────────────────────
    if (!Array.isArray(pkg.tags))
      errors.push('tags يجب أن تكون مصفوفة');
    if (typeof pkg.featured !== 'boolean')
      errors.push('featured يجب أن يكون boolean');
    if (typeof pkg.sortOrder !== 'number')
      errors.push('sortOrder يجب أن يكون رقماً');

    // ── الجودة ───────────────────────────────────────────────────────────────
    if (typeof pkg.verified !== 'boolean')
      errors.push('verified يجب أن يكون boolean');
    if (!VALID_LICENSES.includes(pkg.license))
      errors.push(`license قيمة غير صالحة: "${pkg.license}" — القيم المقبولة: ${VALID_LICENSES.join(', ')}`);

    // ── دورة الحياة ──────────────────────────────────────────────────────────
    if (typeof pkg.deprecated !== 'boolean')
      errors.push('deprecated يجب أن يكون boolean');

    // ── قابلية التوسع ────────────────────────────────────────────────────────
    if (pkg.metadata === null || pkg.metadata === undefined || typeof pkg.metadata !== 'object' || Array.isArray(pkg.metadata))
      errors.push('metadata يجب أن يكون كائناً ({}  على الأقل) — لا يجوز أن يكون null أو undefined');

    return { valid: errors.length === 0, errors };
  }

  // ── 4. validateChecksum ────────────────────────────────────────────────────

  /**
   * يتحقق من تطابق الـ checksum
   *
   * حالياً: مقارنة قيمة مخزونة فقط (لا حساب hash فعلي)
   * TODO: استبدل هذا بـ SHA-256 حقيقي عند توفر الملفات المحلية
   */
  validateChecksum(
    pkg: AudioPackage,
    installed?: InstalledPackageInfo,
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!installed) {
      warnings.push('checksum: لم يتم التحقق بعد (الحزمة غير مثبتة) — TODO: SHA-256 حقيقي');
      return { valid: true, warnings };
    }

    if (pkg.checksum !== installed.checksum) {
      return {
        valid: false,
        warnings: [`checksum غير متطابق: متوقع "${pkg.checksum}" ووجد "${installed.checksum}"`],
      };
    }

    warnings.push('checksum: تمت المقارنة بالقيم المخزونة — TODO: SHA-256 حقيقي عند توفر الملفات');
    return { valid: true, warnings };
  }

  // ── 5. validateStructure ───────────────────────────────────────────────────

  /**
   * يتحقق من وجود هيكل مجلدات الحزمة على الجهاز
   * يفحص: manifest.json (إلزامي) + audio/ (إلزامي) + assets/ (اختياري)
   * لا يحمّل ولا ينشئ أي شيء
   */
  validateStructure(
    type: string,
    id: string,
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pkgManifestFile(type, id).exists)
      errors.push(`manifest.json غير موجود في: packages/${type}/${id}/`);

    if (!pkgAudioDir(type, id).exists)
      errors.push(`مجلد audio/ غير موجود في: packages/${type}/${id}/`);

    if (!pkgAssetsDir(type, id).exists)
      warnings.push(`مجلد assets/ غير موجود في: packages/${type}/${id}/ (اختياري)`);

    return { valid: errors.length === 0, errors, warnings };
  }

  // ── 6. validateMinimumAppVersion ──────────────────────────────────────────

  /**
   * يتحقق من توافق نسخة semver مع إصدار التطبيق الحالي
   *
   * يدعم نوعين:
   *   - minimumAppVersion    (على مستوى الحزمة)
   *   - minimumSupportedAppVersion  (على مستوى الكتالوج)
   *
   * @param minVersion  النسخة الدنيا المطلوبة (semver)
   * @param label       وصف الحقل للرسالة (اختياري)
   *
   * TODO: استبدل CURRENT_APP_VERSION بـ expo-constants لاحقاً
   */
  validateMinimumAppVersion(
    minVersionOrPkg: string | AudioPackage,
    label = 'minimumAppVersion',
  ): { valid: boolean; errors: string[] } {
    const minVersion =
      typeof minVersionOrPkg === 'string'
        ? minVersionOrPkg.trim()
        : minVersionOrPkg.minimumAppVersion?.trim();

    if (!minVersion) return { valid: true, errors: [] };

    const compatible = compareSemver(CURRENT_APP_VERSION, minVersion) >= 0;
    if (!compatible) {
      return {
        valid: false,
        errors: [
          `${label}: تتطلب إصدار ${minVersion} على الأقل، الإصدار الحالي: ${CURRENT_APP_VERSION}`,
        ],
      };
    }

    return { valid: true, errors: [] };
  }

  // ── 7. validatePackage ─────────────────────────────────────────────────────

  /**
   * يُشغّل جميع الفحوصات على حزمة واحدة ويُعيد نتيجة موحدة
   *
   * @param pkg               بيانات الحزمة من الكتالوج
   * @param installed         بيانات الحزمة المثبتة (اختياري)
   * @param checkFileStructure  هل نفحص وجود الملفات؟ (افتراضي: true)
   */
  validatePackage(
    pkg: AudioPackage,
    installed?: InstalledPackageInfo,
    checkFileStructure = true,
  ): PackageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. حقول AudioPackage
    const manifestCheck = this.validateManifest(pkg);
    errors.push(...manifestCheck.errors);

    // 2. checksum
    const checksumCheck = this.validateChecksum(pkg, installed);
    if (!checksumCheck.valid) {
      errors.push(...checksumCheck.warnings);
    } else {
      warnings.push(...checksumCheck.warnings);
    }

    // 3. هيكل الملفات (إذا طُلب)
    let structureValid = true;
    if (checkFileStructure) {
      const structCheck = this.validateStructure(pkg.type, pkg.id);
      structureValid = structCheck.valid;
      errors.push(...structCheck.errors);
      warnings.push(...structCheck.warnings);
    }

    // 4. إصدار التطبيق (minimumAppVersion على مستوى الحزمة)
    const versionCheck = this.validateMinimumAppVersion(pkg, 'minimumAppVersion');
    errors.push(...versionCheck.errors);

    return {
      valid:                errors.length === 0,
      errors,
      warnings,
      manifestValid:        manifestCheck.valid,
      checksumValid:        checksumCheck.valid,
      structureValid,
      appVersionCompatible: versionCheck.valid,
    };
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const packageValidator = new PackageValidator();

// ─── نتيجة اختبار Validator ───────────────────────────────────────────────────

export interface ValidatorTestReport {
  packagesTested: number;
  results: Array<{
    id: string;
    type: string;
    valid: boolean;
    manifestValid: boolean;
    checksumValid: boolean;
    structureValid: boolean;
    appVersionCompatible: boolean;
    errors: string[];
    warnings: string[];
  }>;
}

/**
 * اختبار المرحلة الرابعة عشرة:
 * قراءة SAMPLE_MANIFEST → تشغيل validatePackage على كل حزمة → تقرير
 * (checkFileStructure=false لأن الحزم غير مثبتة في بيئة الاختبار)
 */
export function testValidator(): ValidatorTestReport {
  const packages = SAMPLE_MANIFEST.packages;

  const results = packages.map((pkg) => {
    const result = packageValidator.validatePackage(pkg, undefined, false);
    return {
      id:                   pkg.id,
      type:                 pkg.type,
      valid:                result.valid,
      manifestValid:        result.manifestValid,
      checksumValid:        result.checksumValid,
      structureValid:       result.structureValid,
      appVersionCompatible: result.appVersionCompatible,
      errors:               result.errors,
      warnings:             result.warnings,
    };
  });

  return {
    packagesTested: packages.length,
    results,
  };
}
