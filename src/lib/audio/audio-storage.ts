/**
 * audio-storage.ts
 * Path Resolver Functions + خدمة التخزين للمحتوى الصوتي
 *
 * ─── هيكل التخزين النهائي ───────────────────────────────────────────────────
 *
 *   {documentDirectory}/audio/
 *     packages/
 *       {type}/          ← adhan | quran | ruqyah | dua | notification | custom
 *         {id}/
 *           manifest.json      ← بيانات الحزمة الأصلية (AudioPackage) — ثابت لا يُعدَّل
 *           package-info.json  ← بيانات النظام المحلي (InstalledPackageInfo) — يكتبه التطبيق
 *           assets/         ← thumbnail.webp / cover.webp / license.txt / …
 *           audio/          ← ملفات الصوت الفعلية
 *     cache/
 *     temp/
 *
 * ─── الفصل بين الملفين ──────────────────────────────────────────────────────
 * manifest.json:
 *   - يأتي داخل ZIP من الناشر (AudioPackage)
 *   - لا يُكتب فوقه أبداً بعد النسخ
 *   - مرجع ثابت: version، checksum، author، title، …
 *
 * package-info.json:
 *   - يُنشئه التطبيق عند التثبيت (InstalledPackageInfo)
 *   - يحتوي: installedAt، state، آخر استخدام، وأي بيانات محلية
 *   - وجوده = دليل اكتمال التثبيت
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - Path Resolvers النسبية: تُعيد مسارات قصيرة للتوثيق والـ logs
 * - Path Resolvers المطلقة: تُعيد Directory object مع documentDirectory
 * - FileSystem يعمل فقط على Directory objects
 */

import { Directory, File, Paths } from 'expo-file-system';
import type { AudioType } from './audio-types';
import type { PackageState } from './package-state';
import {
  AUDIO_ROOT,
  PACKAGES_DIRECTORY,
  CACHE_DIRECTORY,
  TEMP_DIRECTORY,
  AUDIO_DIRECTORY,
  ASSETS_DIRECTORY,
  MANIFEST_FILENAME,
  PACKAGE_INFO_FILENAME,
  THUMBNAIL_FILENAME,
} from './storage-layout';

// ─── InstalledPackageInfo ─────────────────────────────────────────────────────

/**
 * البيانات المحلية المُخزَّنة داخل info.json بعد تحميل الحزمة
 *
 * تختلف عن AudioPackage (القادمة من Cloudflare R2) في أنها:
 * - تحتوي على وقت التثبيت الفعلي
 * - تُستخدم بدون إنترنت بالكامل
 * - تُثبت سلامة الحزمة المحلية بواسطة checksum
 */
export interface InstalledPackageInfo {
  /** معرّف الحزمة — يطابق id في index.json */
  id: string;
  /** نوع المحتوى الصوتي */
  type: AudioType;
  /** اسم الحزمة للعرض */
  title: string;
  /** اسم المؤلف أو القارئ */
  author: string;
  /** نسخة الحزمة المُثبَّتة */
  version: string;
  /** حجم الحزمة الفعلي بالبايت */
  sizeBytes: number;
  /** تاريخ التثبيت على الجهاز (ISO 8601) */
  installedAt: string;
  /** بصمة SHA-256 للتحقق من سلامة الملفات */
  checksum: string;
  /** حالة الحزمة الحالية */
  state: PackageState;
}

// ─── StorageReport (نتيجة verifyStorage) ─────────────────────────────────────

export interface StorageReport {
  rootExists: boolean;
  packagesExists: boolean;
  cacheExists: boolean;
  tempExists: boolean;
}

// ─── Path Resolvers النسبية (توثيق + logs) ───────────────────────────────────

