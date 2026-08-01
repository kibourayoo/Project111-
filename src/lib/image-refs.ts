/**
 * سجل مركزي لـ ImageRef — يُملأ أثناء Splash بواسطة _layout.tsx
 * ويُقرأ من الشاشات عند الـ render الأول لتجاوز مرحلة الـ Decode.
 *
 * يستخدم module-level variable (بدلاً من Context) لأنه:
 * - لا يُسبّب re-render عند الكتابة
 * - مضمون الملء قبل أي شاشة (appReady=true يتطلب اكتمال loadAsync)
 * - لا يحتاج إلى Provider أو hook
 */
import type { SharedRefType } from 'expo';

export type ImageKey =
  /* شاشة الإعداد */
  | 'mosque'
  /* الصفحة الرئيسية: 10 أيقونات */
  | 'mushaf' | 'duaa' | 'azkar' | 'subha'
  | 'taqwim' | 'mawaqit' | 'athan' | 'qibla'
  | 'tahadiyat' | 'mazeed'
  /* دوائر الصلوات: 6 صور */
  | 'fajr' | 'shuruq' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
  /* السبحة */
  | 'bead';

const _registry: Partial<Record<ImageKey, SharedRefType<'image'>>> = {};

/**
 * يُخزّن ImageRef بعد اكتمال Image.loadAsync أثناء Splash.
 */
export function registerImageRef(key: ImageKey, ref: SharedRefType<'image'>): void {
  _registry[key] = ref;
}

/**
 * يُعيد ImageRef المخزّن، أو null إذا لم يُحمَّل بعد.
 */
export function getImageRef(key: ImageKey): SharedRefType<'image'> | null {
  return _registry[key] ?? null;
}
