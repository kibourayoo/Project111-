import {
  View, Text, Pressable, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, BookOpen, Layers } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import { useState, useCallback, useEffect, memo } from 'react';
import type { RelativePathString } from 'expo-router';
import { initQuranDb, getSurahs, getJuzs } from '@/lib/quranDb';
import type { Surah, Juz } from '@/lib/quranDb';
import { mushafFontService } from '@/features/mushaf/mushaf-font-service';

// ─── أنواع ────────────────────────────────────────────────────────────────────

type Tab = 'سورة' | 'أجزاء';

/** منع إعادة تحميل الخط عند كل useFocusEffect */
let _fontsLoadedOnce = false;

const BG       = '#FDFBF7';
const CARD_BG  = '#F2EDE5';
const BORDER   = '#DDD8CF';
const TEXT     = '#1A1A1A';
const MUTED    = '#888';
const PRIMARY  = '#5C6BC0';
const MAKKIAH_BG   = '#FFF3E0';
const MAKKIAH_TEXT = '#E65100';
const MADANIAH_BG  = '#E8F5E9';
const MADANIAH_TEXT= '#2E7D32';
const JUZ_BORDER   = '#8D6E6350';
const JUZ_BG       = '#8D6E6312';
const JUZ_TEXT     = '#6D4C41';

// ارتفاع ثابت لتفعيل getItemLayout
const SURAH_ITEM_H = 68;
const JUZ_ITEM_H   = 72;

// ─── أنماط ثابتة على مستوى الوحدة (لا تُعاد إنشاؤها عند كل تصيير) ──────────
const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowJuz: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pageCol: { alignItems: 'center', width: 38 },
  pageLbl: { fontSize: 9,  color: MUTED },
  pageNum: { fontSize: 13, color: MUTED },
  divider: { width: 0.6, height: 36, backgroundColor: BORDER, marginHorizontal: 10 },
  infoCol: { flex: 1, alignItems: 'flex-end' },
  surahName:{ fontSize: 15, color: TEXT, marginBottom: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ayahTxt:  { fontSize: 11, color: MUTED },
  dot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BORDER },
  badgeMak: { backgroundColor: MAKKIAH_BG,  borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  badgeMad: { backgroundColor: MADANIAH_BG, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  badgeMakTxt: { fontSize: 10, color: MAKKIAH_TEXT },
  badgeMadTxt: { fontSize: 10, color: MADANIAH_TEXT },
  circSurah: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 0.8, borderColor: PRIMARY + '50',
    backgroundColor: PRIMARY + '12',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  circSurahTxt: { fontSize: 12, color: PRIMARY },
  juzName:  { fontSize: 15, color: TEXT, marginBottom: 3 },
  juzStart: { fontSize: 11, color: MUTED },
  circJuz: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 0.8, borderColor: JUZ_BORDER,
    backgroundColor: JUZ_BG,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  circJuzTxt: { fontSize: 12, color: JUZ_TEXT },
});

// ─── مكوّن صف السورة — مُغلَّف بـ memo لمنع إعادة التصيير غير الضروري ────────
const SurahItem = memo(({ item, fontFamily, onPress }: {
  item: Surah;
  fontFamily: string | undefined;
  onPress: (pageNumber: number) => void;
}) => (
  <Pressable style={S.row} onPress={() => onPress(item.pageNumber)}>
    <View style={S.pageCol}>
      <Text style={[S.pageLbl, { fontFamily }]}>صفحة</Text>
      <Text style={[S.pageNum, { fontFamily }]}>{item.pageNumber}</Text>
    </View>
    <View style={S.divider} />
    <View style={S.infoCol}>
      <Text style={[S.surahName, { fontFamily }]}>{item.name}</Text>
      <View style={S.badgeRow}>
        <Text style={[S.ayahTxt, { fontFamily }]}>{item.ayahCount} آية</Text>
        <View style={S.dot} />
        <View style={item.type === 'مكية' ? S.badgeMak : S.badgeMad}>
          <Text style={[item.type === 'مكية' ? S.badgeMakTxt : S.badgeMadTxt, { fontFamily }]}>
            {item.type}
          </Text>
        </View>
      </View>
    </View>
    <View style={S.circSurah}>
      <Text style={[S.circSurahTxt, { fontFamily }]}>{item.id}</Text>
    </View>
  </Pressable>
));

// ─── مكوّن صف الجزء ───────────────────────────────────────────────────────────
const JuzItem = memo(({ item, fontFamily, onPress }: {
  item: Juz;
  fontFamily: string | undefined;
  onPress: (pageNumber: number) => void;
}) => (
  <Pressable style={S.rowJuz} onPress={() => onPress(item.startPage)}>
    <View style={S.pageCol}>
      <Text style={[S.pageLbl, { fontFamily }]}>صفحة</Text>
      <Text style={[S.pageNum, { fontFamily }]}>{item.startPage}</Text>
    </View>
    <View style={S.divider} />
    <View style={S.infoCol}>
      <Text style={[S.juzName, { fontFamily }]}>{item.nameAr}</Text>
      <Text style={[S.juzStart, { fontFamily }]}>يبدأ من: {item.startSurah}</Text>
    </View>
    <View style={S.circJuz}>
      <Text style={[S.circJuzTxt, { fontFamily }]}>{item.id}</Text>
    </View>
  </Pressable>
));

