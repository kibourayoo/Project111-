/**
 * hijri.ts
 * واجهة التقويم الهجري — مبنية على @umalqura/core (تقويم أم القرى الرسمي).
 * تُصدِّر نفس الواجهة السابقة لضمان التوافق مع بقية الكود.
 */
import uq from '@umalqura/core';

/* تعيين اللغة العربية مرة واحدة عند تحميل الوحدة */
uq.locale('ar');

/* ── أسماء الأشهر الهجرية بالعربية (من المكتبة مباشرة) ── */
export const HIJRI_MONTHS: string[] = uq.months() as string[];

/* ── أسماء أيام الأسبوع بالعربية — 0=الأحد … 6=السبت ── */
export const AR_DAY_NAMES: string[] = uq.days() as string[];

/* ── تحويل كائن Date ميلادي إلى تاريخ هجري ── */
export function gregorianToHijri(date: Date): { year: number; month: number; day: number } {
  const d = uq(date);
  return { year: d.hy, month: d.hm, day: d.hd };
}

/* ── أول يوم ميلادي لشهر هجري معيّن ── */
export function hijriMonthStart(hYear: number, hMonth: number): Date {
  return uq(hYear, hMonth, 1).date;
}

/* ── عدد الأيام في شهر هجري معيّن (29 أو 30) ── */
export function hijriMonthLength(hYear: number, hMonth: number): number {
  return uq(hYear, hMonth, 1).daysInMonth;
}

/* ── تحويل تاريخ هجري إلى كائن Date ميلادي ── */
export function hijriToGregorian(hYear: number, hMonth: number, hDay: number): Date {
  return uq(hYear, hMonth, hDay).date;
}
