import React from 'react';
import styled from '@emotion/styled';
import {
  ChartLineUp,
  FileText,
  Gauge,
  GithubLogo,
  GoogleLogo,
  MagnifyingGlass,
  OpenAiLogo,
  Sparkle,
  SquaresFour,
  Stack,
} from '@phosphor-icons/react';
import { Icon } from '../../koala/icons/Icon';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, DotCanvas, Section } from '../primitives';
import { ENGINES, HERO_AVATARS, SIGN_UP_HREF } from '../content';

/*
 * Hybrid hero — Surfer accents (typed engine headline, dot canvas) on the Koala UI
 * centred hero shell (Figma 4009:213717): badge pill, brand + outline button pair,
 * tab pills over the product shot, bottom white fade.
 */

const HeroSection = styled(Section)`
  overflow: hidden;
  margin-top: -73px; /* the floating nav (9 + 64) sits over the canvas */
`;

const Inner = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 64px;
  ${BP.md} {
    gap: 40px;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding-top: 170px; /* canvas offset + floating nav */
  text-align: center;
  ${BP.md} {
    padding-top: 140px;
    gap: 24px;
  }
`;

/* Badge pill — Figma Content Badge: white, 1px border, fully rounded. */
const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 8px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 56px;
  background: ${semantic.background.primary};
  font-size: 14px;
  line-height: 20px;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.4px;
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.brand};
  }
`;

const H1 = styled.h1`
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: ${fontWeight.bold};
  font-size: 64px;
  line-height: 71px;
  letter-spacing: -1.9px;
  color: ${semantic.text.primary};
  ${BP.lg} {
    font-size: 54px;
    line-height: 60px;
    letter-spacing: -1.5px;
  }
  ${BP.md} {
    font-size: 42px;
    line-height: 48px;
    letter-spacing: -1.1px;
  }
  ${BP.sm} {
    font-size: 34px;
    line-height: 40px;
    letter-spacing: -0.9px;
  }
`;

const Row = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
`;

const EngineIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 8px;
  color: ${semantic.text.brand};
  svg {
    width: 46px;
    height: 46px;
  }
  ${BP.md} {
    width: 42px;
    height: 42px;
    margin: 0 5px;
    svg {
      width: 32px;
      height: 32px;
    }
  }
`;

const Caret = styled.span`
  display: inline-block;
  width: 2.25px;
  height: 0.85em;
  margin: 0 0 0.06em 2px;
  background: ${semantic.text.primary};
  animation: landing-caret 1.1s steps(2, start) infinite;
  @keyframes landing-caret {
    to { visibility: hidden; }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* Button pair — Figma Button Group: brand fill + outline, Koala button tokens. */

const Buttons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
`;

const BrandBtn = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 18px;
  border-radius: ${semantic.button.brand.radius};
  background: ${semantic.button.brand.bg};
  color: ${semantic.button.brand.fg};
  text-decoration: none;
  font-size: 15.8px;
  line-height: 22px;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.4px;
  transition: background var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard);
  &:hover {
    background: ${semantic.button.brand.bgHover};
  }
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
`;

const OutlineBtn = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 18px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${semantic.button.brand.radius};
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  text-decoration: none;
  font-size: 15.8px;
  line-height: 22px;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.4px;
  box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.04);
  transition: background var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard);
  &:hover {
    background: ${semantic.background.secondary};
  }
  &:active {
    transform: translateY(1px);
  }
  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
`;

/* Social proof — Surfer copy in the Figma centred avatar-row shape. */

