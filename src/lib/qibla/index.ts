/**
 * نقطة تصدير موحدة لمحرك القبلة وخدماته
 */

// ── الأنواع ──
export type {
  Coordinates,
  QiblaResult,
  CompassResult,
  LocationError,
} from './types';

// ── الثوابت ──
export {
  KAABA_COORDINATES,
  EARTH_RADIUS_KM,
  KAABA_PROXIMITY_KM,
} from './constants';

// ── الرياضيات ──
export {
  toRadians,
  toDegrees,
  normalizeAngle,
  haversineDistance,
  calculateBearing,
  angularDifference,
} from './math';

// ── البوصلة (رياضيات) ──
export {
  calculateArrowAngle,
  lowPassFilter,
  isPointingAtQibla,
} from './compass';

// ── محرك القبلة ──
export {
  computeQibla,
  validateCoordinates,
  formatDistance,
  bearingToCardinal,
} from './qibla-engine';

// ── الصلاحيات ──
export type { PermissionStatus, QiblaPermissions } from './permissions';
export {
  requestLocationPermission,
  checkLocationPermission,
  checkMagnetometerAvailable,
  requestQiblaPermissions,
} from './permissions';

// ── خدمة GPS ──
export type { GPSResult, LocationCallback, LocationErrorCallback } from './gps-service';
export { getLocationOnce, subscribeLocation } from './gps-service';

// ── خدمة البوصلة ──
export type { CompassReading, CompassCallback } from './compass-service';
export { subscribeCompass } from './compass-service';

// ── المعايرة ──
export type { CalibrationLevel, CalibrationState } from './calibration';
export { evaluateCalibration, appendHeadingHistory } from './calibration';

// ── Hook الرئيسي (الواجهة الوحيدة للشاشة) ──
export type { QiblaStatus, UseQiblaResult } from './use-qibla';
export { useQibla } from './use-qibla';

