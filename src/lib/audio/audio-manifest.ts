/**
 * audio-manifest.ts
 * النسخة النهائية من Schema الـ index.json
 *
 * هذا الملف هو مرجع الأنواع الرسمي للكتالوج
 * سواء كان محلياً (LocalCatalogSource) أو على Cloudflare R2
 *
 * لا يحتوي على أي FileSystem أو Network أو Storage
 *
 * ─── طبقات الـ Schema ────────────────────────────────────────────────────────
 *   LocalizedString   ← نص متعدد اللغات
 *   PackageLicense    ← قيم رخصة محددة (Enum)
 *   Category          ← تصنيف نوع المحتوى
 *   AudioPackage      ← الحزمة الكاملة بجميع حقولها النهائية
 *   Manifest          ← مستوى الملف الكامل (index.json)
 */

import type { AudioType } from './audio-types';
import { AUDIO_MANIFEST_SCHEMA_VERSION } from './constants';

// ─── LocalizedString ──────────────────────────────────────────────────────────

/**
 * نص متعدد اللغات
 * `ar` إلزامي — بقية اللغات اختيارية
 * مثال: { ar: 'أذان مكة', en: 'Makkah Adhan' }
 */
export interface LocalizedString {
  ar: string;
  en?: string;
  [lang: string]: string | undefined;
}

// ─── PackageLicense ───────────────────────────────────────────────────────────

/**
 * قيم الرخصة المسموح بها — Enum ثابت لمنع القيم غير المتسقة
 * لإضافة نوع جديد: أضفه هنا فقط
 */
export type PackageLicense =
  | 'public-domain' // ملك عام — لا قيود
  | 'cc-by'         // Creative Commons — مع إسناد
  | 'cc-by-nc'      // Creative Commons — غير تجاري
  | 'proprietary'   // حقوق محفوظة
  | 'unknown';      // غير محدد

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * تصنيف نوع المحتوى الصوتي كما يظهر في index.json
 * يجعل الـ UI ديناميكياً بالكامل — لا حاجة لـ hardcode
 */
export interface Category {
  /** يطابق AudioType — "adhan" | "quran" | ... */
  id: string;
  /** عنوان التصنيف للعرض */
  title: LocalizedString;
  /** وصف التصنيف */
  description: LocalizedString;
  /** أيقونة التصنيف (URL اختياري) */
  iconUrl?: string;
  /** ترتيب العرض */
  sortOrder: number;
  /** هل هذا التصنيف مفعّل في الواجهة؟ */
  enabled: boolean;
}

// ─── AudioPackage (النسخة النهائية) ──────────────────────────────────────────

/**
 * حزمة الصوت الكاملة — النسخة النهائية من Schema
 * تحتوي على جميع البيانات اللازمة للعرض والتحميل والتشغيل
 */
export interface AudioPackage {

  // ── الهوية ─────────────────────────────────────────────────────────────────

  /** معرّف فريد ثابت للأبد — لا يتغيّر بعد النشر */
  id: string;
  /** نوع المحتوى الصوتي */
  type: AudioType;
  /** اسم المجلد المحلي بعد التحميل — قد يختلف عن id */
  folderName: string;
  /**
   * رابط ملف Manifest خاص بالحزمة على R2 (اختياري)
   * للحزم الكبيرة كالقرآن الكريم التي لها قائمة ملفات منفصلة
   */
  manifestUrl?: string;

  // ── المحتوى ────────────────────────────────────────────────────────────────

  /** عنوان الحزمة للعرض */
  title: LocalizedString;
  /** وصف مختصر للحزمة (اختياري) */
  description?: LocalizedString;
  /** اسم المؤلف أو القارئ أو المؤذن */
  author: string;
  /** رابط صفحة المؤلف أو مصدره (اختياري) */
  authorUrl?: string;
  /** رمز اللغة BCP 47 مثل: "ar", "ar-SA", "ar-EG" */
  language: string;
  /**
   * المصدر أو المنشأ — نص حر
   * يمثل: دولة، مدينة، مسجد، مؤسسة، جهة إنتاج
   * مثال: "المسجد الحرام - مكة المكرمة" | "دار القرآن الكويتية"
   */
  origin: string;