/** "audio" */
export function rootPath(): string {
  return AUDIO_ROOT;
}
/** "audio/packages" */
export function packagesPath(): string {
  return `${rootPath()}/${PACKAGES_DIRECTORY}`;
}
/** "audio/cache" */
export function cachePath(): string {
  return `${rootPath()}/${CACHE_DIRECTORY}`;
}
/** "audio/temp" */
export function tempPath(): string {
  return `${rootPath()}/${TEMP_DIRECTORY}`;
}
/** "audio/packages/{type}/{id}" */
export function packagePath(type: AudioType, id: string): string {
  return `${packagesPath()}/${type}/${id}`;
}
/** "audio/packages/{type}/{id}/audio" */
export function audioPath(type: AudioType, id: string): string {
  return `${packagePath(type, id)}/${AUDIO_DIRECTORY}`;
}
/** "audio/packages/{type}/{id}/assets" */
export function assetsPath(type: AudioType, id: string): string {
  return `${packagePath(type, id)}/${ASSETS_DIRECTORY}`;
}
/** "audio/packages/{type}/{id}/manifest.json" */
export function manifestPath(type: AudioType, id: string): string {
  return `${packagePath(type, id)}/${MANIFEST_FILENAME}`;
}
/** "audio/packages/{type}/{id}/package-info.json" */
export function packageInfoPath(type: AudioType, id: string): string {
  return `${packagePath(type, id)}/${PACKAGE_INFO_FILENAME}`;
}
/** "audio/packages/{type}/{id}/assets/thumbnail.webp" */
export function thumbnailPath(type: AudioType, id: string): string {
  return `${assetsPath(type, id)}/${THUMBNAIL_FILENAME}`;
}

// ─── Path Resolvers المطلقة (للاستخدام مع FileSystem) ────────────────────────

/** الـ Directory الجذري لمجلد audio داخل documentDirectory */
function absRoot(): Directory {
  return new Directory(Paths.document, AUDIO_ROOT);
}
function absPackages(): Directory { return new Directory(absRoot(), PACKAGES_DIRECTORY); }
function absCache(): Directory    { return new Directory(absRoot(), CACHE_DIRECTORY); }
function absTemp(): Directory     { return new Directory(absRoot(), TEMP_DIRECTORY); }
function absPackageDir(type: AudioType, id: string): Directory {
  return new Directory(absPackages(), type, id);
}
function absAssetsDir(type: AudioType, id: string): Directory {
  return new Directory(absPackageDir(type, id), ASSETS_DIRECTORY);
}
function absAudioDir(type: AudioType, id: string): Directory {
  return new Directory(absPackageDir(type, id), AUDIO_DIRECTORY);
}
function absManifestFile(type: AudioType, id: string): File {
  return new File(absPackageDir(type, id), MANIFEST_FILENAME);
}
/** package-info.json — البيانات المحلية التي يكتبها التطبيق (InstalledPackageInfo) */
function absPackageInfoFile(type: AudioType, id: string): File {
  return new File(absPackageDir(type, id), PACKAGE_INFO_FILENAME);
}

// ─── AudioStorageService ──────────────────────────────────────────────────────

export class AudioStorageService {

  // ── Phase 4: التنفيذ الفعلي ──────────────────────────────────────────────

  /**
   * يتحقق من وجود مجلد باستخدام خاصية .exists من Directory
   */
  async storageExists(dir: Directory): Promise<boolean> {
    return dir.exists;
  }

