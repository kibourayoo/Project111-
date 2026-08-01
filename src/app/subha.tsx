import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Cairo_700Bold } from '@expo-google-fonts/cairo';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Menu, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react-native';
import PageHeader from '@/components/PageHeader';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdhkar } from '@/lib/adhkar-context';

import BEAD_IMG from '../../assets/images/bead.png';
import { getImageRef } from '@/lib/image-refs';

const BG   = '#FDFBF7';
const TEXT = '#1A1A1A';

/* ── حساب y على منحنى بيزيه التكعيبي (worklet) ── */
function cubicBez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  'worklet';
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

function getYAtX(targetX: number, W: number, H: number): number {
  'worklet';
  const cx = Math.max(0, Math.min(W, targetX));
  const s1x0 = 0,        s1x1 = W*0.25, s1x2 = W*0.62, s1x3 = W*0.88;
  const s1y0 = H*0.10,   s1y1 = H*0.10, s1y2 = H*0.44, s1y3 = H*0.46;
  const s2x0 = W*0.88,   s2x1 = W*0.93, s2x2 = W*0.97, s2x3 = W;
  const s2y0 = H*0.46,   s2y1 = H*0.46, s2y2 = H*0.45, s2y3 = H*0.444;
  const inSeg1 = cx <= W * 0.88;
  const x0 = inSeg1 ? s1x0 : s2x0;
  const x1 = inSeg1 ? s1x1 : s2x1;
  const x2 = inSeg1 ? s1x2 : s2x2;
  const x3 = inSeg1 ? s1x3 : s2x3;
  const y0 = inSeg1 ? s1y0 : s2y0;
  const y1 = inSeg1 ? s1y1 : s2y1;
  const y2 = inSeg1 ? s1y2 : s2y2;
  const y3 = inSeg1 ? s1y3 : s2y3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) * 0.5;
    if (cubicBez(mid, x0, x1, x2, x3) < cx) { lo = mid; } else { hi = mid; }
  }
  return cubicBez((lo + hi) * 0.5, y0, y1, y2, y3);
}

const BEAD_R    = 20;
const D         = BEAD_R * 2;  // قطر الخرزة
const SPACING   = 52;
const THRESHOLD = 60;   // حد السحب لتفعيل الخطوة (px)
const DUR_EXIT  = 220;  // مدة خروج الخرزة يميناً (ms)
const DUR_ENTER = 220;  // مدة الدخول من اليسار (ms)

/* إعدادات الـ Spring: سريع وناعم بدون اهتزاز */
const SPRING = { damping: 18, stiffness: 220, mass: 0.8, overshootClamping: true };

const STORAGE_KEY = 'subha_count';

