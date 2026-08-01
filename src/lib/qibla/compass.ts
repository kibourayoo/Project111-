/**
 * تحويلات البوصلة لمحرك القبلة
 * Pure Functions — مستقلة عن React
 */

import { normalizeAngle } from './math';
import type { CompassResult } from './types';

/**
 * حساب زاوية سهم القبلة على شاشة البوصلة
 *
 * المبدأ:
 *   - qiblaBearing = الاتجاه الثابت نحو الكعبة (من الشمال)
 *   - deviceHeading = اتجاه رأس الجهاز الحالي (من الشمال)
 *   - arrowAngle = الزاوية التي يجب تدوير السهم إليها على الشاشة
 *
 * المعادلة: arrowAngle = qiblaBearing - deviceHeading
 *
 * @param qiblaBearing  اتجاه القبلة [0, 360)
 * @param deviceHeading heading الجهاز [0, 360)
 * @returns CompassResult
 */
export function calculateArrowAngle(
  qiblaBearing: number,
  deviceHeading: number
): CompassResult {
  const arrowAngle = normalizeAngle(qiblaBearing - deviceHeading);

  return {
    arrowAngle,
    qiblaBearing,
    deviceHeading,
  };
}

/**
 * تصفية heading الجهاز باستخدام Low-Pass Filter
 * لتخفيف الاهتزازات والتذبذب
 *
 * @param previous  القيمة السابقة
 * @param current   القيمة الحالية
 * @param alpha     معامل التصفية [0, 1] — أعلى = استجابة أسرع (افتراضي: 0.15)
 * @returns القيمة المصفّاة
 */
export function lowPassFilter(
  previous: number,
  current: number,
  alpha = 0.15
): number {
  // تعامل مع القفز عند حدود 0/360
  let diff = current - previous;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return normalizeAngle(previous + alpha * diff);
}

/**
 * التحقق من أن الجهاز قريب من اتجاه القبلة
 * @param arrowAngle  زاوية السهم الحالية
 * @param tolerance   هامش التسامح بالدرجات (افتراضي: 5°)
 */
export function isPointingAtQibla(
  arrowAngle: number,
  tolerance = 5
): boolean {
  const normalized = normalizeAngle(arrowAngle);
  return normalized <= tolerance || normalized >= 360 - tolerance;
}
