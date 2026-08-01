import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Cairo_400Regular } from '@expo-google-fonts/cairo';
import PageHeader from '@/components/PageHeader';

const BG          = '#FDFBF7';
const CARD_BG     = '#F2EDE5';
const BORDER      = '#DDD8CF';
const CIRCLE_FILL = '#FFFFFF';

/*
 * نفس حساب الصفحة الرئيسية تماماً:
 *   cardInnerWidth = width - 8 - 8 - 12 - 12
 *   itemWidth      = cardInnerWidth / 5   ← عرض خلية كل دائرة
 *   cr             = itemWidth * 0.40     ← نصف القطر
 *   circleSize     = cr * 2              ← القطر الكامل
 *
 * كل دائرة تُعرض داخل View بعرض itemWidth ومتمركزة — هكذا تتطابق
 * المسافات تماماً مع الصفحة الرئيسية في كلا الصفين.
 * الصف الثاني: flexDirection = 'row-reverse' حتى يبدأ من اليمين.
 */

function CircleRow({
  count,
  itemWidth,
  circleSize,
  rtl = false,
}: {
  count: number;
  itemWidth: number;
  circleSize: number;
  rtl?: boolean;
}) {
  return (
    <View style={[S.row, rtl && S.rowRTL]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[S.cell, { width: itemWidth }]}>
          <View
            style={[
              S.circle,
              { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export default function FeaturePage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [fontsLoaded] = useFonts({ Cairo_400Regular });
  const { width, height } = useWindowDimensions();
  const cardHeight = height * 0.25;
  /* البطاقة الأولى: +10% | البطاقة الثانية: −15% */
  const card1Height = cardHeight * 1.10;
  const card2Height = cardHeight * 0.65;

  /* حجم الدائرة — مطابق للصفحة الرئيسية */
  const cardInnerWidth = width - 8 - 8 - 12 - 12;
  const itemWidth      = cardInnerWidth / 5;
  const cr             = itemWidth * 0.40;
  const circleSize     = cr * 2;

  /* صفحة المزيد فقط تعرض البطاقتين — باقي الصفحات فارغة */
  const isMore = name === 'المزيد';

  return (
    <View style={S.root}>
      <StatusBar style="dark" backgroundColor={BG} />
      <PageHeader title={name ?? ''} />

      {isMore && (
        <View style={S.body}>
          {/* البطاقة الأولى — صف1: 5 دوائر | صف2: 2 دوائر من اليمين */}
          <View style={[S.card, { height: card1Height }]}>
            <CircleRow count={5} itemWidth={itemWidth} circleSize={circleSize} />
            <CircleRow count={2} itemWidth={itemWidth} circleSize={circleSize} rtl />
          </View>

          {/* البطاقة الثانية — صف1: 5 دوائر فقط (بدون صف ثانٍ) */}
          <View style={[S.card, { height: card2Height }]}>
            <CircleRow count={5} itemWidth={itemWidth} circleSize={circleSize} />
          </View>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  body: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
    justifyContent: 'space-evenly',
  },
  /* صف LTR — الافتراضي (الصف الأول) */
  row: {
    flexDirection: 'row',
  },
  /* صف RTL — الصف الثاني يبدأ من اليمين */
  rowRTL: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  /* خلية كل دائرة بنفس عرض itemWidth — تمركز الدائرة بداخلها */
  cell: {
    alignItems: 'center',
  },
  circle: {
    backgroundColor: CIRCLE_FILL,
    borderWidth: 0.8,
    borderColor: BORDER,
  },
});
