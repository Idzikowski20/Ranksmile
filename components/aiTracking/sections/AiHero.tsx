import React from 'react';
import styled from '@emotion/styled';
import {
  ArrowRight, ChartLineUp, Crosshair, MagnifyingGlass, Sparkle, TrendDown, TrendUp,
} from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, DotCanvas, Eyebrow, Section } from '../../landing/primitives';
import { DashboardMock } from '../../landing/mocks/DashboardMock';
import { HERO, SIGN_UP_HREF } from '../content';

const HeroSection = styled(Section)`
  overflow: hidden;
  padding-bottom: 90px;
  margin-top: -92px;
  ${BP.md} {
    margin-top: -73px;
    padding-bottom: 54px;
  }
`;

const Grid = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.82fr);
  gap: 40px;
  align-items: center;
  padding: 200px 0 0 13.5px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    padding: 150px 0 0;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 27px;
  max-width: 620px;
`;

const H1 = styled.h1`
  margin: 0;
  font-weight: ${fontWeight.bold};
  font-size: 55.2px;
  line-height: 60.67px;
  letter-spacing: -1.5px;
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 40px;
    line-height: 46px;
    letter-spacing: -1px;
  }
`;

const Sub = styled.p`
  margin: 0;
  max-width: 540px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
`;

const Proof = styled.p`
  margin: 4px 0 0;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.tertiary};
  svg {
    color: ${semantic.text.brand};
    flex-shrink: 0;
  }
`;

/* ── Right: purple/blue radial with floating stat cards ────────────────────── */

const Panel = styled.div`
  position: relative;
  min-height: 460px;
  border-radius: 27px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background:
    radial-gradient(120% 90% at 78% 18%, color-mix(in srgb, var(--landing-blue) 20%, transparent), transparent 60%),
    ${semantic.background.tertiary};
  ${BP.lg} {
    min-height: 380px;
  }
`;

const Ring = styled.div`
  position: absolute;
  inset: -20% -30% -20% 10%;
  pointer-events: none;
  background:
    conic-gradient(from 220deg at 60% 40%, transparent 0deg, color-mix(in srgb, var(--landing-blue) 34%, transparent) 60deg, transparent 120deg);
  mask-image: radial-gradient(closest-side, transparent 55%, black 56%, black 70%, transparent 72%);
  -webkit-mask-image: radial-gradient(closest-side, transparent 55%, black 56%, black 70%, transparent 72%);
  opacity: 0.7;
`;

const StatCard = styled.div<{ $x: string; $y: string }>`
  position: absolute;
  left: ${(p) => p.$x};
  top: ${(p) => p.$y};
  min-width: 190px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid ${semantic.border.primary};
  background: color-mix(in srgb, ${semantic.background.primary} 92%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0px 12px 32px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  ${BP.lg} {
    position: static;
    min-width: 0;
  }
`;

const StatRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  b {
    font-size: 30px;
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
    color: ${semantic.text.primary};
  }
  small {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 13px;
    font-weight: ${fontWeight.medium};
  }
`;

const StatLabel = styled.span`
  font-size: 13px;
  color: ${semantic.text.secondary};
`;

const StatGrid = styled.div`
  ${BP.lg} {
    position: static;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 20px;
  }
`;

/* ── Chips row ─────────────────────────────────────────────────────────────── */

const Chips = styled.ul`
  list-style: none;
  margin: 56px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px 0 12px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.primary};
  font-size: 15px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.brand};
  }
`;

/* ── Dashboard frame ───────────────────────────────────────────────────────── */

const Frame = styled.div`
  position: relative;
  margin-top: 56px;
  width: 100%;
  aspect-ratio: 1440 / 620;
  overflow: hidden;
  border-radius: 27px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  box-shadow: 0px 24px 68px rgba(47,48,55,0.08);
  ${BP.md} {
    aspect-ratio: auto;
    min-height: 420px;
    border-radius: 18px;
  }
`;

const CHIP_ICON = [MagnifyingGlass, Crosshair, ChartLineUp, Sparkle];

export function AiHero() {
  return (
    <HeroSection aria-labelledby="ai-hero-title">
      <DotCanvas aria-hidden />
      <Container style={{ position: 'relative' }}>
        <Grid>
          <Copy>
            <Eyebrow data-hero="eyebrow" $tone="brand">{HERO.eyebrow}</Eyebrow>
            <H1 id="ai-hero-title" data-hero="line">
              {HERO.titleLines.map((l, i) => (
                <React.Fragment key={l}>
                  {l}
                  {i < HERO.titleLines.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </H1>
            <Sub data-hero="line">{HERO.sub}</Sub>
            <div data-hero="cta">
              <CtaLink href={SIGN_UP_HREF}>
                {HERO.cta}
                <ArrowRight size={18} weight="bold" aria-hidden />
              </CtaLink>
            </div>
            <Proof data-hero="proof">
              <Sparkle size={16} weight="fill" aria-hidden />
              {HERO.proof}
            </Proof>
          </Copy>

          <Panel data-hero="preview" role="img" aria-label="AI Tracker metrics: Visibility Score, Mention Rate and Average Position">
            <Ring aria-hidden />
            <StatGrid>
              {HERO.stats.map((s, i) => (
                <StatCard
                  key={s.label}
                  $x={['auto', '38%', '10%'][i]}
                  $y={['8%', '40%', '70%'][i]}
                  style={i === 0 ? { right: '8%', left: 'auto' } : undefined}
                >
                  <StatRow>
                    <b>{s.value}</b>
                    <small style={{ color: s.trend === 'up' ? semantic.status.success : semantic.status.danger }}>
                      {s.trend === 'up' ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
                      {s.delta}
                    </small>
                  </StatRow>
                  <StatLabel>{s.label}</StatLabel>
                </StatCard>
              ))}
            </StatGrid>
          </Panel>
        </Grid>

        <Chips data-reveal aria-label="What AI Tracker does">
          {HERO.chips.map((c, i) => {
            const IconComp = CHIP_ICON[i];
            return (
              <Chip key={c}>
                <IconComp size={16} weight="bold" aria-hidden />
                {c}
              </Chip>
            );
          })}
        </Chips>

        <Frame data-hero="preview">
          <DashboardMock org="BMW · AI Tracker" />
        </Frame>
      </Container>
    </HeroSection>
  );
}

export default AiHero;
