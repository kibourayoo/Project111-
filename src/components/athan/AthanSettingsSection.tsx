/**
 * src/components/athan/AthanSettingsSection.tsx
 *
 * قسم إعدادات الأذان — Placeholder
 * يعرض صفوف الإعدادات بدون أي وظيفة فعلية.
 * جاهز للربط بمنطق الإعدادات في مرحلة لاحقة.
 */

import { View, Text, useColorScheme } from 'react-native';
import {
  Settings,
  BellRing,
  Repeat,
  Volume2,
  Bell,
  ChevronLeft,
} from 'lucide-react-native';

import { ATHAN_STRINGS } from './athan-strings';

// ─── AthanSettingsSection ─────────────────────────────────────────────────────

export default function AthanSettingsSection() {
  const cs     = useColorScheme() ?? 'light';
  const isDark  = cs === 'dark';

  const cardBg      = isDark ? '#1C1C1E' : '#FFFFFF';
  const borderC     = isDark ? '#2C2C2E' : '#E5E0D8';
  const titleColor  = isDark ? '#F2F2F7' : '#1A1A1A';
  const iconColor   = isDark ? '#5DA3D4' : '#1A5276';
  const divider     = isDark ? '#2C2C2E' : '#F0ECE6';
  const badgeBg     = isDark ? '#2C2C2E' : '#F5F0E8';
  const badgeText   = isDark ? '#8E8E93' : '#8A7A6A';
  const chevron     = isDark ? '#48484A' : '#C8C8C8';

  const s = ATHAN_STRINGS.settingsSection;

  const rows = [
    {
      icon:        <BellRing size={18} color={iconColor} />,
      label:       s.autoPlayLabel,
      description: s.autoPlayDescription,
    },
    {
      icon:        <Repeat size={18} color={iconColor} />,
      label:       s.repeatLabel,
      description: s.repeatDescription,
    },
    {
      icon:        <Volume2 size={18} color={iconColor} />,
      label:       s.volumeLabel,
      description: s.volumeDescription,
    },
    {
      icon:        <Bell size={18} color={iconColor} />,
      label:       s.notificationLabel,
      description: s.notificationDescription,
    },
  ];

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
        justifyContent:   'space-between',
        padding:           16,
        borderBottomWidth: 1,
        borderBottomColor: divider,
      }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color={iconColor} />
          <Text style={{
            fontSize:   16,
            fontWeight: '700',
            color:      titleColor,
            writingDirection: 'rtl',
          }}>
            {s.title}
          </Text>
        </View>

        {/* شارة "قريباً" */}
        <View style={{
          backgroundColor:  badgeBg,
          paddingHorizontal: 10,
          paddingVertical:    4,
          borderRadius:       12,
        }}>
          <Text style={{ fontSize: 11, color: badgeText, fontWeight: '600' }}>
            قريباً
          </Text>
        </View>
      </View>

      {/* ── صفوف الإعدادات ───────────────────────────────────────────────────── */}
      {rows.map((row, index) => (
        <SettingsRow
          key={index}
          icon={row.icon}
          label={row.label}
          description={row.description}
          showDivider={index < rows.length - 1}
          dividerColor={divider}
          isDark={isDark}
          chevronColor={chevron}
        />
      ))}

      {/* ── ملاحظة Placeholder ───────────────────────────────────────────────── */}
      <View style={{
        padding:         14,
        borderTopWidth:   1,
        borderTopColor:   divider,
        alignItems:      'center',
      }}>
        <Text style={{
          fontSize:  12,
          color:     isDark ? '#636366' : '#A0A0A0',
          textAlign: 'center',
          writingDirection: 'rtl',
        }}>
          {s.placeholderNote}
        </Text>
      </View>

    </View>
  );
}

// ─── SettingsRow ──────────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon:         React.ReactNode;
  label:        string;
  description:  string;
  showDivider:  boolean;
  dividerColor: string;
  isDark:       boolean;
  chevronColor: string;
}

function SettingsRow({
  icon,
  label,
  description,
  showDivider,
  dividerColor,
  isDark,
  chevronColor,
}: SettingsRowProps) {
  const labelColor = isDark ? '#E5E5EA' : '#1A1A1A';
  const descColor  = isDark ? '#636366' : '#8A8A8A';

  return (
    <View style={{
      flexDirection:    'row-reverse',
      alignItems:       'center',
      paddingHorizontal: 16,
      paddingVertical:   14,
      gap:               12,
      borderBottomWidth: showDivider ? 1 : 0,
      borderBottomColor: dividerColor,
      opacity:           0.7, // Placeholder: معطل
    }}>
      {/* الأيقونة */}
      <View style={{ width: 22, alignItems: 'center' }}>
        {icon}
      </View>

      {/* النصوص */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{
          fontSize:         14,
          fontWeight:       '500',
          color:            labelColor,
          writingDirection: 'rtl',
          textAlign:        'right',
        }}>
          {label}
        </Text>
        <Text style={{
          fontSize:         12,
          color:            descColor,
          writingDirection: 'rtl',
          textAlign:        'right',
          lineHeight:        17,
        }}>
          {description}
        </Text>
      </View>

      {/* سهم الانتقال */}
      <ChevronLeft size={16} color={chevronColor} />
    </View>
  );
}
