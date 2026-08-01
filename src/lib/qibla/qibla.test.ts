/**
 * اختبارات داخلية لمحرك القبلة
 * يُشغَّل مباشرة بـ: npx ts-node src/lib/qibla/qibla.test.ts
 * أو: node -e "require('./src/lib/qibla/qibla.test')"
 *
 * لا يعتمد على Jest أو أي framework خارجي
 */

import {
  computeQibla,
  calculateBearing,
  haversineDistance,
  calculateArrowAngle,
  isPointingAtQibla,
  formatDistance,
  bearingToCardinal,
  validateCoordinates,
  KAABA_COORDINATES,
} from './index';
import type { Coordinates } from './types';

// ───────────────────────────────────────────────
// قائمة المدن مع القيم المرجعية المتوقعة
// المصدر: حسابات مستقلة وأدوات قبلة موثوقة
// ───────────────────────────────────────────────
interface CityTest {
  name: string;
  coords: Coordinates;
  expectedBearing: number;  // القيمة المرجعية بالدرجات
  tolerance: number;        // هامش القبول بالدرجات
  expectedDistanceKm: number;
  distanceTolerance: number; // كم
}

const CITY_TESTS: CityTest[] = [
  {
    name: 'مكة المكرمة (عند الكعبة)',
    coords: { latitude: 21.422487, longitude: 39.826206 },
    expectedBearing: 0,     // أي اتجاه مقبول — isAtKaaba يجب أن يكون true
    tolerance: 360,
    expectedDistanceKm: 0,
    distanceTolerance: 0.1,
  },
  {
    name: 'القاهرة — مصر',
    coords: { latitude: 30.0444, longitude: 31.2357 },
    expectedBearing: 136.1,
    tolerance: 1,
    expectedDistanceKm: 1287,
    distanceTolerance: 10,
  },
  {
    name: 'الرياض — المملكة العربية السعودية',
    coords: { latitude: 24.6877, longitude: 46.7219 },
    expectedBearing: 244.2,
    tolerance: 1,
    expectedDistanceKm: 793,
    distanceTolerance: 10,
  },
  {
    name: 'دبي — الإمارات',
    coords: { latitude: 25.2048, longitude: 55.2708 },
    expectedBearing: 258.2,
    tolerance: 1,
    expectedDistanceKm: 1631,
    distanceTolerance: 10,
  },
  {
    name: 'الجزائر — الجزائر',
    coords: { latitude: 36.7538, longitude: 3.0588 },
    expectedBearing: 105.4,
    tolerance: 1,
    expectedDistanceKm: 3926,
    distanceTolerance: 20,
  },
  {
    name: 'الرباط — المغرب',
    coords: { latitude: 34.0209, longitude: -6.8416 },
    expectedBearing: 94.6,
    tolerance: 1,
    expectedDistanceKm: 4758,
    distanceTolerance: 20,
  },
  {
    name: 'إسطنبول — تركيا',
    coords: { latitude: 41.0082, longitude: 28.9784 },
    expectedBearing: 151.6,
    tolerance: 1,
    expectedDistanceKm: 2405,
    distanceTolerance: 10,
  },
  {
    name: 'لندن — المملكة المتحدة',
    coords: { latitude: 51.5074, longitude: -0.1278 },
    expectedBearing: 119.0,
    tolerance: 1,
    expectedDistanceKm: 4794,
    distanceTolerance: 20,
  },
  {
    name: 'جاكرتا — إندونيسيا',
    coords: { latitude: -6.2088, longitude: 106.8456 },
    expectedBearing: 295.2,
    tolerance: 1,
    expectedDistanceKm: 7920,
    distanceTolerance: 30,
  },
  {
    name: 'نيويورك — الولايات المتحدة',
    coords: { latitude: 40.7128, longitude: -74.006 },
    expectedBearing: 58.5,
    tolerance: 1,
    expectedDistanceKm: 10306,
    distanceTolerance: 30,
  },
];

// ───────────────────────────────────────────────
// دوال مساعدة للاختبار
// ───────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function angularError(actual: number, expected: number): number {
  const diff = Math.abs(((actual - expected + 180 + 360) % 360) - 180);
  return diff;
}

// ───────────────────────────────────────────────
// تشغيل الاختبارات
// ───────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log('   اختبارات محرك القبلة — Qibla Engine');
console.log('═══════════════════════════════════════════\n');

