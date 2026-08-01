/**
 * package-manager.ts
 * طبقة إدارة الحزم — Orchestrator فقط
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * PackageManager هو نقطة الدخول الوحيدة لعمليات الحزم من الطبقات العليا.
 * يُنسّق بين الطبقات الموجودة ولا يُنفّذ أي منطق مباشر.
 *
 * ─── ما يُفوَّض إليه ─────────────────────────────────────────────────────────
 *   AudioRepository    ← قراءة / كتابة / حذف بيانات الحزم
 *   PackageValidator   ← التحقق من صحة الهيكل والـ manifest
 *   PackageStateMachine ← إدارة حالة الحزمة في الذاكرة
 *   DownloadManager    ← إضافة مهام التنزيل (install فقط)
 *
 * ─── ما لا يلمسه PackageManager مطلقاً ──────────────────────────────────────
 *   FileSystem         ← مسؤولية AudioStorageService
 *   Downloader         ← مسؤولية DownloadManager
 *   DownloadWorker     ← مسؤولية DownloadManager
 *   DownloadQueue      ← مسؤولية DownloadManager
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *   install()              ← إضافة الحزمة لقائمة التنزيل
 *   uninstall()            ← حذف الحزمة + تحديث السجل + إعادة الحالة
 *   update()               ← Skeleton (لا Networking في هذه المرحلة)
 *   repair()               ← فحص الحزمة وإعادة الحالة المناسبة
 *   verify()               ← التحقق الشامل من سلامة الحزمة
 *   getInstalledPackages() ← قائمة الحزم المثبتة
 */

import type { AudioType }           from './audio-types';
import type { InstalledPackageInfo } from './audio-storage';
import {
  audioRepository,
  type AudioRepository,
}                                   from './audio-repository';
import {
  packageValidator,
  type PackageValidator,
}                                   from './package-validator';
import {
  packageStateMachine,
  type PackageStateMachine,
  type PackageState,
}                                   from './package-state';
import {
  downloadManager,
  type DownloadManager,
}                                   from './download/download-manager';

// ─── PackageManagerResult ─────────────────────────────────────────────────────

/**
 * النتيجة الموحدة لجميع عمليات PackageManager.
 * مستقلة عن AudioRepositoryResult وتُعبَّر عن الطبقة الأعلى.
 */
export interface PackageManagerResult<T = void> {
  /** نجاح العملية */
  success: boolean;
  /** البيانات عند النجاح */
  data?: T;
  /** رسالة وصفية للعملية */
  message: string;
  /** رسالة الخطأ عند الفشل */
  error?: string;
}

// ─── VerifyResult ─────────────────────────────────────────────────────────────

/**
 * نتيجة التحقق الشامل من سلامة حزمة مُثبَّتة.
 */
export interface VerifyResult {
  /** هل الحزمة سليمة تماماً؟ */
  isValid: boolean;
  /** هل الحزمة مسجّلة في Registry؟ */
  registryEntryExists: boolean;
  /** هل package-info.json موجود وقابل للقراءة على القرص؟ */
  packageInfoReadable: boolean;
  /** هل manifest.json موجود في مجلد الحزمة؟ */
  manifestExists: boolean;
  /** هل مجلد audio/ موجود؟ */
  audioDirectoryExists: boolean;
  /** أخطاء هيكل الملفات (تمنع الاستخدام) */
  structureErrors: string[];
  /** تحذيرات هيكل الملفات (لا تمنع الاستخدام) */
  structureWarnings: string[];
}

// ─── RepairResult ─────────────────────────────────────────────────────────────

/**
 * نتيجة عملية repair — تصف حالة الحزمة وما يُوصى به.
 */
export interface RepairResult {
  /** هل الحزمة سليمة ولم تحتج إصلاحاً؟ */
  wasHealthy: boolean;
  /** نتيجة التحقق التفصيلية */
  verifyResult: VerifyResult;
  /** الإجراء الموصى به (re-download يأتي في مرحلة لاحقة) */
  recommendedAction: 'none' | 'redownload';
}

