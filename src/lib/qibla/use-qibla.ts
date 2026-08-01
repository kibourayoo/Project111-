/**
 * useQibla — الواجهة الوحيدة لشاشة القبلة
 *
 * يجمع:
 *   - صلاحيات الموقع والمستشعر
 *   - قراءة GPS
 *   - قراءة البوصلة مع Low-Pass Filter
 *   - حالة المعايرة
 *   - حساب اتجاه القبلة عبر محرك القبلة
 *
 * يُنظّف جميع الاشتراكات عند إغلاق الشاشة.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeQibla, formatDistance, bearingToCardinal } from './qibla-engine';
import { calculateArrowAngle, isPointingAtQibla } from './compass';
import { requestQiblaPermissions } from './permissions';
import { getLocationOnce, subscribeLocation } from './gps-service';
import { subscribeCompass } from './compass-service';
import { evaluateCalibration, appendHeadingHistory } from './calibration';
import type { Coordinates, QiblaResult, CompassResult } from './types';
import type { CalibrationState } from './calibration';

// ─────────────────────────────────────────────
// حالات شاشة القبلة
// ─────────────────────────────────────────────
export type QiblaStatus =
  | 'loading'            // تهيئة أولية
  | 'ready'              // كل شيء يعمل
  | 'permissionDenied'   // رُفض الإذن (موقع أو مستشعر)
  | 'sensorUnavailable'  // لا يوجد مغناطيسية في الجهاز
  | 'calibrating'        // البوصلة تحتاج معايرة
  | 'locationUnavailable'; // تعذّر الحصول على الموقع

// ─────────────────────────────────────────────
// نتيجة Hook
// ─────────────────────────────────────────────
export interface UseQiblaResult {
  /** الحالة الراهنة لشاشة القبلة */
  status: QiblaStatus;

  /** الموقع الحالي للمستخدم */
  location: Coordinates | null;
  /** دقة GPS بالأمتار */
  locationAccuracy: number | null;

  /** نتيجة محرك القبلة (bearing + distance + isAtKaaba) */
  qibla: QiblaResult | null;

  /** heading المجهاز بعد الفلترة */
  deviceHeading: number;

  /** نتيجة البوصلة (زاوية السهم) */
  compass: CompassResult | null;

  /** هل الجهاز يشير نحو القبلة الآن؟ */
  pointingAtQibla: boolean;

  /** حالة المعايرة */
  calibration: CalibrationState | null;

  /** المسافة منسّقة للعرض ("1287 كم") */
  formattedDistance: string | null;

  /** الجهة الأصلية ("شمال شرق") */
  cardinalDirection: string | null;

  /** إعادة المحاولة بعد خطأ أو رفض إذن */
  retry: () => void;
}