export default function SubhaScreen() {
  /* ── [LIFECYCLE:bead] مرحلة 1: إنشاء المكوّن ── */
  const lcT0 = useRef(performance.now());

  const { width: W, height } = useWindowDimensions();
  const H         = height * 0.25;
  const regionTop = height * 0.60;

  /* ── الخط ── */
  const [fontsLoaded] = useFonts({ Cairo_700Bold });

  /* ── العداد ── */
  const [count, setCount] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const popScale = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: popScale.value }] }));

  /* ── الذكر الحالي (من السياق المشترك) ── */
  const { adhkar } = useAdhkar();
  const [dhikrIndex, setDhikrIndex] = useState(0);
  /* تأكد من أن الفهرس لا يتجاوز حدود القائمة عند تغيّر الترتيب */
  const safeIndex = Math.min(dhikrIndex, adhkar.length - 1);

  /* تحميل العداد المحفوظ + تسجيل وقت mount */
  useEffect(() => {
    console.log(`[LIFECYCLE:bead] [1] Component created+mounted: ${lcT0.current.toFixed(1)}ms (abs) | mount delta: ${(performance.now() - lcT0.current).toFixed(1)}ms`);
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCount(parseInt(stored, 10));
    })();
  }, []);

  /* ── مواضع الـ 6 خانات ── */
  const slot0X = -BEAD_R * 0.6;
  const slot3X = slot0X + SPACING * 3;
  const slot5X = W - BEAD_R - 8;
  const slot4X = slot5X - SPACING;
  const SLOTS  = [
    slot0X,
    slot0X + SPACING,
    slot0X + SPACING * 2,
    slot3X,
    slot4X,
    slot5X,
  ];

  /* ── SharedValue واحدة لكل خرزة (x فقط) ── */
  const x0 = useSharedValue(SLOTS[0]);
  const x1 = useSharedValue(SLOTS[1]);
  const x2 = useSharedValue(SLOTS[2]);
  const x3 = useSharedValue(SLOTS[3]);
  const x4 = useSharedValue(SLOTS[4]);
  const x5 = useSharedValue(SLOTS[5]);
  const allX = [x0, x1, x2, x3, x4, x5];

  /* ── y مشتق من x على الـ UI Thread (worklet) ── */
  const y0 = useDerivedValue(() => getYAtX(x0.value, W, H));
  const y1 = useDerivedValue(() => getYAtX(x1.value, W, H));
  const y2 = useDerivedValue(() => getYAtX(x2.value, W, H));
  const y3 = useDerivedValue(() => getYAtX(x3.value, W, H));
  const y4 = useDerivedValue(() => getYAtX(x4.value, W, H));
  const y5 = useDerivedValue(() => getYAtX(x5.value, W, H));

  /* ── useAnimatedStyle لكل خرزة ── */
  const style0 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x0.value - BEAD_R, top: y0.value - BEAD_R, width: D, height: D }));
  const style1 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x1.value - BEAD_R, top: y1.value - BEAD_R, width: D, height: D }));
  const style2 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x2.value - BEAD_R, top: y2.value - BEAD_R, width: D, height: D }));
  const style3 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x3.value - BEAD_R, top: y3.value - BEAD_R, width: D, height: D }));
  const style4 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x4.value - BEAD_R, top: y4.value - BEAD_R, width: D, height: D }));
  const style5 = useAnimatedStyle(() => ({ position: 'absolute' as const, left: x5.value - BEAD_R, top: y5.value - BEAD_R, width: D, height: D }));
  const beadStyles = [style0, style1, style2, style3, style4, style5];

  /* ── الطابور الدائري (JS Thread refs) ── */
  const beadAtSlot  = useRef<number[]>([0, 1, 2, 3, 4, 5]);
  const isAnimating = useRef(false);

  /*
   * ── خطوة الدوران الكامل (Circular Rotation) ──
   * كل سحبة → كل الخرزات تتحرك خانة واحدة يميناً (UI Thread: withSpring)
   * الخرزة في slot5 تخرج يميناً ثم تعود لتحتل slot0
   *
   *   قبل : [A:half] [B:1] [C:2] [D:3] ---- [E:4] [F:5]
   *   بعد : [F:half] [A:1] [B:2] [C:3] ---- [D:4] [E:5]
   */
  const triggerStep = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const slots = [...beadAtSlot.current];
    const exitId = slots[5];  // الخرزة التي ستخرج وتلتف

    /* خرزات 0-4: كل منها تنتقل إلى الخانة التالية بـ withSpring */
    for (let i = 0; i < 5; i++) {
      allX[slots[i]].value = withSpring(SLOTS[i + 1], SPRING);
    }

    /* خرزة slot5: تخرج يميناً بـ withTiming سريع */
    allX[exitId].value = withTiming(
      W + BEAD_R * 3,
      { duration: DUR_EXIT, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;
        /* تقفز خارج الشاشة يساراً (غير مرئية) */
        allX[exitId].value = -BEAD_R * 3;
        /* تدخل بـ withSpring ناعماً إلى slot0 */
        allX[exitId].value = withSpring(SLOTS[0], SPRING, (done) => {
          'worklet';
          if (!done) return;
          /* تحديث الطابور على JS Thread */
          runOnJS(completeStep)(slots);
        });
      }
    );
  };

  const completeStep = (slots: number[]) => {
    /* right-rotation: [s5, s0, s1, s2, s3, s4] */
    beadAtSlot.current = [slots[5], slots[0], slots[1], slots[2], slots[3], slots[4]];
    isAnimating.current = false;
    /* تحديث العداد بعد اكتمال الحركة تماماً */
    setCount(prev => {
      const next = prev + 1;
      AsyncStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
    /* Pop animation خفيف */
    popScale.value = withSequence(
      withTiming(1.08, { duration: 70 }),
      withTiming(1.00, { duration: 80 })
    );
  };

  const handleReset = () => {
    setCount(0);
    AsyncStorage.setItem(STORAGE_KEY, '0');
    setShowReset(false);
  };

  /* ── Gesture.Pan: سحبة > THRESHOLD تُفعّل خطوة واحدة ── */
  const gesture = Gesture.Pan()
    .onEnd((e) => {
      if (Math.abs(e.translationX) >= THRESHOLD) {
        runOnJS(triggerStep)();
      }
    });

  /* مسار الخيط (ثابت) */
  const wavePath =
    `M 0 ${H * 0.10}` +
    ` C ${W * 0.25} ${H * 0.10},` +
    `   ${W * 0.62} ${H * 0.44},` +
    `   ${W * 0.88} ${H * 0.46}` +
    ` C ${W * 0.93} ${H * 0.46},` +
    `   ${W * 0.97} ${H * 0.45},` +
    `   ${W} ${H * 0.444}`;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />

      {/* ─── شريط العنوان ─── */}
      <PageHeader
        title="السبحة"
        right={
          <Pressable onPress={() => router.push('/subha-settings' as never)} style={{ padding: 8, marginRight: -8 }}>
            <Menu size={22} color={TEXT} />
          </Pressable>
        }
      />

      {/* ─── صف الذكر (فوق السبحة) ─── */}
      <View style={{
        position: 'absolute',
        top: height * 0.16,
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 12,
      }}>
        {/* سهم يسار — السابق */}
        <Pressable
          onPress={() => setDhikrIndex(i => i - 1)}
          hitSlop={12}
          style={{ opacity: safeIndex === 0 ? 0 : 1 }}
          disabled={safeIndex === 0}
        >
          <ChevronLeft size={24} color={TEXT} />
        </Pressable>

        <Text style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
          fontWeight: fontsLoaded ? undefined : 'bold',
          fontSize: 22,
          color: TEXT,
        }}>
          {adhkar[safeIndex]}
        </Text>

        {/* سهم يمين — التالي */}
        <Pressable
          onPress={() => setDhikrIndex(i => i + 1)}
          hitSlop={12}
          style={{ opacity: safeIndex === adhkar.length - 1 ? 0 : 1 }}
          disabled={safeIndex === adhkar.length - 1}
        >
          <ChevronRight size={24} color={TEXT} />
        </Pressable>
      </View>

      {/* ─── منطقة السحب (Gesture.Pan) ─── */}
      <GestureDetector gesture={gesture}>
        <View
          style={{ position: 'absolute', top: height * 0.45, left: 0, width: W, height: height * 0.45 }}
        />
      </GestureDetector>

      {/* ─── المنحنى والخرزات ─── */}
      <View
        style={{
          position: 'absolute', top: regionTop, left: 0,
          width: W, height: H, overflow: 'visible',
        }}
        pointerEvents="none"
      >
        {/* الخيط داخل SVG */}
        <Svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Path
            d={wavePath}
            stroke="#1A1A1A"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {/* الخرزات: Animated.View من reanimated + صورة PNG */}
        {beadStyles.map((animStyle, i) => (
          <Animated.View key={i} style={animStyle}>
            <Image
              source={getImageRef('bead') ?? BEAD_IMG}
              style={{ width: D, height: D }}
              contentFit="contain"
              transition={0}
              onLoadStart={i === 0 ? () => {
                const t = performance.now();
                console.log(`[LIFECYCLE:bead] [2] onLoadStart (decode begins): ${t.toFixed(1)}ms | +${(t - lcT0.current).toFixed(1)}ms after mount`);
              } : undefined}
              onLoad={i === 0 ? () => {
                const t = performance.now();
                console.log(`[LIFECYCLE:bead] [3] onLoad (decode complete):   ${t.toFixed(1)}ms | +${(t - lcT0.current).toFixed(1)}ms after mount`);
                requestAnimationFrame(() => {
                  const tRaf = performance.now();
                  console.log(`[LIFECYCLE:bead] [4] rAF (first frame painted): ${tRaf.toFixed(1)}ms | +${(tRaf - lcT0.current).toFixed(1)}ms after mount`);
                });
              } : undefined}
            />
          </Animated.View>
        ))}
      </View>

      {/* ─── العداد ─── */}
      <View style={{
        position: 'absolute',
        top: regionTop + H - 60,
        left: 0, right: 0,
        alignItems: 'center',
        gap: 12,
      }}>
        {/* الرقم مع Pop Animation */}
        <Animated.View style={popStyle}>
          <Text style={{
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
            fontWeight: fontsLoaded ? undefined : 'bold',
            fontSize: Math.min(Math.max(height * 0.075, 56), 64),
            color: TEXT,
            lineHeight: Math.min(Math.max(height * 0.075, 56), 64) * 1.1,
          }}>
            {count}
          </Text>
        </Animated.View>

        {/* زر التصفير */}
        <Pressable
          onPress={() => setShowReset(true)}
          style={{ alignItems: 'center', gap: 4, padding: 8 }}
          hitSlop={12}
        >
          <Text style={{
            fontFamily: fontsLoaded ? 'Cairo_700Bold' : undefined,
            fontWeight: fontsLoaded ? undefined : 'bold',
            fontSize: 13,
            color: TEXT,
            opacity: 0.4,
          }}>
            تصفير العداد
          </Text>
          <RotateCcw size={16} color={TEXT} style={{ opacity: 0.4 }} />
        </Pressable>
      </View>

      {/* ─── مربع تأكيد التصفير ─── */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تصفير العداد</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إعادة العداد إلى الصفر؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowReset(false)}>
              إلغاء
            </AlertDialogCancel>
            <Pressable
              onPress={handleReset}
              className="bg-destructive rounded-lg h-10 px-4 items-center justify-center active:opacity-80"
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                تصفير
              </Text>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
