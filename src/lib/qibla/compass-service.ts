/**
 * خدمة البوصلة — قراءة heading الجهاز عبر Magnetometer
 * مع Low-Pass Filter لتخفيف الاهتزاز
 * تعمل بالكامل بدون إنترنت
 *
 * ملاحظة هندسية:
 *   محور Y في expo Magnetometer يشير نحو رأس الجهاز (الشمال المغناطيسي عندما y>0)
 *   المعادلة الصحيحة: heading = atan2(x, y) بـ إشارة صحيحة
 *   وليس atan2(y, x) الذي يعطي الزاوية من محور X
 */

import { Magnetometer } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/DeviceSensor';
import { normalizeAngle } from './math';
import { lowPassFilter } from './compass';

/** معدل تحديث المغناطيسية (ms) */
const UPDATE_INTERVAL_MS = 80; // ~12.5 Hz — أسرع قليلاً لاستجابة أفضل

/** معامل Low-Pass Filter — قيمة أعلى = أسرع استجابة */
const LPF_ALPHA = 0.15;

/** نتيجة قراءة البوصلة */
export interface CompassReading {
  /** heading بالدرجات [0, 360) من الشمال — 0=شمال، 90=شرق */
  heading: number;
  /** القيم الخام من المغناطيسية */
  raw: { x: number; y: number; z: number };
  timestamp: number;
}

export type CompassCallback = (reading: CompassReading) => void;

/**
 * حساب heading من بيانات المغناطيسية (x, y) على مستوى أفقي
 *
 * نظام إحداثيات expo-sensors Magnetometer (مع الهاتف أفقياً شاشةً للأعلى):
 *   +Y  ← رأس الجهاز (الشمال عند y>0, x≈0)
 *   +X  ← يمين الجهاز
 *   +Z  ← خارج الشاشة (نحو الأعلى)
 *
 * المعادلة الصحيحة:
 *   angle = atan2(x, y)  → تعطي الزاوية من محور Y (الشمال) باتجاه محور X
 *   heading = -angle     → ضرب بـ (-1) للتحويل من CCW إلى CW (اتفاقية البوصلة)
 *
 * المرجع: https://developer.android.com/reference/android/hardware/SensorManager
 */
function magnetometerToHeading(x: number, y: number): number {
  // الزاوية من الشمال (محور +Y) باتجاه الساعة
  const angle = Math.atan2(x, y) * (180 / Math.PI);
  // تطبيع إلى [0, 360)
  return normalizeAngle(angle);
}

/**
 * الاشتراك في تحديثات البوصلة مع تطبيق Low-Pass Filter
 * @returns دالة إلغاء الاشتراك (cleanup)
 */
export function subscribeCompass(onUpdate: CompassCallback): () => void {
  let previousHeading: number | null = null;
  let subscription: Subscription | null = null;

  Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);

  subscription = Magnetometer.addListener(({ x, y, z }) => {
    // تجاهل القراءات التي تقترب من الصفر (جهاز لا يدعم المستشعر)
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    if (magnitude < 1e-6) return;

    const rawHeading = magnetometerToHeading(x, y);

    // طبّق Low-Pass Filter لتخفيف الاهتزاز
    const smoothed =
      previousHeading === null
        ? rawHeading
        : lowPassFilter(previousHeading, rawHeading, LPF_ALPHA);

    previousHeading = smoothed;

    onUpdate({
      heading: smoothed,
      raw: { x, y, z },
      timestamp: Date.now(),
    });
  });

  return () => {
    subscription?.remove();
  };
}