// ─── InstallOptions ───────────────────────────────────────────────────────────

export interface InstallOptions {
  /** رابط تنزيل الحزمة */
  downloadUrl: string;
  /** أولوية التنزيل */
  priority?: 'high' | 'normal' | 'low';
}

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok<T>(data: T, message: string): PackageManagerResult<T> {
  return { success: true, data, message };
}

function ok0(message: string): PackageManagerResult<void> {
  return { success: true, message };
}

function fail<T = void>(error: unknown, message: string): PackageManagerResult<T> {
  const errMsg = error instanceof Error ? error.message : String(error);
  return { success: false, message, error: errMsg };
}

// ─── PackageManager ───────────────────────────────────────────────────────────

export class PackageManager {

  constructor(
    private readonly repository:   AudioRepository,
    private readonly validator:    PackageValidator,
    private readonly stateMachine: PackageStateMachine,
    private readonly dlManager:    DownloadManager,
  ) {}

  // ── install ────────────────────────────────────────────────────────────────

  /**
   * يضيف الحزمة لقائمة التنزيل إذا لم تكن مُثبَّتة أو جارياً تنزيلها.
   *
   * الخطوات:
   *   1. فحص ما إذا كانت الحزمة مُثبَّتة بالفعل في Registry.
   *   2. فحص حالة StateMachine (لا تعيد تنزيل ما هو في الطريق).
   *   3. تفويض التنزيل لـ DownloadManager.enqueue().
   */
  async install(
    id:      string,
    type:    AudioType,
    options: InstallOptions,
  ): Promise<PackageManagerResult<void>> {
    try {
      // 1. فحص التثبيت المسبق
      const installedResult = await this.repository.isInstalled(id, type);
      if (installedResult.success && installedResult.data) {
        return ok0(`الحزمة مُثبَّتة بالفعل: ${id}`);
      }

      // 2. فحص حالة StateMachine
      const { state } = this.stateMachine.getState(id, type);
      const activeStates: PackageState[] = [
        'DOWNLOADING',
        'DOWNLOADED',
        'VALIDATING',
        'INSTALLING',
      ];
      if (activeStates.includes(state)) {
        return ok0(`تنزيل الحزمة جارٍ بالفعل (${state}): ${id}`);
      }

      // 3. تفويض لـ DownloadManager
      const enqueueResult = this.dlManager.enqueue(
        id,
        type,
        options.downloadUrl,
        { priority: options.priority ?? 'normal' },
      );

      if (!enqueueResult.success) {
        return fail(
          enqueueResult.error?.message ?? 'خطأ غير معروف',
          `فشل إضافة الحزمة لقائمة التنزيل: ${id}`,
        );
      }

      return ok0(`تمت إضافة الحزمة لقائمة التنزيل: ${id} (jobId: ${enqueueResult.jobId})`);
    } catch (err) {
      return fail(err, `خطأ غير متوقع أثناء install: ${id}`);
    }
  }

  // ── uninstall ──────────────────────────────────────────────────────────────

