/**
 * Landing primitives. Sizes mirror the Figma reference (1920 canvas, 1440 content
 * column) and fall back gracefully below it. Colours are Koala semantic tokens only:
 * every dark surface of the reference is mapped to the light theme.
 */
import styled from '@emotion/styled';
import { semantic } from '../koala/tokens/semantic';
import { typeface, fontWeight } from '../koala/tokens/typography';
import { shadow } from '../koala/tokens/effects';

export const BP = { lg: '@media (max-width: 1279px)', md: '@media (max-width: 1023px)', sm: '@media (max-width: 767px)' } as const;

/** Figma shadow on stat / resource cards. */
export const CARD_SHADOW = [
  '0px 1px 1px 0px rgba(0,0,0,0.05)',
  '0px 4px 6px 0px rgba(34,42,53,0.04)',
  '0px 24px 68px 0px rgba(47,48,55,0.05)',
  '0px 2px 3px 0px rgba(0,0,0,0.04)',
].join(', ');

/** 1440px content column, 27px gutters below the canvas width. */
export const Container = styled.div`
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 27px;
  box-sizing: border-box;
  ${BP.sm} {
    padding: 0 18px;
  }
`;

export const Section = styled.section`
  position: relative;
  background: ${semantic.background.primary};
  font-family: ${typeface.body};
  color: ${semantic.text.primary};
`;

/** 13.5px uppercase label (Figma `text-[13.5px] uppercase`). */
export const Eyebrow = styled.p<{ $tone?: 'muted' | 'brand'; $tracking?: number }>`
  margin: 0;
  font-size: 13.5px;
  line-height: 13.5px;
  font-weight: ${(p) => (p.$tone === 'brand' ? fontWeight.medium : fontWeight.regular)};
  letter-spacing: ${(p) => (p.$tracking ?? 0)}px;
  text-transform: uppercase;
  color: ${(p) => (p.$tone === 'brand' ? semantic.text.brand : semantic.text.tertiary)};
`;

/** 20.3px uppercase semibold section tag (Solution / Resources / 01 — Diagnose). */
export const Tag = styled.p<{ $color?: string }>`
  margin: 0;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
  color: ${(p) => p.$color ?? semantic.text.brand};
`;

export const H2 = styled.h2<{ $size?: 55.2 | 44.5 | 45 | 35.8; $align?: 'center' | 'left' }>`
  margin: 0;
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: ${(p) => p.$size ?? 44.5}px;
  line-height: ${(p) => ({ 55.2: '60.67px', 44.5: '53.41px', 45: '54px', 35.8: '42.93px' }[p.$size ?? 44.5])};
  letter-spacing: ${(p) => (p.$size === 45 ? '-1.08px' : '0')};
  text-align: ${(p) => p.$align ?? 'center'};
  color: ${semantic.text.primary};
  text-wrap: balance;
  ${BP.md} {
    font-size: ${(p) => Math.round((p.$size ?? 44.5) * 0.72)}px;
    line-height: 1.12;
  }
`;

export const Lead = styled.p<{ $size?: 20.3 | 18; $align?: 'center' | 'left' }>`
  margin: 0;
  font-size: ${(p) => p.$size ?? 20.3}px;
  line-height: ${(p) => (p.$size === 18 ? '28.81px' : '30.39px')};
  text-align: ${(p) => p.$align ?? 'center'};
  color: ${semantic.text.secondary};
  text-wrap: pretty;
  strong,
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  em {
    font-style: normal;
    color: ${semantic.text.primary};
  }
`;

export const Body18 = styled.p`
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  strong {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
  }
`;

/** Figma `Link` CTA: 27×18 padding, radius 13.5, 19.8/24.75 semibold, inset bevel. */
export const CtaLink = styled.a<{ $tone?: 'brand' | 'inverse' | 'white' }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 27px;
  border-radius: 13.5px;
  font-family: ${typeface.body};
  font-size: 19.8px;
  line-height: 24.75px;
  font-weight: ${fontWeight.bold};
  text-decoration: none;
  white-space: nowrap;
  cursor: var(--koala-cursor-pointing);
  background: ${(p) => ({
    brand: semantic.button.brand.bg,
    inverse: semantic.background.inverse,
    white: semantic.background.primary,
  }[p.$tone ?? 'brand'])};
  color: ${(p) => ({ brand: semantic.button.brand.fg, inverse: semantic.text.onInverse, white: semantic.text.primary }[p.$tone ?? 'brand'])};
  box-shadow: inset 0px -1px 0px 0px rgba(0,0,0,0.2), inset 0px 1px 0px 0px rgba(255,255,255,0.25);
  transition: transform var(--motion-fast) var(--motion-ease-standard), filter var(--motion-fast) var(--motion-ease-standard);
  &:hover {
    filter: brightness(0.96);
  }
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

/** Small arrow link: "Data Studies ->", "View all →". */
export const ArrowLink = styled.a<{ $size?: 18 | 16.9 }>`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => (p.$size === 16.9 ? '6.75px' : '9px')};
  font-size: ${(p) => p.$size ?? 18}px;
  line-height: ${(p) => (p.$size === 16.9 ? '25.32px' : '27px')};
  letter-spacing: ${(p) => (p.$size === 16.9 ? '-0.174px' : '0')};
  color: ${semantic.text.secondary};
  text-decoration: none;
  white-space: nowrap;
  span:last-of-type {
    color: ${semantic.text.primary};
  }
  &:hover span {
    color: ${semantic.text.brand};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: 6px;
  }
`;

/** Reference hero texture: a dot canvas. Inverted for the light theme. */
export const DotCanvas = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: -108px;
  height: 1260px;
  pointer-events: none;
  background-image: radial-gradient(${semantic.border.secondary} 1.1px, transparent 1.1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 62% 55% at 50% 35%, black 20%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 62% 55% at 50% 35%, black 20%, transparent 100%);
  opacity: 0.8;
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
