import { useTheme } from '@emotion/react';
import type { SentryTheme } from './theme';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const ICON_SIZES: Record<IconSize, string> = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
};

export interface SVGIconProps {
  size?: IconSize;
  variant?: 'muted' | 'warning';
  legacySize?: string;
  color?: string;
}

export function SvgIcon({
  children,
  size = 'md',
  variant,
  legacySize,
  color,
  ...props
}: SVGIconProps & React.SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  const t = useTheme() as SentryTheme;
  const iconSize = legacySize ?? ICON_SIZES[size] ?? '16px';
  let fill = color ?? t.tokens.content.primary;
  if (variant === 'muted') fill = t.tokens.content.secondary;
  if (variant === 'warning') fill = t.tokens.graphics.warning.vibrant;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={iconSize}
      height={iconSize}
      fill={fill}
      {...props}
    >
      {children}
    </svg>
  );
}