// ─────────────────────────────────────────────
// الثوابت
// ─────────────────────────────────────────────
/** هامش اعتبار السهم موجهاً للقبلة (درجات) */
const QIBLA_TOLERANCE_DEG = 5;

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useQibla(): UseQiblaResult {
  const [status, setStatus] = useState<QiblaStatus>('loading');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [qibla, setQibla] = useState<QiblaResult | null>(null);
  const [compass, setCompass] = useState<CompassResult | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);

  // تاريخ القراءات للمعايرة
  const headingHistoryRef = useRef<number[]>([]);
  // مراجع cleanup للاشتراكات
  const cleanupLocationRef = useRef<(() => void) | null>(null);
  const cleanupCompassRef = useRef<(() => void) | null>(null);
  // منع تحديث state بعد unmount
  const mountedRef = useRef(true);

  // ── حساب اتجاه القبلة عند تغيّر الموقع أو الـ heading ──
  const deviceHeadingRef = useRef<number>(0);
  const locationRef = useRef<Coordinates | null>(null);

  const updateCompass = useCallback((heading: number) => {
    if (!mountedRef.current) return;
    const loc = locationRef.current;
    setDeviceHeading(heading);
    deviceHeadingRef.current = heading;

    if (loc) {
      const q = computeQibla(loc);
      const c = calculateArrowAngle(q.bearing, heading);
      setQibla(q);
      setCompass(c);
    }
  }, []);

  const updateLocation = useCallback((coords: Coordinates, accuracy: number | null) => {
    if (!mountedRef.current) return;
    locationRef.current = coords;
    setLocation(coords);
    setLocationAccuracy(accuracy);

    const q = computeQibla(coords);
    const c = calculateArrowAngle(q.bearing, deviceHeadingRef.current);
    setQibla(q);
    setCompass(c);
  }, []);

  // ── Web: المستشعر غير متوفر في المتصفح ──
  // على الويب، نُظهر حالة sensorUnavailable مباشرة بدون استدعاء أي API أصلي
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') {
      console.log('[QiblaDebug] use-qibla.ts → setStatus(sensorUnavailable) — EXPO_OS===web guard (useEffect)');
      setStatus('sensorUnavailable');
    }
  }, []);

  // ── دالة التهيئة الرئيسية ──
  const initialize = useCallback(async () => {
    if (!mountedRef.current) return;
    // لا نُهيّئ على الويب
    if (process.env.EXPO_OS === 'web') return;
    setStatus('loading');
    headingHistoryRef.current = [];

    // 1. طلب الصلاحيات
    const perms = await requestQiblaPermissions();

    if (!mountedRef.current) return;

    if (perms.location === 'denied') {
      console.log('[QiblaDebug] use-qibla.ts → setStatus(permissionDenied) — location denied');
      setStatus('permissionDenied');
      return;
    }
    if (perms.motion === 'denied') {
      console.log('[QiblaDebug] use-qibla.ts → setStatus(sensorUnavailable) — motion denied (magnetometerAvailable was false)');
      setStatus('sensorUnavailable');
      return;
    }

    // 2. قراءة الموقع الأولية (بدون إنترنت — GPS hardware)
    try {
      const gps = await getLocationOnce();
      if (!mountedRef.current) return;
      updateLocation(gps.coords, gps.accuracy);
    } catch {
      if (!mountedRef.current) return;
      setStatus('locationUnavailable');
      return;
    }

    // 3. الاشتراك في تحديثات الموقع المستمرة
    cleanupLocationRef.current?.();
    cleanupLocationRef.current = subscribeLocation(
      (gps) => updateLocation(gps.coords, gps.accuracy),
      () => { /* الموقع الأولي تم — نتجاهل أخطاء التحديث اللاحقة */ }
    );

    // 4. الاشتراك في البوصلة مع Low-Pass Filter
    cleanupCompassRef.current?.();
    setStatus('calibrating');

    cleanupCompassRef.current = subscribeCompass((reading) => {
      if (!mountedRef.current) return;

      updateCompass(reading.heading);

      // تحديث تاريخ المعايرة
      headingHistoryRef.current = appendHeadingHistory(
        headingHistoryRef.current,
        reading.heading
      );
      const cal = evaluateCalibration(headingHistoryRef.current);
      setCalibration(cal);

      // الانتقال من calibrating إلى ready عند دقة كافية
      setStatus((prev) => {
        if (prev === 'calibrating' && cal.level !== 'uncalibrated' && cal.level !== 'low') {
          return 'ready';
        }
        if (prev === 'ready' && cal.level === 'low') {
          return 'calibrating';
        }
        return prev;
      });
    });
  }, [updateCompass, updateLocation]);

  // ── التهيئة عند mount + cleanup عند unmount ──
  useEffect(() => {
    mountedRef.current = true;

    (async () => { await initialize(); })();

    return () => {
      mountedRef.current = false;
      cleanupLocationRef.current?.();
      cleanupCompassRef.current?.();
    };
  }, [initialize]);

  // ── القيم المشتقة ──
  const pointingAtQibla =
    compass !== null
      ? isPointingAtQibla(compass.arrowAngle, QIBLA_TOLERANCE_DEG)
      : false;

  const formattedDistance = qibla ? formatDistance(qibla.distanceKm) : null;
  const cardinalDirection = qibla ? bearingToCardinal(qibla.bearing) : null;

  return {
    status,
    location,
    locationAccuracy,
    qibla,
    deviceHeading,
    compass,
    pointingAtQibla,
    calibration,
    formattedDistance,
    cardinalDirection,
    retry: initialize,
  };
}
