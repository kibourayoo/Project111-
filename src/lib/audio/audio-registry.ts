/**
 * audio-registry.ts
 * Local Registry لجميع الحزم الصوتية المثبتة على الجهاز
 *
 * ─── الغرض ──────────────────────────────────────────────────────────────────
 * بدلاً من البحث داخل المجلدات لمعرفة الحزم المثبتة، يعتمد التطبيق على
 * ملف واحد فقط: audio/installed.json
 *
 * ─── الهيكل ─────────────────────────────────────────────────────────────────
 *
 *   audio/
 *     installed.json    ← فهرس جميع الحزم المثبتة
 *     packages/
 *       ...
 *
 * ─── installed.json — مثال ──────────────────────────────────────────────────
 *
 *   {
 *     "schemaVersion": "1.0.0",
 *     "updatedAt": 1720180800000,
 *     "packages": [
 *       {
 *         "id": "husary",
 *         "type": "adhan",
 *         "title": "...",
 *         ...
 *       }
 *     ]
 *   }
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - لا يستخدم الإنترنت أو ZIP أو AsyncStorage
 * - كل العمليات محلية باستخدام expo-file-system فقط
 * - isInstalled() تعتمد على Registry فقط، لا تبحث في المجلدات
 */

import { Directory, File, Paths } from 'expo-file-system';
import type { InstalledPackageInfo } from './audio-storage';
import type { AudioType } from './audio-types';
import {
  AUDIO_ROOT,
  REGISTRY_FILENAME,
  REGISTRY_SCHEMA_VERSION,
} from './storage-layout';

// ─── InstalledRegistry ────────────────────────────────────────────────────────

export interface InstalledRegistry {
  /** نسخة مخطط الملف — للكشف عن تحديثات المخطط مستقبلاً */
  schemaVersion: string;
  /** توقيت آخر تعديل (Unix timestamp بالمللي‑ثانية) */
  updatedAt: number;
  /** قائمة جميع الحزم المثبتة */
  packages: InstalledPackageInfo[];
}

// ─── القيمة الافتراضية ────────────────────────────────────────────────────────

const DEFAULT_REGISTRY: InstalledRegistry = {
  schemaVersion: REGISTRY_SCHEMA_VERSION,
  updatedAt: 0,
  packages: [],
};

// ─── المسار المطلق لـ installed.json ─────────────────────────────────────────

function absRegistryFile(): File {
  return new File(
    new Directory(Paths.document, AUDIO_ROOT),
    REGISTRY_FILENAME,
  );
}

// ─── RegistryService ──────────────────────────────────────────────────────────

export class RegistryService {

  /**
   * يُنشئ installed.json بالقيمة الافتراضية إذا لم يكن موجوداً
   * آمن للاستدعاء أكثر من مرة
   */
  async createRegistryIfNeeded(): Promise<void> {
    const file = absRegistryFile();
    if (!file.exists) {
      file.create();
      file.write(JSON.stringify(DEFAULT_REGISTRY, null, 2));
    }
  }

  /**
   * يقرأ installed.json ويُعيد InstalledRegistry
   * يُنشئ الملف تلقائياً إذا لم يكن موجوداً
   */
  async loadRegistry(): Promise<InstalledRegistry> {
    await this.createRegistryIfNeeded();
    const raw = await absRegistryFile().text();
    return JSON.parse(raw) as InstalledRegistry;
  }

  /**
   * يكتب InstalledRegistry إلى installed.json
   * يُحدّث updatedAt تلقائياً
   */
  async saveRegistry(registry: InstalledRegistry): Promise<void> {
    const updated: InstalledRegistry = {
      ...registry,
      updatedAt: Date.now(),
    };
    const file = absRegistryFile();
    if (!file.exists) {
      file.create();
    }
    file.write(JSON.stringify(updated, null, 2));
  }

