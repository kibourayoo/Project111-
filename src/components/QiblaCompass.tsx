/**
 * بوصلة القبلة — SVG خالص
 * لا تحتوي على أي منطق حسابي — تستقبل arrowAngle فقط وتدير السهم
 */

import React from 'react';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';

interface QiblaCompassProps {
  /** زاوية دوران السهم [0, 360) — تأتي من compass.arrowAngle */
  arrowAngle: number;
  /** هل الجهاز يشير للقبلة؟ يغيّر لون السهم */
  pointingAtQibla: boolean;
  /** حجم البوصلة (العرض والارتفاع) — افتراضي 280 */
  size?: number;
}

// ── ألوان هوية التطبيق ──
const COLOR_RING        = '#C5A96A'; // ذهبي
const COLOR_RING_INNER  = '#F5F0E8'; // كريمي فاتح
const COLOR_TICK_MAJOR  = '#8B7355'; // بني داكن
const COLOR_TICK_MINOR  = '#C5A96A'; // ذهبي فاتح
const COLOR_LABELS      = '#5C4A2A'; // بني
const COLOR_ARROW_OFF   = '#C5A96A'; // ذهبي (غير موجه)
const COLOR_ARROW_ON    = '#2E7D32'; // أخضر (موجه)
const COLOR_CENTER      = '#8B7355'; // بني
const COLOR_NORTH       = '#B5451B'; // أحمر للشمال

export function QiblaCompass({
  arrowAngle,
  pointingAtQibla,
  size = 280,
}: QiblaCompassProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR - 18;
  const arrowColor = pointingAtQibla ? COLOR_ARROW_ON : COLOR_ARROW_OFF;

  // ── علامات الدرجات كل 15° (24 شريط) ──
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const deg = i * 15;
    const isMajor = deg % 90 === 0;     // كل ربع دائرة
    const isMid   = deg % 45 === 0;     // كل نصف ربع
    const rad = (deg - 90) * (Math.PI / 180);
    const len   = isMajor ? 14 : isMid ? 10 : 6;
    const startR = outerR - 2;
    const endR   = startR - len;
    return {
      x1: cx + startR * Math.cos(rad),
      y1: cy + startR * Math.sin(rad),
      x2: cx + endR   * Math.cos(rad),
      y2: cy + endR   * Math.sin(rad),
      isMajor,
      isMid,
      deg,
    };
  });

  // ── تسميات الاتجاهات N E S W ──
  const directions = [
    { label: 'N', deg: 0,   color: COLOR_NORTH  },
    { label: 'E', deg: 90,  color: COLOR_LABELS },
    { label: 'S', deg: 180, color: COLOR_LABELS },
    { label: 'W', deg: 270, color: COLOR_LABELS },
  ];
  const labelR = innerR - 14;

  // ── مسار السهم (يشير للأعلى في المنتصف) ──
  // رأس السهم عند الأعلى، الذيل في الأسفل
  const arrowH = innerR * 0.72;
  const arrowW = innerR * 0.18;
  const tipY   = cy - arrowH * 0.62;
  const midY   = cy + arrowH * 0.38;
  const notchY = cy + arrowH * 0.18;

  // مسار: مثلث حاد للأعلى + ذيل مثلث للأسفل
  const arrowPath = [
    `M ${cx} ${tipY}`,
    `L ${cx + arrowW} ${notchY}`,
    `L ${cx + arrowW * 0.45} ${notchY}`,
    `L ${cx + arrowW * 0.45} ${midY}`,
    `L ${cx - arrowW * 0.45} ${midY}`,
    `L ${cx - arrowW * 0.45} ${notchY}`,
    `L ${cx - arrowW} ${notchY}`,
    `Z`,
  ].join(' ');

  // الجزء السفلي (باللون المعاكس — نصف داكن)
  const arrowTailPath = [
    `M ${cx} ${cy + arrowH * 0.62}`,
    `L ${cx + arrowW} ${notchY}`,
    `L ${cx + arrowW * 0.45} ${notchY}`,
    `L ${cx + arrowW * 0.45} ${midY}`,
    `L ${cx - arrowW * 0.45} ${midY}`,
    `L ${cx - arrowW * 0.45} ${notchY}`,
    `L ${cx - arrowW} ${notchY}`,
    `Z`,
  ].join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* ── الدائرة الخارجية ── */}
      <Circle cx={cx} cy={cy} r={outerR} stroke={COLOR_RING} strokeWidth={3} fill={COLOR_RING_INNER} />
      <Circle cx={cx} cy={cy} r={innerR} stroke={COLOR_RING} strokeWidth={1.5} fill="none" />

      {/* ── علامات الدرجات ── */}
      {ticks.map((t) => (
        <Line
          key={t.deg}
          x1={t.x1} y1={t.y1}
          x2={t.x2} y2={t.y2}
          stroke={t.isMajor ? COLOR_TICK_MAJOR : COLOR_TICK_MINOR}
          strokeWidth={t.isMajor ? 2 : t.isMid ? 1.5 : 1}
        />
      ))}

      {/* ── تسميات الاتجاهات ── */}
      {directions.map(({ label, deg, color }) => {
        const rad = (deg - 90) * (Math.PI / 180);
        const lx = cx + labelR * Math.cos(rad);
        const ly = cy + labelR * Math.sin(rad);
        return (
          <SvgText
            key={label}
            x={lx} y={ly + 5}
            textAnchor="middle"
            fontSize={label === 'N' ? 15 : 13}
            fontWeight="bold"
            fill={color}
          >
            {label}
          </SvgText>
        );
      })}

      {/* ── السهم — يدور بزاوية arrowAngle حول المركز ── */}
      <G
        transform={`rotate(${arrowAngle}, ${cx}, ${cy})`}
        origin={`${cx}, ${cy}`}
      >
        {/* النصف الأمامي (الجزء الذي يشير للقبلة) */}
        <Path
          d={arrowPath}
          fill={arrowColor}
          opacity={0.95}
        />
        {/* النصف الخلفي (داكن) */}
        <Path
          d={arrowTailPath}
          fill={COLOR_CENTER}
          opacity={0.6}
        />
      </G>

      {/* ── النقطة المركزية ── */}
      <Circle cx={cx} cy={cy} r={7} fill={COLOR_CENTER} />
      <Circle cx={cx} cy={cy} r={3} fill={COLOR_RING_INNER} />
    </Svg>
  );
}
