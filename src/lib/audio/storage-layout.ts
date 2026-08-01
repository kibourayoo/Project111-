/**
 * storage-layout.ts
 * الثوابت النهائية لهيكل تخزين المحتوى الصوتي
 *
 * هيكل المجلدات:
 *
 *   audio/
 *     packages/
 *       adhan/
 *         husary/
 *           manifest.json      ← بيانات الحزمة المحلية
 *           assets/            ← ملفات غير صوتية (thumbnail, cover, license…)
 *             thumbnail.webp
 *             cover.webp
 *           audio/             ← ملفات الصوت الفعلية
 *             ...
 *       quran/
 *       ruqyah/
 *       dua/
 *       notification/
 *       custom/
 *     cache/
 *     temp/
 *
 * لا يحتوي على أي منطق — ثوابت وأسماء فقط
 */

// ─── المجلدات الرئيسية ────────────────────────────────────────────────────────

/** المجلد الجذري لجميع بيانات الصوت داخل تخزين التطبيق */
export const AUDIO_ROOT = 'audio';

/** مجلد الحزم المُثبَّتة */
export const PACKAGES_DIRECTORY = 'packages';

/** مجلد الملفات المؤقتة للتحميل الجاري */
export const TEMP_DIRECTORY = 'temp';

/** مجلد الـ cache لملفات الصوت المُجزَّأة أو المُعالَجة */
export const CACHE_DIRECTORY = 'cache';

// ─── المجلدات داخل كل حزمة ───────────────────────────────────────────────────

/** مجلد ملفات الصوت الفعلية داخل كل حزمة */
export const AUDIO_DIRECTORY = 'audio';

/**
 * مجلد الأصول غير الصوتية داخل كل حزمة
 * يحتوي: thumbnail.webp / cover.webp / license.txt / …
 */
export const ASSETS_DIRECTORY = 'assets';

// ─── أسماء الملفات الثابتة داخل كل حزمة ─────────────────────────────────────

/**
 * ملف Manifest الأصلي — يأتي داخل ZIP ولا يُعدَّل بعد التثبيت.
 * يحتوي على بيانات تعريف الحزمة بصيغة AudioPackage (من الناشر).
 * مرجع ثابت للقراءة فقط.
 */
export const MANIFEST_FILENAME = 'manifest.json';

/**
 * ملف البيانات المحلية — يُنشَأ بواسطة التطبيق عند التثبيت.
 * يحتوي على InstalledPackageInfo: حالة التثبيت، وقته، آخر استخدام، وأي بيانات محلية.
 * مستقل تماماً عن manifest.json ولا يتداخل معه.
 */
export const PACKAGE_INFO_FILENAME = 'package-info.json';

/** صورة مصغّرة للحزمة بصيغة WebP (داخل assets/) */
export const THUMBNAIL_FILENAME = 'thumbnail.webp';

/** اسم ملف الـ Registry المحلي لجميع الحزم المثبتة */
export const REGISTRY_FILENAME = 'installed.json';

/** نسخة مخطط Registry — تُستخدم للكشف عن تحديثات المخطط */
export const REGISTRY_SCHEMA_VERSION = '1.0.0';
