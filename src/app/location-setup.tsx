import React, { useEffect, useRef, useState } from 'react';
import { PAGE_HEADER_HEIGHT } from '@/components/PageHeader';
import { View, Text, Pressable, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useFonts, Cairo_400Regular, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { ScheherazadeNew_400Regular } from '@expo-google-fonts/scheherazade-new';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { MapPin, Globe } from 'lucide-react-native';
import { findNearestCity } from '@/lib/nearest-city';

/* ── لوحة الألوان (بدون تغيير) ── */
const BG         = '#F9F8F4';
const CARD_BG    = '#FFFFFF';
const CARD_SEL   = '#F2FAF4';
const TEXT       = '#1C1C1E';
const MUTED      = '#6B6B72';
const ACCENT     = '#3E6B47';
const DESC_COLOR = '#8A9E8E';
const GOLD       = '#C8A96E';
const BTN_GRAD: [string, string, string] = ['#3A6442', '#4A7C52', '#3A6442'];

export const SETUP_COMPLETED_KEY  = '@setup_completed';
export const LOCATION_LAT_KEY     = '@location_lat';
export const LOCATION_LNG_KEY     = '@location_lng';
export const LOCATION_COUNTRY_KEY = '@location_country';
export const LOCATION_CITY_KEY    = '@location_city';
type LocationOption = 'gps' | 'manual';

/* ── صورة المسجد: ImageRef من Splash إن كان جاهزاً، fallback لـ require ── */
import MOSQUE_IMG from '../../assets/images/mosque.jpg';
import { getImageRef } from '@/lib/image-refs';

const BTN_DUR = 130;
const easeOut = Easing.out(Easing.cubic);

/* ── بطاقة الاختيار (بدون تغيير) ── */
type CardProps = {
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  animStyle: object;
};
function OptionCard({ active, onPress, icon, title, desc, animStyle }: CardProps) {
  return (
    <Animated.View style={animStyle}>
      <Pressable onPress={onPress}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: active ? CARD_SEL : CARD_BG,
          borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18,
          gap: 14, overflow: 'hidden',
          boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: active ? 12 : 8,
            color: active ? 'rgba(62,107,71,0.10)' : 'rgba(0,0,0,0.05)' }],
        }}>
          {active && (
            <View style={{
              position: 'absolute', right: 0, top: 8, bottom: 8,
              width: 3.5, borderRadius: 2, backgroundColor: ACCENT,
            }} />
          )}
          <View style={{
            width: 22, height: 22, borderRadius: 11,
            borderWidth: active ? 0 : 1.5, borderColor: '#CCCCCC',
            backgroundColor: active ? ACCENT : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {active && <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FFF' }} />}
          </View>
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: active ? 'rgba(62,107,71,0.10)' : '#F2F2F7',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 15, color: TEXT, fontFamily: 'Cairo_700Bold',
              textAlign: 'right', marginBottom: 4,
            }}>
              {title}
            </Text>
            <Text style={{
              fontSize: 11.5, color: DESC_COLOR, fontFamily: 'Cairo_400Regular',
              textAlign: 'right', lineHeight: 18,
            }}>
              {desc}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function LocationSetupScreen() {
  /* ── [LIFECYCLE:mosque] مرحلة 1: إنشاء المكوّن ── */
  const lcT0 = useRef(performance.now()); // الزمن المطلق للـ render الأول

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_700Bold, ScheherazadeNew_400Regular });
  const [selected, setSelected]   = useState<LocationOption>('gps');
  const [loading, setLoading]     = useState(false);
  const [gpsError, setGpsError]   = useState<'perm_denied' | 'perm_permanent' | 'gps_failed' | null>(null);

  /* تسجيل وقت mount بعد أول commit */
  useEffect(() => {
    console.log(`[LIFECYCLE:mosque] [1] Component created+mounted: ${lcT0.current.toFixed(1)}ms (abs) | mount delta: ${(performance.now() - lcT0.current).toFixed(1)}ms`);
  }, []);

  /* من أين جاء المستخدم — لتحديد وجهة العودة بعد الحفظ */
  const { from } = useLocalSearchParams<{ from?: string }>();
  const returnPath = from === 'prayer-times' ? '/prayer-times' : '/';

  /* ── ارتفاعات الأقسام ── */
  // الصورة تأخذ 42% من ارتفاع الشاشة
  const heroH = height * 0.42;
  // العنوان يظهر فوق آخر 25% من الصورة → من أسفل الهيرو
  const titleBottom = heroH * 0.25;

  /* ── انيميشن الدخول المتدرج (العناصر النصية والبطاقات فقط) ── */
  const titleOpacity = useSharedValue(0);
  const titleTransY  = useSharedValue(12);
  const card1Opacity = useSharedValue(0);
  const card1TransY  = useSharedValue(12);
  const card2Opacity = useSharedValue(0);
  const card2TransY  = useSharedValue(12);
  const btnOpacity   = useSharedValue(0);

  useEffect(() => {
    /* الصورة تظهر مباشرة بدون animation — heroOpacity أُزيلت */
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 320, easing: easeOut }));
    titleTransY.value  = withDelay(200, withTiming(0, { duration: 320, easing: easeOut }));
    card1Opacity.value = withDelay(360, withTiming(1, { duration: 280, easing: easeOut }));
    card1TransY.value  = withDelay(360, withTiming(0, { duration: 280, easing: easeOut }));
    card2Opacity.value = withDelay(460, withTiming(1, { duration: 280, easing: easeOut }));
    card2TransY.value  = withDelay(460, withTiming(0, { duration: 280, easing: easeOut }));
    btnOpacity.value   = withDelay(560, withTiming(1, { duration: 280, easing: easeOut }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTransY.value }],
  }));
  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value, transform: [{ translateY: card1TransY.value }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value, transform: [{ translateY: card2TransY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));

  const btnScale = useSharedValue(1);
  const btnScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleContinue = async () => {
    if (selected === 'gps') {
      setGpsError(null);
      setLoading(true);
      try {
        // 1. فحص حالة الإذن الحالية أولاً
        const current = await Location.getForegroundPermissionsAsync();
        let isGranted = current.granted;

        if (!isGranted) {
          if (current.status === 'undetermined' || current.canAskAgain) {
            // يمكن طلب الإذن — اعرض نافذة النظام
            const requested = await Location.requestForegroundPermissionsAsync();
            isGranted = requested.granted;
            if (!isGranted) {
              // رُفض: تحقق إذا كان نهائياً
              setGpsError(requested.canAskAgain ? 'perm_denied' : 'perm_permanent');
              setLoading(false);
              return;
            }
          } else {
            // canAskAgain=false — رفض نهائي، وجّه لإعدادات الجهاز
            setGpsError('perm_permanent');
            setLoading(false);
            return;
          }
        }

        // 2. الحصول على الإحداثيات مع Timeout 15 ثانية
        const posPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        );
        const pos = await Promise.race([posPromise, timeoutPromise]);
        const { latitude, longitude } = pos.coords;

        // 3. Reverse Geocoding — مع fallback محلي عند الفشل
        let countryCode: string | null = null;
        let city = '';

        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          countryCode = geo?.isoCountryCode ?? null;
          city        = geo?.city ?? geo?.region ?? '';
        } catch {
          // reverseGeocode فشل (لا يوجد إنترنت أو خطأ في الخدمة)
        }

        // إذا فشل reverseGeocode أو لم يُعطِ countryCode → ابحث في قاعدة البيانات المحلية
        if (!countryCode) {
          const nearest = findNearestCity(latitude, longitude);
          countryCode   = nearest.countryCode;
          city          = nearest.cityName;
        } else if (!city) {
          // countryCode متوفر لكن city فارغة → اعتمد على أقرب مدينة من نفس الدولة
          const nearest = findNearestCity(latitude, longitude);
          city          = nearest.cityName;
        }

        // 4. حفظ البيانات في AsyncStorage
        await AsyncStorage.multiSet([
          [LOCATION_LAT_KEY,     String(latitude)],
          [LOCATION_LNG_KEY,     String(longitude)],
          [LOCATION_COUNTRY_KEY, countryCode],
          [LOCATION_CITY_KEY,    city],
          [SETUP_COMPLETED_KEY,  'true'],
        ]);

        router.replace(returnPath as import('expo-router').RelativePathString);
      } catch {
        // timeout أو فشل GPS
        setGpsError('gps_failed');
      } finally {
        setLoading(false);
      }
    }
    // خيار "يدوي" — فتح شاشة اختيار الدولة مع تمرير from
    if (selected === 'manual') {
      const fromParam = from === 'prayer-times' ? '&from=prayer-times' : '';
      router.push(`/country-select?${fromParam}` as import('expo-router').RelativePathString);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* ══════════════════════════════════════════
          Hero: الصورة + العنوان فوق آخر 25% منها
      ══════════════════════════════════════════ */}
      <View style={{ height: heroH, width }}>
        {/* الصورة تظهر مباشرة — source: ImageRef بعد Decode في Splash، fallback لـ require */}
        <Image
          source={getImageRef('mosque') ?? MOSQUE_IMG}
          style={{ width, height: heroH }}
          contentFit="cover"
          transition={0}
          onLoadStart={() => {
            const t = performance.now();
            console.log(`[LIFECYCLE:mosque] [2] onLoadStart FIRED (decode لم يتجاوَز): ${t.toFixed(1)}ms | +${(t - lcT0.current).toFixed(1)}ms after mount | source=${getImageRef('mosque') ? 'ImageRef' : 'require'}`);
          }}
          onLoad={() => {
            const t = performance.now();
            console.log(`[LIFECYCLE:mosque] [3] onLoad: ${t.toFixed(1)}ms | +${(t - lcT0.current).toFixed(1)}ms after mount | source=${getImageRef('mosque') ? 'ImageRef' : 'require'}`);
            requestAnimationFrame(() => {
              const tRaf = performance.now();
              console.log(`[LIFECYCLE:mosque] [4] rAF (first frame): ${tRaf.toFixed(1)}ms | +${(tRaf - lcT0.current).toFixed(1)}ms after mount`);
            });
          }}
        />
        {/* تدرج ناعم من الصورة نحو الخلفية (أسفل) */}
        <LinearGradient
          colors={['rgba(249,248,244,0)', 'rgba(249,248,244,0.6)', 'rgba(249,248,244,1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
        {/* تدرج أعلى لحماية أيقونات Status Bar */}
        <LinearGradient
          colors={['rgba(0,0,0,0.22)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + PAGE_HEADER_HEIGHT }}
        />

        {/* "السلام عليكم" فوق آخر 25% من الصورة */}
        <Animated.View style={[{
          position: 'absolute',
          bottom: titleBottom,
          left: 0, right: 0,
          alignItems: 'center',
        }, titleStyle]}>
          <Text style={{
            fontSize: 32, color: TEXT,
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
            fontWeight: fontsLoaded ? undefined : 'bold',
            textAlign: 'center',
          }}>
            السلام عليكم
          </Text>
        </Animated.View>
      </View>

      {/* ══════════════════════════════════════════
          المحتوى: بسملة + وصف + بطاقات + زر
          (لا تمرير — صفحة واحدة ثابتة)
      ══════════════════════════════════════════ */}
      <View style={{
        flex: 1,
        paddingHorizontal: 24,
        marginTop: -titleBottom + 4,   // ← ترفع البسملة لتبدأ أسفل "السلام عليكم" مباشرة
        paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 28,
        justifyContent: 'space-between',
      }}>

        {/* فاصل البسملة + الوصف */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            width: '100%', gap: 8,
          }}>
            <View style={{ flex: 1, height: 0.8, backgroundColor: '#DDD8D0' }} />
            <Text style={{ fontSize: 9, color: GOLD, lineHeight: 16 }}>◆</Text>
            <Text style={{
              fontSize: 21, color: '#AAAAAA',
              fontFamily: fontsLoaded ? 'ScheherazadeNew_400Regular' : undefined,
              includeFontPadding: false, lineHeight: 30, paddingHorizontal: 6,
            }}>
              بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
            </Text>
            <Text style={{ fontSize: 9, color: GOLD, lineHeight: 16 }}>◆</Text>
            <View style={{ flex: 1, height: 0.8, backgroundColor: '#DDD8D0' }} />
          </View>

          <Text style={{
            fontSize: 14.5, color: MUTED,
            fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
            textAlign: 'center', lineHeight: 26,
          }}>
            يحتاج التطبيق إلى معرفة موقعك{'\n'}لحساب مواقيت الصلاة بدقة.
          </Text>
        </View>

        {/* البطاقات */}
        <View style={{ gap: 12 }}>

          {/* رسالة الخطأ — مختلفة حسب نوع الفشل */}
          {gpsError && (
            <View style={{
              backgroundColor: '#FFF4F4',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: '#F5C0C0',
              gap: 8,
            }}>
              <Text style={{
                fontSize: 12.5,
                color: '#B34040',
                fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
                textAlign: 'center',
                lineHeight: 22,
              }}>
                {gpsError === 'perm_permanent'
                  ? 'تم رفض إذن الموقع نهائياً.\nيرجى فتح إعدادات الجهاز لمنح الإذن.'
                  : gpsError === 'perm_denied'
                  ? 'لم يتم منح إذن الموقع.\nاضغط متابعة مرة أخرى أو اختر الموقع يدويًا.'
                  : 'تعذّر تحديد موقعك، تأكد من تشغيل خدمة الموقع ثم حاول مرة أخرى، أو اختر الموقع يدويًا.'
                }
              </Text>

              {/* زر فتح الإعدادات — فقط عند الرفض النهائي */}
              {gpsError === 'perm_permanent' && (
                <Pressable
                  onPress={() => Linking.openSettings()}
                  style={{
                    backgroundColor: '#B34040',
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    color: '#FFFFFF',
                    fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
                    fontWeight: fontsLoaded ? undefined : 'bold',
                  }}>
                    فتح إعدادات الجهاز
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <OptionCard
            active={selected === 'gps'}
            onPress={() => { setSelected('gps'); setGpsError(null); }}
            icon={<MapPin size={19} color={selected === 'gps' ? ACCENT : '#999'} />}
            title="استخدام موقعي الحالي"
            desc="تحديد دقيق لمواقيت الصلاة والتنبيهات حسب موقعك."
            animStyle={card1Style}
          />
          <OptionCard
            active={selected === 'manual'}
            onPress={() => { setSelected('manual'); setGpsError(null); }}
            icon={<Globe size={19} color={selected === 'manual' ? ACCENT : '#999'} />}
            title="تحديد الموقع يدويًا"
            desc="اختر مدينتك أو موقعك يدويًا إذا كنت لا ترغب باستخدام الموقع الحالي."
            animStyle={card2Style}
          />
        </View>

        {/* زر المتابعة */}
        <Animated.View style={[btnStyle, btnScaleStyle, {
          borderRadius: 16, overflow: 'hidden',
          boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 18, color: 'rgba(40,90,50,0.20)' }],
        }]}>
          <Pressable
            onPress={loading ? undefined : handleContinue}
            onPressIn={() => { if (!loading) btnScale.value = withTiming(0.97, { duration: BTN_DUR }); }}
            onPressOut={() => { btnScale.value = withTiming(1, { duration: BTN_DUR }); }}
          >
            <LinearGradient
              colors={BTN_GRAD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            >
              {loading && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={{
                fontSize: 17, color: '#FFFFFF',
                fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
                fontWeight: fontsLoaded ? undefined : 'bold',
                letterSpacing: 0.3,
              }}>
                {loading ? 'جارٍ تحديد الموقع…' : 'متابعة'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

      </View>
    </View>
  );
}