const Proof = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const ProofLine = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: -0.25px;
  color: ${semantic.text.secondary};
  strong {
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
`;

const AvatarList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  height: 32px;
  max-width: 100%;
`;

const AvatarItem = styled.li`
  position: relative;
  width: 24px;
  height: 32px;
  flex-shrink: 0;
  &:last-of-type {
    width: 32px;
  }
`;

const Avatar = styled.span`
  position: absolute;
  left: 0;
  top: 0;
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  border: 2px solid ${semantic.background.primary};
  background: ${semantic.background.secondary};
  color: ${semantic.text.primary};
  font-size: 13.5px;
  line-height: 20px;
  font-weight: ${fontWeight.bold};
  box-shadow: 0 0 0 1px ${semantic.border.primary};
  svg {
    width: 16px;
    height: 16px;
  }
`;

/* Product stage — Figma: tab pills row + top-rounded shot with a deep soft shadow. */

const Stage = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  ${BP.md} {
    gap: 16px;
  }
`;

const Tabs = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  ${BP.md} {
    gap: 8px;
  }
`;

const Tab = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${semantic.button.brand.radius};
  background: ${(p) => (p.$active ? semantic.background.secondary : semantic.background.primary)};
  box-shadow: ${(p) => (p.$active ? 'none' : '0px 1px 1px rgba(0, 0, 0, 0.04)')};
  font-size: 16px;
  line-height: 24px;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.25px;
  color: ${(p) => (p.$active ? semantic.text.primary : semantic.text.secondary)};
  white-space: nowrap;
  svg {
    flex-shrink: 0;
  }
  ${BP.sm} {
    font-size: 14px;
  }
`;

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1216 / 800;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 16px 16px 0 0;
  background: ${semantic.background.tertiary};
  box-shadow: 0px 25px 100px 0px rgba(0, 0, 0, 0.1);
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
  ${BP.md} {
    aspect-ratio: auto;
    height: 380px;
    border-radius: 12px 12px 0 0;
  }
`;

/* Bottom fade — Figma Overlay: the shot melts into the page background. */
const Fade = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 192px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, ${semantic.background.primary});
  ${BP.md} {
    height: 96px;
  }
`;

const TABS = [
  { label: 'Dashboard', icon: SquaresFour, active: true },
  { label: 'AI Visibility', icon: Sparkle },
  { label: 'Content Score', icon: Gauge },
  { label: 'Rank Tracking', icon: ChartLineUp },
  { label: 'Keyword Gap', icon: MagnifyingGlass },
  { label: 'Reports', icon: FileText },
] as const;

const AVATAR_ICON = {
  google: GoogleLogo,
  openai: OpenAiLogo,
  github: GithubLogo,
} as const;

export function Hero() {
  return (
    <HeroSection aria-labelledby="hero-title">
      <DotCanvas aria-hidden />
      <Container style={{ position: 'relative' }}>
        <Inner>
          <Copy>
            <Badge data-hero="eyebrow">
              <Stack size={18} weight="fill" aria-hidden />
              AI visibility platform
            </Badge>

            <H1 id="hero-title">
              <Row data-hero="line">
                Be The Answer in
                <EngineIcon aria-hidden>
                  <Icon name="Sparkle" size={46} weight="fill" />
                </EngineIcon>
                <span data-hero="engine">{ENGINES[0]}</span>
                <Caret aria-hidden />
              </Row>
              <Row data-hero="line">– Everywhere Buyers Search.</Row>
            </H1>

            <Buttons data-hero="cta">
              <BrandBtn href={SIGN_UP_HREF}>Try Ranksmile Platform</BrandBtn>
              <OutlineBtn href="#platform">Explore features</OutlineBtn>
            </Buttons>

            <Proof data-hero="proof">
              <AvatarList aria-label="Engines and integrations Ranksmile works with">
                {HERO_AVATARS.map((a) => {
                  const IconComp = a.icon ? AVATAR_ICON[a.icon] : null;
                  return (
                    <AvatarItem key={a.label} title={a.label}>
                      <Avatar role="img" aria-label={a.label}>
                        {IconComp ? <IconComp weight="bold" aria-hidden /> : a.letter}
                      </Avatar>
                    </AvatarItem>
                  );
                })}
              </AvatarList>
              <ProofLine>
                Marketers, Agencies, and SEOs
                {' '}
                <strong>grow and get mentioned</strong>
                {' '}
                with Ranksmile every day
              </ProofLine>
            </Proof>
          </Copy>

          <Stage data-hero="preview">
            <Tabs aria-hidden>
              {TABS.map(({ label, icon: TabIcon, ...t }) => (
                <Tab key={label} $active={'active' in t && t.active}>
                  <TabIcon size={20} weight="bold" />
                  {label}
                </Tab>
              ))}
            </Tabs>
            <Frame>
              <img
                src="/landing/hero-koala-dashboard.png"
                alt="Ranksmile dashboard with AI visibility metrics"
                width={1216}
                height={800}
              />
            </Frame>
          </Stage>

          <Fade aria-hidden />
        </Inner>
      </Container>
    </HeroSection>
  );
}

export default Hero;
