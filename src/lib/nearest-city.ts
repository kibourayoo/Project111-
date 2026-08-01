/**
 * nearest-city.ts
 *
 * بحث محلي (Offline) عن أقرب مدينة لإحداثيات GPS معطاة.
 * يستخدم خوارزمية Haversine لحساب المسافة الكروية الحقيقية.
 * لا يستخدم أي API خارجية — يقرأ ملفات JSON المحلية فقط.
 */

/* ── استيراد ملفات المدن المحلية ── */
import cityDataSA from '@/data/cities/sa.json';
import cityDataDZ from '@/data/cities/dz.json';
import cityDataMA from '@/data/cities/ma.json';
import cityDataTN from '@/data/cities/tn.json';
import cityDataLY from '@/data/cities/ly.json';
import cityDataEG from '@/data/cities/eg.json';
import cityDataAE from '@/data/cities/ae.json';
import cityDataQA from '@/data/cities/qa.json';
import cityDataPS from '@/data/cities/ps.json';

type CityEntry = { name: string; lat: number; lng: number };
type CityWithCountry = CityEntry & { countryCode: string };

/** جميع المدن المدعومة مع رمز دولتها */
const ALL_CITIES: CityWithCountry[] = [
  ...cityDataSA.map(c => ({ ...c, countryCode: 'SA' })),
  ...cityDataDZ.map(c => ({ ...c, countryCode: 'DZ' })),
  ...cityDataMA.map(c => ({ ...c, countryCode: 'MA' })),
  ...cityDataTN.map(c => ({ ...c, countryCode: 'TN' })),
  ...cityDataLY.map(c => ({ ...c, countryCode: 'LY' })),
  ...cityDataEG.map(c => ({ ...c, countryCode: 'EG' })),
  ...cityDataAE.map(c => ({ ...c, countryCode: 'AE' })),
  ...cityDataQA.map(c => ({ ...c, countryCode: 'QA' })),
  ...cityDataPS.map(c => ({ ...c, countryCode: 'PS' })),
];

/** نصف قطر الأرض بالكيلومترات */
const EARTH_RADIUS_KM = 6371;

/**
 * حساب المسافة بين نقطتين جغرافيتين بخوارزمية Haversine.
 * النتيجة بالكيلومترات.
 */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

export type NearestCityResult = {
  countryCode: string;
  cityName: string;
  distanceKm: number;
};

/**
 * يعثر على أقرب مدينة من إحداثيات GPS المُمرَّرة.
 * يبحث في جميع الدول التسع المدعومة.
 * لا يحتاج إنترنت — يعتمد فقط على ملفات JSON المحلية.
 *
 * @param latitude  - خط العرض (GPS)
 * @param longitude - خط الطول (GPS)
 * @returns رمز الدولة + اسم المدينة + المسافة بالكيلومترات
 */
export function findNearestCity(
  latitude: number,
  longitude: number,
): NearestCityResult {
  let nearest: CityWithCountry = ALL_CITIES[0];
  let minDist = Infinity;

  for (const city of ALL_CITIES) {
    const dist = haversineKm(latitude, longitude, city.lat, city.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }

  return {
    countryCode : nearest.countryCode,
    cityName    : nearest.name,
    distanceKm  : Math.round(minDist),
  };
}
