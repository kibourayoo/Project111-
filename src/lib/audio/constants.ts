/**
 * constants.ts
 * ثوابت نظام إدارة المحتوى الصوتي
 * لا يحتوي على أي منطق — constants فقط
 */

import type { AudioType } from './audio-types';

// ─── مسارات التخزين ───────────────────────────────────────────────────────────

/** الاسم الجذري لمجلد الصوت داخل تخزين التطبيق */
export const AUDIO_ROOT_DIRECTORY = 'audio';

/**
 * اسم ملف الفهرس — ثابت نهائي يُستخدم محلياً وعلى Cloudflare R2
 * لا تغيّر هذا الاسم بعد الإنتاج
 */
export const AUDIO_INDEX_FILENAME = 'index.json';

/** امتداد ملفات الصوت المدعومة */
export const AUDIO_FILE_EXTENSION = '.mp3';

// ─── الأنواع المدعومة ─────────────────────────────────────────────────────────

/**
 * قائمة الأنواع المدعومة رسمياً في هذا الإصدار
 * قابلة للتوسع بإضافة أنواع جديدة في audio-types.ts
 */
export const SUPPORTED_AUDIO_TYPES: AudioType[] = [
  'adhan',
  'quran',
  'mushaf',
  'ruqyah',
  'dua',
  'notification',
  'custom',
];

// ─── إعدادات الفهرس ───────────────────────────────────────────────────────────

/** الإصدار الحالي لمخطط الفهرس (manifest schema version) */
export const AUDIO_MANIFEST_SCHEMA_VERSION = '1.0.0';

/** اسم مجلد الحزم المُضمَّنة في التطبيق (assets bundled at build time) */
export const AUDIO_BUILTIN_DIRECTORY = 'builtin';

/** اسم مجلد الحزم التي حمّلها المستخدم */
export const AUDIO_USER_DIRECTORY = 'user';
