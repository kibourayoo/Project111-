/**
 * src/components/athan/AthanInfoSection.tsx
 *
 * قسم المعلومات عن الأذان — ثابت لا يحتاج props
 * يعرض وصفاً وجدول بيانات بسيط عن الأذان.
 */

import { View, Text, useColorScheme } from 'react-native';
import { Info } from 'lucide-react-native';

import { ATHAN_STRINGS } from './athan-strings';

// ─── AthanInfoSection ─────────────────────────────────────────────────────────

export default function AthanInfoSection() {
  const cs    = useColorScheme() ?? 'light';
  const isDark = cs === 'dark';

  const cardBg      = isDark ? '#1C1C1E' : '#FFFFFF';
  const borderC     = isDark ? '#2C2C2E' : '#E5E0D8';
  const titleColor  = isDark ? '#F2F2F7' : '#1A1A1A';
  const bodyColor   = isDark ? '#AEAEB2' : '#4A4A4A';
  const labelColor  = isDark ? '#8E8E93' : '#6B6B6B';
  const valueColor  = isDark ? '#E5E5EA' : '#1A1A1A';
  const iconColor   = isDark ? '#5DA3D4' : '#1A5276';
  const divider     = isDark ? '#2C2C2E' : '#F0ECE6';
  const rowBg       = isDark ? '#2C2C2E' : '#F9F7F4';

  const s = ATHAN_STRINGS.infoSection;

  return (
    <View style={{
      backgroundColor: cardBg,
      borderRadius:     16,
      borderWidth:       1,
      borderColor:       borderC,
      overflow:         'hidden',
    }}>

      {/* ── رأس القسم ────────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection:    'row-reverse',
        alignItems:       'center',
        gap:               8,
        padding:           16,
        borderBottomWidth: 1,
        borderBottomColor: divider,
      }}>
        <Info size={18} color={iconColor} />
        <Text style={{
          fontSize:   16,
          fontWeight: '700',
          color:      titleColor,
          writingDirection: 'rtl',
        }}>
          {s.title}
        </Text>
      </View>

      {/* ── النص الوصفي ──────────────────────────────────────────────────────── */}
      <View style={{ padding: 16, paddingBottom: 12 }}>
        <Text style={{
          fontSize:         14,
          color:            bodyColor,
          lineHeight:        22,
          textAlign:        'right',
          writingDirection: 'rtl',
        }}>
          {s.body}
        </Text>
      </View>

      {/* ── جدول البيانات ────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <InfoRow
          label={s.durationLabel}
          value={s.durationValue}
          rowBg={rowBg}
          labelColor={labelColor}
          valueColor={valueColor}
        />
        <InfoRow
          label={s.languageLabel}
          value={s.languageValue}
          rowBg={rowBg}
          labelColor={labelColor}
          valueColor={valueColor}
        />
        <InfoRow
          label={s.styleLabel}
          value={s.styleValue}
          rowBg={rowBg}
          labelColor={labelColor}
          valueColor={valueColor}
        />
      </View>

    </View>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label:      string;
  value:      string;
  rowBg:      string;
  labelColor: string;
  valueColor: string;
}

function InfoRow({ label, value, rowBg, labelColor, valueColor }: InfoRowProps) {
  return (
    <View style={{
      flexDirection:    'row-reverse',
      justifyContent:   'space-between',
      alignItems:       'center',
      backgroundColor:  rowBg,
      borderRadius:      10,
      paddingHorizontal: 12,
      paddingVertical:    10,
    }}>
      <Text style={{ fontSize: 13, color: labelColor, fontWeight: '500' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: valueColor, fontWeight: '600', textAlign: 'left' }}>
        {value}
      </Text>
    </View>
  );
}
