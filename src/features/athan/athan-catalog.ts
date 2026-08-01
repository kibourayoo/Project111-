/**
 * src/features/athan/athan-catalog.ts
 *
 * كتالوج المؤذّنين المُضمَّنين في التطبيق (Bundled Assets).
 *
 * ─── كيفية إضافة مؤذّن جديد ──────────────────────────────────────────────────
 * 1. أضف ملف .mp3 داخل assets/audio/athan/<id>.mp3
 * 2. أضف import في قسم "مراجع Assets"
 * 3. أضف مدخلاً جديداً في BUILTIN_MUEZZIN_DEFS
 *
 * ─── ملاحظة: المؤذّنون القابلون للتحميل ─────────────────────────────────────
 * هذا الملف خاص بالمُضمَّنين فقط.
 * المؤذّنون القابلون للتحميل يُضافون لاحقاً عبر طبقة منفصلة
 * دون الحاجة لتعديل هذا الملف أو البنية الحالية.
 */

import { Asset } from 'expo-asset';

import hudhaifiMp3   from '../../../assets/audio/athan/ali_ahmad_mulla.mp3';
import abdulsamadMp3 from '../../../assets/audio/athan/abdulsamad.mp3';

import type { Muezzin } from './athan-types';

// ─── تعريفات المؤذّنين المُضمَّنين ────────────────────────────────────────────

const BUILTIN_MUEZZIN_DEFS = [
  {
    id:       'adhan-builtin-ali-ahmad-mulla',
    name:     'الشيخ علي أحمد ملا',
    country:  'المملكة العربية السعودية',
    module:   hudhaifiMp3,
  },
  {
    id:       'adhan-builtin-abdulsamad',
    name:     'الشيخ عبد الباسط عبد الصمد',
    country:  'مصر',
    module:   abdulsamadMp3,
  },
] as const;

// ─── تحميل Assets وبناء قائمة المؤذّنين بـ URIs محلولة ───────────────────────

/**
 * يُحمِّل ملفات الأذان ويُعيد قائمة المؤذّنين بـ URIs صالحة.
 *
 * يُستدعى مرة واحدة عند تهيئة useAthanPlayer.
 * آمنة للاستدعاء المتكرر — expo-asset يُخزّن النتائج داخلياً.
 */
export async function loadBuiltinMuezzins(): Promise<Muezzin[]> {
  const modules = BUILTIN_MUEZZIN_DEFS.map((def) => def.module);
  const assets  = await Asset.loadAsync(modules);

  return BUILTIN_MUEZZIN_DEFS.map((def, i) => ({
    id:      def.id,
    name:    def.name,
    country: def.country,
    uri:     assets[i].uri ?? assets[i].localUri ?? '',
  }));
}

/** المؤذّن الافتراضي (placeholder بـ uri فارغ — يُستبدل بعد loadBuiltinMuezzins) */
export const DEFAULT_MUEZZIN: Muezzin = {
  id:      BUILTIN_MUEZZIN_DEFS[0].id,
  name:    BUILTIN_MUEZZIN_DEFS[0].name,
  country: BUILTIN_MUEZZIN_DEFS[0].country,
  uri:     '',
};

/**
 * قائمة ثابتة بـ URIs فارغة — للتوافق مع الكود الحالي.
 * استخدم loadBuiltinMuezzins() للحصول على URIs صالحة.
 * @deprecated استخدم loadBuiltinMuezzins() بدلاً منه
 */
export const MUEZZINS: readonly Muezzin[] = BUILTIN_MUEZZIN_DEFS.map((def) => ({
  id:      def.id,
  name:    def.name,
  country: def.country,
  uri:     '',
}));
