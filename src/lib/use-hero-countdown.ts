/**
 * use-hero-countdown.ts
 *
 * يحسب حالة Hero كل ثانية:
 *   - "بعد"  : العداد يتناقص حتى وقت الصلاة القادمة
 *   - "منذ"  : العداد يتزايد منذ دخول وقت الصلاة (لمدة محددة)
 *
 * مدد "منذ":
 *   الفجر 30 دقيقة | الشروق 15 | الظهر 30 | العصر 30 | المغرب 30 | العشاء 90
 *
 * بعد انتهاء مدة "منذ" يُعرض الحدث التالي بصيغة "بعد".
 */
import { useEffect, useState } from 'react';
import type { TodayPrayerDates } from './use-prayer-times';

/* ── مدد "منذ" بالثواني لكل صلاة ── */
const SINCE_SECONDS: Record<keyof TodayPrayerDates, number> = {
  fajr    : 30 * 60,
  shurooq : 15 * 60,
  dhuhr   : 30 * 60,
  asr     : 30 * 60,
  maghrib : 30 * 60,
  isha    : 90 * 60,
};

/* ── ترتيب الصلوات خلال اليوم ── */
const PRAYER_ORDER: { key: keyof TodayPrayerDates; name: string }[] = [
  { key: 'fajr',    name: 'الفجر'   },
  { key: 'shurooq', name: 'الشروق'  },
  { key: 'dhuhr',   name: 'الظهر'   },
  { key: 'asr',     name: 'العصر'   },
  { key: 'maghrib', name: 'المغرب'  },
  { key: 'isha',    name: 'العشاء'  },
];

export type HeroCountdownState = {
  /** اسم الصلاة المعروضة */
  prayerName: string;
  /** "بعد" أو "منذ" */
  mode: 'بعد' | 'منذ';
  /** العداد بصيغة HH:MM:SS */
  countdown: string;
};

function toHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function computeState(dates: TodayPrayerDates): HeroCountdownState {
  const now = Date.now();

  /* ── 1. فحص حالة "منذ" ── */
  for (const p of PRAYER_ORDER) {
    const t = dates[p.key].getTime();
    const sinceMs = SINCE_SECONDS[p.key] * 1000;
    if (now >= t && now < t + sinceMs) {
      return {
        prayerName: p.name,
        mode      : 'منذ',
        countdown : toHHMMSS((now - t) / 1000),
      };
    }
  }

  /* ── 2. حالة "بعد": أقرب صلاة لم تحن بعد ── */
  for (const p of PRAYER_ORDER) {
    const t = dates[p.key].getTime();
    if (now < t) {
      return {
        prayerName: p.name,
        mode      : 'بعد',
        countdown : toHHMMSS((t - now) / 1000),
      };
    }
  }

  /* ── 3. انتهت جميع أوقات اليوم → فجر الغد ── */
  const tomorrowFajr = new Date(dates.fajr);
  tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
  return {
    prayerName: 'الفجر',
    mode      : 'بعد',
    countdown : toHHMMSS((tomorrowFajr.getTime() - now) / 1000),
  };
}

export function useHeroCountdown(
  prayerDates: TodayPrayerDates | null,
): HeroCountdownState | null {
  const [state, setState] = useState<HeroCountdownState | null>(
    prayerDates ? computeState(prayerDates) : null,
  );

  useEffect(() => {
    if (!prayerDates) { setState(null); return; }
    // احسب فوراً ثم كل ثانية
    setState(computeState(prayerDates));
    const id = setInterval(() => setState(computeState(prayerDates)), 1000);
    return () => clearInterval(id);
  }, [prayerDates]);

  return state;
}
