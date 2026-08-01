/**
 * usePrayerTimes
 * يقرأ بيانات الموقع التي حفظها نظام الإعداد الأولي من AsyncStorage،
 * ثم يحسب مواقيت اليوم الحالي محليًا باستخدام مكتبة adhan
 * مع طريقة الحساب المناسبة للدولة عبر prayer-method-by-country.
 *
 * مصدر الموقع الوحيد: @location_lat / @location_lng / @location_country
 * لا يطلب GPS مباشرة — هذه مسؤولية شاشة الإعداد الأولي فقط.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates, PrayerTimes, Prayer } from 'adhan';
import { getMethodForCountry } from './prayer-method-by-country';
import { formatPrayerTime } from './prayer-timezone';
import {
  LOCATION_LAT_KEY,
  LOCATION_LNG_KEY,
  LOCATION_COUNTRY_KEY,
} from '@/app/location-setup';

export type TodayPrayers = {
  fajr: string;
  shurooq: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

/** التواريخ الخام لمواقيت اليوم (Date objects مباشرة من adhan — UTC) */
export type TodayPrayerDates = {
  fajr: Date;
  shurooq: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
};


export function usePrayerTimes() {
  const [prayers, setPrayers] = useState<TodayPrayers | null>(null);
  const [prayerDates, setPrayerDates] = useState<TodayPrayerDates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          /* ── 1. قراءة بيانات الموقع من AsyncStorage ── */
          const [latRaw, lngRaw, countryRaw] = await AsyncStorage.multiGet([
            LOCATION_LAT_KEY,
            LOCATION_LNG_KEY,
            LOCATION_COUNTRY_KEY,
          ]);

          const lat         = latRaw[1]     ? parseFloat(latRaw[1])  : null;
          const lng         = lngRaw[1]     ? parseFloat(lngRaw[1])  : null;
          const countryCode = countryRaw[1] ?? null;

          if (lat === null || lng === null) {
            if (active) setError('لم يتم تحديد الموقع بعد');
            return;
          }

          /* ── 2. اختيار طريقة الحساب بناءً على الدولة ── */
          const params = getMethodForCountry(countryCode);

          /* ── 3. حساب المواقيت لليوم الحالي ── */
          const coords = new Coordinates(lat, lng);
          const date = new Date();
          const pt = new PrayerTimes(coords, date, params);

          const rawFajr    = pt.timeForPrayer(Prayer.Fajr)    ?? new Date();
          const rawShurooq = pt.timeForPrayer(Prayer.Sunrise) ?? new Date();
          const rawDhuhr   = pt.timeForPrayer(Prayer.Dhuhr)   ?? new Date();
          const rawAsr     = pt.timeForPrayer(Prayer.Asr)     ?? new Date();
          const rawMaghrib = pt.timeForPrayer(Prayer.Maghrib) ?? new Date();
          const rawIsha    = pt.timeForPrayer(Prayer.Isha)    ?? new Date();

          if (active) {
            setPrayers({
              fajr    : formatPrayerTime(rawFajr,    countryCode),
              shurooq : formatPrayerTime(rawShurooq, countryCode),
              dhuhr   : formatPrayerTime(rawDhuhr,   countryCode),
              asr     : formatPrayerTime(rawAsr,     countryCode),
              maghrib : formatPrayerTime(rawMaghrib, countryCode),
              isha    : formatPrayerTime(rawIsha,    countryCode),
            });
            setPrayerDates({
              fajr    : rawFajr,
              shurooq : rawShurooq,
              dhuhr   : rawDhuhr,
              asr     : rawAsr,
              maghrib : rawMaghrib,
              isha    : rawIsha,
            });
            setError(null);
          }
        } catch {
          if (active) setError('خطأ في حساب المواقيت');
        }
      })();
      return () => { active = false; };
    }, [])
  );

  return { prayers, prayerDates, error };
}

/* اسم الصلاة → المفتاح المقابل في TodayPrayers */
export const prayerKey: Record<string, keyof TodayPrayers> = {
  'الفجر'   : 'fajr',
  'الشروق'  : 'shurooq',
  'الظهر'   : 'dhuhr',
  'العصر'   : 'asr',
  'المغرب'  : 'maghrib',
  'العشاء'  : 'isha',
};
