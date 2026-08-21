/**
 * Marketing-scale primitives built on Koala tokens. The product scale tops out at
 * product headings; the landing needs display sizes, so these live here and nowhere else.
 */
import styled from '@emotion/styled';
import { semantic } from '../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../koala/tokens/typography';
import { radius, shadow } from '../koala/tokens/effects';
import { media } from '../koala/tokens/breakpoints';

export const Container = styled.div`
  width: 100%;
  max-width: 1216px;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
  ${media.md} {
    padding: 0 32px;
  }
`;

export const Section = styled.section<{ $tone?: 'primary' | 'secondary' }>`
  position: relative;
  padding: 72px 0;
  background: ${(p) => (p.$tone === 'secondary' ? semantic.background.secondary : semantic.background.primary)};
  ${media.md} {
    padding: 112px 0;
  }
`;

export const Eyebrow = styled.p`
  margin: 0 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: ${typeface.body};
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  font-weight: ${fontWeight.medium};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${semantic.text.brand};
`;

export const Display = styled.h1`
  margin: 0;
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: clamp(38px, 6.2vw, ${textScale['7xl'].fontSize});
  line-height: 1.04;
  letter-spacing: -0.035em;
  color: ${semantic.text.primary};
  text-wrap: balance;
`;

export const H2 = styled.h2`
  margin: 0;
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: clamp(30px, 4.2vw, ${textScale['5xl'].fontSize});
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: ${semantic.text.primary};
  text-wrap: balance;
`;

export const H3 = styled.h3`
  margin: 0;
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: ${textScale.xl.fontSize};
  line-height: ${textScale.xl.lineHeight};
  letter-spacing: -0.02em;
  color: ${semantic.text.primary};
`;

export const Lead = styled.p`
  margin: 0;
  font-family: ${typeface.body};
  font-size: ${textScale.lg.fontSize};
  line-height: 1.5;
  letter-spacing: ${textScale.base.letterSpacing};
  color: ${semantic.text.secondary};
  text-wrap: pretty;
  strong {
    color: ${semantic.text.primary};
    font-weight: ${fontWeight.medium};
  }
`;

export const Body = styled.p`
  margin: 0;
  font-family: ${typeface.body};
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  letter-spacing: ${textScale.base.letterSpacing};
  color: ${semantic.text.secondary};
  text-wrap: pretty;
`;

export const Muted = styled.span`
  color: ${semantic.text.tertiary};
`;

export const Panel = styled.div`
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${radius['2xl']};
  box-shadow: ${shadow.xs};
`;

export const SectionHead = styled.div<{ $align?: 'center' | 'start' }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$align === 'start' ? 'flex-start' : 'center')};
  text-align: ${(p) => (p.$align === 'start' ? 'left' : 'center')};
  gap: 20px;
  max-width: 720px;
  margin: ${(p) => (p.$align === 'start' ? '0' : '0 auto')};
  margin-bottom: 48px;
  ${media.md} {
    margin-bottom: 64px;
  }
`;

/** Primary CTA as an anchor — Koala brand button metrics (lg: 44px / radius 14px). */
export const CtaLink = styled.a<{ $variant?: 'primary' | 'secondary' | 'onBrand' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 18px;
  border-radius: ${radius.button.lg};
  font-family: ${typeface.body};
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.medium};
  letter-spacing: ${textScale.sm.letterSpacing};
  white-space: nowrap;
  text-decoration: none;
  cursor: var(--koala-cursor-pointing);
  transition: background var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard);
  border: 1px solid transparent;
  ${(p) => {
    if (p.$variant === 'secondary') {
      return `
        background: ${semantic.button.secondary.bg};
        color: ${semantic.button.secondary.fg};
        border-color: ${semantic.button.secondary.border};
        &:hover { background: ${semantic.button.secondary.bgHover}; }
      `;
    }
    if (p.$variant === 'onBrand') {
      return `
        background: ${semantic.background.primary};
        color: ${semantic.text.primary};
        &:hover { background: ${semantic.background.secondary}; }
      `;
    }
    return `
      background: ${semantic.button.brand.bg};
      color: ${semantic.button.brand.fg};
      &:hover { background: ${semantic.button.brand.bgHover}; }
    `;
  }}
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
  svg {
    transition: transform var(--motion-fast) var(--motion-ease-standard);
  }
  &:hover svg {
    transform: translateX(2px);
  }
`;

export const TextLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  text-decoration: none;
  border-bottom: 1px solid ${semantic.border.secondary};
  padding-bottom: 1px;
  &:hover {
    color: ${semantic.text.brand};
    border-color: ${semantic.border.brand};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: ${radius.sm};
  }
`;

/** Subtle dot grid — the reference hero texture, inverted for the light theme. */
export const DotGrid = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(${semantic.border.secondary} 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 100%);
  opacity: 0.7;
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
