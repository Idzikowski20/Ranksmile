import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';

const Img = styled.img<{ $size: number }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid ${semantic.border.primary};
`;

const Fallback = styled.span<{ $size: number }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${semantic.background.secondary};
  color: ${semantic.text.secondary};
  font-family: ${typeface.body};
  font-size: ${(p) => Math.max(10, Math.round(p.$size * 0.4))}px;
  font-weight: 500;
  border: 1px solid ${semantic.border.primary};
`;

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ src, name, size = 32, className }: AvatarProps) {
  if (src) return <Img className={className} src={src} alt={name ?? ''} $size={size} />;
  return (
    <Fallback className={className} $size={size} aria-label={name}>
      {initials(name)}
    </Fallback>
  );
}

export function AvatarButton(props: AvatarProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { src, name, size, className, ...rest } = props;
  return (
    <button type="button" className={className} style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'var(--koala-cursor-pointing)' }} {...rest}>
      <Avatar src={src} name={name} size={size} />
    </button>
  );
}

export default Avatar;
