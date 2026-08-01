/**
 * خدمة GPS — قراءة الموقع الجغرافي عبر expo-location
 * تعمل بالكامل بدون إنترنت (GPS hardware)
 */

import * as Location from 'expo-location';
import type { Coordinates } from './types';

/** خيارات قراءة الموقع */
const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 10_000,   // تحديث كل 10 ثوانٍ
  distanceInterval: 10,   // أو عند تحرك 10 متر
};

/** نتيجة خدمة GPS */
export interface GPSResult {
  coords: Coordinates;
  accuracy: number | null;  // بالأمتار
  timestamp: number;
}

/** نوع callback الموقع */
export type LocationCallback = (result: GPSResult) => void;
export type LocationErrorCallback = (error: string) => void;

/**
 * قراءة الموقع مرة واحدة (للحصول على القيمة الأولية)
 */
export async function getLocationOnce(): Promise<GPSResult> {
  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    coords: {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    },
    accuracy: loc.coords.accuracy ?? null,
    timestamp: loc.timestamp,
  };
}

/**
 * الاشتراك في تحديثات الموقع المستمرة
 * @returns دالة إلغاء الاشتراك (cleanup)
 */
export function subscribeLocation(
  onUpdate: LocationCallback,
  onError: LocationErrorCallback
): () => void {
  let subscription: Location.LocationSubscription | null = null;

  (async () => {
    try {
      subscription = await Location.watchPositionAsync(
        LOCATION_OPTIONS,
        (loc) => {
          onUpdate({
            coords: {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            },
            accuracy: loc.coords.accuracy ?? null,
            timestamp: loc.timestamp,
          });
        }
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'location_error');
    }
  })();

  return () => {
    subscription?.remove();
  };
}
