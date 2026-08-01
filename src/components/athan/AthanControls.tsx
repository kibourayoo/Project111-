/**
 * src/components/athan/AthanControls.tsx
 *
 * أزرار التحكم في مشغّل الأذان
 *
 * الأزرار: السابق | توقف مؤقت/تشغيل/استكمال | إيقاف | التالي
 * لا تحتوي على أي منطق صوتي — جميع الوظائف تأتي عبر props.
 */

import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useState }  from 'react';
import {
  SkipBack,
  Play,
  Pause,
  Square,
  SkipForward,
} from 'lucide-react-native';

import { ATHAN_STRINGS } from './athan-strings';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AthanControlsProps {
  /** هل التشغيل جارٍ؟ */
  isPlaying:      boolean;
  /** هل موقوف مؤقتاً؟ */
  isPaused:       boolean;
  /** هل يمكن الانتقال للسابق؟ */
  canGoPrevious:  boolean;
  /** هل يمكن الانتقال للتالي؟ */
  canGoNext:      boolean;
  /** زر السابق */
  onPrevious:     () => void;
  /** زر تشغيل */
  onPlay:         () => void;
  /** زر إيقاف مؤقت */
  onPause:        () => void;
  /** زر استكمال */
  onResume:       () => void;
  /** زر إيقاف نهائي */
  onStop:         () => void;
  /** زر التالي */
  onNext:         () => void;
}

// ─── AthanControls ────────────────────────────────────────────────────────────

export default function AthanControls({
  isPlaying,
  isPaused,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onPlay,
  onPause,
  onResume,
  onStop,
  onNext,
}: AthanControlsProps) {
  const cs    = useColorScheme() ?? 'light';
  const isDark = cs === 'dark';

  const primaryColor   = isDark ? '#5DA3D4' : '#1A5276';
  const primaryFill    = isDark ? '#0D2137' : '#EAF2FB';
  const stopColor      = isDark ? '#EF9A9A' : '#C62828';
  const stopFill       = isDark ? '#3A1010' : '#FFEBEE';
  const disabledColor  = isDark ? '#3A3A3C' : '#C8C8C8';
  const iconWhite      = '#FFFFFF';

  // زر التشغيل الرئيسي: تشغيل / إيقاف مؤقت / استكمال
  const mainAction = isPlaying
    ? { icon: <Pause size={28} color={iconWhite} fill={iconWhite} />, label: ATHAN_STRINGS.controls.pause,  onPress: onPause }
    : isPaused
      ? { icon: <Play  size={28} color={iconWhite} fill={iconWhite} />, label: ATHAN_STRINGS.controls.resume, onPress: onResume }
      : { icon: <Play  size={28} color={iconWhite} fill={iconWhite} />, label: ATHAN_STRINGS.controls.play,   onPress: onPlay };

  return (
    <View style={{
      flexDirection:  'row',
      justifyContent: 'center',
      alignItems:     'center',
      gap:             16,
    }}>

      {/* ── السابق ───────────────────────────────────────────────────────────── */}
      <SmallButton
        icon={<SkipBack size={20} color={canGoPrevious ? primaryColor : disabledColor} />}
        label={ATHAN_STRINGS.controls.previous}
        onPress={onPrevious}
        disabled={!canGoPrevious}
        bgColor={primaryFill}
        isDark={isDark}
        disabledBg={isDark ? '#1C1C1E' : '#F5F5F5'}
      />

      {/* ── الزر الرئيسي (تشغيل / إيقاف مؤقت / استكمال) ─────────────────────── */}
      <MainButton
        icon={mainAction.icon}
        label={mainAction.label}
        onPress={mainAction.onPress}
        bgColor={primaryColor}
      />

      {/* ── إيقاف نهائي ─────────────────────────────────────────────────────── */}
      <SmallButton
        icon={<Square size={18} color={stopColor} fill={stopColor} />}
        label={ATHAN_STRINGS.controls.stop}
        onPress={onStop}
        bgColor={stopFill}
        isDark={isDark}
        disabledBg={isDark ? '#1C1C1E' : '#F5F5F5'}
      />

      {/* ── التالي ───────────────────────────────────────────────────────────── */}
      <SmallButton
        icon={<SkipForward size={20} color={canGoNext ? primaryColor : disabledColor} />}
        label={ATHAN_STRINGS.controls.next}
        onPress={onNext}
        disabled={!canGoNext}
        bgColor={primaryFill}
        isDark={isDark}
        disabledBg={isDark ? '#1C1C1E' : '#F5F5F5'}
      />

    </View>
  );
}

// ─── MainButton ───────────────────────────────────────────────────────────────

interface MainButtonProps {
  icon:    React.ReactNode;
  label:   string;
  onPress: () => void;
  bgColor: string;
}

function MainButton({ icon, label, onPress, bgColor }: MainButtonProps) {
  const [pressed, setPressed] = useState(false);
  const labelColor = (useColorScheme() ?? 'light') === 'dark' ? '#8E8E93' : '#6B6B6B';
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          width:           72,
          height:           72,
          borderRadius:     36,
          backgroundColor: bgColor,
          alignItems:      'center',
          justifyContent:  'center',
          opacity:          pressed ? 0.75 : 1,
        }}
      >
        {icon}
      </Pressable>
      <Text style={{
        fontSize:  10,
        color:     labelColor,
        textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}

// ─── SmallButton ──────────────────────────────────────────────────────────────

interface SmallButtonProps {
  icon:       React.ReactNode;
  label:      string;
  onPress:    () => void;
  bgColor:    string;
  isDark:     boolean;
  disabledBg: string;
  disabled?:  boolean;
}

function SmallButton({
  icon,
  label,
  onPress,
  bgColor,
  isDark,
  disabledBg,
  disabled = false,
}: SmallButtonProps) {
  const [pressed, setPressed] = useState(false);
  const bg = disabled ? disabledBg : bgColor;

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => { if (!disabled) setPressed(true); }}
        onPressOut={() => setPressed(false)}
        style={{
          width:           52,
          height:           52,
          borderRadius:     26,
          backgroundColor: bg,
          alignItems:      'center',
          justifyContent:  'center',
          opacity:          pressed ? 0.7 : (disabled ? 0.4 : 1),
        }}
      >
        {icon}
      </Pressable>
      <Text style={{
        fontSize: 10,
        color:    isDark ? '#8E8E93' : '#6B6B6B',
        textAlign: 'center',
        opacity:   disabled ? 0.4 : 1,
      }}>
        {label}
      </Text>
    </View>
  );
}