  /**
   * يحذف الحزمة من الجهاز ويُعيد النظام لحالة NOT_INSTALLED.
   *
   * الخطوات:
   *   1. التحقق من أن الحزمة مُثبَّتة (لا نحذف ما لا يوجد).
   *   2. حفظ الحالة الحالية للـ Rollback.
   *   3. تفويض حذف الملفات + Registry لـ AudioRepository.
   *   4. إعادة StateMachine لـ NOT_INSTALLED.
   *
   * Rollback:
   *   إذا فشل removePackage: نُعيد StateMachine للحالة المحفوظة.
   */
  async uninstall(id: string, type: AudioType): Promise<PackageManagerResult<void>> {
    try {
      // 1. التحقق من الوجود
      const installedResult = await this.repository.isInstalled(id, type);
      if (!installedResult.success || !installedResult.data) {
        return fail(
          `الحزمة غير مُثبَّتة: ${id}`,
          `لا يمكن إلغاء تثبيت حزمة غير موجودة: ${id}`,
        );
      }

      // 2. حفظ الحالة الحالية
      const previousStatus = this.stateMachine.getState(id, type);

      // 3. حذف الملفات والسجل عبر Repository
      const removeResult = await this.repository.removePackage(id, type);
      if (!removeResult.success) {
        // Rollback: فقط إذا تغيرت الحالة فعلاً بين getState وفشل removePackage.
        // لا نستدعي setState إذا كانت الحالة الحالية مساوية للحالة السابقة لتجنب
        // استثناء "انتقال غير مسموح: X → X" الذي يخفي سبب الفشل الحقيقي.
        const currentStatus = this.stateMachine.getState(id, type);
        if (currentStatus.state !== previousStatus.state) {
          try {
            this.stateMachine.setState(id, type, previousStatus.state);
          } catch {
            // تجاهل أخطاء Rollback — الخطأ الحقيقي من removePackage يُعاد أدناه
          }
        }
        return fail(
          removeResult.error ?? 'فشل حذف الحزمة',
          `فشل إلغاء تثبيت الحزمة: ${id}`,
        );
      }

      // 4. إعادة StateMachine لـ NOT_INSTALLED
      this.stateMachine.reset(id, type);

      return ok0(`تم إلغاء تثبيت الحزمة بنجاح: ${id}`);
    } catch (err) {
      return fail(err, `خطأ غير متوقع أثناء uninstall: ${id}`);
    }
  }

  // ── update ─────────────────────────────────────────────────────────────────

  /**
   * Skeleton — تحديث الحزمة لأحدث إصدار.
   *
   * ملاحظة: يتطلب Networking للتحقق من إصدار Catalog.
   *         سيُكتمل في المرحلة التالية.
   */
  async update(id: string, type: AudioType): Promise<PackageManagerResult<void>> {
    // التحقق من وجود الحزمة قبل أي شيء
    const installedResult = await this.repository.isInstalled(id, type);
    if (!installedResult.success || !installedResult.data) {
      return fail(
        `الحزمة غير مُثبَّتة: ${id}`,
        `لا يمكن تحديث حزمة غير مُثبَّتة: ${id}`,
      );
    }

    // Skeleton: Networking غير مُفعَّل في هذه المرحلة
    return {
      success: false,
      message: `تحديث الحزمة يتطلب Networking — سيُنفَّذ في مرحلة لاحقة: ${id}`,
      error:   'NOT_IMPLEMENTED',
    };
  }

  // ── verify ─────────────────────────────────────────────────────────────────

  /**
   * يتحقق من سلامة الحزمة المُثبَّتة بدون أي تعديل.
   *
   * يفحص:
   *   - وجود سجل الحزمة في Registry
   *   - وجود manifest.json + audio/ + assets/ (عبر PackageValidator)
   *
   * لا يُعدّل أي ملف ولا يُحدّث أي حالة.
   */
  async verify(id: string, type: AudioType): Promise<PackageManagerResult<VerifyResult>> {
    try {
      // 1. فحص Registry
      const installedResult = await this.repository.isInstalled(id, type);
      const registryEntryExists = !!(installedResult.success && installedResult.data);

      // 2. فحص package-info.json فعلياً على القرص (عبر AudioRepository)
      const packageInfoResult = await this.repository.readPackageInfo(id, type);
      const packageInfoReadable = packageInfoResult.success;

      // 3. فحص هيكل الملفات عبر PackageValidator
      const structCheck = this.validator.validateStructure(type, id);

      // 4. استخلاص وجود manifest.json و audio/ من أخطاء PackageValidator
      const manifestExists       = !structCheck.errors.some(e => e.includes('manifest.json'));
      const audioDirectoryExists = !structCheck.errors.some(e => e.includes('audio/'));

      // الحكم النهائي: Registry + package-info.json + هيكل الملفات جميعها سليمة
      const verifyResult: VerifyResult = {
        isValid:             registryEntryExists && packageInfoReadable && structCheck.valid,
        registryEntryExists,
        packageInfoReadable,
        manifestExists,
        audioDirectoryExists,
        structureErrors:     structCheck.errors,
        structureWarnings:   structCheck.warnings,
      };

      const message = verifyResult.isValid
        ? `الحزمة سليمة: ${id}`
        : `الحزمة تحتوي على مشاكل: ${id} — أخطاء: ${structCheck.errors.length}`;

      return ok(verifyResult, message);
    } catch (err) {
      return fail(err, `خطأ غير متوقع أثناء verify: ${id}`);
    }
  }

