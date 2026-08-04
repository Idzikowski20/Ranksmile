import React from 'react';
import * as Phosphor from '@phosphor-icons/react';

type PhosphorComponent = React.ComponentType<{
  size?: number | string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}>;

export type IconProps = {
  /** PascalCase Phosphor name matching Koala Icon_Bold, e.g. `ArrowRight`. */
  name: string;
  size?: number | string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Koala Icon_Bold = Phosphor Bold (Figma Icons `3950:146150`, ~1300 glyphs).
 */
export function Icon({ name, size = 20, weight = 'bold', color = 'currentColor', className, style }: IconProps) {
  const raw = (Phosphor as Record<string, unknown>)[name];
  // Phosphor icons are forwardRef objects (typeof === 'object'); plain functions also ok.
  const Comp = (
    typeof raw === 'function' || (raw != null && typeof raw === 'object' && '$$typeof' in (raw as object))
      ? raw
      : undefined
  ) as PhosphorComponent | undefined;
  if (!Comp) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[koala/Icon] Unknown icon "${name}"`);
    }
    return null;
  }
  return <Comp size={size} weight={weight} color={color} className={className} style={style} />;
}

export default Icon;
