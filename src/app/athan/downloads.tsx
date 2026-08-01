/**
 * src/app/athan/downloads.tsx — صفحة تحميل المزيد من الأصوات
 * مسار: /athan/downloads
 *
 * تعرض قائمة المؤذّنين القابلين للتحميل مع حالات:
 * Not downloaded / Downloading (مع شريط التقدم) / Downloaded / Failed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ArrowLeft, Download, Trash2, RefreshCw, Music, X } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';

import { downloadService }  from '@/features/athan/download-service';
import { downloadManager }  from '@/features/athan/download-manager';
import type { DownloadableMuezzin } from '@/features/athan/downloadable-muezzin-types';
import type { DownloadStatus }      from '@/features/athan/download-manager';

// ─── ثوابت التصميم (مطابقة لصفحة الأذان الرئيسية) ──────────────────────────
const BG       = '#FDFBF7';
const BORDER   = '#E0DBD3';
const TEXT     = '#1A1A1A';
const MUTED    = '#7A7A7A';
const PRIMARY  = '#1A5276';
const DIVIDER  = '#F0ECE6';
const PLAY_BG  = '#EAF2FB';
const SUCCESS  = '#1E8449';
const DANGER   = '#C0392B';
const DANGER_BG = '#FDEDEC';

// ─── دالة مساعدة: تنسيق حجم الملف ──────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

// ─── AthanDownloadsScreen ─────────────────────────────────────────────────────

export default function AthanDownloadsScreen() {
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold });

  const [voices,      setVoices]      = useState<DownloadableMuezzin[]>([]);
  /** خريطة الحالات المباشرة من DownloadManager (id → DownloadStatus) */
  const [statusMap,   setStatusMap]   = useState<Map<string, DownloadStatus>>(new Map());
  /** خريطة التقدم المباشرة من DownloadManager (id → 0–1) */
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  /** خريطة رسائل الخطأ (id → message) */
  const [errorMap,    setErrorMap]    = useState<Map<string, string>>(new Map());

  // FIX BUG 1: ref للتحقق من أن الـ component لا يزال mounted قبل كل setState
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── تحميل البيانات الأولية عند الدخول للشاشة ──────────────────────────────

  const refreshVoices = useCallback(async () => {
    const available = await downloadService.getAvailableVoices();
    // FIX BUG 1: لا نستدعي setState إذا غادر المستخدم الشاشة
    if (mounted.current) setVoices(available);
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => { await refreshVoices(); })();
    }, [refreshVoices]),
  );

  // ── الاشتراك في أحداث DownloadManager ────────────────────────────────────

  useEffect(() => {
    // تغييرات الحالة → تحديث statusMap + errorMap
    // FIX BUG 2: أزلنا IDLE من شرط refresh — handleDelete يتولى ذلك مباشرة
    // ليبقى refresh فقط عند COMPLETED لتحديث isDownloaded في voices
    const unsubStatus = downloadManager.onStatusChanged((event) => {
      if (!mounted.current) return;

      setStatusMap((prev) => {
        const next = new Map(prev);
        next.set(event.id, event.current);
        return next;
      });
      setErrorMap((prev) => {
        const next = new Map(prev);
        if (event.current === 'FAILED') {
          next.set(event.id, event.entry.errorMessage ?? 'فشل التحميل');
        } else {
          next.delete(event.id);
        }
        return next;
      });
      // إعادة تحميل القائمة عند اكتمال التحميل فقط (لتحديث isDownloaded)
      // FIX BUG 2: لا نُعيد التحميل عند IDLE لتجنب الاستدعاء المزدوج مع handleDelete
      if (event.current === 'COMPLETED') {
        (async () => { await refreshVoices(); })();
      }
    });

    // تحديثات التقدم → تحديث progressMap مباشرة (بدون AsyncStorage)
    const unsubProgress = downloadManager.onProgress((event) => {
      if (!mounted.current) return;
      setProgressMap((prev) => {
        const next = new Map(prev);
        next.set(event.id, event.progress);
        return next;
      });
    });

    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, [refreshVoices]);

  // ── معالجات الأحداث ───────────────────────────────────────────────────────

  const handleDownload = useCallback((id: string) => {
    // تشغيل التحميل بدون await — الـ UI يتحدث عبر subscription
    void downloadService.download(id);
  }, []);

  const handleCancel = useCallback((id: string) => {
    void downloadService.cancel(id);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await downloadService.delete(id);
    await refreshVoices();
  }, [refreshVoices]);

  const handleRetry = useCallback((id: string) => {
    void downloadService.download(id);
  }, []);

  // ── حساب الحالة الفعلية لكل مؤذّن ───────────────────────────────────────

  function getVoiceStatus(m: DownloadableMuezzin): DownloadStatus {
    const liveStatus = statusMap.get(m.id);
    if (liveStatus) return liveStatus;
    if (m.isDownloaded)  return 'COMPLETED';
    if (m.isDownloading) return 'DOWNLOADING';
    return 'IDLE';
  }

  function getVoiceProgress(m: DownloadableMuezzin): number {
    return progressMap.get(m.id) ?? m.progress;
  }

  // ── الخطوط ────────────────────────────────────────────────────────────────

  const font400 = fontsLoaded ? 'Cairo_400Regular' : undefined;
  const font600 = fontsLoaded ? 'Cairo_600SemiBold' : undefined;
  const font700 = fontsLoaded ? 'Cairo_700Bold'     : undefined;

  const isEmpty = voices.length === 0;

  // ─── الواجهة ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* شريط العنوان */}
      <PageHeader title="تحميل المزيد من الأصوات" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          /* ── حالة الكتالوج الفارغ ── */
          <View style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 32, paddingTop: 80,
          }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: PLAY_BG, alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Music size={28} color={PRIMARY} />
            </View>
            <Text style={{
              fontSize: 16, fontFamily: font600, color: TEXT,
              textAlign: 'center', marginBottom: 8,
            }}>
              سيتم إضافة المزيد من المؤذّنين قريباً
            </Text>
            <Text style={{
              fontSize: 13, fontFamily: font400, color: MUTED,
              textAlign: 'center', lineHeight: 20,
            }}>
              نعمل على توفير تسجيلات إضافية عالية الجودة
            </Text>
          </View>
        ) : (
          /* ── قائمة المؤذّنين القابلين للتحميل ── */
          <View style={{ marginTop: 12 }}>
            {voices.map((m) => {
              const status      = getVoiceStatus(m);
              const progress    = getVoiceProgress(m);
              const isDownloading = status === 'DOWNLOADING' || status === 'PENDING';
              const isDownloaded  = status === 'COMPLETED';
              const isFailed      = status === 'FAILED';
              const errorMsg      = errorMap.get(m.id);
              const progressPct   = Math.round(progress * 100);

              return (
                <View key={m.id}>
                  {/* ── صف المؤذّن ── */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    backgroundColor: isFailed ? DANGER_BG : BG,
                  }}>

                    {/* ── زر الإجراء (تحميل / إلغاء / حذف / إعادة محاولة) ── */}
                    {isDownloading ? (
                      /* أثناء التحميل: مؤشر دوار + زر إلغاء */
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 8 }}>
                        <ActivityIndicator size="small" color={PRIMARY} />
                        <Pressable
                          onPress={() => handleCancel(m.id)}
                          style={{
                            width: 28, height: 28, borderRadius: 14,
                            backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <X size={13} color={MUTED} />
                        </Pressable>
                      </View>
                    ) : isDownloaded ? (
                      /* محمَّل: زر حذف */
                      <Pressable
                        onPress={() => { void handleDelete(m.id); }}
                        style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: DANGER_BG, alignItems: 'center', justifyContent: 'center',
                          marginRight: 14,
                        }}
                      >
                        <Trash2 size={16} color={DANGER} />
                      </Pressable>
                    ) : isFailed ? (
                      /* فشل: زر إعادة المحاولة */
                      <Pressable
                        onPress={() => handleRetry(m.id)}
                        style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: DANGER_BG, alignItems: 'center', justifyContent: 'center',
                          marginRight: 14,
                        }}
                      >
                        <RefreshCw size={16} color={DANGER} />
                      </Pressable>
                    ) : (
                      /* غير محمَّل: زر تحميل */
                      <Pressable
                        onPress={() => handleDownload(m.id)}
                        style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: PLAY_BG, alignItems: 'center', justifyContent: 'center',
                          marginRight: 14,
                        }}
                      >
                        <Download size={16} color={PRIMARY} />
                      </Pressable>
                    )}

                    {/* ── اسم المؤذّن + تفاصيل ── */}
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontFamily: font600, color: TEXT, textAlign: 'right' }}>
                        {m.name}
                      </Text>

                      {isFailed ? (
                        /* رسالة الخطأ */
                        <Text style={{ fontSize: 11, fontFamily: font400, color: DANGER, textAlign: 'right', marginTop: 2 }}>
                          {errorMsg ?? 'فشل التحميل — اضغط للإعادة'}
                        </Text>
                      ) : isDownloaded ? (
                        /* حالة مكتملة */
                        <Text style={{ fontSize: 12, fontFamily: font400, color: SUCCESS, textAlign: 'right', marginTop: 2 }}>
                          تم التحميل
                        </Text>
                      ) : isDownloading ? (
                        /* نسبة التقدم */
                        <Text style={{ fontSize: 12, fontFamily: font400, color: PRIMARY, textAlign: 'right', marginTop: 2 }}>
                          {`جارٍ التحميل ${progressPct}%`}
                        </Text>
                      ) : (
                        /* الدولة + الحجم */
                        <Text style={{ fontSize: 12, fontFamily: font400, color: MUTED, textAlign: 'right', marginTop: 2 }}>
                          {[m.country, formatSize(m.size)].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* ── شريط التقدم (مرئي أثناء التحميل فقط) ── */}
                  {isDownloading && (
                    <View style={{ height: 3, backgroundColor: DIVIDER }}>
                      <View style={{
                        height: 3,
                        backgroundColor: PRIMARY,
                        width: `${progressPct}%`,
                      }} />
                    </View>
                  )}

                  <View style={{ height: 1, backgroundColor: DIVIDER }} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
