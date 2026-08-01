/**
 * src/components/athan/AthanHeroCard.tsx
 *
 * بطاقة المؤذّن الرئيسية — أيقونة + اسم + حالة + زر التغيير
 *
 * لا تحتوي على أي منطق صوتي.
 * جميع القيم تأتي من props.
 */

import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useState } from 'react';
import { Music2 } from 'lucide-react-native';

import AzanIcon          from '../AzanIcon';
import { ATHAN_STRINGS } from './athan-strings';

// ─── أنواع الـ Props ──────────────────────────────────────────────────────────

export type AthanPlaybackState = 'idle' | 'playing' | 'paused' | 'ended' | 'error';

export interface AthanHeroCardProps {
  /** اسم المؤذّن — null قبل الاختيار */
  muezzinName:        string | null;
  /** وصف مختصر للمؤذّن */
  muezzinDescription: string | null;
  /** حالة التشغيل الحالية */
  playbackState:      AthanPlaybackState;
  /** يُستدعى عند الضغط على زر "تغيير المؤذّن" */
  onSelectMuezzin:    () => void;
}

// ─── ثوابت الألوان حسب الحالة ────────────────────────────────────────────────

type ThemeKey = 'light' | 'dark';

const STATE_CONFIG: Record<
  AthanPlaybackState,
  Record<ThemeKey, { bg: string; text: string }>
> = {
  idle:    { light: { bg: '#F0F4F8', text: '#5A7184' }, dark: { bg: '#2A3441', text: '#8BADC0' } },
  playing: { light: { bg: '#E8F5E9', text: '#2E7D32' }, dark: { bg: '#1B3A1C', text: '#66BB6A' } },
  paused:  { light: { bg: '#FFF8E1', text: '#F57F17' }, dark: { bg: '#3A2F0A', text: '#FFB74D' } },
  ended:   { light: { bg: '#F0F4F8', text: '#5A7184' }, dark: { bg: '#2A3441', text: '#8BADC0' } },
  error:   { light: { bg: '#FFEBEE', text: '#C62828' }, dark: { bg: '#3A1010', text: '#EF9A9A' } },
};

// ─── AthanHeroCard ────────────────────────────────────────────────────────────

export default function AthanHeroCard({
  muezzinName,
  muezzinDescription,
  playbackState,
  onSelectMuezzin,
}: AthanHeroCardProps) {
  const cs       = (useColorScheme() ?? 'light') as ThemeKey;
  const isDark   = cs === 'dark';
  const stateConf = STATE_CONFIG[playbackState][cs];

  const [btnPressed, setBtnPressed] = useState(false);

  // ألوان متوافقة مع الثيم
  const cardBg     = isDark ? '#1C1C1E' : '#FFFFFF';
  const borderC    = isDark ? '#2C2C2E' : '#E5E0D8';
  const nameColor  = isDark ? '#F2F2F7' : '#1A1A1A';
  const descColor  = isDark ? '#8E8E93' : '#6B6B6B';
  const iconBg     = isDark ? '#2C2C2E' : '#F5F0E8';
  const btnBg      = isDark
    ? (btnPressed ? '#1A3C5E' : '#0D2137')
    : (btnPressed ? '#D6E4F0' : '#EAF2FB');
  const btnText    = isDark ? '#5DA3D4' : '#1A5276';

  const stateLabel = ATHAN_STRINGS.playbackState[playbackState];

  return (
    <View style={{
      backgroundColor: cardBg,
      borderRadius:     20,
      borderWidth:       1,
      borderColor:       borderC,
      padding:           20,
      alignItems:       'center',
      gap:               14,
    }}>

      {/* ── الأيقونة الدائرية ────────────────────────────────────────────────── */}
      <View style={{
        width:           100,
        height:           100,
        borderRadius:     50,
        backgroundColor: iconBg,
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
      }}>
        <AzanIcon width={64} height={70} />
      </View>

      {/* ── اسم المؤذّن ──────────────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{
          fontSize:   20,
          fontWeight: '700',
          color:      nameColor,
          textAlign:  'center',
          writingDirection: 'rtl',
        }}>
          {muezzinName ?? ATHAN_STRINGS.noMuezzinSelected}
        </Text>

        {muezzinDescription && (
          <Text style={{
            fontSize:        13,
            color:           descColor,
            textAlign:       'center',
            writingDirection: 'rtl',
          }}>
            {muezzinDescription}
          </Text>
        )}
      </View>

      {/* ── شارة الحالة ──────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection:  'row',
        alignItems:     'center',
        gap:             6,
        backgroundColor: stateConf.bg,
        paddingHorizontal: 14,
        paddingVertical:    6,
        borderRadius:       20,
      }}>
        <Music2 size={13} color={stateConf.text} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: stateConf.text }}>
          {stateLabel}
        </Text>
      </View>

      {/* ── زر اختيار / تغيير المؤذّن ────────────────────────────────────────── */}
      <Pressable
        onPress={onSelectMuezzin}
        onPressIn={() => setBtnPressed(true)}
        onPressOut={() => setBtnPressed(false)}
        style={{
          backgroundColor: btnBg,
          paddingHorizontal: 20,
          paddingVertical:    9,
          borderRadius:       12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: btnText }}>
          {muezzinName
            ? ATHAN_STRINGS.changeMuezzinBtn
            : ATHAN_STRINGS.selectMuezzinBtn}
        </Text>
      </Pressable>
    </View>
  );
}
