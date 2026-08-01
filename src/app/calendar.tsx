import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ArrowLeft } from 'lucide-react-native';
import { useMonthlyPrayerTimes } from '@/lib/use-monthly-prayer-times';
import { gregorianToHijri } from '@/lib/hijri';

/* ── ألوان ── */
const BG              = '#FDFBF7';
const TEXT            = '#1A1A1A';
const MUTED           = '#9E9790';
const DIVIDER         = '#E8E4DC';
const CARD_BG         = '#F3EFE7';
const TODAY_BG        = '#1E2D3D';
const TODAY_FG        = '#FFFFFF';
const FADED           = '#C8C3BA';
const FRIDAY_COLOR    = '#8B7355';
const SEG_ACTIVE_BG   = '#1E2D3D';
const SEG_ACTIVE_FG   = '#FFFFFF';
const SEG_INACTIVE_BG = '#EDE8DF';

/* ── رؤوس الأعمدة: من اليسار (الجمعة) إلى اليمين (السبت) ── */
const DAY_HEADERS = ['الجمعة','الخميس','الأربعاء','الثلاثاء','الإثنين','الأحد','السبت'];

/* أسماء الأشهر الميلادية بالعربية — للعنوان في وضع الميلادي */
const GREG_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

/* تحويل getDay() → عمود في الشبكة
   الأعمدة: 0=الجمعة(5), 1=الخميس(4), 2=الأربعاء(3),
            3=الثلاثاء(2), 4=الإثنين(1), 5=الأحد(0), 6=السبت(6) */
const JS_DAY_TO_COL: Record<number, number> = { 5:0, 4:1, 3:2, 2:3, 1:4, 0:5, 6:6 };

