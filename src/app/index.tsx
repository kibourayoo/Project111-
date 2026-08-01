import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Cairo_400Regular } from '@expo-google-fonts/cairo';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import Svg, { Circle, Path, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import HERO_BG from '../../assets/images/hero_bg.webp';
import { usePrayerTimes, prayerKey } from '@/lib/use-prayer-times';
import { useHeroCountdown } from '@/lib/use-hero-countdown';
import { gregorianToHijri, HIJRI_MONTHS, AR_DAY_NAMES } from '@/lib/hijri';
import React from 'react';
import QuranIcon from '../components/QuranIcon';
import PrayerHandsIcon from '../components/PrayerHandsIcon';
import BookWithLeavesIcon from '../components/BookWithLeavesIcon';
import MisbahaIcon from '../components/MisbahaIcon';
import CalendarIcon from '../components/CalendarIcon';
import ClockIcon from '../components/ClockIcon';
import AzanHomeIcon from '../components/AzanHomeIcon';
import { mushafFontService } from '@/features/mushaf/mushaf-font-service';
import QiblaIcon from '../components/QiblaIcon';
import IslamicElementIcon from '../components/IslamicElementIcon';
import MoreHorizontalIcon from '../components/MoreHorizontalIcon';

import FAJR_IMG      from '../../assets/images/prayers/fajr.png';
import SHURUQ_IMG    from '../../assets/images/prayers/shuruq.png';
import DHUHR_IMG     from '../../assets/images/prayers/dhuhr.png';
import ASR_IMG       from '../../assets/images/prayers/asr.png';
import MAGHRIB_IMG   from '../../assets/images/prayers/maghrib.png';
import ISHA_IMG      from '../../assets/images/prayers/isha.png';
import { getImageRef } from '@/lib/image-refs';
import type { SharedRefType } from 'expo';

/* نوع الـ source المدعوم من expo-image: رقم (require) أو ImageRef */
type ImgSrc = number | SharedRefType<'image'>;

/* أيقونات SVG للدوائر */
type CircleIcon = React.ComponentType<{ size: number }>;
const SVG_ICON_MAP: Record<string, CircleIcon> = {
  'المصحف': QuranIcon,
  'الدعاء': PrayerHandsIcon,
  'الأذكار': BookWithLeavesIcon,
  'السبحة': MisbahaIcon,
  'التقويم': CalendarIcon,
  'المواقيت': ClockIcon,
  'الأذان': AzanHomeIcon,
  'القبلة': QiblaIcon,
  'تحديات': IslamicElementIcon,
  'المزيد': MoreHorizontalIcon,
};

/* دوائر الصلوات: ImageRef إن كان جاهزاً، fallback لـ require */
const PRAYER_IMG_MAP: Record<string, ImgSrc> = {
  'الفجر':   getImageRef('fajr')     ?? FAJR_IMG,
  'الشروق':  getImageRef('shuruq')   ?? SHURUQ_IMG,
  'الظهر':   getImageRef('dhuhr')    ?? DHUHR_IMG,
  'العصر':   getImageRef('asr')      ?? ASR_IMG,
  'المغرب':  getImageRef('maghrib')  ?? MAGHRIB_IMG,
  'العشاء':  getImageRef('isha')     ?? ISHA_IMG,
};

export default function BlankScreen() {
  const { width, height: screenHeight } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ Cairo_400Regular });
  const { prayers, prayerDates } = usePrayerTimes();
  const heroCountdown = useHeroCountdown(prayerDates ?? null);

  /* ── التواريخ الحقيقية (تُحسب مرة واحدة عند الرندر — ثابتة خلال اليوم) ── */
  const AR_MONTHS_GR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const today       = new Date();
  const hijri       = gregorianToHijri(today);
  const hijriDay    = hijri.day.toLocaleString('ar-EG'); // أرقام عربية
  const hijriMonth  = HIJRI_MONTHS[hijri.month - 1] ?? '';
  const hijriYear   = hijri.year;
  const dayName     = AR_DAY_NAMES[today.getDay()] ?? '';
  const hijriStr    = `${dayName} ${hijriDay} ${hijriMonth} ${hijriYear} هـ`;
  const gregorianStr = `${today.getDate()} ${AR_MONTHS_GR[today.getMonth()]} ${today.getFullYear()} م`;  const curveDepth = 18;
  const padding = 24;
  const tipWidth = width * 0.06;
  const svgWidth = width + padding * 2;
  const svgHeight = curveDepth + 4;

  // viewBox يبدأ من -padding حتى تظهر أجزاء المسار السالبة (off-screen) بشكل صحيح
  const viewBox = `${-padding} 0 ${svgWidth} ${svgHeight}`;

  // الخط: ينزل من الحافة اليسرى، يرتفع إلى مستوى الخط المستقيم، ثم ينزل في الحافة اليمنى
  const d = [
    `M ${-padding} ${curveDepth}`,
    `Q 0 0 ${tipWidth} 0`,
    `L ${width - tipWidth} 0`,
    `Q ${width} 0 ${width + padding} ${curveDepth}`,
  ].join(' ');

  // الدوائر تملأ عرض الشاشة: 6 دوائر + 5 فراغات بينها (الفراغ = نصف قطر الدائرة)
  const edgePadding = 16;
  const usableWidth = width - edgePadding * 2;
  // 6*(2r) + 5*(r) = usableWidth  →  17r = usableWidth
  const circleRadius = usableWidth / 17;
  const circleGap = circleRadius; // الفراغ بين الدوائر = نصف القطر
  const circlesStartX = edgePadding + circleRadius;
  const circlesY = circleRadius + 1;
  const circlesSvgHeight = circleRadius * 2 + 2;
  const circleColor = '#DDD8CF';
  const circleStrokeWidth = 0.7;

  // أسماء الصلوات: من اليسار الفيزيائي إلى اليمين (SVG يرسم LTR)
  // اليمين = الفجر ، اليسار = العشاء
  const prayerNames = ['العشاء', 'المغرب', 'العصر', 'الظهر', 'الشروق', 'الفجر'];
  const labelFontSize = 11;
  const labelHeight = labelFontSize + 6;
  const labelGap = 4;

  // heroTopPx: نقطة بداية العناصر أسفل البطاقة — نفس القيمة المستخدمة في SVG
  // يحل مشكلة التشوه الناتجة عن تعارض pixel (SVG) مع percentage ('30%') في Layout
  const heroTopPx = screenHeight * 0.30;

  // حساب أبعاد صورة Hero يدويًا (cover + محاذاة من الأسفل = القص من الأعلى)
  // الصورة الأصلية: 1536×851 بكسل
  const HERO_IMG_W = 1536;
  const HERO_IMG_H = 851;
  const heroBgCardH = screenHeight * 0.30 + curveDepth + 4;
  const heroBgScale = Math.max(width / HERO_IMG_W, heroBgCardH / HERO_IMG_H);
  const heroBgRenderW = HERO_IMG_W * heroBgScale;
  const heroBgRenderH = HERO_IMG_H * heroBgScale;
  // محاذاة أفقية: وسط  |  محاذاة رأسية: الأسفل (القص من الأعلى)
  const heroBgX = (width - heroBgRenderW) / 2;
  const heroBgY = heroBgCardH - heroBgRenderH;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* ─── Hero Card + Curved Bottom ─────────────────────────────────────────
          SVG واحد يرسم شكل البطاقة بالصورة كخلفية.
          ClipPath يقيّد الصورة بحدود البطاقة بالضبط — لا فراغات، لا تأثيرات.
      ─────────────────────────────────────────────────────────────────────── */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={width}
        height={screenHeight * 0.30 + curveDepth + 4}
      >
        <Defs>
          <ClipPath id="heroClip">
            <Path
              d={[
                `M 0 0`,
                `L ${width} 0`,
                `L ${width} ${screenHeight * 0.30 + curveDepth}`,
                `Q ${width} ${screenHeight * 0.30} ${width - tipWidth} ${screenHeight * 0.30}`,
                `L ${tipWidth} ${screenHeight * 0.30}`,
                `Q 0 ${screenHeight * 0.30} 0 ${screenHeight * 0.30 + curveDepth}`,
                `Z`,
              ].join(' ')}
            />
          </ClipPath>
        </Defs>
        {/* الصورة مقيّدة بشكل البطاقة — cover محسوب يدويًا، محاذاة من الأسفل */}
        <SvgImage
          href={HERO_BG}
          x={heroBgX}
          y={heroBgY}
          width={heroBgRenderW}
          height={heroBgRenderH}
          clipPath="url(#heroClip)"
        />
        {/* حد البطاقة فوق الصورة */}
        <Path
          d={[
            `M 0 0`,
            `L ${width} 0`,
            `L ${width} ${screenHeight * 0.30 + curveDepth}`,
            `Q ${width} ${screenHeight * 0.30} ${width - tipWidth} ${screenHeight * 0.30}`,
            `L ${tipWidth} ${screenHeight * 0.30}`,
            `Q 0 ${screenHeight * 0.30} 0 ${screenHeight * 0.30 + curveDepth}`,
            `Z`,
          ].join(' ')}
          fill="none"
          stroke={circleColor}
          strokeWidth={0.8}
        />
      </Svg>

      {/* ─── Hero Info Overlay (بيانات ثابتة — يسار البطاقة) ───────────────────
          تُعرض فوق صورة المسجد، بدون أي منطق أو hooks.
      ─────────────────────────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: width * 0.65,
          height: heroTopPx,
          justifyContent: 'center',
          paddingLeft: 22,
          paddingBottom: 8,
        }}
        pointerEvents="none"
      >
        {/* تسمية + عداد — مُغلَّفَان في View بعرض تلقائي حتى تتمحور التسمية فوق يمين العداد */}
        <View style={{ alignSelf: 'flex-start' }}>
          {/* تسمية الصلاة القادمة — فوق الجهة اليمنى للعداد */}
          <Text
            style={{
              fontFamily: 'Cairo_400Regular',
              fontSize: 13,
              color: '#2B2B2B',
              textAlign: 'right',
              textShadowColor: 'rgba(255,255,255,0.4)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
              marginBottom: 2,
            }}
          >
          {heroCountdown?.prayerName ?? 'العصر'} {heroCountdown?.mode ?? 'بعد'}
          </Text>

          {/* العداد التنازلي — أكبر عنصر */}
          <Text
            style={{
              fontFamily: 'Cairo_400Regular',
              fontSize: 42,
              fontWeight: '700',
              color: '#1E2D3D',
              textAlign: 'left',
              letterSpacing: 1,
              textShadowColor: 'rgba(255,255,255,0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
              lineHeight: 50,
            }}
          >
            {heroCountdown?.countdown ?? '--:--:--'}
          </Text>
        </View>

        {/* التاريخ الهجري */}
        <Text
          style={{
            fontFamily: 'Cairo_400Regular',
            fontSize: 12,
            color: '#2B2B2B',
            textAlign: 'left',
            textShadowColor: 'rgba(255,255,255,0.4)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
            marginTop: 2,
          }}
        >
          {hijriStr}
        </Text>

        {/* التاريخ الميلادي */}
        <Text
          style={{
            fontFamily: 'Cairo_400Regular',
            fontSize: 12,
            color: '#2B2B2B',
            textAlign: 'left',
            textShadowColor: 'rgba(255,255,255,0.4)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
            marginTop: 1,
          }}
        >
          {gregorianStr}
        </Text>
      </View>

      {/* أسماء الصلوات فوق كل دائرة */}
      {fontsLoaded && prayerNames.map((name, i) => {
        const cx = circlesStartX + i * (circleRadius * 2 + circleGap);
        return (
          <Text
            key={name}
            style={{
              position: 'absolute',
              top: heroTopPx,
              marginTop: svgHeight + 10 - labelHeight - labelGap,
              left: cx - circleRadius * 1.5,
              width: circleRadius * 3,
              textAlign: 'center',
              fontSize: labelFontSize,
              color: '#1A1A1A',
              fontFamily: 'Cairo_400Regular',
            }}
          >
            {name}
          </Text>
        );
      })}

      {/* ٦ دوائر أسفل أسماء الصلوات */}
      <View style={{ position: 'absolute', top: heroTopPx, marginTop: svgHeight + 10, left: 0, width, height: circlesSvgHeight }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const name = prayerNames[i];
          const cx = circlesStartX + i * (circleRadius * 2 + circleGap);
          const img = PRAYER_IMG_MAP[name];
          return img ? (
            /* دائرة بها صورة */
            <View
              key={i}
              style={{
                position: 'absolute',
                left: cx - circleRadius,
                top: circlesY - circleRadius,
                width: circleRadius * 2,
                height: circleRadius * 2,
                borderRadius: circleRadius,
                overflow: 'hidden',
                borderWidth: circleStrokeWidth,
                borderColor: circleColor,
              }}
            >
              <Image
                source={img}
                style={{ width: circleRadius * 2, height: circleRadius * 2, transform: [{ scale: 1.25 }] }}
                contentFit="cover"
                transition={0}
              />
            </View>
          ) : (
            /* دائرة فارغة */
            <View key={i} style={{ position: 'absolute', left: cx - circleRadius, top: 0, width: circleRadius * 2, height: circlesSvgHeight }}>
              <Svg width={circleRadius * 2} height={circlesSvgHeight}>
                <Circle
                  cx={circleRadius}
                  cy={circlesY}
                  r={circleRadius}
                  stroke={circleColor}
                  strokeWidth={circleStrokeWidth}
                  fill="none"
                />
              </Svg>
            </View>
          );
        })}
      </View>

      {/* أوقات الصلاة أسفل كل دائرة */}
      {fontsLoaded && prayerNames.map((name, i) => {
        const cx = circlesStartX + i * (circleRadius * 2 + circleGap);
        const key = prayerKey[name];
        const timeStr = prayers && key ? prayers[key] : '—';
        return (
          <Text
            key={`time-${name}`}
            style={{
              position: 'absolute',
              top: heroTopPx,
              marginTop: svgHeight + 10 + circlesSvgHeight + 6,
              left: cx - circleRadius * 1.5,
              width: circleRadius * 3,
              textAlign: 'center',
              fontSize: 13,
              color: '#666',
              fontFamily: 'Cairo_400Regular',
            }}
          >
            {timeStr}
          </Text>
        );
      })}
      <View style={{
        position: 'absolute',
        top: heroTopPx,
        marginTop: svgHeight + 10 + circlesSvgHeight + 72,
        left: 8,
        right: 8,
        height: '25%',
        borderRadius: 16,
        borderWidth: 0.8,
        borderColor: circleColor,
        backgroundColor: '#F2EDE5',
        paddingHorizontal: 12,
        paddingTop: 16,
        paddingBottom: 8,
        justifyContent: 'space-evenly',
      }}>
        {/* صفان من 5 أيقونات مع نص أسفل كل منها */}
        {[
          // الصف الأول — من اليسار الفيزيائي إلى اليمين (RTL: التقويم أولاً يساراً = آخر يميناً)
          ['التقويم', 'السبحة', 'الأذكار', 'الدعاء', 'المصحف'],
          // الصف الثاني
          ['المزيد', 'تحديات', 'القبلة', 'الأذان', 'المواقيت'],
        ].map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {row.map((label) => {
              const cardInnerWidth = width - 8 - 8 - 12 - 12;
              const itemWidth = cardInnerWidth / 5;
              const cr = itemWidth * 0.40;
              return (
                <Pressable
                  key={label}
                  onPress={() => {
                    if (label === 'المصحف') {
                      // فحص الخطوط — إن وُجدت افتح المصحف مباشرة، وإلا شاشة التحميل
                      const check = mushafFontService.checkFontsExist();
                      if (check.allPresent) {
                        router.push('/mushaf' as RelativePathString);
                      } else {
                        router.push('/mushaf/font-download' as RelativePathString);
                      }
                    }
                    else if (label === 'الدعاء') router.push('/duaa' as RelativePathString);
                    else if (label === 'الأذكار') router.push('/azkar' as RelativePathString);
                    else if (label === 'السبحة') router.push('/subha' as RelativePathString);
                    else if (label === 'المواقيت') router.push('/prayer-times' as RelativePathString);
                    else if (label === 'القبلة') router.push('/qibla' as RelativePathString);
                    else if (label === 'الأذان') router.push('/athan' as RelativePathString);
                    else if (label === 'التقويم') router.push('/calendar' as RelativePathString);
                    else router.push(`/feature/${label}` as RelativePathString);
                  }}
                  style={{ width: itemWidth, alignItems: 'center', gap: 4 }}
                >
                  {SVG_ICON_MAP[label] ? (
                    /* أيقونة SVG داخل دائرة بيضاء — تملأ الدائرة بالكامل */
                    <View style={{
                      width: cr * 2,
                      height: cr * 2,
                      borderRadius: cr,
                      overflow: 'hidden',
                      borderWidth: circleStrokeWidth,
                      borderColor: circleColor,
                      backgroundColor: '#FFFFFF',
                    }}>
                      <View style={{
                        position: 'absolute',
                        left: -(cr * 0.25),
                        top: -(cr * 0.25),
                      }}>
                        {React.createElement(SVG_ICON_MAP[label], { size: cr * 2.5 })}
                      </View>
                    </View>
                  ) : (
                    /* دائرة فارغة بيضاء */
                    <Svg width={cr * 2} height={cr * 2}>
                      <Circle
                        cx={cr}
                        cy={cr}
                        r={cr - 0.5}
                        stroke={circleColor}
                        strokeWidth={circleStrokeWidth}
                        fill="#FFFFFF"
                      />
                    </Svg>
                  )}
                  <Text style={{
                    fontSize: 10,
                    color: '#1A1A1A',
                    fontFamily: fontsLoaded ? 'Cairo_400Regular' : undefined,
                    textAlign: 'center',
                  }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
