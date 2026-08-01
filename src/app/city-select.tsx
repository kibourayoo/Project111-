/**
 * city-select.tsx
 * المرحلة الثانية — اختيار المدينة بناءً على الدولة المختارة.
 * تستقبل param: country (ISO code) وتحمّل JSON المقابل ديناميكيًا.
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, MapPin, CheckCircle2 } from 'lucide-react-native';
import { COUNTRIES } from '@/data/countries';
import {
  SETUP_COMPLETED_KEY,
  LOCATION_LAT_KEY,
  LOCATION_LNG_KEY,
  LOCATION_COUNTRY_KEY,
  LOCATION_CITY_KEY,
} from './location-setup';

/* ── ألوان التطبيق ── */
const BG      = '#F9F8F4';
const CARD_BG = '#FFFFFF';
const TEXT    = '#1C1C1E';
const MUTED   = '#6B6B72';
const ACCENT  = '#3E6B47';
const BORDER  = '#E8E4DC';
const BTN_DISABLED = '#A8C5AE';

import cityDataSA from '@/data/cities/sa.json';
import cityDataDZ from '@/data/cities/dz.json';
import cityDataMA from '@/data/cities/ma.json';
import cityDataTN from '@/data/cities/tn.json';
import cityDataLY from '@/data/cities/ly.json';
import cityDataEG from '@/data/cities/eg.json';
import cityDataAE from '@/data/cities/ae.json';
import cityDataQA from '@/data/cities/qa.json';
import cityDataPS from '@/data/cities/ps.json';

/* ── نوع المدينة ── */
type CityEntry = { name: string; lat: number; lng: number };

/* ── خريطة الدول → مدنها ── */
const CITY_MAP: Record<string, CityEntry[]> = {
  SA: cityDataSA,
  DZ: cityDataDZ,
  MA: cityDataMA,
  TN: cityDataTN,
  LY: cityDataLY,
  EG: cityDataEG,
  AE: cityDataAE,
  QA: cityDataQA,
  PS: cityDataPS,
};

export default function CitySelectScreen() {
  const insets = useSafeAreaInsets();
  const { country, from } = useLocalSearchParams<{ country: string; from?: string }>();
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_700Bold });
  const [selected, setSelected] = useState<CityEntry | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const code    = (country ?? 'SA').toUpperCase();
  const cities  = useMemo<CityEntry[]>(() => CITY_MAP[code] ?? [], [code]);
  const countryInfo = useMemo(
    () => COUNTRIES.find((c) => c.code === code),
    [code]
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await AsyncStorage.multiSet([
        [LOCATION_LAT_KEY,     String(selected.lat)],
        [LOCATION_LNG_KEY,     String(selected.lng)],
        [LOCATION_COUNTRY_KEY, code],
        [LOCATION_CITY_KEY,    selected.name],
        [SETUP_COMPLETED_KEY,  'true'],
      ]);
      const dest = from === 'prayer-times' ? '/prayer-times' : '/';
      router.replace(dest as import('expo-router').RelativePathString);
    } catch {
      setError('حدث خطأ أثناء الحفظ، أعد المحاولة.');
      setSaving(false);
    }
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
          {countryInfo ? `${countryInfo.emoji} ${countryInfo.name}` : 'اختر المدينة'}
        </Text>
      </View>

      {/* ── قائمة المدن ── */}
      <FlatList
        data={cities}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) => {
          const isActive = selected?.name === item.name;
          return (
            <Pressable onPress={() => setSelected(item)}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isActive ? '#F2FAF4' : CARD_BG,
                paddingVertical: 15, paddingHorizontal: 20,
                borderBottomWidth: 1, borderBottomColor: BORDER,
                gap: 12,
              }}>
                <MapPin size={16} color={isActive ? ACCENT : '#BBBBBB'} />
                <Text style={{
                  flex: 1, fontSize: 15, color: TEXT, textAlign: 'right',
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

      {/* ── زر التأكيد ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: BG,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 28,
        borderTopWidth: 1, borderTopColor: BORDER,
      }}>
        {selected && (
          <Text style={{
            fontSize: 13, color: MUTED,
            fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
            textAlign: 'center', marginBottom: 10,
          }}>
            تم اختيار: {selected.name}
          </Text>
        )}
        {error ? (
          <Text style={{
            fontSize: 12.5, color: '#B34040', textAlign: 'center',
            fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
            marginBottom: 8,
          }}>
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={selected && !saving ? handleConfirm : undefined}
          style={{
            backgroundColor: selected && !saving ? ACCENT : BTN_DISABLED,
            borderRadius: 14, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          {saving && <ActivityIndicator size="small" color="#FFF" />}
          <Text style={{
            fontSize: 16, color: '#FFFFFF',
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
          }}>
            {saving ? 'جارٍ الحفظ…' : 'تأكيد الاختيار'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
