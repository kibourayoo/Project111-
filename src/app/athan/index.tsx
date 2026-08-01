/**
 * src/app/athan/index.tsx — شاشة الأذان الرئيسية
 * مسار: /athan
 *
 * التدفق:
 *   Screen → useAthanPlayer (Feature Hook)
 *          → athanService (Feature Service)
 *          → audioService (AudioService Facade)
 *          → PlaylistManager + AudioController
 */

import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ArrowLeft, Play, Pause, Download } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import type { RelativePathString } from 'expo-router';

import { useAthanPlayer } from '../../features/athan';
import type { Muezzin } from '../../features/athan';

// ─── ثوابت التصميم ────────────────────────────────────────────────────────────
const BG       = '#FDFBF7';
const BORDER   = '#E0DBD3';
const TEXT     = '#1A1A1A';
const MUTED    = '#7A7A7A';
const PRIMARY  = '#1A5276';
const DIVIDER  = '#F0ECE6';
const PLAY_BG  = '#EAF2FB';
const PLAY_ACT = '#D0E8F8'; // خلفية زر التشغيل أثناء التشغيل
const BTN_BG   = '#FFFFFF';

export default function AthanPlayerScreen() {
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold });
  const insets = useSafeAreaInsets();

  const { status, muezzins, assetsReady, togglePlay } = useAthanPlayer();

  const font400 = fontsLoaded ? 'Cairo_400Regular' : undefined;
  const font600 = fontsLoaded ? 'Cairo_600SemiBold' : undefined;
  const font700 = fontsLoaded ? 'Cairo_700Bold'     : undefined;

  /** هل المؤذّن يُشغَّل حالياً؟ */
  const isPlaying = (m: Muezzin) =>
    status.isPlaying && status.currentMuezzin?.id === m.id;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="الأذان" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* قائمة المؤذّنين الافتراضيين */}
        <View style={{ marginTop: 12 }}>
          {!assetsReady ? (
            /* حالة التحميل الأولي للـ assets */
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="small" color={PRIMARY} />
            </View>
          ) : (
            muezzins.map((m) => {
              const playing = isPlaying(m);
              return (
                <View key={m.id}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    backgroundColor: BG,
                  }}>
                    {/* زر التشغيل / الإيقاف */}
                    <Pressable
                      onPress={() => { (async () => { await togglePlay(m); })(); }}
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: playing ? PLAY_ACT : PLAY_BG,
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 14,
                      }}
                    >
                      {playing
                        ? <Pause size={16} color={PRIMARY} fill={PRIMARY} />
                        : <Play  size={16} color={PRIMARY} fill={PRIMARY} />
                      }
                    </Pressable>

                    {/* اسم المؤذّن + الدولة */}
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontFamily: font600, color: TEXT, textAlign: 'right' }}>
                        {m.name}
                      </Text>
                      {m.country ? (
                        <Text style={{ fontSize: 12, fontFamily: font400, color: MUTED, textAlign: 'right', marginTop: 2 }}>
                          {m.country}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: DIVIDER }} />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* زر "تحميل المزيد" — مثبت أسفل الشاشة فوق Safe Area */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
        <Pressable
          onPress={() => router.push('/athan/downloads' as RelativePathString)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: BTN_BG, borderRadius: 14,
            borderWidth: 1, borderColor: BORDER,
            paddingVertical: 16,
          }}
        >
          <Download size={20} color={PRIMARY} />
          <Text style={{ fontSize: 15, fontFamily: font600, color: PRIMARY, marginRight: 10, marginLeft: 10 }}>
            تحميل المزيد من الأصوات
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
