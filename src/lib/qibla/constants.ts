import type { Coordinates } from './types';

/**
 * إحداثيات الكعبة المشرفة — مكة المكرمة
 * المصدر: World Geodetic System 1984 (WGS-84)
 */
export const KAABA_COORDINATES: Coordinates = {
  latitude: 21.422487,
  longitude: 39.826206,
};

/** نصف قطر الأرض بالكيلومترات (WGS-84 mean radius) */
export const EARTH_RADIUS_KM = 6371.0;

/** تحويل الدرجات إلى راديان */
export const DEG_TO_RAD = Math.PI / 180;

/** تحويل الراديان إلى درجات */
export const RAD_TO_DEG = 180 / Math.PI;

/** المسافة القصوى (كم) لاعتبار الموقع "داخل مكة" عند الكعبة */
export const KAABA_PROXIMITY_KM = 1.0;

/** عدد درجات الدائرة الكاملة */
export const FULL_CIRCLE = 360;
