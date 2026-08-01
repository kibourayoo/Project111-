import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { AlignJustify } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import { useMonthlyPrayerTimes } from '@/lib/use-monthly-prayer-times';
import { LOCATION_CITY_KEY, LOCATION_COUNTRY_KEY } from '@/app/location-setup';
import { COUNTRIES } from '@/data/countries';

const BG      = '#FDFBF7';
const TEXT    = '#1A1A1A';
const MUTED   = '#888888';
const DIVIDER = '#E8E4DC';
const CARD_BG = '#F3EFE7';

/* ── الأعمدة — مرتبة من اليمين إلى اليسار (RTL) ── */
const COL_HEADERS = ['العشاء','المغرب','العصر','الظهر','الشروق','الفجر','م/هـ','اليوم'];

/* خلية عنوان */
function HeaderCell({ label, last }: { label: string; first?: boolean; last?: boolean }) {
  return (
    <View style={{
      flex: label === 'اليوم' ? 1.3 : 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRightWidth: !last ? 1 : 0,
      borderRightColor: DIVIDER,
    }}>
      <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

/* خلية بيانات */
function DataCell({ value, wide }: { value: string; wide?: boolean }) {
  return (
    <View style={{ flex: wide ? 1.3 : 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: TEXT, textAlign: 'center' }}>{value}</Text>
    </View>
  );
}

export default function PrayerTimesScreen() {
  const [fontsLoaded] = useFonts({ Cairo_700Bold });
  const { days, monthName, loading, error } = useMonthlyPrayerTimes();

  /* ── قراءة اسم المدينة والدولة من AsyncStorage (تتحدث عند كل focus) ── */
  const [locationLabel, setLocationLabel] = useState('');

  const loadLocation = useCallback(async () => {
    const [[, city], [, countryCode]] = await AsyncStorage.multiGet([
      LOCATION_CITY_KEY,
      LOCATION_COUNTRY_KEY,
    ]);
    const countryName = countryCode
      ? (COUNTRIES.find(c => c.code === countryCode.toUpperCase())?.name ?? null)
      : null;
    if (city && countryName)  setLocationLabel(`${city} - ${countryName}`);
    else if (city)            setLocationLabel(city);
    else if (countryName)     setLocationLabel(countryName);
    else                      setLocationLabel('الموقع غير محدد');
  }, []);

  useFocusEffect(useCallback(() => { loadLocation(); }, [loadLocation]));

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ─── شريط العنوان ─── */}
      <PageHeader
        title="المواقيت"
        right={
          <Pressable
            onPress={() => router.push('/prayer-times-settings' as import('expo-router').RelativePathString)}
            style={{ padding: 8, marginRight: -8 }}
          >
            <AlignJustify size={22} color={TEXT} />
          </Pressable>
        }
      />

      {/* ─── سطر الشهر + المدينة ─── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 10,
      }}>
        {/* يسار: اسم الشهر الهجري */}
        <Text style={{
          fontSize: 13, color: TEXT,
          fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
          fontWeight: fontsLoaded ? undefined : 'bold',
          flex: 1, textAlign: 'left',
        }} numberOfLines={1}>
          {monthName || ' '}
        </Text>

        {/* يمين: المدينة والدولة */}
        <Text style={{
          fontSize: 13, color: MUTED,
          fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
          fontWeight: fontsLoaded ? undefined : '600',
          flex: 1, textAlign: 'right',
        }} numberOfLines={1}>
          {locationLabel || ' '}
        </Text>
      </View>

      {/* ─── حالة التحميل أو الخطأ ─── */}
      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={MUTED} />
        </View>
      )}

      {!loading && error && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 24,
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined }}>
            {error}
          </Text>
        </View>
      )}

      {/* ─── الجدول (يظهر فقط عند توفر البيانات) ─── */}
      {!loading && !error && days.length > 0 && (
        <>
          {/* ─── بطاقة رأس الأعمدة (ثابتة) ─── */}
          <View style={{
            marginHorizontal: 10,
            backgroundColor: CARD_BG,
            borderRadius: 8,
            flexDirection: 'row',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: DIVIDER,
            marginBottom: 4,
          }}>
            {COL_HEADERS.map((label, i) => (
              <HeaderCell
                key={label}
                label={label}
                first={i === 0}
                last={i === COL_HEADERS.length - 1}
              />
            ))}
          </View>

          {/* ─── قائمة الأيام ─── */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {days.map((day, idx) => (
              <View key={idx}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  backgroundColor: day.isToday ? '#EDE8DF' : undefined,
                }}>
                  <DataCell value={day.isha} />
                  <DataCell value={day.maghrib} />
                  <DataCell value={day.asr} />
                  <DataCell value={day.dhuhr} />
                  <DataCell value={day.shurooq} />
                  <DataCell value={day.fajr} />
                  <DataCell value={day.dateMG} />
                  <DataCell value={day.dayName} wide />
                </View>
                {idx < days.length - 1 && (
                  <View style={{ height: 1, backgroundColor: DIVIDER }} />
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
