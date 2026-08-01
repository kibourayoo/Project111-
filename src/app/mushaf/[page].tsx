/**
 * [page].tsx — عارض صفحات المصحف
 * ─────────────────────────────────────────────────────────────────────────────
 * - يعرض صفحات المصحف بالخط القرآني (QCF)
 * - التنقل بالسحب يميناً/يساراً (FlatList أفقي)
 * - كل صفحة مستقلة داخل نفس الشاشة
 * - يدعم offline بالكامل
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  View, Text, FlatList, ActivityIndicator,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { RelativePathString } from 'expo-router';
import PageHeader from '@/components/PageHeader';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { mushafFontService, MUSHAF_FONTS_DIR } from '@/features/mushaf/mushaf-font-service';

// ─── ثوابت ────────────────────────────────────────────────────────────────────
const BG        = '#FDFBF7';
const BORDER    = '#DDD8CF';
const TEXT      = '#1A1A1A';
const MUTED     = '#888';
const HEADER_BG = '#F5F0E8';
const PRIMARY   = '#5C6BC0';

const FONT_PAGE = 'QCF_P001';
const FONT_BSML = 'QCF_BSML';

/** إجمالي صفحات المصحف */
const TOTAL_PAGES = 604;

// ─── أنواع JSON ────────────────────────────────────────────────────────────────
interface PageLine {
  line:   number;
  type:   'surah-header' | 'text';
  text:   string;
  surah?: string;
}
interface PageData {
  page:  number;
  lines: PageLine[];
}

// ─── قراءة JSON من التخزين المحلي ────────────────────────────────────────────
async function readPageJson(pageNum: number): Promise<PageData | null> {
  try {
    const fileName = `page-${String(pageNum).padStart(3, '0')}.json`;
    const dir  = new Directory(Paths.document, MUSHAF_FONTS_DIR);
    const file = new File(dir, fileName);
    if (!file.exists) return null;
    const content = await file.text();
    return JSON.parse(content) as PageData;
  } catch {
    return null;
  }
}

// ─── مكوّن رأس السورة ─────────────────────────────────────────────────────────
function SurahHeader({ text }: { text: string }) {
  return (
    <View style={S.surahHeader}>
      <Text style={S.surahHeaderText}>{text}</Text>
    </View>
  );
}

// ─── مكوّن صفحة واحدة ────────────────────────────────────────────────────────
function MushafPage({
  pageNum,
  pageWidth,
}: {
  pageNum:   number;
  pageWidth: number;
}) {
  const [data,    setData]    = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noData,  setNoData]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNoData(false);
      const d = await readPageJson(pageNum);
      if (!cancelled) {
        setData(d);
        setNoData(d === null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageNum]);

  const pageLabel = `صفحة ${pageNum}`;

  return (
    <View style={[S.pageWrapper, { width: pageWidth }]}>
      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={S.loadingText}>جارٍ تحميل {pageLabel}…</Text>
        </View>
      ) : noData || !data ? (
        <View style={S.center}>
          <Text style={S.mutedText}>{pageLabel}</Text>
          <Text style={S.mutedText}>بيانات الصفحة غير متاحة بعد</Text>
        </View>
      ) : (
        <FlatList
          data={data.lines}
          keyExtractor={(item) => `${pageNum}-${item.line}`}
          contentContainerStyle={S.pageContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item.type === 'surah-header' ? (
              <SurahHeader text={item.surah ?? item.text} />
            ) : (
              <Text
                style={[
                  S.quranLine,
                  { fontFamily: item.line === 1 ? FONT_BSML : FONT_PAGE },
                ]}
              >
                {item.text}
              </Text>
            )
          }
        />
      )}
    </View>
  );
}

// ─── الشاشة الرئيسية ──────────────────────────────────────────────────────────
export default function MushafPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const startPage = Math.min(TOTAL_PAGES, Math.max(1, parseInt(page ?? '1', 10)));

  const { width } = useWindowDimensions();
  const flatRef   = useRef<FlatList>(null);

  const [currentPage, setCurrentPage] = useState(startPage);
  const [fontsReady,  setFontsReady]  = useState(false);
  const [fontError,   setFontError]   = useState('');

  // ── حارس الخط ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // إذا كانت الخطوط جاهزة انتقل مباشرة
      if (mushafFontService.areFontsReady()) {
        setFontsReady(true);
        return;
      }
      // تحقق من وجود الخطوط وملفات JSON
      const check = mushafFontService.checkFontsExist();
      const pages = mushafFontService.checkPagesExist();
      if (!check.allPresent || !pages.allPresent) {
        router.replace('/mushaf/font-download' as RelativePathString);
        return;
      }
      // حمّلها في ذاكرة RN
      const result = await mushafFontService.loadFontsIntoRN();
      if (!result.success) {
        setFontError(result.error ?? 'فشل تحميل الخط');
        return;
      }
      setFontsReady(true);
    })();
  }, []);

  // ── بناء قائمة الصفحات ──────────────────────────────────────────────────────
  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  // ── الانتقال إلى صفحة محددة عند التمرير ────────────────────────────────────
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: number }> }) => {
      if (viewableItems.length > 0) {
        setCurrentPage(viewableItems[0].item);
      }
    },
    [],
  );
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  // ── حالة خطأ الخط ───────────────────────────────────────────────────────────
  if (fontError) {
    return (
      <View style={S.root}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="المصحف" />
        <View style={S.center}>
          <Text style={S.errorText}>{fontError}</Text>
        </View>
      </View>
    );
  }

  // ── تحميل الخط ──────────────────────────────────────────────────────────────
  if (!fontsReady) {
    return (
      <View style={S.root}>
        <StatusBar style="dark" backgroundColor={BG} />
        <PageHeader title="المصحف" />
        <View style={S.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={S.loadingText}>جارٍ تجهيز الخط…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان مع رقم الصفحة الحالي */}
      <PageHeader title={`صفحة ${currentPage} / ${TOTAL_PAGES}`} />

      {/* عارض الصفحات الأفقي */}
      <FlatList
        ref={flatRef}
        data={pages}
        keyExtractor={(item) => item.toString()}
        renderItem={({ item }) => (
          <MushafPage pageNum={item} pageWidth={width} />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startPage - 1}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        windowSize={3}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews
      />
    </View>
  );
}

// ─── أنماط ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  pageWrapper: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 4,
  },
  surahHeader: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: HEADER_BG,
  },
  surahHeaderText: { fontSize: 18, color: TEXT, textAlign: 'center' },
  quranLine: {
    fontSize: 22,
    color: TEXT,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 40,
    width: '100%',
  },
  loadingText: { fontSize: 14, color: MUTED, textAlign: 'center' },
  errorText:   { fontSize: 14, color: '#C62828', textAlign: 'center' },
  mutedText:   { fontSize: 14, color: MUTED, textAlign: 'center' },
});