  /**
   * يُضيف حزمة جديدة إلى Registry
   * إذا كانت موجودة مسبقاً (نفس id + type): يُحدّث version / checksum / installedAt
   */
  async addOrUpdatePackage(info: InstalledPackageInfo): Promise<void> {
    const registry = await this.loadRegistry();
    const existingIndex = registry.packages.findIndex(
      (p) => p.id === info.id && p.type === info.type,
    );

    if (existingIndex >= 0) {
      // تحديث الحقول المتغيرة فقط
      registry.packages[existingIndex] = {
        ...registry.packages[existingIndex],
        version: info.version,
        checksum: info.checksum,
        installedAt: info.installedAt,
        state: info.state,
      };
    } else {
      // إضافة حزمة جديدة
      registry.packages.push(info);
    }

    await this.saveRegistry(registry);
  }

  /**
   * يحذف حزمة من Registry
   * آمن — لا يفشل إذا لم تكن الحزمة موجودة
   */
  async removePackage(id: string, type: AudioType): Promise<void> {
    const registry = await this.loadRegistry();
    registry.packages = registry.packages.filter(
      (p) => !(p.id === id && p.type === type),
    );
    await this.saveRegistry(registry);
  }

  /**
   * يُعيد جميع الحزم المثبتة من Registry
   */
  async getInstalledPackages(): Promise<InstalledPackageInfo[]> {
    const registry = await this.loadRegistry();
    return registry.packages;
  }

  /**
   * يُعيد حزمة واحدة من Registry أو null إذا لم تكن موجودة
   */
  async getInstalledPackage(
    id: string,
    type: AudioType,
  ): Promise<InstalledPackageInfo | null> {
    const registry = await this.loadRegistry();
    return registry.packages.find((p) => p.id === id && p.type === type) ?? null;
  }

  /**
   * يتحقق من تثبيت الحزمة بالاعتماد على Registry فقط
   * لا يبحث داخل المجلدات
   */
  async isInstalled(id: string, type: AudioType): Promise<boolean> {
    const registry = await this.loadRegistry();
    return registry.packages.some((p) => p.id === id && p.type === type);
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const registryService = new RegistryService();

// ─── نتيجة اختبار Registry ───────────────────────────────────────────────────

export interface RegistryTestReport {
  registryCreated: boolean;
  packageInstalled: boolean;
  foundInRegistry: boolean;
  packageData: InstalledPackageInfo | null;
  removedFromRegistry: boolean;
  notFoundAfterRemove: boolean;
}

/**
 * اختبار المرحلة السابعة — دورة حياة Registry كاملة:
 * createRegistryIfNeeded → addOrUpdatePackage → getInstalledPackage
 * → isInstalled → removePackage → isInstalled
 */
export async function testRegistry(): Promise<RegistryTestReport> {
  const testPkg: InstalledPackageInfo = {
    id: 'husary',
    type: 'adhan',
    title: 'أذان الشيخ محمود خليل الحصري',
    author: 'محمود خليل الحصري',
    version: '1.0.0',
    sizeBytes: 0,
    installedAt: new Date().toISOString(),
    checksum: 'sha256:registry-test',
    state: 'INSTALLED',
  };

  const report: RegistryTestReport = {
    registryCreated: false,
    packageInstalled: false,
    foundInRegistry: false,
    packageData: null,
    removedFromRegistry: false,
    notFoundAfterRemove: false,
  };

  // 1. إنشاء Registry
  await registryService.createRegistryIfNeeded();
  report.registryCreated = absRegistryFile().exists;

  // 2. إضافة الحزمة
  await registryService.addOrUpdatePackage(testPkg);
  report.packageInstalled = true;

  // 3. قراءة Registry والتحقق
  report.packageData = await registryService.getInstalledPackage(
    testPkg.id,
    testPkg.type,
  );
  report.foundInRegistry = report.packageData !== null;

  // 4. التحقق بـ isInstalled
  const installed = await registryService.isInstalled(testPkg.id, testPkg.type);
  report.foundInRegistry = report.foundInRegistry && installed;

  // 5. حذف الحزمة من Registry
  await registryService.removePackage(testPkg.id, testPkg.type);
  report.removedFromRegistry = true;

  // 6. التأكد من الاختفاء
  report.notFoundAfterRemove = !(await registryService.isInstalled(
    testPkg.id,
    testPkg.type,
  ));

  return report;
}