// ─── كاش على مستوى الوحدة — يُحمَّل مرة واحدة طوال عمر التطبيق ───────────────
let _cachedSurahs: Surah[] | null = null;
let _cachedJuzs: Juz[]   | null = null;

// ─── الشاشة الرئيسية ──────────────────────────────────────────────────────────
export default function MushafScreen() {
  // بوابة الخط — تُعيد التوجيه إلى شاشة التحميل إن لم تكن الخطوط جاهزة
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (_fontsLoadedOnce && mushafFontService.areFontsReady()) return;
        const check = mushafFontService.checkFontsExist();
        if (!check.allPresent) {
          router.replace('/mushaf/font-download' as RelativePathString);
          return;
        }
        if (!mushafFontService.areFontsReady()) {
          const loadResult = await mushafFontService.loadFontsIntoRN();
          if (!loadResult.success) {
            router.replace('/mushaf/font-download' as RelativePathString);
            return;
          }
        }
        _fontsLoadedOnce = true;
      })();
    }, []),
  );

  const [activeTab, setActiveTab] = useState<Tab>('سورة');
  const [surahs, setSurahs]       = useState<Surah[]>(_cachedSurahs ?? []);
  const [juzs, setJuzs]           = useState<Juz[]>(_cachedJuzs   ?? []);
  const [dataReady, setDataReady] = useState(_cachedSurahs !== null);

  // خط واجهة القائمة — مؤقتاً undefined حتى إعادة ربط QCF
  const fontFamily = undefined;
  const loading = !dataReady;

  useEffect(() => {
    if (_cachedSurahs !== null) return;
    (async () => {
      await initQuranDb();
      const [s, j] = await Promise.all([getSurahs(), getJuzs()]);
      _cachedSurahs = s;
      _cachedJuzs   = j;
      setSurahs(s);
      setJuzs(j);
      setDataReady(true);
    })();
  }, []);

  // فتح شاشة عرض المصحف عند الضغط على سورة أو جزء
  const openPage = useCallback((pageNumber: number) => {
    router.push(`/mushaf/${pageNumber}` as RelativePathString);
  }, []);

  // useCallback يمنع إعادة إنشاء دالة التصيير عند كل render للشاشة
  const renderSurah = useCallback(
    ({ item }: { item: Surah }) => (
      <SurahItem item={item} fontFamily={fontFamily} onPress={openPage} />
    ),
    [fontFamily, openPage],
  );

  const renderJuz = useCallback(
    ({ item }: { item: Juz }) => (
      <JuzItem item={item} fontFamily={fontFamily} onPress={openPage} />
    ),
    [fontFamily, openPage],
  );

  const surahLayout = useCallback(
    (_: unknown, index: number) => ({ length: SURAH_ITEM_H, offset: SURAH_ITEM_H * index, index }),
    [],
  );
  const juzLayout = useCallback(
    (_: unknown, index: number) => ({ length: JUZ_ITEM_H, offset: JUZ_ITEM_H * index, index }),
    [],
  );

  const surahKey = useCallback((item: Surah) => item.id.toString(), []);
  const juzKey   = useCallback((item: Juz)   => item.id.toString(), []);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="المصحف" />

      {/* التبويبان */}
      <View style={{
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
        backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 0.6,
        borderColor: BORDER, padding: 4, gap: 4,
      }}>
        {(['سورة', 'أجزاء'] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                justifyContent: 'center', gap: 6, paddingVertical: 9,
                borderRadius: 9,
                backgroundColor: active ? BG : 'transparent',
                borderWidth: active ? 0.6 : 0,
                borderColor: BORDER,
              }}
            >
              {tab === 'سورة'
                ? <BookOpen size={15} color={active ? PRIMARY : MUTED} />
                : <Layers   size={15} color={active ? PRIMARY : MUTED} />
              }
              <Text style={{ fontSize: 14, fontFamily, color: active ? PRIMARY : MUTED }}>
                {tab === 'سورة' ? 'السورة' : 'الأجزاء'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* المحتوى */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : activeTab === 'سورة' ? (
        <FlatList
          data={surahs}
          keyExtractor={surahKey}
          renderItem={renderSurah}
          getItemLayout={surahLayout}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={21}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={juzs}
          keyExtractor={juzKey}
          renderItem={renderJuz}
          getItemLayout={juzLayout}
          initialNumToRender={30}
          maxToRenderPerBatch={30}
          windowSize={21}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
