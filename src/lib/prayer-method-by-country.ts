/**
 * prayer-method-by-country.ts
 *
 * طبقة مستقلة: تربط رمز الدولة (ISO 3166-1 alpha-2) بطريقة حساب مواقيت الصلاة
 * المناسبة لها، مع أي تعديلات دقائق خاصة بها.
 *
 * لإضافة دولة جديدة: أضف سطرًا واحدًا في COUNTRY_METHOD_MAP.
 * لا علاقة لهذا الملف بأي واجهة مستخدم أو منطق عرض.
 */

import { CalculationMethod, CalculationParameters, Madhab } from 'adhan';

/* ── نوع المعاملات الإضافية الاختيارية لكل دولة ── */
export type CountryMethodConfig = {
  /** دالة تُنشئ معاملات الحساب الأساسية */
  buildParams: () => CalculationParameters;
  /** تعديلات دقائق يدوية تُطبَّق فوق نتيجة الحساب (اختيارية) */
  adjustments?: Partial<{
    fajr: number;
    sunrise: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
  }>;
  /** مذهب حساب وقت العصر (اختياري، الافتراضي: Shafi) */
  madhab?: typeof Madhab[keyof typeof Madhab];
};

/**
 * خريطة رموز الدول → إعدادات طريقة الحساب.
 * الرمز دائمًا بأحرف كبيرة (ISO 3166-1 alpha-2).
 *
 * المصادر:
 *  - adhan METHODS.md
 *  - وثائق رابطة العالم الإسلامي
 *  - وثائق وزارات الأوقاف الرسمية
 */
const COUNTRY_METHOD_MAP: Record<string, CountryMethodConfig> = {
  /* ── شمال أفريقيا ── */
  DZ: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // الجزائر
  MA: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // المغرب
  TN: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // تونس
  LY: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // ليبيا

  /* ── مصر ── */
  EG: { buildParams: () => CalculationMethod.Egyptian() },            // مصر

  /* ── الجزيرة العربية ── */
  SA: { buildParams: () => CalculationMethod.UmmAlQura() },           // السعودية
  AE: { buildParams: () => CalculationMethod.Dubai() },               // الإمارات
  KW: { buildParams: () => CalculationMethod.Kuwait() },              // الكويت
  QA: { buildParams: () => CalculationMethod.Qatar() },               // قطر
  BH: { buildParams: () => CalculationMethod.Kuwait() },              // البحرين
  OM: { buildParams: () => CalculationMethod.UmmAlQura() },           // عُمان
  YE: { buildParams: () => CalculationMethod.UmmAlQura() },           // اليمن

  /* ── الهلال الخصيب ── */
  IQ: { buildParams: () => CalculationMethod.UmmAlQura() },           // العراق
  SY: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // سوريا
  JO: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // الأردن
  LB: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // لبنان
  PS: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // فلسطين

  /* ── آسيا الجنوبية ── */
  PK: { buildParams: () => CalculationMethod.Karachi() },             // باكستان
  IN: { buildParams: () => CalculationMethod.Karachi() },             // الهند
  BD: { buildParams: () => CalculationMethod.Karachi() },             // بنغلاديش

  /* ── جنوب شرق آسيا ── */
  MY: { buildParams: () => CalculationMethod.Singapore() },           // ماليزيا
  SG: { buildParams: () => CalculationMethod.Singapore() },           // سنغافورة
  ID: { buildParams: () => CalculationMethod.Singapore() },           // إندونيسيا

  /* ── إيران ── */
  IR: { buildParams: () => CalculationMethod.Tehran() },              // إيران

  /* ── تركيا ── */
  TR: { buildParams: () => CalculationMethod.Turkey() },              // تركيا

  /* ── أمريكا الشمالية ── */
  US: { buildParams: () => CalculationMethod.NorthAmerica() },        // الولايات المتحدة
  CA: { buildParams: () => CalculationMethod.NorthAmerica() },        // كندا

  /* ── أوروبا والمملكة المتحدة ── */
  GB: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // المملكة المتحدة
  FR: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // فرنسا
  DE: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // ألمانيا

  /* ── دول جنوب الصحراء وأفريقيا ── */
  NG: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // نيجيريا
  SN: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // السنغال
  SD: { buildParams: () => CalculationMethod.Egyptian() },            // السودان
  SO: { buildParams: () => CalculationMethod.MuslimWorldLeague() },   // الصومال
};

/* ── الطريقة الاحتياطية عند عدم التعرف على الدولة ── */
const FALLBACK_CONFIG: CountryMethodConfig = {
  buildParams: () => CalculationMethod.MuslimWorldLeague(),
};

/**
 * يُعيد معاملات حساب المواقيت المناسبة لرمز الدولة المُمرَّر.
 * إذا كانت الدولة غير معروفة يستخدم Muslim World League كاحتياط.
 *
 * @param isoCode - رمز الدولة بصيغة ISO 3166-1 alpha-2 (مثل "DZ"، "SA")
 * @returns CalculationParameters جاهز للاستخدام مع adhan PrayerTimes
 */
export function getMethodForCountry(isoCode: string | null | undefined): CalculationParameters {
  const code = isoCode?.toUpperCase() ?? '';
  const config = COUNTRY_METHOD_MAP[code] ?? FALLBACK_CONFIG;
  const params = config.buildParams();

  /* تطبيق المذهب إن كان محددًا */
  if (config.madhab) {
    params.madhab = config.madhab;
  }

  /* تطبيق تعديلات الدقائق إن وُجدت */
  if (config.adjustments) {
    params.adjustments = { ...params.adjustments, ...config.adjustments };
  }

  return params;
}
