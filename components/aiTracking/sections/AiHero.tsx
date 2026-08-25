import React, { useRef } from 'react';
import styled from '@emotion/styled';
import {
  ChartLineUp, Crosshair, GoogleLogo, MagnifyingGlass, OpenAiLogo, Sparkle, Star,
} from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Section, Tag } from '../../landing/primitives';
import { HERO, SIGN_UP_HREF } from '../content';
import { useRadarMotion } from '../useRadarMotion';

/*
 * Figma 3:4237 — section pt 180 / pb 126 / gap 125:
 *   A) copy block 990×594 (tag · H1 69.1 · sub 22.5 · CTA · rating row)
 *   B) pt 55, gap 27: chips row ↔ engine circles (radar centred on the last circle) · video 1440×823
 *   C) "Trusted by" — h3 44.5 + 4×2 logo grid (90px cells)
 * Dark → light: black surfaces become bg-primary/tertiary, the purple sweep becomes --landing-blue.
 */

const HeroSection = styled(Section)`
  overflow: hidden;
  padding: 180px 0 126px;
  margin-top: -92px;
  display: flex;
  flex-direction: column;
  gap: 125px;
  ${BP.md} {
    margin-top: -73px;
    padding: 150px 0 72px;
    gap: 72px;
  }
`;

/* ── A) Copy ────────────────────────────────────────────────────────────────── */

const Copy = styled.div`
  position: relative;
  max-width: 990px;
  min-height: 594.25px;
  ${BP.md} {
    min-height: 0;
  }
`;

const H1 = styled.h1`
  margin: 51.29px 0 0;
  font-size: 69.1px;
  line-height: 75.99px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.lg} {
    font-size: 56px;
    line-height: 62px;
  }
  ${BP.md} {
    margin-top: 24px;
    font-size: 40px;
    line-height: 46px;
  }
`;

const Sub = styled.p`
  margin: 24px 180px 0 0;
  font-size: 22.5px;
  line-height: 33.76px;
  color: ${semantic.text.secondary};
  ${BP.md} {
    margin-right: 0;
    font-size: 18px;
    line-height: 28px;
  }
`;

const CtaWrap = styled.div`
  padding: 27px 0 18px;
  margin-top: 24px;
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 27px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
  }
`;

const Stars = styled.span`
  display: inline-flex;
  svg {
    color: ${semantic.text.brand};
  }
`;

/* ── B) Chips · engines · radar · video ─────────────────────────────────────── */

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 27px;
  padding-top: 55px;
  ${BP.md} {
    padding-top: 0;
  }
`;

const Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  ${BP.lg} {
    flex-direction: column;
    align-items: flex-start;
    gap: 27px;
  }
`;

const Chips = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
`;

/* Figma: black buttons on black (px 18 / py 13.5, radius 13.5) — bg matches the page, so plain. */
const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 13.5px 18px;
  border-radius: 13.5px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  svg {
    width: 27px;
    height: 27px;
    color: ${semantic.text.brand};
  }
  ${BP.md} {
    padding: 8px 12px;
    font-size: 15px;
  }
`;

/* The 54px anchor — the radar is centred on this box, the engine circles extend left of it. */
const Anchor = styled.div`
  position: relative;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  /* The reference canvas is 1920 wide; below 1700px the pills would clip at the right edge,
     so the whole radar cluster slides left while the engine circles stay put. */
  --radar-shift: 0px;
  @media (max-width: 1699px) {
    --radar-shift: -150px;
  }
  ${BP.lg} {
    width: auto;
    height: auto;
    align-self: stretch;
  }
`;

const EnginesLabel = styled.span`
  position: absolute;
  right: 9px;
  bottom: calc(100% + 11px);
  width: 236px;
  font-size: 15.3px;
  line-height: 22.95px;
  color: ${semantic.text.secondary};
  white-space: nowrap;
  ${BP.lg} {
    position: static;
    display: block;
    width: auto;
    margin-bottom: 9px;
  }
`;

const Engines = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  ${BP.lg} {
    position: static;
  }
`;

const EngineCircle = styled.span<{ $strong?: boolean }>`
  width: 54px;
  height: 54px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid ${(p) => (p.$strong ? semantic.border.strong : semantic.border.secondary)};
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  svg {
    width: 27px;
    height: 27px;
  }
`;

/* Radar layers — all centred on the anchor. Sizes are the reference's 2077px image scaled to rings. */
const RadarLayer = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2000px;
  height: 2000px;
  transform: translate(calc(-50% + var(--radar-shift)), -50%);
  pointer-events: none;
  z-index: 0;
  ${BP.lg} {
    display: none;
  }
`;

const Ring = styled.i<{ $r: number; $o: number }>`
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${(p) => p.$r * 2}px;
  height: ${(p) => p.$r * 2}px;
  margin: ${(p) => -p.$r}px 0 0 ${(p) => -p.$r}px;
  border-radius: 50%;
  border: 1px solid ${semantic.border.primary};
  opacity: ${(p) => p.$o};
`;

