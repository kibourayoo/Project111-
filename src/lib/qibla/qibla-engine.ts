/**
 * محرك القبلة الرئيسي
 * Pure Functions — مستقل تماماً عن React
 */

import { KAABA_COORDINATES, KAABA_PROXIMITY_KM } from './constants';
import { haversineDistance, calculateBearing } from './math';
import type { Coordinates, QiblaResult } from './types';

/**
 * حساب اتجاه القبلة والمسافة إلى الكعبة المشرفة
 * من موقع جغرافي معطى
 *
 * @param location  الإحداثيات الحالية للمستخدم
 * @returns QiblaResult — bearing والمسافة وحالة القرب من الكعبة
 */
export function computeQibla(location: Coordinates): QiblaResult {
  const distanceKm = haversineDistance(location, KAABA_COORDINATES);
  const bearing = calculateBearing(location, KAABA_COORDINATES);
  const isAtKaaba = distanceKm <= KAABA_PROXIMITY_KM;

  return {
    bearing,
    distanceKm,
    isAtKaaba,
  };
}

/**
 * التحقق من صحة إحداثيات جغرافية
 */
export function validateCoordinates(coords: Coordinates): boolean {
  return (
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180 &&
    isFinite(coords.latitude) &&
    isFinite(coords.longitude)
  );
}

/**
 * تنسيق المسافة للعرض (كم أو م)
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} م`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} كم`;
  }
  return `${Math.round(distanceKm)} كم`;
}

/**
 * تنسيق اتجاه القبلة للعرض النصي (الجهة الأصلية)
 */
export function bearingToCardinal(bearing: number): string {
  const directions = [
    'شمال', 'شمال شرق', 'شرق', 'جنوب شرق',
    'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب',
  ];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}