  /**
   * يُنشئ مجلداً إذا لم يكن موجوداً — idempotent آمن
   */
  async createDirectoryIfNeeded(dir: Directory): Promise<void> {
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }
  }

  /**
   * يُنشئ هيكل المجلدات الكامل عند أول تشغيل
   * يُنشئ: audio/ ← packages/ ← cache/ ← temp/
   * آمن للاستدعاء أكثر من مرة
   */
  async initializeStorage(): Promise<void> {
    await this.createDirectoryIfNeeded(absRoot());
    await this.createDirectoryIfNeeded(absPackages());
    await this.createDirectoryIfNeeded(absCache());
    await this.createDirectoryIfNeeded(absTemp());
  }

  /**
   * يتحقق من وجود جميع مجلدات النظام ويُعيد تقريراً
   */
  async verifyStorage(): Promise<StorageReport> {
    return {
      rootExists:     absRoot().exists,
      packagesExists: absPackages().exists,
      cacheExists:    absCache().exists,
      tempExists:     absTemp().exists,
    };
  }

  // ── Phase 6: تثبيت محلي ──────────────────────────────────────────────────

  /**
   * يُنشئ هيكل حزمة محلية كاملة ويكتب package-info.json ببيانات النظام المحلي.
   * لا يستخدم إنترنت ولا ZIP — محاكاة محلية بالكامل.
   * manifest.json لا يُنشَأ ولا يُلمَس هنا.
   * ملاحظة: تسجيل الحزمة في Registry مسؤولية AudioRepository.
   */
  async installLocalPackage(packageInfo: InstalledPackageInfo): Promise<void> {
    // 1. التأكد من وجود هيكل النظام الأساسي
    await this.createDirectoryIfNeeded(absRoot());
    await this.createDirectoryIfNeeded(absPackages());
    await this.createDirectoryIfNeeded(
      new Directory(absPackages(), packageInfo.type),
    );

    // 2. إنشاء مجلد الحزمة
    const pkgDir = absPackageDir(packageInfo.type, packageInfo.id);
    await this.createDirectoryIfNeeded(pkgDir);

    // 3. إنشاء المجلدات الداخلية
    await this.createDirectoryIfNeeded(absAssetsDir(packageInfo.type, packageInfo.id));
    await this.createDirectoryIfNeeded(absAudioDir(packageInfo.type, packageInfo.id));

    // 4. كتابة package-info.json ببيانات النظام المحلي
    // manifest.json لا يُلمَس — يبقى كما هو (أو غير موجود في التثبيت المحلي)
    const infoFile = absPackageInfoFile(packageInfo.type, packageInfo.id);
    if (!infoFile.exists) {
      infoFile.create();
    }
    infoFile.write(JSON.stringify(packageInfo, null, 2));
  }

  // ── Phase 23: نقل الملفات من cache إلى documentDirectory ───────────────────

  /**
   * ينقل محتويات مجلد الاستخراج المؤقت إلى المكان النهائي في documentDirectory.
   *
   * الخطوات:
   *   1. التأكد من وجود سلسلة المجلدات الأب في documentDirectory.
   *   2. حذف المجلد النهائي إن وُجد (تثبيت نظيف).
   *   3. نسخ مجلد الاستخراج بالكامل إلى المكان النهائي (sourceDir.copy).
   *   4. الكتابة فوق manifest.json بصيغة InstalledPackageInfo.
   *
   * Rollback عند الفشل:
   *   - يحذف المجلد النهائي الجزئي إن وُجد.
   *   - لا يلمس المجلد المصدر (cache) — تنظيفه مسؤولية Worker.
   *   - لا يُحدّث Registry.
   *
   * @param extractedPath - مسار نظام الملفات المطلق (بدون file://)
   *                        كما يُعيده DownloadExtractor.extract()
   * @param type         - نوع الحزمة
   * @param id           - معرّف الحزمة
   * @param packageInfo  - بيانات InstalledPackageInfo لكتابتها في manifest.json
   */
  async copyPackageFromExtracted(
    extractedPath: string,
    type:          AudioType,
    id:            string,
    packageInfo:   InstalledPackageInfo,
  ): Promise<void> {
    // ── 1. التأكد من وجود سلسلة المجلدات الأب ────────────────────────────────
    await this.createDirectoryIfNeeded(absRoot());
    await this.createDirectoryIfNeeded(absPackages());
    await this.createDirectoryIfNeeded(new Directory(absPackages(), type));

    const destDir    = absPackageDir(type, id);
    const sourceDir  = new Directory(`file://${extractedPath}`);

    if (!sourceDir.exists) {
      throw new Error(`مجلد الاستخراج غير موجود: ${extractedPath}`);
    }

    // ── 2. حذف المجلد النهائي إن وُجد (تثبيت نظيف) ──────────────────────────
    if (destDir.exists) {
      destDir.delete();
    }

    // ── 3. نسخ مجلد الاستخراج بالكامل إلى المكان النهائي ─────────────────────
    try {
      sourceDir.copy(destDir);
    } catch (err) {
      // Rollback: حذف أي ملفات نُسخت جزئياً
      try {
        if (destDir.exists) destDir.delete();
      } catch {
        // تجاهل أخطاء Rollback
      }
      throw err;
    }

    // ── 4. كتابة package-info.json ببيانات النظام المحلي ──────────────────────
    // manifest.json المنسوخ من ZIP يحتوي على AudioPackage — لا يُلمَس.
    // package-info.json هو الملف الذي يكتبه التطبيق للبيانات المحلية.
    // وجود package-info.json = دليل اكتمال التثبيت.
    const infoFile = absPackageInfoFile(type, id);
    if (!infoFile.exists) {
      infoFile.create();
    }
    infoFile.write(JSON.stringify(packageInfo, null, 2));
  }

  /**
   * يقرأ package-info.json للحزمة ويُعيد InstalledPackageInfo.
   * package-info.json هو الملف المحلي الذي يكتبه التطبيق — لا manifest.json.
   * @throws إذا لم يكن package-info.json موجوداً
   */
  async readInstalledManifest(type: AudioType, id: string): Promise<InstalledPackageInfo> {
    const infoFile = absPackageInfoFile(type, id);
    if (!infoFile.exists) {
      throw new Error(`package-info.json غير موجود: ${packageInfoPath(type, id)}`);
    }
    const raw = await infoFile.text();
    return JSON.parse(raw) as InstalledPackageInfo;
  }

  /**
   * يتحقق من تثبيت الحزمة بفحص وجود package-info.json.
   * وجود package-info.json = اكتمل التثبيت بواسطة التطبيق.
   * manifest.json وحده لا يكفي — قد يكون موجوداً من نسخة ناقصة.
   */
  async isPackageInstalled(type: AudioType, id: string): Promise<boolean> {
    return absPackageInfoFile(type, id).exists;
  }

  /**
   * يحذف مجلد الحزمة بالكامل (manifest + assets + audio)
   * ملاحظة: حذف سجل الحزمة من Registry مسؤولية AudioRepository
   */
  async removeInstalledPackage(type: AudioType, id: string): Promise<void> {
    const pkgDir = absPackageDir(type, id);
    if (pkgDir.exists) {
      pkgDir.delete();
    }
  }

  // ── Phase 4+: Infrastructure ──────────────────────────────────────────────

  /**
   * يحذف جميع محتويات audio/cache/ دون حذف المجلد نفسه.
   * إذا لم يكن المجلد موجوداً يُنشئه (حالة تعافٍ).
   * لا يلمس أي Package.
   */
  async clearCache(): Promise<void> {
    const cacheDir = absCache();
    if (!cacheDir.exists) {
      cacheDir.create({ intermediates: true });
      return;
    }
    for (const item of cacheDir.list()) {
      item.delete();
    }
  }

  /**
   * يحذف جميع محتويات audio/temp/ دون حذف المجلد نفسه.
   * إذا لم يكن المجلد موجوداً يُنشئه (حالة تعافٍ).
   * لا يلمس أي Package.
   * ⚠️ يُستخدم فقط عند cancelAll — يحذف كل الملفات المؤقتة.
   * لحذف ملف job واحد فقط استخدم removeTempJob(jobId).
   */
  async clearTemp(): Promise<void> {
    const tempDir = absTemp();
    if (!tempDir.exists) {
      tempDir.create({ intermediates: true });
      return;
    }
    for (const item of tempDir.list()) {
      item.delete();
    }
  }

  /**
   * يحذف ملف ZIP المؤقت الخاص بـ Job واحد فقط.
   * المسار: audio/temp/{jobId}.zip
   * آمن للاستدعاء حتى لو الملف غير موجود.
   * لا يلمس ملفات Jobs أخرى.
   *
   * يُستدعى من DownloadWorker عند الانتهاء (نجاح / فشل / إلغاء).
   *
   * @param jobId - معرّف الـ Job (مُستخدم كاسم الملف: {jobId}.zip)
   */
  removeTempJob(jobId: string): void {
    const tempFile = new File(absTemp(), `${jobId}.zip`);
    if (tempFile.exists) {
      tempFile.delete();
    }
  }

  /**
   * يُزيل حزمة كاملة من الـ FileSystem (مجلد + كل محتوياته).
   * مُكافئ لـ removeInstalledPackage — نقطة دخول موحّدة للـ Download Manager.
   * ملاحظة: حذف سجل الحزمة من Registry مسؤولية AudioRepository.
   */
  async removePackage(type: AudioType, id: string): Promise<void> {
    const pkgDir = absPackageDir(type, id);
    if (pkgDir.exists) {
      pkgDir.delete();
    }
  }

  /**
   * يتحقق من وجود الحزمة محلياً بفحص وجود مجلدها على الـ FileSystem.
   * لا يعتمد على Registry — يعتمد على هيكل التخزين الحالي فقط.
   */
  async packageExists(type: AudioType, id: string): Promise<boolean> {
    return absPackageDir(type, id).exists;
  }

  /**
   * يقرأ package-info.json المحلي للحزمة ويُعيد InstalledPackageInfo.
   * @throws إذا لم يكن package-info.json موجوداً
   */
  async readPackageInfo(type: AudioType, id: string): Promise<InstalledPackageInfo> {
    return this.readInstalledManifest(type, id);
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const audioStorage = new AudioStorageService();

// ─── Test Functions (للتحقق فقط — لا تُستخدم في الإنتاج) ─────────────────────

/**
 * اختبار المرحلة الرابعة:
 * تهيئة هيكل التخزين والتحقق من وجود المجلدات
 */
export async function testStorageInit(): Promise<StorageReport> {
  await audioStorage.initializeStorage();
  return audioStorage.verifyStorage();
}

/** نتيجة اختبار التثبيت المحلي */
export interface InstallationTestReport {
  installedSuccessfully: boolean;
  installedAfterInstall: boolean;
  manifestRead: boolean;
  manifestData: InstalledPackageInfo | null;
  removedSuccessfully: boolean;
  installedAfterRemove: boolean;
}

/**
 * اختبار المرحلة السادسة — دورة حياة حزمة محلية كاملة:
 * installLocalPackage → isPackageInstalled → readInstalledManifest
 * → removeInstalledPackage → isPackageInstalled
 */
export async function testLocalInstallation(): Promise<InstallationTestReport> {
  const testPackage: InstalledPackageInfo = {
    id: 'husary',
    type: 'adhan',
    title: 'أذان الشيخ محمود خليل الحصري',
    author: 'محمود خليل الحصري',
    version: '1.0.0',
    sizeBytes: 0,
    installedAt: new Date().toISOString(),
    checksum: 'sha256:test-only',
    state: 'INSTALLED',
  };

  const report: InstallationTestReport = {
    installedSuccessfully: false,
    installedAfterInstall: false,
    manifestRead: false,
    manifestData: null,
    removedSuccessfully: false,
    installedAfterRemove: false,
  };

  // 1. تثبيت الحزمة
  await audioStorage.installLocalPackage(testPackage);
  report.installedSuccessfully = true;

  // 2. التحقق من التثبيت
  report.installedAfterInstall = await audioStorage.isPackageInstalled(
    testPackage.type,
    testPackage.id,
  );

  // 3. قراءة manifest.json
  report.manifestData = await audioStorage.readInstalledManifest(
    testPackage.type,
    testPackage.id,
  );
  report.manifestRead = report.manifestData !== null;

  // 4. حذف الحزمة
  await audioStorage.removeInstalledPackage(testPackage.type, testPackage.id);
  report.removedSuccessfully = true;

  // 5. التحقق بعد الحذف
  report.installedAfterRemove = await audioStorage.isPackageInstalled(
    testPackage.type,
    testPackage.id,
  );

  return report;
}