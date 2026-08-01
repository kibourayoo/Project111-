import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

interface Props { size?: number; color?: string }

export default function MoreHorizontalIcon({ size = 100, color = '#000000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 402 386" preserveAspectRatio="xMidYMid meet">
      <G
        transform="translate(0.000000,386.000000) scale(0.100000,-0.100000)"
        fill={color}
        stroke="none"
      >
        {/* النقطة الأولى (اليسرى) */}
        <Path d="M1295 2077 c-44 -21 -102 -90 -116 -139 -28 -107 42 -224 151 -248 218 -48 345 237 162 364 -34 24 -55 31 -105 33 -37 2 -74 -2 -92 -10z" />
        {/* النقطة الثانية (الوسطى) */}
        <Path d="M1885 2074 c-78 -40 -115 -101 -115 -187 0 -74 32 -133 95 -172 135 -83 305 12 305 171 0 88 -34 145 -112 185 -46 23 -131 25 -173 3z" />
        {/* النقطة الثالثة (اليمنى) */}
        <Path d="M2475 2073 c-82 -43 -119 -108 -113 -199 7 -105 77 -178 185 -190 40 -5 57 -1 103 23 75 40 113 101 113 181 0 32 -7 70 -16 87 -20 40 -75 91 -110 104 -41 16 -127 13 -162 -6z" />
      </G>
    </Svg>
  );
}