const Sweep = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2000px;
  height: 2000px;
  margin: -1000px 0 0 -1000px;
  transform-origin: 50% 50%;
  transform: rotate(-22deg);
  will-change: transform;
  /* wedge trails the leading edge (counter-clockwise from "up") */
  background: conic-gradient(
    from -70deg at 50% 50%,
    color-mix(in srgb, var(--landing-blue) 0%, transparent) 0deg,
    color-mix(in srgb, var(--landing-blue) 14%, transparent) 70deg,
    transparent 70.5deg,
    transparent 360deg
  );
  mask-image: radial-gradient(closest-side, black 0%, black 35%, transparent 80%);
  -webkit-mask-image: radial-gradient(closest-side, black 0%, black 35%, transparent 80%);
  border-radius: 50%;
  &::after {
    content: '';
    position: absolute;
    left: calc(50% - 1px);
    bottom: 50%;
    width: 2px;
    height: 1000px;
    background: linear-gradient(to top, var(--landing-blue), color-mix(in srgb, var(--landing-blue) 0%, transparent));
  }
`;

const Dot = styled.i<{ $x: number; $y: number; $s?: number }>`
  position: absolute;
  left: calc(50% + ${(p) => p.$x}px);
  top: calc(50% + ${(p) => p.$y}px);
  width: ${(p) => p.$s ?? 3}px;
  height: ${(p) => p.$s ?? 3}px;
  border-radius: 50%;
  background: ${semantic.border.strong};
  opacity: 0.8;
`;

/* Stat pills — Figma: radius 9999, pl 31.5 / pr 36 / py 22, gap 18; 45px number + 16.2px meta. */
const Pills = styled.div`
  position: absolute;
  left: calc(50% + var(--radar-shift));
  top: 50%;
  width: 0;
  height: 0;
  z-index: 2;
  ${BP.lg} {
    position: static;
    width: auto;
    height: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }
