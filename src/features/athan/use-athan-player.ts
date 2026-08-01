/**
 * src/features/athan/use-athan-player.ts
 *
 * useAthanPlayer — React Hook لشاشة الأذان
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * يربط شاشة الأذان بـ athanService ويُحدّث الحالة تلقائياً عند كل تغيير.
 * الشاشة تستخدم هذا Hook فقط ولا تعرف شيئاً عن athanService أو AudioService.
 *
 * ─── ما يُعيده ────────────────────────────────────────────────────────────────
 *   status          ← حالة المشغّل (تتحدث تلقائياً)
 *   muezzins        ← المؤذّنون المُضمَّنون أولاً ثم المحمَّلون (بعد تحليل الـ assets)
 *   assetsReady     ← هل اكتمل تحميل الـ assets؟
 *   togglePlay      ← اضغط على مؤذّن: يبدأ / يوقف / يبدّل
 *   stop            ← إيقاف التشغيل النهائي
 *
 * ─── ترتيب القائمة ────────────────────────────────────────────────────────────
 *   [ ...builtinMuezzins, ...downloadedMuezzins ]
 *   المُضمَّنون دائماً أولاً — المحمَّلون يُضافون بعدهم مباشرة.
 *
 * ─── طبقات الاعتماد ──────────────────────────────────────────────────────────
 *   Hook → athanService       (تشغيل)
 *   Hook → downloadService    (قراءة المحمَّلين)
 *   Hook → downloadManager    (أحداث COMPLETED/IDLE)
 *   Hook → loadBuiltinMuezzins (أصول مُضمَّنة)
 *
 * لا يعرف الـ Hook شيئاً عن: StorageService / DOWNLOADABLE_MUEZZINS_CATALOG / StoredVoiceRecord
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect }                            from 'expo-router';

import { athanService }        from './athan-service';
import { loadBuiltinMuezzins } from './athan-catalog';
import { downloadService }     from './download-service';
import { downloadManager }     from './download-manager';

import type { Muezzin, AthanPlayerStatus } from './athan-types';

// ─── نوع ما يُعيده الـ Hook ───────────────────────────────────────────────────

export interface UseAthanPlayerReturn {
  /** حالة المشغّل — تتحدث تلقائياً عبر اشتراك الأحداث */
  status:       AthanPlayerStatus;
  /**
   * قائمة المؤذّنين بالترتيب:
   * 1. المُضمَّنون (Built-in) — دائماً أولاً
   * 2. المحمَّلون (Downloaded) — يُضافون بعد المُضمَّنين
   */
  muezzins:     Muezzin[];
  /** هل اكتمل تحليل الـ assets؟ */
  assetsReady:  boolean;
  /**
   * الضغط على زر مؤذّن:
   * - نفس المؤذّن أثناء التشغيل → إيقاف
   * - مؤذّن آخر (أو نفسه وهو متوقف) → تشغيل
   */
  togglePlay:   (muezzin: Muezzin) => Promise<void>;
  /** إيقاف التشغيل النهائي */
  stop:         () => Promise<void>;
}

// ─── useAthanPlayer ───────────────────────────────────────────────────────────

export function useAthanPlayer(): UseAthanPlayerReturn {

  const [status, setStatus] = useState<AthanPlayerStatus>(
    () => athanService.getStatus(),
  );

  /** المؤذّنون المُضمَّنون — يُحمَّلون مرة واحدة عند mount */
  const [builtinMuezzins,   setBuiltinMuezzins]   = useState<Muezzin[]>([]);
  /** المؤذّنون المحمَّلون من AsyncStorage — يتحدثون عند كل focus وعند الأحداث */
  const [downloadedMuezzins, setDownloadedMuezzins] = useState<Muezzin[]>([]);
  const [assetsReady, setAssetsReady] = useState(false);

  // guard لمنع setState بعد unmount
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── تحميل المؤذّنين المُضمَّنين (مرة واحدة عند mount) ────────────────────────
  useEffect(() => {
    (async () => {
      const loaded = await loadBuiltinMuezzins();
      if (mounted.current) {
        setBuiltinMuezzins(loaded);
        setAssetsReady(true);
      }
    })();
  }, []);

  // ── تحميل المؤذّنين المحمَّلين من AsyncStorage ────────────────────────────────

  const refreshDownloaded = useCallback(async () => {
    // التفويض الكامل لـ DownloadService — الـ Hook لا يعرف StorageService أو الكتالوج
    const installed = await downloadService.getInstalledVoices();
    if (!mounted.current) return;
    setDownloadedMuezzins(installed);
  }, []);

  // تحديث عند كل دخول للشاشة (يشمل العودة من صفحة التحميلات)
  useFocusEffect(
    useCallback(() => {
      (async () => { await refreshDownloaded(); })();
    }, [refreshDownloaded]),
  );

  // ── الاشتراك في أحداث DownloadManager ────────────────────────────────────────
  // يُعيد تحميل القائمة حين:
  //   COMPLETED ← اكتمل تحميل مؤذّن جديد → يظهر في القائمة
  //   IDLE      ← حُذف مؤذّن (reset بعد delete) → يختفي من القائمة
  useEffect(() => {
    const unsub = downloadManager.onStatusChanged((event) => {
      if (!mounted.current) return;
      if (event.current === 'COMPLETED' || event.current === 'IDLE') {
        (async () => { await refreshDownloaded(); })();
      }
    });
    return unsub;
  }, [refreshDownloaded]);

  // ── الاشتراك في تغييرات حالة المشغّل ────────────────────────────────────────
  useEffect(() => {
    const unsub = athanService.onStatusChange((s) => {
      if (mounted.current) setStatus(s);
    });
    setStatus(athanService.getStatus());
    return unsub;
  }, []);

  // ── القائمة المدمجة: مُضمَّنون أولاً ثم محمَّلون ─────────────────────────────
  const muezzins: Muezzin[] = [...builtinMuezzins, ...downloadedMuezzins];

  // ── togglePlay ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async (muezzin: Muezzin) => {
    const current = athanService.getStatus();
    const isSame  = current.currentMuezzin?.id === muezzin.id;

    if (isSame && current.isPlaying) {
      // نفس المؤذّن وهو يعمل → إيقاف
      await athanService.stop();
    } else {
      // مؤذّن جديد أو نفسه متوقف → تشغيل (AudioService يوقف السابق تلقائياً)
      await athanService.play(muezzin);
    }
  }, []);

  // ── stop ─────────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    await athanService.stop();
  }, []);

  return { status, muezzins, assetsReady, togglePlay, stop };
}
