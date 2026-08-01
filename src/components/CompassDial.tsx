import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
  G,
  Line,
  Text as SvgText,
  Polygon,
  Rect,
} from "react-native-svg";

type CompassProps = {
  /** حجم البوصلة بالبيكسل (العرض والطول متطابقان) */
  size?: number;
  /** اتجاه الهاتف الفعلي بالدرجات (من 0 إلى 360) */
  heading: number;
  /** زاوية القبلة بالدرجات بالنسبة للشمال الجغرافي */
  qiblaBearing: number;
};

export default function CompassDial({ size = 320, heading, qiblaBearing }: CompassProps) {
  const center = size / 2;

  const outerRadius     = size * 0.43;
  const middleRadius    = size * 0.414;
  const innerRadius     = size * 0.338;
  const highlightRadius = size * 0.335;
  const needleScale     = (size / 2048) * 0.60;

  /* قرص البوصلة يدور عكس اتجاه الهاتف حتى يُبقي N نحو الشمال الحقيقي */
  const compassRotation = -heading;

  /*
   * أيقونة الكعبة — ثابتة على الشاشة نحو الكعبة
   * ──────────────────────────────────────────────
   * المنطق:
   *   - قرص البوصلة يدور بـ (-heading) لإبقاء N ثابتاً نحو الشمال
   *   - أيقونة الكعبة يجب أن تشير نحو qiblaBearing من الشمال الجغرافي
   *   - إذا أُضيفت داخل القرص: ستدور معه وتبدو ثابتة مع البوصلة (خطأ)
   *   - الحل الصحيح: إخراجها خارج القرص، وحساب موضعها من:
   *       kaabaScreenAngle = qiblaBearing - heading
   *       (اتجاهها على الشاشة = اتجاهها من الشمال ناقص heading الجهاز الحالي)
   *   - زاوية SVG تبدأ من محور X الموجب (يمين) → نطرح 90° للحصول على
   *       أعلى الشاشة = 0° (اتفاقية البوصلة → SVG)
   */
  const kaabaScreenAngle = qiblaBearing - heading;          // اتجاه الكعبة على الشاشة
  const kaabaAngleSVG    = (kaabaScreenAngle - 90) * (Math.PI / 180); // SVG يبدأ من Y-axis
  const kaabaPathRadius  = size * 0.405;
  const kaabaIconSize    = size * 0.055;
  const kaabaX = center + Math.cos(kaabaAngleSVG) * kaabaPathRadius;
  const kaabaY = center + Math.sin(kaabaAngleSVG) * kaabaPathRadius;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

        {/* ── 1. التدرجات اللونية ── */}
        <Defs>
          <RadialGradient id="discGradient" cx="50%" cy="42%" rx="70%" ry="70%">
            <Stop offset="0%"   stopColor="#FCFAF6" />
            <Stop offset="55%"  stopColor="#F8F5EF" />
            <Stop offset="100%" stopColor="#EFEAE2" />
          </RadialGradient>
          <LinearGradient id="outerStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#FFFFFF" />
            <Stop offset="45%"  stopColor="#D8D2C9" />
            <Stop offset="100%" stopColor="#FFFFFF" />
          </LinearGradient>
          <LinearGradient id="innerStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#D8D2C8" />
            <Stop offset="45%"  stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#D7D0C6" />
          </LinearGradient>
          <RadialGradient id="highlightGrad" cx="42%" cy="34%" rx="60%" ry="60%">
            <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.38" />
            <Stop offset="70%"  stopColor="#FFFFFF" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="shadeGrad" cx="62%" cy="70%" rx="75%" ry="75%">
            <Stop offset="0%"   stopColor="#D8D1C7" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#D8D1C7" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* ── 2. قرص البوصلة المتحرك ── */}
        <G rotation={compassRotation} origin={`${center}, ${center}`}>

          {/* الخلفية والإطارات */}
          <Circle cx={center} cy={center} r={outerRadius} fill="url(#discGradient)" />
          <Circle cx={center} cy={center} r={outerRadius} fill="url(#highlightGrad)" />
          <Circle cx={center} cy={center} r={outerRadius} fill="url(#shadeGrad)" />
          <Circle cx={center} cy={center} r={outerRadius - (size * 0.012) / 2}
            fill="none" stroke="url(#outerStrokeGrad)" strokeWidth={size * 0.012} />
          <Circle cx={center} cy={center} r={middleRadius}
            fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={size * 0.0035} />
          <Circle cx={center} cy={center} r={innerRadius}
            fill="none" stroke="url(#innerStrokeGrad)" strokeWidth={size * 0.008} />
          <Circle cx={center} cy={center} r={highlightRadius}
            fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={size * 0.0025} />

          {/* التدريجات والأرقام */}
          <G id="graduation-ticks">
            {Array.from({ length: 72 }).map((_, i) => {
              const angle = i * 5;
              const rad = ((angle - 90) * Math.PI) / 180;
              const isMajor    = angle % 15 === 0;
              const isCardinal = angle % 90 === 0;
              const tickOuter  = size * 0.37;
              const tickLength = isCardinal ? size * 0.026 : isMajor ? size * 0.018 : size * 0.01;
              const tickInner  = tickOuter - tickLength;
              return (
                <Line
                  key={`tick-${angle}`}
                  x1={center + Math.cos(rad) * tickOuter}
                  y1={center + Math.sin(rad) * tickOuter}
                  x2={center + Math.cos(rad) * tickInner}
                  y2={center + Math.sin(rad) * tickInner}
                  stroke={isCardinal ? "#B59B73" : "#5A5A5A"}
                  strokeWidth={isCardinal ? size * 0.0028 : isMajor ? size * 0.0023 : size * 0.0015}
                  strokeLinecap="round"
                  opacity={0.95}
                />
              );
            })}

            {Array.from({ length: 24 }).map((_, i) => {
              const angle = i * 15;
              const rad   = ((angle - 90) * Math.PI) / 180;
              const r     = size * 0.39;
              const x     = center + Math.cos(rad) * r;
              const y     = center + Math.sin(rad) * r;
              let textRot = angle;
              if (textRot > 90 && textRot < 270) textRot += 180;
              return (
                <SvgText
                  key={`label-${angle}`}
                  x={x} y={y}
                  fontSize={size * 0.022}
                  fontWeight="500" fill="#373737"
                  textAnchor="middle" alignmentBaseline="middle"
                  transform={`rotate(${textRot} ${x} ${y})`}
                >
                  {angle}
                </SvgText>
              );
            })}
          </G>

          {/* الاتجاهات الجغرافية */}
          <G id="cardinal-directions">
            <Circle cx={center} cy={center} r={size * 0.25}
              fill="none" stroke="#d8d1c6" strokeOpacity={0.58} strokeWidth={size * 0.0022} />
            <Circle cx={center} cy={center} r={size * 0.2492}
              fill="none" stroke="#ffffff" strokeOpacity={0.42} strokeWidth={size * 0.0012} />
            <SvgText x={center} y={center - size * 0.285}
              fontSize={size * 0.042} fontWeight="500" fill="#bf955d"
              textAnchor="middle" alignmentBaseline="middle">N</SvgText>
            <SvgText x={center + size * 0.285} y={center}
              fontSize={size * 0.04} fontWeight="500" fill="#1f3f43"
              textAnchor="middle" alignmentBaseline="middle">E</SvgText>
            <SvgText x={center} y={center + size * 0.285}
              fontSize={size * 0.04} fontWeight="500" fill="#1f3f43"
              textAnchor="middle" alignmentBaseline="middle">S</SvgText>
            <SvgText x={center - size * 0.285} y={center}
              fontSize={size * 0.04} fontWeight="500" fill="#1f3f43"
              textAnchor="middle" alignmentBaseline="middle">W</SvgText>

            {([
              { text: "NW", angle: 315 }, { text: "NE", angle: 45 },
              { text: "SE", angle: 135 }, { text: "SW", angle: 225 },
            ] as const).map(({ text, angle }) => {
              const rad = ((angle - 90) * Math.PI) / 180;
              const r   = size * 0.26;
              const x   = center + Math.cos(rad) * r;
              const y   = center + Math.sin(rad) * r;
              let textRot = angle;
              if (textRot > 90 && textRot < 270) textRot -= 180;
              return (
                <SvgText key={text} x={x} y={y}
                  fontSize={size * 0.03} fontWeight="500" fill="#1f3f43"
                  textAnchor="middle" alignmentBaseline="middle"
                  transform={`rotate(${textRot} ${x} ${y})`}
                >
                  {text}
                </SvgText>
              );
            })}
          </G>

          {/* النجمة الزخرفية */}
          <G transform={`translate(${center}, ${center}) scale(${needleScale}) translate(-1024, -1024)`}>
            <G id="background-star">
              <G id="minor-arms">
                <Polygon points="1024,1024 1114,1024 1450,1450" fill="#ebebea" />
                <Polygon points="1024,1024 1024,1114 1450,1450" fill="#9ea29d" />
                <Polygon points="1024,1024 1024,934 1450,598"  fill="#ebebea" />
                <Polygon points="1024,1024 1114,1024 1450,598"  fill="#9ea29d" />
                <G transform="rotate(180, 1024, 1024)">
                  <Polygon points="1024,1024 1114,1024 1450,1450" fill="#ebebea" />
                  <Polygon points="1024,1024 1024,1114 1450,1450" fill="#9ea29d" />
                  <Polygon points="1024,1024 1024,934 1450,598"  fill="#ebebea" />
                  <Polygon points="1024,1024 1114,1024 1450,598"  fill="#9ea29d" />
                </G>
              </G>
              <G id="major-arms">
                <Polygon points="1024,1024 934,1024 1024,1850"  fill="#bcc0bb" />
                <Polygon points="1024,1024 1114,1024 1024,1850" fill="#7d8880" />
                <Polygon points="1024,1024 1024,934 1850,1024"  fill="#bcc0bb" />
                <Polygon points="1024,1024 1024,1114 1850,1024" fill="#7d8880" />
                <G transform="rotate(180, 1024, 1024)">
                  <Polygon points="1024,1024 934,1024 1024,1850"  fill="#bcc0bb" />
                  <Polygon points="1024,1024 1114,1024 1024,1850" fill="#7d8880" />
                  <Polygon points="1024,1024 1024,934 1850,1024"  fill="#bcc0bb" />
                  <Polygon points="1024,1024 1024,1114 1850,1024" fill="#7d8880" />
                </G>
              </G>
            </G>
          </G>

          {/* أيقونة الكعبة — مُخرَجة من القرص، ثابتة على الشاشة نحو الكعبة */}

        </G>

        {/* ── أيقونة الكعبة — خارج القرص الدوار، ثابتة نحو الكعبة ── */}
        <G transform={`translate(${kaabaX}, ${kaabaY})`}>
          <Rect x={-kaabaIconSize / 2} y={-kaabaIconSize / 2}
            width={kaabaIconSize} height={kaabaIconSize}
            fill="#1a1a1a" rx={kaabaIconSize * 0.15} />
          <Rect x={-kaabaIconSize / 2} y={-kaabaIconSize * 0.12}
            width={kaabaIconSize} height={kaabaIconSize * 0.14} fill="#d4af37" />
          <Rect x={-kaabaIconSize * 0.12} y={kaabaIconSize * 0.05}
            width={kaabaIconSize * 0.24} height={kaabaIconSize * 0.32}
            fill="#c59b27" rx={kaabaIconSize * 0.04} />
        </G>

        {/* ── 3. المؤشر الثابت (لا يدور) ── */}
        <G transform={`translate(${center}, ${center}) scale(${needleScale}) translate(-1024, -1024)`}>
          <G id="fixed-user-needle">
            <Polygon points="1024,1024 914,1024 1024,150"  fill="#024d47" />
            <Polygon points="1024,1024 1134,1024 1024,150" fill="#0f7873" />
            <Circle cx="1024" cy="1024" r="120" fill="#024d47" />
            <Circle cx="1024" cy="1024" r="95"  fill="#cda45b" />
            <Circle cx="1024" cy="1024" r="70"  fill="#f3d395" />
            <Circle cx="1024" cy="1024" r="45"  fill="#024d47" />
          </G>
        </G>

      </Svg>
    </View>
  );
}
