/**
 * دوال رياضية لمحرك القبلة
 * Pure Functions — بدون أي Side Effects — مستقلة عن React
 */

import { DEG_TO_RAD, RAD_TO_DEG, EARTH_RADIUS_KM, FULL_CIRCLE } from './constants';
import type { Coordinates } from './types';

/**
 * تحويل درجات إلى راديان
 */
export function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/**
 * تحويل راديان إلى درجات
 */
export function toDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * تطبيع زاوية إلى نطاق [0, 360)
 */
export function normalizeAngle(angle: number): number {
  return ((angle % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
}

/**
 * حساب المسافة بين نقطتين جغرافيتين باستخدام معادلة Haversine
 * @returns المسافة بالكيلومترات
 */
export function haversineDistance(from: Coordinates, to: Coordinates): number {
  const φ1 = toRadians(from.latitude);
  const φ2 = toRadians(to.latitude);
  const Δφ = toRadians(to.latitude - from.latitude);
  const Δλ = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * حساب الاتجاه الأولي (Initial Bearing / Forward Azimuth) من نقطة إلى أخرى
 * باستخدام معادلة Bearing القياسية
 * @returns الاتجاه بالدرجات [0, 360) حيث 0 = شمال، 90 = شرق
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const φ1 = toRadians(from.latitude);
  const φ2 = toRadians(to.latitude);
  const Δλ = toRadians(to.longitude - from.longitude);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);

  return normalizeAngle(toDegrees(θ));
}

/**
 * حساب الفرق الزاوي بين اتجاهين مع مراعاة الدوران الكامل
 * @returns الفرق في نطاق (-180, 180]
 */
export function angularDifference(a: number, b: number): number {
  const diff = ((b - a + 180 + FULL_CIRCLE) % FULL_CIRCLE) - 180;
  return diff;
}
