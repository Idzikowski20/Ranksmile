import React from 'react';
import styled from '@emotion/styled';
import { GithubLogo, GoogleLogo, OpenAiLogo, Sparkle, Stack } from '@phosphor-icons/react';
import { Icon } from '../../koala/icons/Icon';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, DotCanvas, Eyebrow, Section } from '../primitives';
import { ENGINES, HERO_AVATARS, SIGN_UP_HREF } from '../content';

/* Figma 1:6 — section gap 90, pb 90; content column px 27 + pl 13.5; copy block py 90, gap 45. */

const HeroSection = styled(Section)`
  overflow: hidden;
  padding-bottom: 90px;
  margin-top: -92px; /* the floating nav sits over the canvas, as in the reference */
  ${BP.md} {
    padding-bottom: 54px;
    margin-top: -73px;
  }
`;

const Inner = styled.div`
  position: relative;
  padding: 0 0 0 13.5px;
  min-height: 720px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  ${BP.md} {
    padding-left: 0;
    min-height: 0;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 45px;
  max-width: 1170px;
  padding: 90px 0;
  padding-top: 200px; /* 108 canvas offset + 92 nav */
  ${BP.md} {
    padding-top: 150px;
    gap: 32px;
  }
`;

const EyebrowRow = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  svg {
    color: ${semantic.text.brand};
  }
`;

const H1 = styled.h1`
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-weight: ${fontWeight.bold};
  font-size: 76.5px;
  line-height: 84.16px;
  letter-spacing: -2.25px;
  color: ${semantic.text.primary};
  ${BP.lg} {
    font-size: 64px;
    line-height: 70px;
    letter-spacing: -1.8px;
  }
  ${BP.md} {
    font-size: 48px;
    line-height: 54px;
    letter-spacing: -1.3px;
  }
  ${BP.sm} {
    font-size: 38px;
    line-height: 44px;
    letter-spacing: -1px;
  }
`;

const Row = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
`;

const EngineIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76.5px;
  height: 76.5px;
  margin: 0 11.477px;
  color: ${semantic.text.brand};
  svg {
    width: 55px;
    height: 55px;
  }
  ${BP.md} {
    width: 48px;
    height: 48px;
    margin: 0 6px;
    svg {
      width: 36px;
      height: 36px;
    }
  }
`;

const Caret = styled.span`
  display: inline-block;
  width: 2.25px;
  height: 68.86px;
  margin: 0 0 6.121px 2px;
  background: ${semantic.text.primary};
  animation: landing-caret 1.1s steps(2, start) infinite;
  @keyframes landing-caret {
    to { visibility: hidden; }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  ${BP.md} {
    height: 0.9em;
  }
`;

const CtaWrap = styled.div`
  padding-top: 36px;
  ${BP.md} {
    padding-top: 0;
  }
`;

/* Proof row — Figma 1:83: 90px tall; line at top, avatars + copy at 54px; rating right at 1107px. */

const Proof = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: 27px 36px;
  row-gap: 27px;
  align-items: center;
  min-height: 90px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    row-gap: 18px;
  }
`;

const ProofLine = styled.p`
  grid-column: 1 / -1;
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  strong {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
  }
`;

const AvatarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 27px;
  ${BP.sm} {
    flex-wrap: wrap;
    gap: 12px;
  }
`;

const AvatarList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  height: 36px;
  max-width: 100%;
  ${BP.sm} {
    height: 30px;
  }
`;

const AvatarItem = styled.li`
  position: relative;
  width: 29.7px;
  height: 36px;
  flex-shrink: 0;
  &:last-of-type {
    width: 36px;
  }
  ${BP.sm} {
    /* tighten the 13-avatar overlap so the stack fits a 354px mobile column */
    width: 22px;
    height: 30px;
    &:last-of-type {
      width: 30px;
    }
  }
`;

const Avatar = styled.span`
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  border: 2px solid ${semantic.background.primary};
  background: ${semantic.background.secondary};
  color: ${semantic.text.primary};
  font-size: 15.3px;
  line-height: 22.95px;
  font-weight: ${fontWeight.bold};
  box-shadow: 0 0 0 1px ${semantic.border.primary};
  svg {
    width: 18px;
    height: 18px;
  }
  ${BP.sm} {
    width: 30px;
    height: 30px;
    font-size: 13px;
    svg {
      width: 15px;
      height: 15px;
    }
  }
`;

const Dot = styled.span`
  position: absolute;
  left: 16.2px;
  top: 41.4px;
  width: 3.59px;
  height: 3.59px;
  border-radius: 0.54px;
  background: ${semantic.background.brand};
`;

const Already = styled.p`
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  white-space: nowrap;
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  justify-self: end;
  ${BP.lg} {
    justify-self: start;
  }
`;

const EngineDots = styled.span`
  display: inline-flex;
  gap: 3px;
  svg {
    color: ${semantic.text.brand};
  }
`;

/* Video frame — Figma 1:176: aspect 1440/675, radius 27, border, product still inside. */

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1440.23 / 675.11;
  overflow: hidden;
  border-radius: 27px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  box-shadow: 0px 24px 68px 0px rgba(47,48,55,0.06);
  ${BP.md} {
    aspect-ratio: auto;
    height: 420px;
    border-radius: 18px;
  }
`;

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
            <EyebrowRow data-hero="eyebrow">
              <Stack size={15.75} weight="fill" aria-hidden />
              <Eyebrow>AI visibility platform</Eyebrow>
            </EyebrowRow>

            <H1 id="hero-title">
              <Row data-hero="line">
                Be The Answer in
                <EngineIcon aria-hidden>
                  <Icon name="Sparkle" size={55} weight="fill" />
                </EngineIcon>
                <span data-hero="engine">{ENGINES[0]}</span>
                <Caret aria-hidden />
              </Row>
              <Row data-hero="line">– Everywhere Buyers Search.</Row>
            </H1>

            <CtaWrap data-hero="cta">
              <CtaLink href={SIGN_UP_HREF}>Try Ranksmile Platform →</CtaLink>
            </CtaWrap>
          </Copy>

          <Proof data-hero="proof">
            <ProofLine>
              Marketers, Agencies, and SEOs
              {' '}
              <strong>grow and get mentioned</strong>
              {' '}
              with Ranksmile every day
            </ProofLine>
            <AvatarRow>
              <AvatarList aria-label="Engines and integrations Ranksmile works with">
                {HERO_AVATARS.map((a) => {
                  const IconComp = a.icon ? AVATAR_ICON[a.icon] : null;
                  return (
                    <AvatarItem key={a.label} title={a.label}>
                      <Avatar role="img" aria-label={a.label}>
                        {IconComp ? <IconComp weight="bold" aria-hidden /> : a.letter}
                      </Avatar>
                      {a.dot ? <Dot aria-hidden /> : null}
                    </AvatarItem>
                  );
                })}
              </AvatarList>
              <Already>Already the answer. Are you?</Already>
            </AvatarRow>
            <Rating>
              <EngineDots aria-hidden>
                {ENGINES.map((e) => <Sparkle key={e} size={19} weight="fill" />)}
              </EngineDots>
              <Eyebrow>{`${ENGINES.length} engines · tracked daily`}</Eyebrow>
            </Rating>
          </Proof>
        </Inner>

        <Frame data-hero="preview">
          {/* The reference poster frame is a blank white still; the dashboard render is the product shot. */}
          <img
            src="/landing/cta-dashboard.png"
            alt="Ranksmile dashboard with AI visibility metrics"
            width={1440}
            height={1160}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        </Frame>
      </Container>
    </HeroSection>
  );
}

export default Hero;
