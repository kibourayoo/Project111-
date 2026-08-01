/**
 * package-state.ts
 * نظام حالات الحزم الصوتية — State Machine كاملة
 *
 * ─── مخطط الانتقالات المسموحة ────────────────────────────────────────────────
 *
 *   NOT_INSTALLED ──→ DOWNLOADING
 *   DOWNLOADING   ──→ DOWNLOADED | FAILED
 *   DOWNLOADED    ──→ VALIDATING | INSTALLING
 *   VALIDATING    ──→ INSTALLING | FAILED | CORRUPTED
 *   INSTALLING    ──→ INSTALLED  | FAILED
 *   INSTALLED     ──→ UPDATE_AVAILABLE
 *   UPDATE_AVAILABLE ──→ DOWNLOADING
 *   FAILED        ──→ DOWNLOADING | NOT_INSTALLED
 *   CORRUPTED     ──→ DOWNLOADING | NOT_INSTALLED
 *
 * ─── ملاحظات ────────────────────────────────────────────────────────────────
 * - لا يوجد FileSystem أو Network أو Download أو AsyncStorage
 * - جميع الحالات تعيش في الذاكرة فقط (Map)
 * - يستطيع الـ UI الاعتماد على PackageState مباشرة بدون منطق إضافي
 */

import type { AudioType } from './audio-types';

// ─── PackageState ─────────────────────────────────────────────────────────────

/**
 * الحالات الممكنة لأي حزمة صوتية داخل التطبيق
 * يُستخدم لعرض واجهة المستخدم واتخاذ القرارات
 */
export type PackageState =
  | 'NOT_INSTALLED'    // لم تُثبَّت بعد
  | 'DOWNLOADING'      // جارٍ التحميل
  | 'DOWNLOADED'       // اكتمل التحميل — في انتظار التحقق
  | 'VALIDATING'       // جارٍ التحقق من checksum والهيكل
  | 'INSTALLING'       // جارٍ التثبيت
  | 'INSTALLED'        // مُثبَّتة وجاهزة للتشغيل
  | 'UPDATE_AVAILABLE' // مُثبَّتة لكن يوجد إصدار أحدث
  | 'FAILED'           // فشل التحميل أو التثبيت
  | 'CORRUPTED';       // فشل التحقق من checksum — بيانات تالفة

// ─── PackageStatus ────────────────────────────────────────────────────────────

/**
 * الحالة الكاملة لحزمة صوتية في لحظة معيّنة
 */
export interface PackageStatus {
  /** معرّف الحزمة */
  id: string;
  /** نوع المحتوى الصوتي */
  type: AudioType;
  /** الحالة الحالية */
  state: PackageState;
  /** نسبة التقدم (0–100) — أثناء DOWNLOADING و INSTALLING */
  progress: number;
  /** رسالة وصفية للحالة أو الخطأ */
  message: string;
  /** توقيت آخر تحديث (Unix timestamp بالمللي‑ثانية) */
  updatedAt: number;
}

// ─── DEFAULT_PACKAGE_STATUS ───────────────────────────────────────────────────

export const DEFAULT_PACKAGE_STATUS: Omit<PackageStatus, 'id' | 'type'> = {
  state:     'NOT_INSTALLED',
  progress:  0,
  message:   '',
  updatedAt: 0,
};

// ─── PackageStateTransition (الانتقالات المسموح بها) ─────────────────────────

/**
 * خريطة الانتقالات المسموح بها لكل حالة
 * أي انتقال غير موجود هنا سيُرفض بـ Error
 */
export const ALLOWED_TRANSITIONS: Record<PackageState, PackageState[]> = {
  NOT_INSTALLED:    ['DOWNLOADING'],
  DOWNLOADING:      ['DOWNLOADED', 'FAILED'],
  DOWNLOADED:       ['VALIDATING', 'INSTALLING'],
  VALIDATING:       ['INSTALLING', 'FAILED', 'CORRUPTED'],
  INSTALLING:       ['INSTALLED', 'FAILED'],
  INSTALLED:        ['UPDATE_AVAILABLE'],
  UPDATE_AVAILABLE: ['DOWNLOADING'],
  FAILED:           ['DOWNLOADING', 'NOT_INSTALLED'],
  CORRUPTED:        ['DOWNLOADING', 'NOT_INSTALLED'],
};

