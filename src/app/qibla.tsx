/**
 * شاشة القبلة
 *
 * المنطق:  useQibla()  ←  src/lib/qibla/use-qibla.ts
 * الواجهة: CompassDial ←  src/components/CompassDial.tsx
 *
 * السلوك:
 *  - العقرب الكبير ثابت للأعلى دائماً
 *  - القرص + التدريجات + النجمة يدورون معاً (N موجّه للشمال الحقيقي)
 *  - أيقونة الكعبة تدور في مسارها الدائري نحو الكعبة دون دوران ذاتي
 *  - البيانات (مسافة، درجة) من الحساب الحقيقي
 *  - يدعم أوفلاين (GPS hardware)
 */

import { View, Text, Pressable, ActivityIndicator, useWindowDimensions, I18nManager, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import Svg, { Rect, G, Circle, Line, Path } from 'react-native-svg';
import { useQibla } from '../lib/qibla/use-qibla';
import CompassDial from '../components/CompassDial';
import PageHeader from '../components/PageHeader';

// ── لوحة الألوان الموحّدة ──
const BG      = '#FDFBF7';
const CARD    = '#FFFFFF';
const BORDER  = '#E5DFD6';
const GOLD    = '#C5A96A';
const DARK    = '#5C4A2A';
const MUTED   = '#8B7355';
const ICON_BG = '#F5EDD8';
const ERR_BG  = '#FFF3E0';
const ERR_CLR = '#C0392B';

// ── حجم الأيقونة ──
const ICON_SIZE = 28;

/* ─── أيقونة الكعبة SVG ─── */
function KaabaIcon({ size = ICON_SIZE }: { size?: number }) {
  const s = size;
  const beltH = s * 0.15;
  const beltY = s * 0.36;
  const doorW = s * 0.26;
  const doorH = s * 0.32;
  const doorX = (s - doorW) / 2;
  const doorY = beltY + beltH + s * 0.03;
  return (
    <View style={{ width: s, height: s, borderRadius: s * 0.18, overflow: 'hidden' }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <G>
          <Rect x={0} y={0} width={s} height={s} fill="#1C1C1C" />
          <Rect x={0} y={beltY} width={s} height={beltH} fill="#D4AF37" />
          <Rect x={doorX} y={doorY} width={doorW} height={doorH} fill="#B8942A" rx={s * 0.05} />
        </G>
      </Svg>
    </View>
  );
}

/* ─── أيقونة اتجاه القبلة SVG ─── */
function QiblaDirectionIcon({ size = ICON_SIZE }: { size?: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r  = s * 0.42;
  return (
    <View style={{
      width: s, height: s,
      borderRadius: s / 2,
      backgroundColor: ICON_BG,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Circle cx={cx} cy={cy} r={r} fill={ICON_BG} stroke={GOLD} strokeWidth={s * 0.04} />
        <Line x1={cx} y1={cy - r * 0.65} x2={cx} y2={cy + r * 0.65}
          stroke={BORDER} strokeWidth={s * 0.03} strokeLinecap="round" />
        <Line x1={cx - r * 0.65} y1={cy} x2={cx + r * 0.65} y2={cy}
          stroke={BORDER} strokeWidth={s * 0.03} strokeLinecap="round" />
        <Path
          d={`M${cx},${cy - r * 0.6} L${cx - r * 0.15},${cy} L${cx + r * 0.15},${cy} Z`}
          fill={GOLD}
        />
        <Path
          d={`M${cx},${cy + r * 0.6} L${cx - r * 0.15},${cy} L${cx + r * 0.15},${cy} Z`}
          fill={MUTED} opacity={0.45}
        />
        <Circle cx={cx} cy={cy} r={s * 0.045} fill={DARK} />
      </Svg>
    </View>
  );
}

/* ─── بطاقة المعلومات ─── */
interface InfoCardProps {
  icon: React.ReactNode;
  value: string;
  unit: string;
  label: string;
  cardW: number;
  fontBold?: string;
  fontSemi?: string;
  fontRegular?: string;
}
function InfoCard({ icon, value, unit, label, cardW, fontBold, fontSemi, fontRegular }: InfoCardProps) {
  return (
    <View style={[S.infoCard, { width: cardW }]}>
      <View style={{
        flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {icon}
        <View style={{ alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start', flex: 1, paddingHorizontal: 6 }}>
          <Text style={{ fontFamily: fontBold, fontSize: 18, color: DARK, includeFontPadding: false }}>
            {value}
          </Text>
          <Text style={{ fontFamily: fontSemi, fontSize: 10, color: GOLD }}>{unit}</Text>
        </View>
      </View>
      <View style={S.cardDivider} />
      <Text style={{ fontFamily: fontRegular, fontSize: 10, color: MUTED, textAlign: 'center', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── الشاشة الرئيسية ──────────────────────────────────────────────────────────
export default function QiblaScreen() {
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold });
  const compassSize = Math.min(width * 0.9, 340);
  const cardW = (width - 16 * 2 - 12) / 2;

  const {
    status,
    qibla,
    deviceHeading,
    formattedDistance,
    retry,
  } = useQibla();

  const fontBold    = fontsLoaded ? 'Cairo_700Bold'     : undefined;
  const fontSemi    = fontsLoaded ? 'Cairo_600SemiBold' : undefined;
  const fontRegular = fontsLoaded ? 'Cairo_400Regular'  : undefined;

  // ── بيانات العرض ────────────────────────────────────────────────────────────
  const distanceText = formattedDistance ?? '---';
  const bearingText  = qibla ? `${Math.round(qibla.bearing)}°` : '---';
  const qiblaBearing = qibla?.bearing ?? 0;

  // ── حالات الخطأ ─────────────────────────────────────────────────────────────
  if (status === 'permissionDenied') {
    return (
      <View style={[S.root, S.centered]}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="القبلة" />
        <View style={S.msgBox}>
          <Text style={[S.msgTitle, { fontFamily: fontBold }]}>إذن الموقع مطلوب</Text>
          <Text style={[S.msgBody, { fontFamily: fontRegular }]}>
            يحتاج تطبيق القبلة إلى صلاحية الوصول للموقع لتحديد اتجاه الكعبة.
          </Text>
          <Pressable style={S.retryBtn} onPress={retry}>
            <Text style={[S.retryText, { fontFamily: fontSemi }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'sensorUnavailable') {
    return (
      <View style={[S.root, S.centered]}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="القبلة" />
        <View style={S.msgBox}>
          <Text style={[S.msgTitle, { fontFamily: fontBold }]}>المستشعر غير متوفر</Text>
          <Text style={[S.msgBody, { fontFamily: fontRegular }]}>
            جهازك لا يدعم مستشعر البوصلة المغناطيسية.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'locationUnavailable') {
    return (
      <View style={[S.root, S.centered]}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="القبلة" />
        <View style={S.msgBox}>
          <Text style={[S.msgTitle, { fontFamily: fontBold }]}>تعذّر تحديد الموقع</Text>
          <Text style={[S.msgBody, { fontFamily: fontRegular }]}>
            تأكد من تفعيل GPS وإعادة المحاولة.
          </Text>
          <Pressable style={S.retryBtn} onPress={retry}>
            <Text style={[S.retryText, { fontFamily: fontSemi }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'loading' || status === 'calibrating') {
    return (
      <View style={[S.root, S.centered]}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="القبلة" />
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={[S.loadingText, { fontFamily: fontRegular }]}>
          {status === 'calibrating' ? 'جارٍ معايرة البوصلة…' : 'جارٍ تحديد الموقع…'}
        </Text>
      </View>
    );
  }

  // ── الشاشة الرئيسية (ready) ─────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="القبلة" />

      {/* بطاقتا المعلومات */}
      <View style={S.cardsRow}>
        <InfoCard
          icon={<KaabaIcon size={ICON_SIZE} />}
          value={distanceText}
          unit="المسافة"
          label="البُعد عن الكعبة"
          cardW={cardW}
          fontBold={fontBold}
          fontSemi={fontSemi}
          fontRegular={fontRegular}
        />
        <InfoCard
          icon={<QiblaDirectionIcon size={ICON_SIZE} />}
          value={bearingText}
          unit="من الشمال"
          label="اتجاه القبلة"
          cardW={cardW}
          fontBold={fontBold}
          fontSemi={fontSemi}
          fontRegular={fontRegular}
        />
      </View>

      {/* البوصلة */}
      <View style={S.compassWrapper}>
        <CompassDial
          size={compassSize}
          heading={deviceHeading}
          qiblaBearing={qiblaBearing}
        />
      </View>
    </View>
  );
}

// ─── أنماط ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:           { flex: 1, backgroundColor: BG },
  centered:       { alignItems: 'center' },
  cardsRow:       { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  compassWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  infoCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cardDivider: { height: 1, backgroundColor: BORDER, marginVertical: 5, opacity: 0.7 },
  msgBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: ERR_BG,
    margin: 24,
    borderRadius: 16,
  },
  msgTitle:    { fontSize: 18, color: DARK, textAlign: 'center' },
  msgBody:     { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },
  retryBtn:    { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  retryText:   { fontSize: 14, color: '#fff' },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED },
});
