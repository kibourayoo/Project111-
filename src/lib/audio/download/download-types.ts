/**
 * download-types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * جميع أنواع (Types) نظام Download Manager.
 * لا يحتوي أي منطق تنفيذي — أنواع بيانات خالصة.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AudioType } from '../audio-types';

// ─── DownloadStatus ───────────────────────────────────────────────────────────

/**
 * حالة Job واحدة داخل Download Manager.
 *
 * pending   → في الـ Queue بانتظار الدور
 * running   → يجري تنزيله الآن
 * paused    → متوقف مؤقتاً
 * cancelled → ألغاه المستخدم أو النظام
 * finished  → اكتمل بنجاح
 * failed    → فشل بعد استنفاد المحاولات
 */
export type DownloadStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'finished'
  | 'failed';

// ─── DownloadPriority ─────────────────────────────────────────────────────────

/**
 * أولوية الـ Job داخل الـ Queue.
 * الـ Queue يُرتَّب تنازلياً: high → normal → low.
 */
export type DownloadPriority = 'high' | 'normal' | 'low';

// ─── DownloadProgress ─────────────────────────────────────────────────────────

/**
 * بيانات التقدم اللحظية لـ Job جارٍ تنزيله.
 *
 * @property bytesDownloaded - عدد البايتات المُنزَّلة حتى الآن
 * @property totalBytes      - الحجم الكلي (0 إذا لم يُعرف بعد)
 * @property percent         - نسبة الاكتمال 0–100 (0 إذا لم يُعرف totalBytes)
 * @property bytesPerSecond  - سرعة التنزيل اللحظية (0 في البداية)
 * @property elapsedMs       - الزمن المنقضي منذ بدء الـ Job (مللي ثانية)
 */
export interface DownloadProgress {
  readonly bytesDownloaded: number;
  readonly totalBytes:      number;
  readonly percent:         number;
  readonly bytesPerSecond:  number;
  readonly elapsedMs:       number;
}

// ─── DownloadError ────────────────────────────────────────────────────────────

/**
 * خطأ موحَّد يُصدره Download Manager.
 *
 * @property code    - رمز الخطأ (مثال: 'NETWORK_TIMEOUT', 'DISK_FULL', 'NOT_FOUND')
 * @property message - رسالة قابلة للعرض
 * @property jobId   - معرّف الـ Job المرتبط بالخطأ
 * @property cause   - الخطأ الأصلي (اختياري)
 */
export interface DownloadError {
  readonly code:    string;
  readonly message: string;
  readonly jobId:   string;
  readonly cause?:  unknown;
}

// ─── DownloadJob ──────────────────────────────────────────────────────────────

/**
 * وحدة التنزيل الأساسية — تمثّل طلب تنزيل حزمة صوتية واحدة.
 *
 * @property id          - معرّف فريد للـ Job (uuid أو packageId)
 * @property packageId   - معرّف الحزمة الصوتية المراد تنزيلها
 * @property type        - نوع الحزمة (AudioType)
 * @property downloadUrl - رابط التنزيل الكامل (Cloudflare R2 أو غيره)
 * @property priority    - أولوية التنزيل داخل الـ Queue
 * @property status      - الحالة الحالية
 * @property progress    - بيانات التقدم (null إذا لم يبدأ بعد)
 * @property retryCount  - عدد محاولات إعادة المحاولة المنجزة
 * @property maxRetries  - الحد الأقصى لإعادة المحاولة
 * @property createdAt   - وقت إضافة الـ Job للـ Queue (timestamp ms)
 * @property startedAt   - وقت بدء التنزيل الفعلي (null إذا لم يبدأ)
 * @property finishedAt  - وقت الانتهاء أو الإلغاء (null إذا لم ينته)
 * @property error       - آخر خطأ (null إذا لا يوجد)
 */
export interface DownloadJob {
  readonly id:          string;
  readonly packageId:   string;
  readonly type:        AudioType;
  readonly downloadUrl: string;
  readonly priority:    DownloadPriority;
  status:               DownloadStatus;
  progress:             DownloadProgress | null;
  retryCount:           number;
  readonly maxRetries:  number;
  readonly createdAt:   number;
  startedAt:            number | null;
  finishedAt:           number | null;
  error:                DownloadError | null;
}

// ─── DownloadQueueItem ────────────────────────────────────────────────────────

/**
 * عنصر مبسَّط يُستخدم لعرض الـ Queue للطبقات الخارجية.
 * مشتق من DownloadJob لكن يحتوي البيانات القابلة للعرض فقط.
 */
export interface DownloadQueueItem {
  readonly id:        string;
  readonly packageId: string;
  readonly type:      AudioType;
  readonly priority:  DownloadPriority;
  readonly status:    DownloadStatus;
  readonly progress:  DownloadProgress | null;
  readonly position:  number;
}

// ─── DownloadResult ───────────────────────────────────────────────────────────

/**
 * نتيجة موحَّدة تُعيدها دوال Download Manager.
 *
 * @property success  - نجاح العملية أم لا
 * @property jobId    - معرّف الـ Job المعني
 * @property error    - تفاصيل الخطأ عند الفشل (null عند النجاح)
 */
export interface DownloadResult {
  readonly success: boolean;
  readonly jobId:   string;
  readonly error:   DownloadError | null;
}

// ─── EnqueueOptions ──────────────────────────────────────────────────────────

/**
 * خيارات إضافية عند إضافة Job جديد.
 */
export interface EnqueueOptions {
  /** أولوية الـ Job — افتراضي: 'normal' */
  priority?:   DownloadPriority;
  /** الحد الأقصى لإعادة المحاولة — افتراضي: 3 */
  maxRetries?: number;
}
