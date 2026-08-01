/**
 * src/components/athan/AthanProgressBar.tsx
 *
 * شريط التقدم + توقيتات الأذان
 *
 * Placeholder: progress = 0, times = '0:00'
 * لا يحتوي على أي منطق صوتي.
 */

import { View, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { ATHAN_STRINGS } from './athan-strings';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AthanProgressBarProps {
  /** نسبة التقدم من 0 إلى 1 — Placeholder: 0 */
  progress:      number;
  /** الوقت الحالي المنسَّق — Placeholder: '0:00' */
  currentTime:   string;
  /** المدة الكلية المنسَّقة — Placeholder: '0:00' */
  totalDuration: string;
  /** هل يجري التحميل؟ */
  isBuffering:   boolean;
}

// ─── AthanProgressBar ─────────────────────────────────────────────────────────

export default function AthanProgressBar({
  progress,
  currentTime,
  totalDuration,
  isBuffering,
}: AthanProgressBarProps) {
  const cs    = useColorScheme() ?? 'light';
  const isDark = cs === 'dark';

  // ألوان الشريط
  const trackBg   = isDark ? '#2C2C2E' : '#E5E0D8';
  const fillColor = isDark ? '#5DA3D4' : '#1A5276';
  const timeColor = isDark ? '#8E8E93' : '#6B6B6B';

  // تقليم النسبة بين 0 و 1
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ gap: 8 }}>

      {/* ── شريط التقدم ──────────────────────────────────────────────────────── */}
      <View style={{
        height:          6,
        backgroundColor: trackBg,
        borderRadius:     3,
        overflow:        'hidden',
      }}>
        <View style={{
          height:          6,
          borderRadius:     3,
          backgroundColor: fillColor,
          // RTL: الشريط يمتلئ من اليمين إلى اليسار
          width:           `${clampedProgress * 100}%`,
          alignSelf:       'flex-end',
        }} />
      </View>

      {/* ── التوقيتات + مؤشر التحميل ────────────────────────────────────────── */}
      <View style={{
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems:     'center',
      }}>
        {/* الوقت الكلي (يسار — نهاية في RTL) */}
        <Text style={{ fontSize: 12, color: timeColor, fontVariant: ['tabular-nums'] }}>
          {totalDuration}
        </Text>

        {/* مؤشر التحميل في المنتصف */}
        {isBuffering && (
          <ActivityIndicator size="small" color={fillColor} />
        )}

        {/* الوقت الحالي (يمين — بداية في RTL) */}
        <Text style={{ fontSize: 12, color: timeColor, fontVariant: ['tabular-nums'] }}>
          {currentTime}
        </Text>
      </View>

    </View>
  );
}
