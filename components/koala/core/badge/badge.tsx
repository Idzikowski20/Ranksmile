import React from 'react';
import styled from '@emotion/styled';

/** Canonical Badge appearances (semantic tokens). Legacy aliases kept for callers. */
export type BadgeAppearance =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'muted'
  | 'highlight'
  | 'promotion'
  | 'alpha'
  | 'beta'
  | 'new'
  | 'experimental'
  | 'internal';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** @deprecated use BadgeAppearance — kept as alias */
export type BadgeVariant = BadgeAppearance;

const APPEARANCE: Record<BadgeAppearance, { bg: string; color: string }> = {
  neutral: { bg: 'var(--koala-bg-secondary)', color: 'var(--koala-text-primary)' },
  muted: { bg: 'var(--koala-bg-secondary)', color: 'var(--koala-text-secondary)' },
  internal: { bg: 'var(--koala-bg-secondary)', color: 'var(--koala-text-secondary)' },
  info: { bg: 'var(--koala-bg-brand-subtle, color-mix(in srgb, var(--koala-text-brand) 12%, transparent))', color: 'var(--koala-text-brand)' },
  brand: { bg: 'var(--koala-text-brand)', color: 'var(--koala-text-on-brand, #fff)' },
  success: { bg: 'var(--koala-status-success-bg)', color: 'var(--koala-status-success)' },
  warning: { bg: 'var(--koala-status-warning-bg)', color: 'var(--koala-status-warning)' },
  danger: { bg: 'var(--koala-status-danger-bg)', color: 'var(--koala-status-danger)' },
  highlight: { bg: 'var(--koala-bg-secondary)', color: 'var(--koala-text-brand)' },
  promotion: { bg: 'var(--koala-bg-secondary)', color: 'var(--koala-text-brand)' },
  // check-koala-tokens-ignore — marketing chromatic labels (alpha/beta/new)
  alpha: { bg: '#FC5CB4', color: '#000000' },
  beta: { bg: '#FFCE00', color: '#000000' },
  new: { bg: '#00F261', color: '#000000' },
  experimental: { bg: 'var(--koala-bg-tertiary)', color: 'var(--koala-text-primary)' },
};

const SIZE: Record<BadgeSize, { height: number; padX: number; fontSize: number; radius: number; gap: number }> = {
  sm: { height: 18, padX: 5, fontSize: 10, radius: 4, gap: 3 },
  md: { height: 20, padX: 6, fontSize: 11, radius: 5, gap: 4 },
  lg: { height: 24, padX: 8, fontSize: 12, radius: 8, gap: 5 },
};

const Root = styled.span<{
  $appearance: BadgeAppearance;
  $size: BadgeSize;
}>(({ $appearance, $size }) => {
  const a = APPEARANCE[$appearance] ?? APPEARANCE.neutral;
  const s = SIZE[$size];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: s.gap,
    height: s.height,
    padding: `0 ${s.padX}px`,
    fontSize: s.fontSize,
    fontWeight: 500,
    fontFamily: 'var(--font-family-primary)',
    borderRadius: s.radius,
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
    background: a.bg,
    color: a.color,
    boxSizing: 'border-box' as const,
  };
});

export type BadgeProps = {
  children: React.ReactNode;
  /** Preferred prop */
  appearance?: BadgeAppearance;
  /** @deprecated alias of appearance */
  variant?: BadgeAppearance;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

export function Badge({
  children,
  appearance,
  variant,
  size = 'md',
  icon,
  className,
  style,
  title,
}: BadgeProps) {
  const resolved = appearance ?? variant ?? 'muted';
  return (
    <Root
      className={className}
      style={style}
      title={title}
      $appearance={resolved}
      $size={size}
    >
      {icon ? <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden>{icon}</span> : null}
      {children}
    </Root>
  );
}

export default Badge;