// ─── PackageStateMachine ──────────────────────────────────────────────────────

/** مفتاح فريد لكل حزمة داخل الـ Map */
function makeKey(id: string, type: AudioType): string {
  return `${type}:${id}`;
}

export class PackageStateMachine {
  private readonly states = new Map<string, PackageStatus>();

  // ── قراءة الحالة ────────────────────────────────────────────────────────────

  /**
   * يُعيد الحالة الحالية للحزمة، أو NOT_INSTALLED إذا لم تُسجَّل بعد
   */
  getState(id: string, type: AudioType): PackageStatus {
    return (
      this.states.get(makeKey(id, type)) ?? {
        id,
        type,
        ...DEFAULT_PACKAGE_STATUS,
        updatedAt: Date.now(),
      }
    );
  }

  // ── تغيير الحالة ────────────────────────────────────────────────────────────

  /**
   * يُغيّر حالة الحزمة إذا كان الانتقال مسموحاً
   * @throws {Error} إذا كان الانتقال غير مسموح
   */
  setState(
    id: string,
    type: AudioType,
    nextState: PackageState,
    opts: { progress?: number; message?: string } = {},
  ): PackageStatus {
    const current = this.getState(id, type);
    const allowed = ALLOWED_TRANSITIONS[current.state];

    if (!allowed.includes(nextState)) {
      throw new Error(
        `انتقال غير مسموح: ${current.state} → ${nextState} (الحزمة: ${id})`,
      );
    }

    const updated: PackageStatus = {
      ...current,
      state:     nextState,
      progress:  opts.progress  ?? (nextState === 'INSTALLED' ? 100 : current.progress),
      message:   opts.message   ?? '',
      updatedAt: Date.now(),
    };

    this.states.set(makeKey(id, type), updated);
    return updated;
  }

  /**
   * يُعيد الحزمة إلى NOT_INSTALLED ويمسح تقدمها
   */
  reset(id: string, type: AudioType): PackageStatus {
    const fresh: PackageStatus = {
      id,
      type,
      ...DEFAULT_PACKAGE_STATUS,
      updatedAt: Date.now(),
    };
    this.states.set(makeKey(id, type), fresh);
    return fresh;
  }

  // ── استعلامات الحالة ─────────────────────────────────────────────────────────

  /** هل الحزمة مشغولة حالياً (تحميل أو تحقق أو تثبيت)؟ */
  isBusy(id: string, type: AudioType): boolean {
    const { state } = this.getState(id, type);
    return state === 'DOWNLOADING' || state === 'VALIDATING' || state === 'INSTALLING';
  }

  /** هل الحزمة مُثبَّتة وقابلة للاستخدام؟ */
  isInstalled(id: string, type: AudioType): boolean {
    const { state } = this.getState(id, type);
    return state === 'INSTALLED' || state === 'UPDATE_AVAILABLE';
  }

  /** هل يتوفر تحديث للحزمة؟ */
  needsUpdate(id: string, type: AudioType): boolean {
    return this.getState(id, type).state === 'UPDATE_AVAILABLE';
  }

  /** هل فشلت الحزمة أو تلفت؟ */
  hasFailed(id: string, type: AudioType): boolean {
    const { state } = this.getState(id, type);
    return state === 'FAILED' || state === 'CORRUPTED';
  }
}

// ─── singleton ────────────────────────────────────────────────────────────────
export const packageStateMachine = new PackageStateMachine();

// ─── Helper Functions (للتوافق مع الكود الموجود) ─────────────────────────────