`;

const Pill = styled.div<{ $cx: number; $cy: number; $w: number }>`
  position: absolute;
  left: ${(p) => p.$cx - p.$w / 2}px;
  top: ${(p) => p.$cy - 50}px;
  width: ${(p) => p.$w}px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 36px 22px 31.5px;
  border-radius: 9999px;
  border: 1px solid ${semantic.border.primary};
  background: color-mix(in srgb, ${semantic.background.primary} 94%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0px 12px 32px rgba(0,0,0,0.08);
  will-change: transform;
  ${BP.lg} {
    position: static;
    width: auto;
  }
`;

const PillValue = styled.b`
  font-size: 45px;
  line-height: 45px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const PillMeta = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 16.2px;
  line-height: 16.2px;
  color: ${semantic.text.tertiary};
  white-space: nowrap;
  em {
    font-style: normal;
    margin-right: 4px;
    &[data-trend='up'] { color: ${semantic.status.success}; }
    &[data-trend='down'] { color: ${semantic.status.danger}; }
  }
  small {
    font-size: 16.2px;
    color: ${semantic.text.tertiary};
    opacity: 0.7;
  }
`;

const Sources = styled.div<{ $cx: number; $cy: number }>`
  position: absolute;
  left: ${(p) => p.$cx - 136}px;
  top: ${(p) => p.$cy - 32}px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 13.5px 9px 13.5px 27px;
  border-radius: 9999px;
  border: 1px solid ${semantic.border.primary};
  background: color-mix(in srgb, ${semantic.background.primary} 94%, transparent);
  box-shadow: 0px 12px 32px rgba(0,0,0,0.06);
  font-size: 18px;
  line-height: 18px;
  color: ${semantic.text.tertiary};
  white-space: nowrap;
  ${BP.lg} {
    position: static;
  }
`;

const Favicons = styled.span`
  display: inline-flex;
  i {
    width: 27px;
    height: 27px;
    margin-left: -9px;
    box-sizing: border-box;
    border-radius: 9999px;
    border: 1px solid ${semantic.border.secondary};
    background: ${semantic.background.secondary};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-style: normal;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    &:first-of-type {
      margin-left: 0;
    }
  }
`;

/* Video — Figma 1440×823.86, radius 18, border; a top fade lets the radar dissolve into it. */
const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1440.23 / 823.86;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  z-index: 1;
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 140px;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(to bottom, ${semantic.background.primary}, transparent);
  }
  ${BP.md} {
    aspect-ratio: auto;
    min-height: 420px;
  }
`;

/* ── C) Trusted grid — h3 44.5 + 4×2 bordered cells of 90px ─────────────────── */

const Trusted = styled.div`
  display: flex;
  flex-direction: column;
  gap: 45px;
  h3 {
    margin: 0 auto;
    max-width: 900px;
    font-size: 44.5px;
    line-height: 53.41px;
    font-weight: ${fontWeight.bold};
    text-align: center;
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 90px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 18px;
  ${BP.md} {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Cell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid ${semantic.border.primary};
  font-size: 22px;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  color: ${semantic.text.secondary};
  svg {
    color: ${semantic.text.tertiary};
  }
`;

const CHIP_ICON = [MagnifyingGlass, Crosshair, ChartLineUp, Sparkle];

/* Pill centres relative to the radar anchor (reference px) and the sweep angle that ticks each. */
const PILL_POS = [
  { cx: -96, cy: -682, w: 282, angle: -8 },
  { cx: 41, cy: -521, w: 340, angle: 5 },
  { cx: -41, cy: -397, w: 306, angle: -6 },
] as const;

const DOTS = [
  [-560, -420], [-380, -260], [-220, -660], [120, -880], [300, -560], [-140, -160], [80, -300],
  [-700, -80], [420, -120], [-260, -30], [220, -760], [-470, -560],
] as const;

export function AiHero() {
  const radarRef = useRef<HTMLDivElement>(null);
  useRadarMotion(radarRef);

  return (
    <HeroSection aria-labelledby="ai-hero-title">
      <Container>
        <Copy>
          <Tag data-hero="eyebrow">{HERO.eyebrow}</Tag>
          <H1 id="ai-hero-title" data-hero="line">
            {HERO.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i < HERO.titleLines.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </H1>
          <Sub data-hero="line">{HERO.subLines.join(' ')}</Sub>
          <CtaWrap data-hero="cta">
            <CtaLink href={SIGN_UP_HREF}>{HERO.cta}</CtaLink>
          </CtaWrap>
          <Rating data-hero="proof">
            <Stars aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} weight="fill" />)}
            </Stars>
            <b>{HERO.ratingStrong}</b>
            <span>{HERO.ratingMuted}</span>
          </Rating>
        </Copy>
      </Container>

      <Container>
        <Block data-hero="preview">
          <Row ref={radarRef}>
            <Chips aria-label="What AI Tracker does">
              {HERO.chips.map((c, i) => {
                const IconComp = CHIP_ICON[i];
                return (
                  <Chip key={c}>
                    <IconComp weight="bold" aria-hidden />
                    {c}
                  </Chip>
                );
              })}
            </Chips>

            <Anchor>
              <RadarLayer aria-hidden>
                {[180, 360, 560, 800, 1000].map((r, i) => (
                  <Ring key={r} $r={r} $o={[0.9, 0.7, 0.5, 0.35, 0.2][i]} data-radar-ring />
                ))}
                {DOTS.map(([x, y], i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Dot key={i} $x={x} $y={y} $s={i % 3 === 0 ? 4 : 3} />
                ))}
                <Sweep data-radar-sweep />
              </RadarLayer>

              <Pills aria-label="Live AI Tracker metrics">
                {HERO.stats.map((s, i) => (
                  <Pill
                    key={s.id}
                    $cx={PILL_POS[i].cx}
                    $cy={PILL_POS[i].cy}
                    $w={PILL_POS[i].w}
                    data-radar-pill
                    data-angle={PILL_POS[i].angle}
                    data-min={s.min}
                    data-max={s.max}
                    data-decimals={s.decimals}
                    data-suffix={s.suffix}
                    data-delta-suffix={s.deltaSuffix}
                  >
                    <PillValue data-radar-value data-current={s.value}>
                      {`${s.value.toFixed(s.decimals)}${s.suffix}`}
                    </PillValue>
                    <PillMeta>
                      <span>{s.label}</span>
                      <span>
                        <em data-radar-delta data-trend={s.delta >= 0 ? 'up' : 'down'}>
                          {`${s.delta >= 0 ? '+' : ''}${s.delta}${s.deltaSuffix}`}
                        </em>
                        <small>since last 30d</small>
                      </span>
                    </PillMeta>
                  </Pill>
                ))}
                <Sources $cx={50} $cy={-233} data-radar-pill data-angle={12} data-min={0} data-max={0}>
                  Top sources:
                  <Favicons aria-hidden>
                    {HERO.topSources.map((l) => <i key={l}>{l}</i>)}
                  </Favicons>
                </Sources>
              </Pills>

              <EnginesLabel>{HERO.enginesLabel}</EnginesLabel>
              <Engines aria-label="Engines tracked">
                <EngineCircle title="Gemini"><Sparkle weight="fill" /></EngineCircle>
                <EngineCircle title="ChatGPT"><OpenAiLogo weight="bold" /></EngineCircle>
                <EngineCircle title="Claude"><Star weight="bold" /></EngineCircle>
                <EngineCircle title="Google" $strong><GoogleLogo weight="bold" /></EngineCircle>
              </Engines>
            </Anchor>
          </Row>

          <Frame>
            <img
              src="/ai-tracking/hero-video-poster.png"
              alt="Ranksmile AI Tracker — BMW · sport car visibility report"
              width={1440}
              height={824}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Frame>
        </Block>
      </Container>

      <Container>
        <Trusted data-reveal>
          <h3>{HERO.trustedTitle}</h3>
          <Grid>
            {HERO.trusted.map((name) => (
              <Cell key={name}>
                <Sparkle size={22} weight="fill" aria-hidden />
                {name}
              </Cell>
            ))}
          </Grid>
        </Trusted>
      </Container>
    </HeroSection>
  );
}

export default AiHero;
