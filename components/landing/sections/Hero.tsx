import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight, Sparkle, TrendUp } from '@phosphor-icons/react';
import Gauge from '../../ranksmile/Gauge';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, CtaLink, Display, DotGrid, Eyebrow, Panel, Section } from '../primitives';
import { ENGINES, SIGN_UP_HREF } from '../content';

const HeroSection = styled(Section)`
  overflow: hidden;
  padding-top: 64px;
  padding-bottom: 0;
  ${media.md} {
    padding-top: 104px;
    padding-bottom: 0;
  }
`;

const Copy = styled.div`
  position: relative;
  max-width: 820px;
`;

const Line = styled.span`
  display: block;
`;

/* Fixed-width slot so the cycling engine name never reflows the headline. */
const EngineSlot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.18em;
  color: ${semantic.text.brand};
  white-space: nowrap;
  &::after {
    content: '';
    display: inline-block;
    width: 3px;
    height: 0.9em;
    margin-left: 2px;
    background: ${semantic.text.primary};
    border-radius: 2px;
    animation: landing-caret 1s steps(2, start) infinite;
  }
  @keyframes landing-caret {
    to { visibility: hidden; }
  }
  @media (prefers-reduced-motion: reduce) {
    &::after { animation: none; }
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 36px;
`;

const Proof = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 72px;
  ${media.md} {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-top: 96px;
  }
`;

const ProofText = styled.p`
  margin: 0;
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.tertiary};
  strong {
    color: ${semantic.text.primary};
    font-weight: ${fontWeight.medium};
  }
`;

const Engines = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const EngineChip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.full};
  background: ${semantic.background.primary};
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.brand};
  }
`;

/* ── Product preview (pure HTML/CSS mock of the dashboard) ─────────────────── */

const PreviewWrap = styled.div`
  position: relative;
  margin-top: 56px;
  ${media.md} {
    margin-top: 72px;
  }
  /* fade the bottom edge into the next section */
  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 120px;
    background: linear-gradient(to bottom, transparent, ${semantic.background.primary});
    pointer-events: none;
  }
`;

const Preview = styled(Panel)`
  overflow: hidden;
  box-shadow: ${shadow.lg};
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: 0;
  font-family: ${typeface.body};
`;

const PreviewBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${semantic.border.secondary};
  }
`;

const PreviewBody = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 200px 1fr;
  }
`;

const PreviewSide = styled.div`
  display: none;
  ${media.lg} {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 12px;
    border-right: 1px solid ${semantic.border.primary};
    background: ${semantic.background.secondary};
  }
`;

const SideItem = styled.div<{ $active?: boolean }>`
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: ${radius.sm};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${(p) => (p.$active ? fontWeight.medium : fontWeight.regular)};
  color: ${(p) => (p.$active ? semantic.text.primary : semantic.text.secondary)};
  background: ${(p) => (p.$active ? semantic.background.primary : 'transparent')};
`;

const SideGroup = styled.div`
  margin: 12px 10px 4px;
  font-size: ${textScale.xs.fontSize};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${semantic.text.tertiary};
`;

const PreviewMain = styled.div`
  padding: 24px 20px 0;
  ${media.md} {
    padding: 32px 32px 0;
  }
`;

const Greeting = styled.p`
  margin: 0 0 8px;
  font-size: ${textScale.xl.fontSize};
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;
  color: ${semantic.text.primary};
`;

const Summary = styled.p`
  margin: 0 0 24px;
  max-width: 640px;
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  mark {
    background: ${semantic.background.secondary};
    color: ${semantic.text.primary};
    padding: 1px 6px;
    border-radius: 6px;
    font-weight: ${fontWeight.medium};
  }
`;

const Widgets = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: 1.4fr 1fr 1fr;
  }
`;

const Widget = styled.div`
  border: 1px solid ${semantic.border.primary};
  border-bottom: 0;
  border-radius: ${radius.card.default} ${radius.card.default} 0 0;
  padding: 16px;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${semantic.background.primary};
`;

const WidgetLabel = styled.span`
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.tertiary};
`;

const WidgetValue = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: ${textScale['2xl'].fontSize};
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;
  color: ${semantic.text.primary};
  small {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: ${textScale.xs.fontSize};
    font-weight: ${fontWeight.medium};
    color: ${semantic.status.success};
  }
`;

const GaugeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  span {
    font-size: ${textScale.sm.fontSize};
    color: ${semantic.text.secondary};
  }
`;

const SPARK = '0,52 30,48 60,50 90,40 120,42 150,34 180,30 210,24 240,26 270,18 300,14';

