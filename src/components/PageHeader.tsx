/**
 * PageHeader — شريط علوي موحّد لجميع صفحات التطبيق
 * ───────────────────────────────────────────────────
 * ارتفاع ثابت 84px (زيادة ~50% عن 56px السابق).
 * المحتوى (زر الرجوع + العنوان + اليمين) في منتصف الشريط عمودياً.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const BG     = '#F2EDE5';
const BORDER = '#DDD8CF';
const TEXT   = '#1A1A1A';

/** الارتفاع الموحّد للشريط العلوي — يُصدَّر لاستخدامه في الصفحات التي تحسبه يدوياً */
export const PAGE_HEADER_HEIGHT = 84;

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  /** عنصر اختياري يُعرض على اليمين بدل الفراغ */
  right?: React.ReactNode;
}

export default function PageHeader({ title, onBack, right }: PageHeaderProps) {
  return (
    <View style={S.header}>
      <Pressable onPress={onBack ?? (() => router.back())} style={S.sideSlot}>
        <ArrowLeft size={22} color={TEXT} />
      </Pressable>

      <Text style={S.title} numberOfLines={1}>{title}</Text>

      <View style={S.sideSlot}>
        {right ?? null}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    height: PAGE_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: BG,
    borderBottomWidth: 0.6,
    borderBottomColor: BORDER,
  },
  sideSlot: {
    width: 44,
    height: PAGE_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    color: TEXT,
    textAlign: 'center',
  },
});
