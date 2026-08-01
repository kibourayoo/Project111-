/**
 * prayer-timezone.ts
 *
 * خريطة IANA Timezone للدول المدعومة + دالة تنسيق موحدة.
 * تعتمد على Intl.DateTimeFormat بدلاً من getHours() حتى تعرض
 * الوقت بتوقيت الدولة المختارة بغض النظر عن توقيت الجهاز.
 */

/** خريطة رمز الدولة (ISO alpha-2) → IANA Timezone */
export const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  SA: 'Asia/Riyadh',
  DZ: 'Africa/Algiers',
  MA: 'Africa/Casablanca',
  TN: 'Africa/Tunis',
  LY: 'Africa/Tripoli',
  EG: 'Africa/Cairo',
  AE: 'Asia/Dubai',
  QA: 'Asia/Qatar',
  PS: 'Asia/Hebron',
};

/** التوقيت الاحتياطي عند عدم التعرف على الدولة */
const FALLBACK_TZ = 'UTC';

/**
 * يُنسِّق تاريخ adhan (UTC) إلى "HH:mm" بتوقيت الدولة المختارة.
 *
 * @param date        - كائن Date المُعاد من adhan (UTC داخلياً)
 * @param countryCode - رمز الدولة ISO alpha-2 (مثل "SA"، "EG")
 * @returns نص الوقت بصيغة "HH:mm" بتوقيت الدولة
 */
export function formatPrayerTime(
  date: Date,
  countryCode: string | null | undefined,
): string {
  const tz = COUNTRY_TIMEZONE_MAP[countryCode?.toUpperCase() ?? ''] ?? FALLBACK_TZ;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone   : tz,
    hourCycle  : 'h23',   // 00–23، يتجنب "24" في بعض المتصفحات
    hour       : '2-digit',
    minute     : '2-digit',
  }).formatToParts(date);

  const h = parts.find(p => p.type === 'hour')?.value   ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';

  return `${h}:${m}`;
}