type Cell = {
  hijriDay: number;
  gregDay:  number;
  type:     'prev' | 'curr' | 'next';
  isToday:  boolean;
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_700Bold });
  const [activeTab, setActiveTab] = useState<'hijri' | 'gregorian'>('hijri');

  /* بيانات الشهر الحالي من النظام الموجود */
  const { days, monthName, loading, error } = useMonthlyPrayerTimes();

  /* ── بناء شبكة التقويم ──
   الأسبوع يسير من اليمين إلى اليسار: col[6]=السبت → col[0]=الجمعة
   صيغة تحويل الفتحة الزمنية إلى عمود: col = 6 - (slot % 7)
   بذلك يتم تعيين كل يوم مباشرةً بعموده الصحيح بدلاً من التعبئة التسلسلية ── */
  const grid = useMemo((): Cell[][] => {
    if (!days.length) return [];

    const firstDate = days[0].date;
    const lastDate  = days[days.length - 1].date;

    /* الفتحة الزمنية للـ col[0] (الجمعة) = 6، للـ col[6] (السبت) = 0
       إذن: slotDay1 = 6 - col0  (موضع اليوم الأول في تدفق الوقت) */
    const col0      = JS_DAY_TO_COL[firstDate.getDay()];
    const slotDay1  = 6 - col0;
    const rowCount  = Math.ceil((slotDay1 + days.length) / 7);
    const totalSlots = rowCount * 7;

    /* شبكة مبدئية فارغة */
    const grid2d: Cell[][] = Array.from(
      { length: rowCount },
      function() { return Array(7).fill(null) as unknown as Cell[]; }
    );

    /* — أيام الشهر الحالي — */
    days.forEach(function(row, idx) {
      const slot = slotDay1 + idx;
      const r    = Math.floor(slot / 7);
      const c    = 6 - (slot % 7);
      grid2d[r][c] = {
        hijriDay: row.hijriDay,
        gregDay:  row.gregorianDay,
        type:     'curr',
        isToday:  row.isToday,
      };
    });

    /* — خلايا الشهر السابق — */
    for (let slot = 0; slot < slotDay1; slot++) {
      const d = new Date(firstDate);
      d.setDate(d.getDate() + (slot - slotDay1));   // offset سالب
      const { day: hd } = gregorianToHijri(d);
      const r = Math.floor(slot / 7);
      const c = 6 - (slot % 7);
      grid2d[r][c] = { hijriDay: hd, gregDay: d.getDate(), type: 'prev', isToday: false };
    }

    /* — خلايا الشهر التالي — */
    const currEnd = slotDay1 + days.length;
    for (let slot = currEnd; slot < totalSlots; slot++) {
      const offset = slot - currEnd + 1;
      const d = new Date(lastDate);
      d.setDate(d.getDate() + offset);
      const { day: hd } = gregorianToHijri(d);
      const r = Math.floor(slot / 7);
      const c = 6 - (slot % 7);
      grid2d[r][c] = { hijriDay: hd, gregDay: d.getDate(), type: 'next', isToday: false };
    }

    return grid2d;
  }, [days]);

  /* ── عنوان الشهر حسب التبويب النشط ── */
  const title = useMemo(function() {
    if (!days.length) return '';
    if (activeTab === 'hijri') return monthName;
    /* الشهر الميلادي: نأخذ اليوم الأوسط لتجنب مشكلة الشهرين */
    const mid = days[Math.floor(days.length / 2)].date;
    return GREG_MONTHS[mid.getMonth()] + ' ' + mid.getFullYear();
  }, [days, monthName, activeTab]);

  const bold    = fontsLoaded ? 'Cairo_700Bold'    : undefined;
  const regular = fontsLoaded ? 'Cairo_400Regular' : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ── شريط علوي: زر رجوع + Segmented Control في المنتصف ── */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <Pressable onPress={function() { router.back(); }} style={{ padding: 6, marginLeft: -4 }}>
          <ArrowLeft size={20} color={TEXT} />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{
            flexDirection: 'row',
            backgroundColor: SEG_INACTIVE_BG,
            borderRadius: 8,
            padding: 2,
            width: 150,
          }}>
            <Pressable
              onPress={function() { setActiveTab('hijri'); }}
              style={{
                flex: 1, paddingVertical: 5, borderRadius: 6, alignItems: 'center',
                backgroundColor: activeTab === 'hijri' ? SEG_ACTIVE_BG : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: activeTab === 'hijri' ? bold : regular,
                fontSize: 12,
                color: activeTab === 'hijri' ? SEG_ACTIVE_FG : MUTED,
              }}>
                {'هجري'}
              </Text>
            </Pressable>
            <Pressable
              onPress={function() { setActiveTab('gregorian'); }}
              style={{
                flex: 1, paddingVertical: 5, borderRadius: 6, alignItems: 'center',
                backgroundColor: activeTab === 'gregorian' ? SEG_ACTIVE_BG : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: activeTab === 'gregorian' ? bold : regular,
                fontSize: 12,
                color: activeTab === 'gregorian' ? SEG_ACTIVE_FG : MUTED,
              }}>
                {'ميلادي'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* موازن لإبقاء Segmented Control في المنتصف */}
        <View style={{ width: 32 }} />
      </View>

      {/* ── عنوان الشهر ── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' }}>
        <Text style={{ fontFamily: bold, fontSize: 18, color: TEXT, letterSpacing: 0.2 }}>
          {title}
        </Text>
      </View>

      {/* ── حالة التحميل ── */}
      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={MUTED} />
        </View>
      )}

      {/* ── حالة الخطأ ── */}
      {!loading && !!error && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 24,
            fontFamily: bold }}>
            {error}
          </Text>
        </View>
      )}

      {/* ── شبكة التقويم ── */}
      {!loading && !error && grid.length > 0 && (
        <View style={{ flex: 1, paddingHorizontal: 10, paddingBottom: insets.bottom + 12 }}>

          {/* رأس الأيام */}
          <View style={{
            backgroundColor: CARD_BG,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: DIVIDER,
            flexDirection: 'row',
            overflow: 'hidden',
            marginBottom: 4,
          }}>
            {DAY_HEADERS.map(function(name, i) {
              return (
                <View key={name} style={{
                  flex: 1, alignItems: 'center', paddingVertical: 7,
                  borderRightWidth: i < DAY_HEADERS.length - 1 ? 1 : 0,
                  borderRightColor: DIVIDER,
                }}>
                  <Text style={{
                    fontFamily: bold, fontSize: 10,
                    color: name === 'الجمعة' ? FRIDAY_COLOR : MUTED,
                    textAlign: 'center',
                  }}>
                    {name}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* صفوف الأسابيع */}
          <View style={{ flex: 1 }}>
            {grid.map(function(week, wi) {
              return (
                <View key={wi} style={{ flex: 1, flexDirection: 'row' }}>
                  {week.map(function(cell, ci) {
                    const isFaded  = cell.type !== 'curr';
                    const isFriday = ci === 0;
                    const dayNum   = activeTab === 'hijri' ? cell.hijriDay : cell.gregDay;
                    return (
                      <View key={ci} style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        borderBottomWidth: wi < grid.length - 1 ? 1 : 0,
                        borderRightWidth: ci < week.length - 1 ? 1 : 0,
                        borderColor: DIVIDER,
                      }}>
                        {cell.isToday ? (
                          <View style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: TODAY_BG,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ fontFamily: bold, fontSize: 14, color: TODAY_FG }}>
                              {dayNum}
                            </Text>
                          </View>
                        ) : (
                          <Text style={{
                            fontFamily: regular, fontSize: 15, textAlign: 'center',
                            color: isFaded ? FADED : isFriday ? FRIDAY_COLOR : TEXT,
                          }}>
                            {dayNum}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>

        </View>
      )}
    </View>
  );
}