export function Hero() {
  return (
    <HeroSection aria-labelledby="hero-title">
      <DotGrid aria-hidden />
      <Container>
        <Copy>
          <Eyebrow data-hero="eyebrow">
            <Sparkle size={14} weight="fill" aria-hidden />
            SEO + AI visibility workspace
          </Eyebrow>
          <Display id="hero-title">
            <Line data-hero="line">
              Be the answer in
              {' '}
              <EngineSlot aria-live="off">
                <span data-hero="engine">{ENGINES[0]}</span>
              </EngineSlot>
            </Line>
            <Line data-hero="line">— everywhere buyers search.</Line>
          </Display>
          <CtaRow data-hero="cta">
            <CtaLink href={SIGN_UP_HREF}>
              Start 7-day free trial
              <ArrowRight size={18} weight="bold" aria-hidden />
            </CtaLink>
            <CtaLink href="#workflow" $variant="secondary">See the workflow</CtaLink>
          </CtaRow>
        </Copy>

        <Proof data-hero="proof">
          <ProofText>
            <strong>One score for rankings and AI citations.</strong>
            {' '}
            Ranksmile tracks where each engine names your brand — and what to publish to change it.
          </ProofText>
          <Engines aria-label="Engines tracked by Ranksmile">
            {ENGINES.map((engine) => (
              <EngineChip key={engine}>
                <Sparkle size={12} weight="fill" aria-hidden />
                {engine}
              </EngineChip>
            ))}
          </Engines>
        </Proof>

        <PreviewWrap data-hero="preview">
          <Preview role="img" aria-label="Ranksmile dashboard: clicks, AI visibility and Content Score widgets">
            <PreviewBar aria-hidden>
              <span />
              <span />
              <span />
            </PreviewBar>
            <PreviewBody aria-hidden>
              <PreviewSide>
                <SideItem $active>Dashboard</SideItem>
                <SideItem>Recommendations</SideItem>
                <SideItem>Content Editor</SideItem>
                <SideGroup>SEO</SideGroup>
                <SideItem>Rank tracking</SideItem>
                <SideItem>Keyword research</SideItem>
                <SideItem>Coverage gap</SideItem>
                <SideGroup>AI visibility</SideGroup>
                <SideItem>Overview</SideItem>
                <SideItem>Sources</SideItem>
                <SideItem>Competitors</SideItem>
                <SideItem>Prompts</SideItem>
              </PreviewSide>
              <PreviewMain>
                <Greeting>Good morning, Alex</Greeting>
                <Summary>
                  Your site received
                  {' '}
                  <b>3,270 clicks</b>
                  {' '}
                  — a 19% increase vs the last 30 days. Your AI Visibility is
                  {' '}
                  <mark>21</mark>
                  , placing you
                  {' '}
                  <b>4th</b>
                  {' '}
                  behind
                  {' '}
                  <mark>Northwind 81</mark>
                  ,
                  {' '}
                  <mark>Contoso 71</mark>
                  {' '}
                  and
                  {' '}
                  <mark>Fabrikam 68</mark>
                  .
                </Summary>
                <Widgets>
                  <Widget>
                    <WidgetLabel>Clicks · last 30 days</WidgetLabel>
                    <WidgetValue>
                      3,270
                      <small>
                        <TrendUp size={12} weight="bold" />
                        19%
                      </small>
                    </WidgetValue>
                    <svg viewBox="0 0 300 60" preserveAspectRatio="none" width="100%" height="56" aria-hidden>
                      <defs>
                        <linearGradient id="hero-spark" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="var(--koala-bg-brand)" stopOpacity="0.22" />
                          <stop offset="1" stopColor="var(--koala-bg-brand)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points={`0,60 ${SPARK} 300,60`} fill="url(#hero-spark)" />
                      <polyline points={SPARK} fill="none" stroke="var(--koala-bg-brand)" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </Widget>
                  <Widget>
                    <WidgetLabel>AI Visibility · 5 engines</WidgetLabel>
                    <WidgetValue>21</WidgetValue>
                    <svg viewBox="0 0 300 60" preserveAspectRatio="none" width="100%" height="56" aria-hidden>
                      <polyline
                        points="0,56 60,56 120,54 180,52 220,40 260,28 300,16"
                        fill="none"
                        stroke="var(--koala-text-secondary)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Widget>
                  <Widget>
                    <WidgetLabel>Content Score · latest draft</WidgetLabel>
                    <GaugeRow>
                      <Gauge score={91} size="sm" />
                      <span>Ready to publish</span>
                    </GaugeRow>
                  </Widget>
                </Widgets>
              </PreviewMain>
            </PreviewBody>
          </Preview>
        </PreviewWrap>
      </Container>
    </HeroSection>
  );
}

export default Hero;