  // ── repair ─────────────────────────────────────────────────────────────────

  /**
   * يفحص الحزمة ويُعيد تقريراً بحالتها وما يُوصى به.
   *
   * الخطوات:
   *   1. تشغيل verify().
   *   2. إذا كانت سليمة: لا يفعل شيئاً.
   *   3. إذا كانت تالفة: يُحدّث StateMachine لـ CORRUPTED ويُعيد التقرير.
   *      (إعادة التنزيل مسؤولية المرحلة القادمة.)
   */
  async repair(id: string, type: AudioType): Promise<PackageManagerResult<RepairResult>> {
    try {
      // 1. تشغيل verify
      const verifyResultWrapper = await this.verify(id, type);
      if (!verifyResultWrapper.success || !verifyResultWrapper.data) {
        return fail(
          verifyResultWrapper.error ?? 'فشل verify',
          `فشل فحص الحزمة أثناء repair: ${id}`,
        );
      }

      const verifyResult = verifyResultWrapper.data;

      // 2. الحزمة سليمة — لا يلزم إصلاح
      if (verifyResult.isValid) {
        const repairResult: RepairResult = {
          wasHealthy:        true,
          verifyResult,
          recommendedAction: 'none',
        };
        return ok(repairResult, `الحزمة سليمة ولا تحتاج إصلاحاً: ${id}`);
      }

      // 3. الحزمة تالفة — تحديث StateMachine + إعادة تقرير
      const { state } = this.stateMachine.getState(id, type);
      // الانتقال لـ CORRUPTED مسموح فقط من VALIDATING أو INSTALLED حسب StateMachine.
      // إذا كانت الحالة الحالية لا تسمح بالانتقال، نُسجّل الخطأ بدون crash.
      const allowedFromCurrent: PackageState[] = ['VALIDATING', 'INSTALLED', 'UPDATE_AVAILABLE'];
      if (allowedFromCurrent.includes(state)) {
        this.stateMachine.setState(id, type, 'CORRUPTED');
      }

      const repairResult: RepairResult = {
        wasHealthy:        false,
        verifyResult,
        recommendedAction: 'redownload',
      };
      return ok(
        repairResult,
        `الحزمة تالفة وتحتاج إعادة تنزيل: ${id} — أخطاء: ${verifyResult.structureErrors.join(', ')}`,
      );
    } catch (err) {
      return fail(err, `خطأ غير متوقع أثناء repair: ${id}`);
    }
  }

  // ── getInstalledPackages ───────────────────────────────────────────────────

  /**
   * يُعيد قائمة جميع الحزم المُثبَّتة.
   * يُفوَّض بالكامل لـ AudioRepository.
   */
  async getInstalledPackages(): Promise<PackageManagerResult<InstalledPackageInfo[]>> {
    try {
      const result = await this.repository.getInstalledPackages();
      if (!result.success) {
        return fail(
          result.error ?? 'فشل جلب الحزم',
          'فشل جلب قائمة الحزم المُثبَّتة',
        );
      }
      const packages = result.data ?? [];
      return ok(packages, `تم جلب ${packages.length} حزمة مُثبَّتة`);
    } catch (err) {
      return fail(err, 'خطأ غير متوقع أثناء getInstalledPackages');
    }
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────

export const packageManager = new PackageManager(
  audioRepository,
  packageValidator,
  packageStateMachine,
  downloadManager,
);