  // ── الإصدار ────────────────────────────────────────────────────────────────

  /** نسخة الحزمة بصيغة semver */
  version: string;
  /** تاريخ أول نشر (ISO 8601) — لا يتغيّر */
  releaseDate: string;
  /** تاريخ آخر تعديل (ISO 8601) — يتغيّر مع كل تحديث */
  updatedAt: string;
  /** الحد الأدنى لإصدار التطبيق المطلوب بصيغة semver */
  minimumAppVersion: string;

  // ── الملفات ────────────────────────────────────────────────────────────────

  /** بصمة SHA-256 لملف التحميل — "sha256:abc123..." */
  checksum: string;
  /**
   * بصمة SHA-256 لملف manifestUrl المنفصل (اختياري)
   * مستقل عن checksum لأن الـ manifest قد يتحدث دون تغيير الـ ZIP
   */
  manifestChecksum?: string;
  /** الحجم الكلي بعد الاستخراج بالبايت */
  sizeBytes: number;
  /** حجم ملف ZIP قبل الاستخراج بالبايت (اختياري — للعرض قبل التحميل) */
  compressedSizeBytes?: number;
  /**
   * مدة المحتوى الصوتي بالثواني (اختياري)
   * للأذان: مدة الأذان | للمعاينة: مدة المقطع | للقرآن: مدة السورة الأولى
   */
  durationSeconds?: number;
  /** رابط التحميل على Cloudflare R2 — null للحزم المدمجة (builtIn) */
  downloadUrl?: string | null;
  /** رابط مقطع معاينة قصير قبل التحميل (اختياري) */
  previewUrl?: string;
  /** رابط صورة مصغّرة للحزمة (اختياري) */
  thumbnailUrl?: string;
  /** هل الحزمة مُضمَّنة في التطبيق بدون تحميل؟ */
  builtIn: boolean;

  // ── الاكتشاف ───────────────────────────────────────────────────────────────

  /** وسوم للبحث والتصفية */
  tags: string[];
  /** هل تُعرض في الواجهة الرئيسية؟ */
  featured: boolean;
  /** ترتيب العرض داخل النوع */
  sortOrder: number;

  // ── الجودة والمصداقية ──────────────────────────────────────────────────────

  /** هل تحقق فريق المحتوى من صحة التلاوة/المحتوى؟ */
  verified: boolean;
  /** رخصة المحتوى — قيم محددة لمنع التعارض */
  license: PackageLicense;

  // ── دورة الحياة ────────────────────────────────────────────────────────────

  /** هل الحزمة مهجورة؟ */
  deprecated: boolean;
  /** id الحزمة البديلة عند الهجر (اختياري) */
  replacementId?: string;

  // ── قابلية التوسع ──────────────────────────────────────────────────────────

  /**
   * بيانات إضافية خاصة بكل نوع — موجود دائماً حتى لو {}
   * مثال quran:    { riwaya: 'حفص', suras: 114 }
   * مثال adhan:    { maqam: 'رست', recordingQuality: 'studio' }
   * مثال ruqyah:   { scholar: 'ابن باز', source: 'السنة النبوية' }
   */
  metadata: Record<string, unknown>;
}

// ─── Manifest (الشكل النهائي لـ index.json) ──────────────────────────────────

/**
 * الشكل الكامل لملف index.json على Cloudflare R2
 */
