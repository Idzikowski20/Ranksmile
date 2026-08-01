import React from 'react';

const ORG_COLORS = ['#FFD00E', '#F84416', '#6C5FC7', '#57BE8C', '#FF6B6B'] as const;

export function orgAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return ORG_COLORS[h % ORG_COLORS.length];
}

function textOnBg(hex: string): string {
  const light = new Set(['#FFD00E', '#F84416']);
  return light.has(hex) ? '#000000' : '#FFFFFF';
}

type LetterAvatarProps = {
  letter: string;
  color?: string;
  size?: number;
  title?: string;
};

const LetterAvatar = ({ letter, color, size = 32, title }: LetterAvatarProps) => {
  const fill = color ?? orgAvatarColor(letter);
  const textFill = textOnBg(fill);
  const initial = (letter || '?').charAt(0).toUpperCase();

  return (
    <span
      className="koala-letter-avatar"
      style={{ width: size, height: size }}
      title={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <rect x="0" y="0" width="120" height="120" fill={fill} rx="14" />
        <text
          x="50%"
          y="50%"
          fontSize="65"
          fontWeight="bold"
          textAnchor="middle"
          fill={textFill}
          dominantBaseline="central"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
};

export default LetterAvatar;
