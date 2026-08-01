/**
 * use-monthly-prayer-times.ts
 * يحسب مواقيت الصلاة لكل أيام الشهر الهجري الحالي.
 * يعتمد على @umalqura/core لجميع عمليات التقويم الهجري.
 * يقرأ الموقع من AsyncStorage فقط — لا يطلب GPS.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates, PrayerTimes, Prayer } from 'adhan';
import uq from '@umalqura/core';
import { getMethodForCountry } from './prayer-method-by-country';
import { formatPrayerTime } from './prayer-timezone';
import {
  LOCATION_LAT_KEY,
  LOCATION_LNG_KEY,
  LOCATION_COUNTRY_KEY,
} from '@/app/location-setup';
import { AR_DAY_NAMES, HIJRI_MONTHS } from './hijri';

export type DayRow = {
  /** اليوم الهجري (1-30) */
  hijriDay: number;
  /** اليوم الميلادي */
  gregorianDay: number;
  /** اسم اليوم بالعربية */
  dayName: string;
  /** نص عمود م/هـ مثلاً "5/10" */
  dateMG: string;
  fajr: string;
  shurooq: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  /** هل هذا اليوم هو اليوم الحالي فعلًا؟ */
  isToday: boolean;
  /** كائن Date الميلادي لهذا اليوم */
  date: Date;
};


export type MonthlyPrayerState = {
  days: DayRow[];
  monthName: string;
  loading: boolean;
  error: string | null;
};

export function useMonthlyPrayerTimes(): MonthlyPrayerState {
  const [state, setState] = useState<MonthlyPrayerState>({
    days: [],
    monthName: '',
    loading: true,
    error: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState(s => ({ ...s, loading: true, error: null }));
      (async () => {
      try {
        /* ── 1. قراءة الموقع من AsyncStorage ── */
        const [latRaw, lngRaw, countryRaw] = await AsyncStorage.multiGet([
          LOCATION_LAT_KEY,
          LOCATION_LNG_KEY,
          LOCATION_COUNTRY_KEY,
        ]);

        const lat         = latRaw[1]     ? parseFloat(latRaw[1])  : null;
        const lng         = lngRaw[1]     ? parseFloat(lngRaw[1])  : null;
        const countryCode = countryRaw[1] ?? null;

        if (lat === null || lng === null) {
          if (active) setState({ days: [], monthName: '', loading: false, error: 'لم يتم تحديد الموقع بعد' });
          return;
        }

        /* ── 2. تحديد الشهر الهجري الحالي عبر @umalqura/core ── */
        const today    = new Date();
        const todayUq  = uq(today);
        const hYear    = todayUq.hy;
        const hMonth   = todayUq.hm;
        const monthLen = todayUq.daysInMonth;
        const monthName = `${HIJRI_MONTHS[hMonth - 1]} ${hYear} هـ`;

        /* ── 3. معاملات حساب المواقيت ── */
        const params = getMethodForCountry(countryCode);
        const coords = new Coordinates(lat, lng);

        /* ── 4. بناء صفوف الجدول: يوم واحد لكل يوم هجري في الشهر ── */
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        const days: DayRow[] = [];

        for (let hijriDay = 1; hijriDay <= monthLen; hijriDay++) {
          /* التاريخ الميلادي المقابل للـ hijriDay — من @umalqura/core مباشرة */
          const localDate = uq(hYear, hMonth, hijriDay).date;
          const gregorianDay = localDate.getDate();
          const dayName      = AR_DAY_NAMES[localDate.getDay()];
          const dayKey       = `${localDate.getFullYear()}-${localDate.getMonth()}-${localDate.getDate()}`;
          const isToday      = dayKey === todayKey;

          /* حساب المواقيت عبر adhan */
          const pt = new PrayerTimes(coords, localDate, params);

          days.push({
            hijriDay,
            gregorianDay,
            dayName,
            dateMG : `${hijriDay}/${gregorianDay}`,
            fajr    : formatPrayerTime(pt.timeForPrayer(Prayer.Fajr)    ?? new Date(), countryCode),
            shurooq : formatPrayerTime(pt.timeForPrayer(Prayer.Sunrise) ?? new Date(), countryCode),
            dhuhr   : formatPrayerTime(pt.timeForPrayer(Prayer.Dhuhr)   ?? new Date(), countryCode),
            asr     : formatPrayerTime(pt.timeForPrayer(Prayer.Asr)     ?? new Date(), countryCode),
            maghrib : formatPrayerTime(pt.timeForPrayer(Prayer.Maghrib) ?? new Date(), countryCode),
            isha    : formatPrayerTime(pt.timeForPrayer(Prayer.Isha)    ?? new Date(), countryCode),
            isToday,
            date: localDate,
          });
        }

        if (active) setState({ days, monthName, loading: false, error: null });
      } catch {
        if (active) setState({ days: [], monthName: '', loading: false, error: 'خطأ في حساب المواقيت' });
      }
      })();
      return () => { active = false; };
    }, [])
  );

  return state;
}