/** هل الحزمة مُثبَّتة وجاهزة للتشغيل؟ */
export function isInstalled(state: PackageState): boolean {
  return state === 'INSTALLED' || state === 'UPDATE_AVAILABLE';
}
/** هل الحزمة قيد التحميل حالياً؟ */
export function isDownloading(state: PackageState): boolean {
  return state === 'DOWNLOADING';
}
/** هل فشلت عملية التحميل أو التثبيت؟ */
export function isFailed(state: PackageState): boolean {
  return state === 'FAILED';
}
/** هل بيانات الحزمة تالفة؟ */
export function isCorrupted(state: PackageState): boolean {
  return state === 'CORRUPTED';
}
/** هل يتوفر تحديث للحزمة؟ */
export function needsUpdate(state: PackageState): boolean {
  return state === 'UPDATE_AVAILABLE';
}
/** هل يمكن بدء التثبيت؟ */
export function canInstall(state: PackageState): boolean {
  return state === 'DOWNLOADED' || state === 'VALIDATING';
}
/** هل يمكن بدء التحميل؟ */
export function canDownload(state: PackageState): boolean {
  return (
    state === 'NOT_INSTALLED' ||
    state === 'FAILED'        ||
    state === 'CORRUPTED'     ||
    state === 'UPDATE_AVAILABLE'
  );
}
/** هل العملية جارية حالياً؟ */
export function isInProgress(state: PackageState): boolean {
  return state === 'DOWNLOADING' || state === 'VALIDATING' || state === 'INSTALLING';
}

// ─── StateMachineTestReport ───────────────────────────────────────────────────

export interface StateMachineTestReport {
  /** هل اكتمل المسار الكامل NOT_INSTALLED → INSTALLED بنجاح؟ */
  fullPathCompleted: boolean;
  /** الحالات التي مرّ بها بالترتيب */
  statesVisited: PackageState[];
  /** هل تم رفض الانتقال غير المسموح؟ */
  invalidTransitionRejected: boolean;
  /** رسالة الخطأ المُعادة عند الانتقال غير المسموح */
  rejectionMessage: string;
}

/**
 * اختبار المرحلة الحادية عشرة:
 * NOT_INSTALLED → DOWNLOADING → DOWNLOADED → VALIDATING
 * → INSTALLING → INSTALLED ثم محاولة INSTALLED → DOWNLOADING (مرفوض)
 */
export function testStateMachine(): StateMachineTestReport {
  const sm   = new PackageStateMachine();
  const id   = 'husary';
  const type: AudioType = 'adhan';

  const visited: PackageState[] = [];
  let fullPathCompleted       = false;
  let invalidTransitionRejected = false;
  let rejectionMessage          = '';

  try {
    // المسار الكامل
    visited.push(sm.getState(id, type).state);                                    // NOT_INSTALLED
    sm.setState(id, type, 'DOWNLOADING', { progress: 0,   message: 'جارٍ التحميل' });
    visited.push(sm.getState(id, type).state);
    sm.setState(id, type, 'DOWNLOADED',  { progress: 100, message: 'اكتمل التحميل' });
    visited.push(sm.getState(id, type).state);
    sm.setState(id, type, 'VALIDATING',  { progress: 100, message: 'جارٍ التحقق' });
    visited.push(sm.getState(id, type).state);
    sm.setState(id, type, 'INSTALLING',  { progress: 100, message: 'جارٍ التثبيت' });
    visited.push(sm.getState(id, type).state);
    sm.setState(id, type, 'INSTALLED',   { message: 'تم التثبيت بنجاح' });
    visited.push(sm.getState(id, type).state);

    fullPathCompleted = sm.isInstalled(id, type);

    // محاولة انتقال غير مسموح: INSTALLED → DOWNLOADING
    sm.setState(id, type, 'DOWNLOADING');
  } catch (err) {
    invalidTransitionRejected = true;
    rejectionMessage = err instanceof Error ? err.message : String(err);
  }

  return { fullPathCompleted, statesVisited: visited, invalidTransitionRejected, rejectionMessage };
}
