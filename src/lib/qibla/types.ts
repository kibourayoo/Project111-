/**
 * أنواع محرك القبلة — مستقل تماماً عن React
 */

/** إحداثيات جغرافية */
export interface Coordinates {
  /** خط العرض بالدرجات (-90 إلى 90) */
  latitude: number;
  /** خط الطول بالدرجات (-180 إلى 180) */
  longitude: number;
}

/** نتيجة حساب اتجاه القبلة */
export interface QiblaResult {
  /** الاتجاه نحو القبلة بالدرجات (0–360، حيث 0 = شمال) */
  bearing: number;
  /** المسافة إلى الكعبة بالكيلومترات */
  distanceKm: number;
  /** هل الموقع داخل مكة المكرمة (≤ 1 km)؟ */
  isAtKaaba: boolean;
}

/** نتيجة البوصلة بعد دمجها مع heading الجهاز */
export interface CompassResult {
  /** الزاوية التي يجب أن يشير إليها السهم على الشاشة (بالدرجات) */
  arrowAngle: number;
  /** الاتجاه نحو القبلة (bearing) */
  qiblaBearing: number;
  /** heading الجهاز الحالي (0–360) */
  deviceHeading: number;
}

/** خطأ في الموقع */
export type LocationError =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';
