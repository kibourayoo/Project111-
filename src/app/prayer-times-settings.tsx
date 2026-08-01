/**
 * prayer-times-settings.tsx
 * صفحة إعدادات المواقيت — تعرض خيار تغيير الموقع فقط.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFonts, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { MapPin } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';

const BG      = '#FDFBF7';
const TEXT    = '#1A1A1A';
const MUTED   = '#888888';
const DIVIDER = '#E8E4DC';
const CARD_BG = '#F3EFE7';

export default function PrayerTimesSettingsScreen() {
  const [fontsLoaded] = useFonts({ Cairo_700Bold });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ─── شريط العنوان ─── */}
      <PageHeader title="الإعدادات" />

      {/* ─── قائمة الخيارات ─── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>

        {/* فاصل عنوان القسم */}
        <Text style={{
          fontSize: 12, color: MUTED, marginBottom: 8, textAlign: 'right',
          fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
        }}>
          الموقع
        </Text>

        {/* بطاقة تغيير الموقع */}
        <Pressable
          onPress={() =>
            router.push('/location-setup?from=prayer-times' as import('expo-router').RelativePathString)
          }
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: DIVIDER,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <MapPin size={20} color={MUTED} style={{ marginLeft: 12 }} />
          <Text style={{
            flex: 1, fontSize: 15, color: TEXT, textAlign: 'right',
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
            fontWeight: fontsLoaded ? undefined : '600',
          }}>
            تغيير الموقع
          </Text>
        </Pressable>

      </View>
    </View>
  );
}
