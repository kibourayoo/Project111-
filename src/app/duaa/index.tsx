import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import { useFonts } from 'expo-font';
import { Cairo_400Regular } from '@expo-google-fonts/cairo';
import DuaaDocumentIcon from '../../components/DuaaDocumentIcon';
import HandsStarsIcon   from '../../components/HandsStarsIcon';
import StarBadgeIcon    from '../../components/StarBadgeIcon';
import BookIcon         from '../../components/BookIcon';

const BG     = '#FDFBF7';
const CARD   = '#FFFFFF';
const BORDER = '#DDD8CF';
const TEXT   = '#1A1A1A';
const MUTED  = '#9E9790';

type CardIcon = React.ComponentType<{ size: number; color: string }>;

/* بطاقات الدعاء — الترتيب الأصلي (يسار→يمين، أعلى→أسفل) مع النصوص */
const CARDS: { id: number; route: RelativePathString; label: string; Icon?: CardIcon; sizeScale?: number; offsetY?: number }[] = [
  { id: 1, route: '/duaa/sunnah'    as RelativePathString, label: 'دعاء من السنة',   Icon: DuaaDocumentIcon },
  { id: 2, route: '/duaa/quran'     as RelativePathString, label: 'دعاء من القرآن',  Icon: BookIcon, sizeScale: 0.72, offsetY: -12 },
  { id: 3, route: '/duaa/favorites' as RelativePathString, label: 'المفضلة',         Icon: StarBadgeIcon },
  { id: 4, route: '/duaa/needs'     as RelativePathString, label: 'أدعية لكل حاجة', Icon: HandsStarsIcon },
];

export default function DuaaScreen() {
  const { width, height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Cairo_400Regular });

  const cardH = height * 0.25;
  const gap   = 12;
  const hPad  = 16;
  const cardW = (width - hPad * 2 - gap) / 2;

  /* عرض البطاقات على شكل شبكة 2×2 — أعلى يمين أولاً */
  const rows = [CARDS.slice(0, 2), CARDS.slice(2, 4)];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="الدعاء" />

      <ScrollView
        contentContainerStyle={{ padding: hPad, paddingBottom: 32, gap }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap }}>
            {row.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => router.push(card.route)}
                style={{
                  width: cardW,
                  height: cardH,
                  backgroundColor: CARD,
                  borderRadius: 16,
                  borderWidth: 0.8,
                  borderColor: BORDER,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  paddingTop: 12,
                }}
              >
                {/* منطقة الأيقونة — تملأ المساحة المتاحة */}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {card.Icon && (
                    <View style={card.offsetY ? { transform: [{ translateY: card.offsetY }] } : undefined}>
                      <card.Icon
                        size={Math.min(cardW, cardH) * 1.1 * (card.sizeScale ?? 1)}
                        color="#1A1A1A"
                      />
                    </View>
                  )}
                </View>

                {/* عنوان البطاقة في الأسفل */}
                <Text style={{
                  fontSize: 13,
                  color: TEXT,
                  fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
                  textAlign: 'center',
                }}>
                  {card.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
