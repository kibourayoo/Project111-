/**
 * country-select.tsx
 * المرحلة الأولى من اختيار الموقع اليدوي — اختيار الدولة.
 */
import React, { useState } from 'react';
import {
  View, Text, Pressable, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { COUNTRIES } from '@/data/countries';

/* ── ألوان التطبيق ── */
const BG      = '#F9F8F4';
const CARD_BG = '#FFFFFF';
const TEXT    = '#1C1C1E';
const MUTED   = '#6B6B72';
const ACCENT  = '#3E6B47';
const BORDER  = '#E8E4DC';
const BTN_DISABLED = '#A8C5AE';

export default function CountrySelectScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_700Bold });
  const [selected, setSelected] = useState<string | null>(null);
  const { from } = useLocalSearchParams<{ from?: string }>();

  const handleNext = () => {
    if (!selected) return;
    const fromParam = from === 'prayer-times' ? `&from=prayer-times` : '';
    router.push(
      `/city-select?country=${selected}${fromParam}` as import('expo-router').RelativePathString
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ── رأس الشاشة ── */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: BG,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={22} color={TEXT} />
        </Pressable>
        <Text style={{
          flex: 1, fontSize: 18, color: TEXT, textAlign: 'right',
          fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
        }}>
          اختر دولتك
        </Text>
      </View>

      {/* ── قائمة الدول ── */}
      <FlatList
        data={COUNTRIES}
        keyExtractor={(item) => item.code}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const isActive = selected === item.code;
          return (
            <Pressable onPress={() => setSelected(item.code)}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isActive ? '#F2FAF4' : CARD_BG,
                paddingVertical: 16, paddingHorizontal: 20,
                borderBottomWidth: 1, borderBottomColor: BORDER,
                gap: 14,
              }}>
                <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                <Text style={{
                  flex: 1, fontSize: 15.5, color: TEXT, textAlign: 'right',
                  fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
                }}>
                  {item.name}
                </Text>
                {isActive
                  ? <CheckCircle2 size={20} color={ACCENT} />
                  : <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      borderWidth: 1.5, borderColor: '#CCCCCC',
                    }} />
                }
              </View>
            </Pressable>
          );
        }}
      />

      {/* ── زر التالي ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: BG,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 28,
        borderTopWidth: 1, borderTopColor: BORDER,
      }}>
        <Pressable
          onPress={selected ? handleNext : undefined}
          style={{
            backgroundColor: selected ? ACCENT : BTN_DISABLED,
            borderRadius: 14, paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontSize: 16, color: '#FFFFFF',
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
          }}>
            التالي — اختر المدينة
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
