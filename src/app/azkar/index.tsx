import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { RelativePathString } from 'expo-router';
import PageHeader from '@/components/PageHeader';
import EveningAzkarIcon  from '../../components/EveningAzkarIcon';
import MorningAzkarIcon  from '../../components/MorningAzkarIcon';
import WakingUpAzkarIcon from '../../components/WakingUpAzkarIcon';
import AzanIcon          from '../../components/AzanIcon';
import MosqueCheckIcon   from '../../components/MosqueCheckIcon';
import SleepingIcon      from '../../components/SleepingIcon';

const BG     = '#FDFBF7';
const CARD   = '#FFFFFF';
const BORDER = '#DDD8CF';
const TEXT   = '#1A1A1A';

type CardIcon = React.ComponentType<{ width: number; height: number }>;

const CARDS: { id: number; title: string; route: string; Icon?: CardIcon }[] = [
  { id: 1, title: 'أذكار المساء',       route: '/azkar/masaa', Icon: EveningAzkarIcon },
  { id: 2, title: 'أذكار الصباح',       route: '/azkar/sobh',  Icon: MorningAzkarIcon },
  { id: 3, title: 'أذكار الاستيقاظ',   route: '/azkar/istiqaz', Icon: WakingUpAzkarIcon },
  { id: 4, title: 'أذكار النوم',        route: '/azkar/nawm', Icon: (p: { width: number; height: number }) => <SleepingIcon {...p} moonColor="#000000" starColor="#000000" /> },
  { id: 5, title: 'أذكار بعد الصلاة',  route: '/azkar/badalsalah', Icon: MosqueCheckIcon },
  { id: 6, title: 'أذكار الأذان',       route: '/azkar/athan', Icon: AzanIcon },
];

export default function AzkarScreen() {
  const { width } = useWindowDimensions();

  const hPad  = 16;
  const gap   = 10;
  const cardW = (width - hPad * 2 - gap * 2) / 3;
  const cardH = cardW * 1.15;

  const rows = [CARDS.slice(0, 3), CARDS.slice(3, 6)];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="الأذكار" />

      {/* الشبكة */}
      <ScrollView
        contentContainerStyle={{ padding: hPad, paddingBottom: 32, gap }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap }}>
            {row.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => router.push(card.route as RelativePathString)}
                style={{
                  width: cardW,
                  height: cardH,
                  backgroundColor: CARD,
                  borderRadius: 14,
                  borderWidth: 0.8,
                  borderColor: BORDER,
                  overflow: 'hidden',
                }}
              >
                {/* محتوى البطاقة — أيقونة SVG مكبّرة 18% ومتمركزة */}
                {card.Icon && (
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <card.Icon width={cardW * 1.18} height={cardH * 1.18} />
                  </View>
                )}

                {/* عنوان البطاقة في آخر 25% */}
                <View style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  height: cardH * 0.25,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      fontSize: Math.floor(cardW * 0.115),
                      color: '#1A2B44',
                      fontWeight: '500',
                      fontFamily: 'Cairo_400Regular',
                      textAlign: 'center',
                    }}
                  >
                    {card.title}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
