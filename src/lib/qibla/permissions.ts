/**
 * إدارة صلاحيات الموقع والمستشعرات
 * مستقلة عن React — تُستدعى من الخدمات أو من useQibla
 */

import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface QiblaPermissions {
  location: PermissionStatus;
  motion: PermissionStatus;
}

/**
 * طلب صلاحية الموقع (When In Use)
 */
export async function requestLocationPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'denied';
  }
}

/**
 * التحقق من صلاحية الموقع دون طلبها
 */
export async function checkLocationPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'denied';
  }
}

/**
 * التحقق من توافر المغناطيسية (Magnetometer)
 * يعمل بدون إنترنت — يقرأ من المستشعر المحلي فقط
 */
export async function checkMagnetometerAvailable(): Promise<boolean> {
  // ── [DIAGNOSTIC LOGGING] ── لا تعديل على المنطق ──
  console.log('[QiblaDebug] === بيئة التشغيل ===');
  console.log('[QiblaDebug] Platform.OS =', Platform.OS);
  console.log('[QiblaDebug] process.env.EXPO_OS =', process.env.EXPO_OS);
  console.log('[QiblaDebug] Device.isDevice =', Device.isDevice);
  console.log('[QiblaDebug] Constants.executionEnvironment =', Constants.executionEnvironment);
  // ─────────────────────────────────────────────────

  try {
    const result = await Magnetometer.isAvailableAsync();
    // ── [DIAGNOSTIC LOGGING] ──
    console.log('[QiblaDebug] Magnetometer.isAvailableAsync() =>', result);
    // ─────────────────────────
    return result;
  } catch (e) {
    // ── [DIAGNOSTIC LOGGING] ──
    console.error('[QiblaDebug] Magnetometer.isAvailableAsync() THREW =>', e);
    // ─────────────────────────
    return false;
  }
}

/**
 * طلب جميع الصلاحيات المطلوبة لشاشة القبلة
 */
export async function requestQiblaPermissions(): Promise<QiblaPermissions> {
  const [location, magnetometerAvailable] = await Promise.all([
    requestLocationPermission(),
    checkMagnetometerAvailable(),
  ]);

  return {
    location,
    motion: magnetometerAvailable ? 'granted' : 'denied',
  };
}
