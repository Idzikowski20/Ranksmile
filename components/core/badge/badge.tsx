import styled from '@emotion/styled';

type BadgeVariant = 'muted' | 'info' | 'success' | 'warning' | 'danger' | 'highlight' | 'promotion' | 'alpha' | 'beta' | 'new' | 'experimental' | 'internal';

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  alpha: { bg: '#FC5CB4', color: '#000000' },
  beta: { bg: '#FFCE00', color: '#000000' },
  new: { bg: '#00F261', color: '#000000' },
  experimental: { bg: '#787581', color: '#FFFFFF' },
  muted: { bg: '#0000200F', color: '#302E36' },
  internal: { bg: '#0000200F', color: '#302E36' },
  info: { bg: '#F299641C', color: '#E07D42' },
  success: { bg: '#00B8001C', color: '#008900' },
  warning: { bg: '#E0B01030', color: '#A45200' },
  danger: { bg: '#F828081C', color: '#D50000' },
  highlight: { bg: '#F000901A', color: '#C8007E' },
  promotion: { bg: '#F000901A', color: '#C8007E' },
};

export const Badge = styled.span<{ variant?: BadgeVariant }>(({ variant = 'muted' }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  height: 20,
  padding: '0 6px',
  fontSize: 11,
  fontWeight: 500,
  fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
  borderRadius: 5,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  background: variantStyles[variant].bg,
  color: variantStyles[variant].color,
}));

export default Badge;
