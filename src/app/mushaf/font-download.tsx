/**
 * font-download.tsx — شاشة تحميل أصول المصحف (خطوط + بيانات الصفحات)
 * ─────────────────────────────────────────────────────────────────────────────
 * المرحلة ١: تنزيل 605 خط TTF من R2 (BSML + P001–P604)
 * المرحلة ٢: تنزيل 604 ملف JSON من R2 (page-001.json … page-604.json)
 * المرحلة ٣: تحميل الخطوط في ذاكرة React Native
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import {
  mushafFontService,
  MUSHAF_TOTAL_PAGES,
} from '@/features/mushaf/mushaf-font-service';
import type { DownloadProgress } from '@/features/mushaf/mushaf-font-service';

// ─── ألوان ────────────────────────────────────────────────────────────────────
const BG        = '#FDFBF7';
const CARD_BG   = '#F2EDE5';
const BORDER    = '#DDD8CF';
const TEXT      = '#1A1A1A';
const MUTED     = '#888888';
const BTN_BG    = '#0000FF';
const BTN_DIS   = '#9999CC';
const BAR_TRACK = '#DDD8CF';
const BAR_FONT  = '#0000FF';
const BAR_PAGE  = '#2E7D32';
const ERR_COLOR = '#C0392B';

// ─── حالات الشاشة ─────────────────────────────────────────────────────────────
type Phase = 'idle' | 'downloading' | 'loading' | 'done' | 'error';

export default function FontDownloadScreen() {
  const { width, height } = useWindowDimensions();

  const [phase,    setPhase]    = useState<Phase>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errMsg,   setErrMsg]   = useState('');

  // ─── بدء التحميل الكامل ─────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (phase !== 'idle' && phase !== 'error') return;

    setPhase('downloading');
    setErrMsg('');
    setProgress(null);

    // 1️⃣ تنزيل الخطوط + JSON من R2
    const dlResult = await mushafFontService.downloadAll(
      (p) => setProgress(p),
    );

    if (!dlResult.success) {
      setErrMsg(dlResult.error ?? 'فشل التحميل');
      setPhase('error');
      return;
    }

    // 2️⃣ تحميل الخطوط في ذاكرة React Native
    setPhase('loading');
    const loadResult = await mushafFontService.loadFontsIntoRN();

    if (!loadResult.success) {
      setErrMsg(loadResult.error ?? 'فشل تحميل الخط');
      setPhase('error');
      return;
    }

    // 3️⃣ الانتقال إلى المصحف
    setPhase('done');
    router.replace('/mushaf' as RelativePathString);
  }, [phase]);

  // ─── مقاييس التقدم ──────────────────────────────────────────────────────────
  const overallPct = progress?.overallPercent ?? 0;
  const phasePct   = progress?.phasePercent   ?? 0;
  const isFonts    = progress?.phase === 'fonts';
  const totalFonts = 605; // BSML + P001–P604

  // ─── نص الزر ────────────────────────────────────────────────────────────────
  const btnLabel =
    phase === 'downloading'
      ? `${overallPct}% — ${isFonts ? 'خطوط' : 'صفحات'}`
      : phase === 'loading'
      ? 'تجهيز الخطوط…'
      : phase === 'error'
      ? 'إعادة المحاولة'
      : 'تحميل المصحف';

  const btnDisabled = phase === 'downloading' || phase === 'loading' || phase === 'done';

  return (
    <View style={S.root}>
      <StatusBar style="dark" backgroundColor={BG} />
      <PageHeader title="تحميل المصحف" />

      <View style={S.body}>
        <View
          style={[
            S.card,
            { width: width * 0.75, height: height * 0.80, marginRight: -(width * 0.08) },
          ]}
        >
          {/* ── وسط البطاقة ──────────────────────────────────────────────── */}
          <View style={S.center}>

            {/* العنوان الثابت */}
            <Text style={S.headText}>أصول المصحف الكريم</Text>

            {/* وصف حجم التحميل */}
            <Text style={S.subText}>
              {'605 خط + ' + MUSHAF_TOTAL_PAGES + ' صفحة'}
            </Text>

            {/* ── شريط التقدم الكلي ───────────────────────────────────────── */}
            {(phase === 'downloading' || phase === 'loading') && (
              <View style={[S.barBlock, { width: (width * 0.75) - 48 }]}>

                {/* شريط كلي */}
                <Text style={S.barLabel}>الإجمالي — {overallPct}%</Text>
                <View style={S.barTrack}>
                  <View style={[S.barFill, { width: `${overallPct}%`, backgroundColor: BAR_FONT }]} />
                </View>

                {/* شريط المرحلة الحالية */}
                {phase === 'downloading' && (
                  <>
                    <Text style={[S.barLabel, { marginTop: 12 }]}>
                      {isFonts
                        ? `الخطوط — ${progress?.completed ?? 0} / ${totalFonts}`
                        : `الصفحات — ${progress?.completed ?? 0} / ${MUSHAF_TOTAL_PAGES}`}
                    </Text>
                    <View style={S.barTrack}>
                      <View
                        style={[
                          S.barFill,
                          {
                            width: `${phasePct}%`,
                            backgroundColor: isFonts ? BAR_FONT : BAR_PAGE,
                          },
                        ]}
                      />
                    </View>
                    <Text style={S.fileText} numberOfLines={1}>
                      {progress?.currentFile ?? '…'}
                    </Text>
                  </>
                )}

                {phase === 'loading' && (
                  <>
                    <View style={[S.barTrack, { marginTop: 8 }]}>
                      <View style={[S.barFill, { width: '100%', backgroundColor: BAR_PAGE }]} />
                    </View>
                    <Text style={S.fileText}>جارٍ تسجيل الخطوط في النظام…</Text>
                  </>
                )}
              </View>
            )}

            {/* رسالة الخطأ */}
            {phase === 'error' && (
              <Text style={S.errText}>{errMsg}</Text>
            )}

            {/* حالة الخمول */}
            {phase === 'idle' && (
              <Text style={S.hintText}>
                يتم التحميل مرة واحدة فقط ثم يُخزَّن على الجهاز
              </Text>
            )}
          </View>

          {/* ── زر التحميل — أسفل البطاقة ───────────────────────────────── */}
          <View style={S.btnWrapper}>
            <Pressable
              style={[S.btn, btnDisabled && S.btnDisabled]}
              onPress={handleDownload}
              disabled={btnDisabled}
            >
              <Text style={S.btnText}>{btnLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── أنماط ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 0.8,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  headText: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 4,
  },
  /* بلوك شريط التقدم */
  barBlock: {
    gap: 4,
  },
  barLabel: {
    fontSize: 12,
    color: MUTED,
  },
  barTrack: {
    height: 8,
    backgroundColor: BAR_TRACK,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  fileText: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    marginTop: 2,
  },
  /* خطأ */
  errText: {
    fontSize: 13,
    color: ERR_COLOR,
    textAlign: 'center',
  },
  /* زر التحميل */
  btnWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  btn: {
    backgroundColor: BTN_BG,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: BTN_DIS,
  },
  btnText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});