export interface Manifest {
  /** إصدار مخطط الملف — يتغيّر فقط عند تغيير البنية */
  schemaVersion: string;
  /**
   * رقم تسلسلي يزداد مع كل نشر جديد
   * يُستخدم للكشف عن التحديثات: هل رقمي < رقم السيرفر؟
   */
  catalogVersion: number;
  /** وقت بناء الملف (ISO 8601) */
  generatedAt: string;
  /** أقدم إصدار تطبيق يستطيع قراءة هذا الملف (semver) */
  minimumSupportedAppVersion: string;
  /** عدد الحزم الكلي — للتحقق السريع من اكتمال الملف */
  totalPackages: number;
  /** قائمة تصنيفات المحتوى */
  categories: Category[];
  /** قائمة جميع الحزم المتاحة */
  packages: AudioPackage[];
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * يتحقق من أن الكائن يمثّل Manifest صالحاً بالحقول الجوهرية
 */
export function isManifestValid(manifest: unknown): manifest is Manifest {
  if (!manifest || typeof manifest !== 'object') return false;
  const m = manifest as Record<string, unknown>;
  return (
    typeof m.schemaVersion   === 'string' &&
    typeof m.catalogVersion  === 'number' &&
    typeof m.generatedAt     === 'string' &&
    Array.isArray(m.packages) &&
    Array.isArray(m.categories)
  );
}

/** يبحث عن حزمة بمعرّفها */
export function findPackage(manifest: Manifest, packageId: string): AudioPackage | null {
  return manifest.packages.find((p) => p.id === packageId) ?? null;
}

/** يُعيد جميع الحزم من نوع معيّن */
export function packagesByType(manifest: Manifest, type: AudioType): AudioPackage[] {
  return manifest.packages.filter((p) => p.type === type);
}

/** يُعيد الحزم المُضمَّنة في التطبيق */
export function builtInPackages(manifest: Manifest): AudioPackage[] {
  return manifest.packages.filter((p) => p.builtIn);
}

/** يُعيد الحزم القابلة للتحميل (غير مدمجة ولها downloadUrl) */
export function downloadablePackages(manifest: Manifest): AudioPackage[] {
  return manifest.packages.filter((p) => !p.builtIn && !!p.downloadUrl);
}

// ─── SAMPLE_MANIFEST ─────────────────────────────────────────────────────────

/**
 * فهرس تجريبي يغطي جميع الأنواع الخمسة
 * ⚠️ للاختبار فقط — لا تُستخدم في الإنتاج
 */
export const SAMPLE_MANIFEST: Manifest = {
  schemaVersion:               AUDIO_MANIFEST_SCHEMA_VERSION,
  catalogVersion:              1,
  generatedAt:                 '2026-07-05T00:00:00Z',
  minimumSupportedAppVersion:  '1.0.0',
  totalPackages:               6,
  categories: [
    {
      id: 'adhan', sortOrder: 1, enabled: true,
      title:       { ar: 'الأذان',        en: 'Adhan'    },
      description: { ar: 'أذان الصلوات الخمس', en: 'Call to prayer' },
    },
    {
      id: 'quran', sortOrder: 2, enabled: true,
      title:       { ar: 'القرآن الكريم', en: 'Quran'    },
      description: { ar: 'ختمات كاملة وسور مختارة', en: 'Full recitations' },
    },
    {
      id: 'mushaf', sortOrder: 3, enabled: true,
      title:       { ar: 'المصحف الشريف', en: 'Mushaf'   },
      description: { ar: 'صفحات المصحف مع بيانات الآيات', en: 'Mushaf pages with verse data' },
    },
    {
      id: 'ruqyah', sortOrder: 4, enabled: true,
      title:       { ar: 'الرقية الشرعية', en: 'Ruqyah' },
      description: { ar: 'الرقية الشرعية من القرآن والسنة', en: 'Islamic healing recitation' },
    },
    {
      id: 'dua', sortOrder: 5, enabled: true,
      title:       { ar: 'الأدعية',       en: 'Dua'      },
      description: { ar: 'أدعية من القرآن الكريم والسنة النبوية', en: 'Supplications' },
    },
    {
      id: 'notification', sortOrder: 6, enabled: true,
      title:       { ar: 'الإشعارات',     en: 'Notifications' },
      description: { ar: 'أصوات تنبيهات التطبيق', en: 'App notification sounds' },
    },
  ],
  packages: [

    // ── 1. أذان مُدمَج (builtIn) ──────────────────────────────────────────────
    {
      id:          'adhan-builtin-makkah',
      type:        'adhan',
      folderName:  'adhan-builtin-makkah',
      title:       { ar: 'أذان مكة المكرمة',       en: 'Makkah Adhan' },
      description: { ar: 'أذان المسجد الحرام — مُضمَّن في التطبيق', en: 'Grand Mosque adhan — built-in' },
      author:      'الشيخ علي أحمد ملا',
      language:    'ar',
      origin:      'المسجد الحرام - مكة المكرمة',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:    'sha256-builtin-makkah-placeholder',
      sizeBytes:   2_202_009,
      durationSeconds: 210,
      downloadUrl: null,
      builtIn:     true,
      tags:        ['مكة', 'مسجد حرام', 'كلاسيكي', 'مُدمَج'],
      featured:    true,
      sortOrder:   1,
      verified:    true,
      license:     'proprietary',
      deprecated:  false,
      metadata:    { recordingQuality: 'studio', maqam: 'رست' },
    },

    // ── 2. أذان قابل للتحميل ──────────────────────────────────────────────────
    {
      id:          'adhan-mishari-afasy',
      type:        'adhan',
      folderName:  'adhan-mishari-afasy',
      title:       { ar: 'أذان مشاري راشد العفاسي', en: 'Mishari Afasy Adhan' },
      description: { ar: 'أذان بصوت الشيخ مشاري العفاسي', en: 'Adhan by Sheikh Mishari Afasy' },
      author:      'مشاري راشد العفاسي',
      language:    'ar',
      origin:      'الكويت',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:    'sha256-mishari-afasy-placeholder',
      sizeBytes:           3_670_016,
      compressedSizeBytes: 3_145_728,
      durationSeconds:     195,
      downloadUrl: 'https://cdn.example.com/audio/adhan-mishari-afasy/v1.zip',
      previewUrl:  'https://cdn.example.com/audio/adhan-mishari-afasy/preview.mp3',
      thumbnailUrl:'https://cdn.example.com/thumbnails/mishari-afasy.webp',
      builtIn:     false,
      tags:        ['عفاسي', 'كويت', 'هادئ'],
      featured:    true,
      sortOrder:   2,
      verified:    true,
      license:     'proprietary',
      deprecated:  false,
      metadata:    { maqam: 'صبا' },
    },

    // ── 3. قرآن كريم ─────────────────────────────────────────────────────────
    {
      id:          'quran-sudais-full',
      type:        'quran',
      folderName:  'quran-sudais-full',
      manifestUrl: 'https://cdn.example.com/audio/quran-sudais-full/manifest.json',
      title:       { ar: 'القرآن الكريم — الشيخ السديس', en: 'Quran — Sheikh Sudais' },
      description: { ar: 'ختمة كاملة بصوت الشيخ عبد الرحمن السديس', en: 'Complete recitation by Sheikh Abdul Rahman Al-Sudais' },
      author:      'عبد الرحمن السديس',
      authorUrl:   'https://example.com/sudais',
      language:    'ar',
      origin:      'المسجد الحرام - مكة المكرمة',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:            'sha256-sudais-full-placeholder',
      manifestChecksum:    'sha256-sudais-manifest-placeholder',
      sizeBytes:           891_289_600,
      compressedSizeBytes: 734_003_200,
      downloadUrl: 'https://cdn.example.com/audio/quran-sudais-full/v1.zip',
      previewUrl:  'https://cdn.example.com/audio/quran-sudais-full/preview.mp3',
      thumbnailUrl:'https://cdn.example.com/thumbnails/sudais.webp',
      builtIn:     false,
      tags:        ['قرآن', 'سديس', 'ختمة كاملة', 'حفص'],
      featured:    true,
      sortOrder:   1,
      verified:    true,
      license:     'proprietary',
      deprecated:  false,
      metadata:    { riwaya: 'حفص عن عاصم', suras: 114, recordingQuality: 'studio' },
    },

    // ── 4. رقية شرعية ────────────────────────────────────────────────────────
    {
      id:          'ruqyah-shuraim',
      type:        'ruqyah',
      folderName:  'ruqyah-shuraim',
      title:       { ar: 'الرقية الشرعية — الشيخ شريم', en: 'Ruqyah — Sheikh Shuraim' },
      description: { ar: 'رقية شرعية كاملة بصوت الشيخ سعود الشريم', en: 'Complete ruqyah by Sheikh Saud Al-Shuraim' },
      author:      'سعود الشريم',
      language:    'ar',
      origin:      'المسجد الحرام - مكة المكرمة',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:            'sha256-ruqyah-shuraim-placeholder',
      sizeBytes:           47_185_920,
      compressedSizeBytes: 39_321_600,
      durationSeconds:     3600,
      downloadUrl: 'https://cdn.example.com/audio/ruqyah-shuraim/v1.zip',
      thumbnailUrl:'https://cdn.example.com/thumbnails/shuraim.webp',
      builtIn:     false,
      tags:        ['رقية', 'شريم', 'علاج', 'سنة نبوية'],
      featured:    false,
      sortOrder:   1,
      verified:    true,
      license:     'proprietary',
      deprecated:  false,
      metadata:    { scholar: 'سعود الشريم', source: 'القرآن والسنة' },
    },

    // ── 5. مصحف شريف ─────────────────────────────────────────────────────────
    {
      id:          'mushaf-hafs-standard',
      type:        'mushaf',
      folderName:  'mushaf-hafs-standard',
      title:       { ar: 'المصحف الشريف — رواية حفص', en: 'Mushaf — Hafs Narration' },
      description: { ar: '604 صفحة بخط عثماني واضح مع بيانات الآيات والأجزاء', en: '604 pages in Uthmani script with verse and juz data' },
      author:      'مجمع الملك فهد لطباعة المصحف الشريف',
      language:    'ar',
      origin:      'المملكة العربية السعودية',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:            'sha256-mushaf-hafs-placeholder',
      sizeBytes:           157_286_400,
      compressedSizeBytes: 104_857_600,
      downloadUrl: 'https://cdn.example.com/mushaf/mushaf-hafs-standard/v1.zip',
      thumbnailUrl:'https://cdn.example.com/thumbnails/mushaf-hafs.webp',
      builtIn:     false,
      tags:        ['مصحف', 'حفص', 'عثماني', '604 صفحة'],
      featured:    true,
      sortOrder:   1,
      verified:    true,
      license:     'proprietary',
      deprecated:  false,
      metadata:    {
        riwaya:     'حفص عن عاصم',
        totalPages: 604,
        script:     'عثماني',
        resolution: '1242x1656',
        format:     'webp',
      },
    },

    // ── 6. دعاء ──────────────────────────────────────────────────────────────
    {
      id:          'dua-morning-evening',
      type:        'dua',
      folderName:  'dua-morning-evening',
      title:       { ar: 'أذكار الصباح والمساء', en: 'Morning & Evening Adhkar' },
      description: { ar: 'أذكار الصباح والمساء المأثورة عن النبي ﷺ', en: 'Prophetic morning and evening remembrance' },
      author:      'مجموعة قراء',
      language:    'ar',
      origin:      'المملكة العربية السعودية',
      version:     '1.0.0',
      releaseDate: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-07-05T00:00:00Z',
      minimumAppVersion: '1.0.0',
      checksum:            'sha256-dua-morning-placeholder',
      sizeBytes:           15_728_640,
      compressedSizeBytes: 12_582_912,
      durationSeconds:     1800,
      downloadUrl: 'https://cdn.example.com/audio/dua-morning-evening/v1.zip',
      previewUrl:  'https://cdn.example.com/audio/dua-morning-evening/preview.mp3',
      builtIn:     false,
      tags:        ['أذكار', 'صباح', 'مساء', 'سنة نبوية'],
      featured:    true,
      sortOrder:   1,
      verified:    true,
      license:     'public-domain',
      deprecated:  false,
      metadata:    { occasion: 'صباح ومساء', count: 40 },
    },
  ],
};