// ── اختبار 1: ثوابت الكعبة ──
console.log('▶ ثوابت الكعبة المشرفة:');
assert(
  Math.abs(KAABA_COORDINATES.latitude - 21.422487) < 0.0001,
  `خط عرض الكعبة = ${KAABA_COORDINATES.latitude}`
);
assert(
  Math.abs(KAABA_COORDINATES.longitude - 39.826206) < 0.0001,
  `خط طول الكعبة = ${KAABA_COORDINATES.longitude}`
);

// ── اختبار 2: المدن ──
console.log('\n▶ اختبارات المدن:');
for (const city of CITY_TESTS) {
  console.log(`\n  📍 ${city.name}`);
  const result = computeQibla(city.coords);

  if (city.name.includes('مكة')) {
    assert(result.isAtKaaba, `isAtKaaba = true (المسافة: ${result.distanceKm.toFixed(3)} كم)`);
  } else {
    assert(!result.isAtKaaba, `isAtKaaba = false`);

    const bearingErr = angularError(result.bearing, city.expectedBearing);
    assert(
      bearingErr <= city.tolerance,
      `bearing = ${result.bearing.toFixed(1)}° (متوقع: ${city.expectedBearing}°, خطأ: ${bearingErr.toFixed(1)}°)`
    );

    const distErr = Math.abs(result.distanceKm - city.expectedDistanceKm);
    assert(
      distErr <= city.distanceTolerance,
      `distance = ${result.distanceKm.toFixed(0)} كم (متوقع: ~${city.expectedDistanceKm} كم, فرق: ${distErr.toFixed(0)} كم)`
    );
  }
}

// ── اختبار 3: البوصلة ──
console.log('\n▶ اختبارات البوصلة:');
{
  const compass = calculateArrowAngle(135, 0);
  assert(Math.abs(compass.arrowAngle - 135) < 0.01, `arrowAngle(bearing=135, heading=0) = ${compass.arrowAngle}`);

  const compass2 = calculateArrowAngle(135, 90);
  assert(Math.abs(compass2.arrowAngle - 45) < 0.01, `arrowAngle(bearing=135, heading=90) = ${compass2.arrowAngle}`);

  const compass3 = calculateArrowAngle(10, 350);
  assert(Math.abs(compass3.arrowAngle - 20) < 0.01, `arrowAngle(bearing=10, heading=350) = ${compass3.arrowAngle} (crossing 0°)`);
}

// ── اختبار 4: isPointingAtQibla ──
console.log('\n▶ اختبارات isPointingAtQibla:');
assert(isPointingAtQibla(2), 'arrowAngle=2° → يشير للقبلة (ضمن 5°)');
assert(isPointingAtQibla(358), 'arrowAngle=358° → يشير للقبلة (ضمن 5°)');
assert(!isPointingAtQibla(10), 'arrowAngle=10° → لا يشير للقبلة');
assert(!isPointingAtQibla(180), 'arrowAngle=180° → عكس القبلة');

// ── اختبار 5: formatDistance ──
console.log('\n▶ اختبارات formatDistance:');
assert(formatDistance(0.3) === '300 م', `formatDistance(0.3) = "${formatDistance(0.3)}"`);
assert(formatDistance(2.5) === '2.5 كم', `formatDistance(2.5) = "${formatDistance(2.5)}"`);
assert(formatDistance(1200) === '1200 كم', `formatDistance(1200) = "${formatDistance(1200)}"`);

// ── اختبار 6: validateCoordinates ──
console.log('\n▶ اختبارات validateCoordinates:');
assert(validateCoordinates({ latitude: 21.4, longitude: 39.8 }), 'إحداثيات مكة صالحة');
assert(!validateCoordinates({ latitude: 91, longitude: 0 }), 'خط عرض > 90 غير صالح');
assert(!validateCoordinates({ latitude: 0, longitude: 181 }), 'خط طول > 180 غير صالح');
assert(!validateCoordinates({ latitude: NaN, longitude: 0 }), 'NaN غير صالح');

// ── النتيجة النهائية ──
console.log('\n═══════════════════════════════════════════');
console.log(`النتيجة: ${passed} نجح / ${failed} فشل / ${passed + failed} إجمالي`);
if (failed === 0) {
  console.log('✅ جميع الاختبارات نجحت — المحرك جاهز للاستخدام');
} else {
  console.error(`❌ فشل ${failed} اختبار — يرجى المراجعة`);
  process.exit(1);
}
console.log('═══════════════════════════════════════════\n');

export {};
