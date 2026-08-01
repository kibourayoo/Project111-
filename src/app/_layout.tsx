import * as Sentry from '@sentry/react-native';
import { Stack, router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AdhkarProvider } from '@/lib/adhkar-context';
import { useEffect, useRef, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import { ScheherazadeNew_400Regular } from '@expo-google-fonts/scheherazade-new';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import { registerImageRef } from '@/lib/image-refs';
import "../global.css";

/* ── أصول دوائر الصلوات ── */
import imgFajr    from '../../assets/images/prayers/fajr.png';
import imgShuruq  from '../../assets/images/prayers/shuruq.png';
import imgDhuhr   from '../../assets/images/prayers/dhuhr.png';
import imgAsr     from '../../assets/images/prayers/asr.png';
import imgMaghrib from '../../assets/images/prayers/maghrib.png';
import imgIsha    from '../../assets/images/prayers/isha.png';
/* ── أصول السبحة ── */
import imgBead from '../../assets/images/bead.png';
/* ── أصول شاشة الإقلاع ── */
import splashCardImg from '../../assets/images/splash_card.webp';
import imgMosque from '../../assets/images/mosque.jpg';
/* ── أصول شاشة الدعاء ── */
import imgSunnah from '../../assets/images/duaa/sunnah.png';
import imgQuran  from '../../assets/images/duaa/quran.png';
import imgHaajah from '../../assets/images/duaa/haajah.png';
import imgMufad  from '../../assets/images/duaa/mufad.png';

/* ── لون خلفية Splash — مطابق لـ app.json و BG التطبيق ── */
const SPLASH_BG = '#FDFBF7';

/* ── بطاقة Splash المخصصة — تظهر أثناء تحميل الموارد ── */
function SplashOverlay() {
  const { width } = useWindowDimensions();
  const cardSize = width * 0.468;
  return (
    <View style={{
      flex: 1,
      backgroundColor: SPLASH_BG,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    }}>
      <ExpoImage
        source={splashCardImg}
        style={{ width: cardSize, height: cardSize }}
        contentFit="contain"
        transition={0}
      />
      {/* الشعار */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{
          fontFamily: 'Cairo_700Bold',
          fontSize: 22,
          color: '#3B2A1A',
          letterSpacing: 0.5,
        }}>
          سَبيل
        </Text>
        <Text style={{
          fontFamily: 'Cairo_400Regular',
          fontSize: 15,
          color: '#7A6650',
          letterSpacing: 0.3,
        }}>
          سبيلك إلى النور
        </Text>
      </View>
    </View>
  );
}

/* ── جميع الصور الأساسية التي يجب تحميلها قبل أول Frame ── */
/* المرحلة 2 فقط (دعاء) — المرحلة 1 تُحمَّل عبر Image.loadAsync أدناه */
const PRELOAD_ASSETS_PHASE2 = [
  /* شاشة الدعاء: 4 صور */
  imgSunnah, imgQuran, imgHaajah, imgMufad,
];

/* خريطة المرحلة 1: 8 صور ستُحمَّل عبر Image.loadAsync (decode كامل أثناء Splash) */
const PHASE1_IMAGES = [
  /* شاشة الإعداد الأول */
  ['mosque',    imgMosque   ],
  /* دوائر الصلوات: 6 صور */
  ['fajr',      imgFajr     ],
  ['shuruq',    imgShuruq   ],
  ['dhuhr',     imgDhuhr    ],
  ['asr',       imgAsr      ],
  ['maghrib',   imgMaghrib  ],
  ['isha',      imgIsha     ],
  /* السبحة */
  ['bead',      imgBead     ],
] as const;

/* ──────────────────────────────────────────────────────────
   preventAutoHideAsync يُستدعى على مستوى الوحدة (قبل أي render)
   حتى تبقى شاشة Splash ظاهرة حتى نستدعي hideAsync بأنفسنا.
   ────────────────────────────────────────────────────────── */
SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const RootLayout: React.FC = () => {
  /* ── 1. تحميل جميع الخطوط المستخدمة في التطبيق ── */
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_700Bold,
    ScheherazadeNew_400Regular,
  });

  /* ── 2. تحميل الصور المحلية الأساسية + قراءة حالة الإعداد الأولي ── */
  const [assetsReady, setAssetsReady] = useState(false);
  /* نتيجة فحص الإعداد — ref لتجنب إعادة Render إضافية */
  const setupDoneRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const tAll0 = performance.now();

      /* ── المرحلة 1: Image.loadAsync بالتوازي لجميع الـ 8 صور ──
         يُجري Decode كامل (UIImage/Drawable) أثناء Splash قبل أي render */
      await Promise.all(
        PHASE1_IMAGES.map(async ([key, module]) => {
          const ref = await ExpoImage.loadAsync(module);
          registerImageRef(key, ref);
        })
      );
      console.log(`[LIFECYCLE:splash] Phase-1 (8 images) Image.loadAsync done: ${(performance.now() - tAll0).toFixed(1)}ms`);

      /* ── المرحلة 2: Asset.loadAsync للأذكار والدعاء + AsyncStorage بالتوازي ── */
      const tPhase2 = performance.now();
      const [, setupDone] = await Promise.all([
        Asset.loadAsync(PRELOAD_ASSETS_PHASE2),
        AsyncStorage.getItem('@setup_completed'),
      ]);
      console.log(`[LIFECYCLE:splash] Phase-2 (4 assets + AsyncStorage): ${(performance.now() - tPhase2).toFixed(1)}ms`);
      console.log(`[LIFECYCLE:splash] TOTAL Splash preload: ${(performance.now() - tAll0).toFixed(1)}ms`);

      setupDoneRef.current = setupDone;
      setAssetsReady(true);
    })();
  }, []);

  /* ── 3. إخفاء Splash بعد اكتمال جميع موارد التهيئة ── */
  const appReady = (fontsLoaded || fontError != null) && assetsReady;

  useEffect(() => {
    if (!appReady) return;
    SplashScreen.hideAsync();
    /* توجيه المستخدم الجديد مباشرةً — بعد mount الـ Stack وليس قبله */
    if (!setupDoneRef.current) {
      router.replace('/location-setup' as RelativePathString);
    }
  }, [appReady]);

  /* ── 4. شاشة الإقلاع المخصصة — تظهر أثناء التحميل ── */
  if (!appReady) {
    return <SplashOverlay />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AdhkarProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="subha" />
          <Stack.Screen name="subha-settings" />
          <Stack.Screen name="adhkar-manager" />
        <Stack.Screen name="add-dhikr" />
        <Stack.Screen name="edit-dhikr" />
          <Stack.Screen name="athan" />
          <Stack.Screen name="athan/downloads" />
          <Stack.Screen name="azkar" />
          <Stack.Screen name="azkar/index" />
          <Stack.Screen name="azkar/masaa" />
          <Stack.Screen name="azkar/sobh" />
          <Stack.Screen name="azkar/istiqaz" />
          <Stack.Screen name="azkar/nawm" />
          <Stack.Screen name="azkar/badalsalah" />
          <Stack.Screen name="azkar/athan" />
          <Stack.Screen name="duaa" />
          <Stack.Screen name="duaa/index" />
        <Stack.Screen name="location-setup" />
          <Stack.Screen name="country-select" />
          <Stack.Screen name="city-select" />
          <Stack.Screen name="prayer-times" />
          <Stack.Screen name="prayer-times-settings" />
          <Stack.Screen name="feature/[name]" />
          <Stack.Screen
            name="qibla"
            options={{
              title: 'القبلة',
              headerStyle: { backgroundColor: '#FDFBF7' },
              headerTintColor: '#5C4A2A',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          />
          <Stack.Screen
            name="sensor-debug"
            options={{
              title: '🔬 Sensor Debug',
              headerStyle: { backgroundColor: '#FDFBF7' },
              headerTintColor: '#5C4A2A',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          />
        </Stack>
        <PortalHost />
      </AdhkarProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
