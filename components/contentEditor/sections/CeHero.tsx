import React from 'react';
import styled from '@emotion/styled';
import { Play } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Section } from '../../landing/primitives';
import { HERO, SIGN_UP_HREF, A } from '../content';

/*
 * Figma 5:6 — decorative arc (opacity .5) · head py 126 gap 54 (20.3 eyebrow · 99px H1 · 27px sub ·
 * explainer + CTA) · editor image 1386×746 r18 @ .25 with 414×929 toolbar pinned right · purple WRITE
 * box 504 tall r18 (pill · kicker · 45px H3 · arrow).
 */

const Wrap = styled(Section)`
  position: relative;
  overflow: hidden;
  margin-top: -92px;
  padding-top: 92px;
  ${BP.md} {
    margin-top: -73px;
    padding-top: 73px;
  }
`;

const Arc = styled.div`
  position: absolute;
  left: 3.12%;
  right: 3.12%;
  top: 90px;
  height: 905px;
  pointer-events: none;
  opacity: 0.5;
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 12%;
    width: 92%;
    height: 180%;
    transform: translateX(-50%);
    border-radius: 50% 50% 0 0 / 100% 100% 0 0;
    border: 54px solid ${semantic.background.secondary};
    border-bottom: 0;
    box-sizing: border-box;
  }
`;

const Head = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 54px;
  padding: 126px 0;
  text-align: center;
  ${BP.md} {
    padding: 72px 0 54px;
    gap: 36px;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 34.6px;
  p.eyebrow {
    margin: 0;
    font-size: 20.3px;
    line-height: 20.25px;
    font-weight: ${fontWeight.medium};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  h1 {
    margin: 0;
    font-size: 99px;
    line-height: 99px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p.sub {
    margin: 0;
    max-width: 990px;
    padding: 0 36px;
    font-size: 27px;
    line-height: 40.51px;
    color: ${semantic.text.primary};
  }
  ${BP.lg} {
    h1 {
      font-size: 72px;
      line-height: 74px;
    }
  }
  ${BP.md} {
    h1 {
      font-size: 44px;
      line-height: 48px;
    }
    p.sub {
      padding: 0;
      font-size: 19px;
      line-height: 29px;
    }
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 18px;
  row-gap: 12px;
`;

const Explainer = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 27px;
  padding: 9px 27px 9px 9px;
  border-radius: 13.5px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  text-decoration: none;
  font-size: 19.8px;
  line-height: 19.8px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.tertiary};
  span.thumb {
    position: relative;
    width: 96px;
    height: 54px;
    overflow: hidden;
    border-radius: 9px;
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    i {
      position: absolute;
      left: 50%;
      top: 12px;
      width: 30px;
      height: 30px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: ${semantic.background.primary};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${semantic.text.primary};
    }
  }
  &:hover {
    color: ${semantic.text.primary};
  }
`;

const Stage = styled.div`
  position: relative;
  padding: 27px;
  ${BP.md} {
    padding: 0;
  }
`;

const Editor = styled.div`
  overflow: hidden;
  border-radius: 18px;
  img {
    display: block;
    width: 100%;
    height: auto;
    opacity: 0.25;
  }
`;

const Toolbar = styled.div`
  position: absolute;
  right: 27px;
  top: 27px;
  height: calc(100% + 647px); /* 1420.44 vs 746.34 image — the toolbar scrolls past the image into the WRITE box */
  padding-top: 311.46px;
  width: 414.06px;
  pointer-events: none;
  z-index: 2;
  img {
    position: sticky;
    top: 0;
    display: block;
    width: 414.06px;
    height: 929.2px;
    object-fit: cover;
    object-position: top;
    border-radius: 9px;
    box-shadow: 0px 2px 3px rgba(0,0,0,0.04), 0px 24px 68px rgba(47,48,55,0.05), 0px 4px 6px rgba(34,42,53,0.04), 0px 1px 1px rgba(0,0,0,0.05);
  }
  ${BP.lg} {
    display: none;
  }
`;

const WriteWrap = styled.div`
  padding-top: 126px;
  ${BP.md} {
    padding-top: 54px;
  }
`;

const Write = styled.div`
  position: relative;
  height: 504.08px;
  box-sizing: border-box;
  padding: 27px 540px 54px 27px;
  border-radius: 18px;
  background: var(--landing-blue);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  ${BP.lg} {
    padding-right: 27px;
    height: auto;
    gap: 54px;
  }
`;

const Pill = styled.span`
  align-self: flex-start;
  padding: 8px 18px 7.2px;
  border-radius: 90px;
  background: ${semantic.background.inverse};
  font-size: 15.8px;
  line-height: 18.9px;
  font-weight: ${fontWeight.medium};
  text-transform: uppercase;
  color: ${semantic.text.onInverse};
`;

const WriteCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 26px;
  p {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 18px;
    line-height: 27px;
    img {
      width: 18px;
      height: 18px;
    }
  }
  h3 {
    margin: 0;
    font-size: 45px;
    line-height: 54px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
  }
  ${BP.md} {
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
`;

const Arrow = styled.img`
  position: absolute;
  right: 504px;
  top: 20%;
  width: 270px;
  height: auto;
  ${BP.lg} {
    display: none;
  }
`;

export function CeHero() {
  return (
    <Wrap aria-labelledby="ce-hero-title">
      <Arc aria-hidden />
      <Container>
        <Head>
          <Copy>
            <p className="eyebrow" data-hero="eyebrow">{HERO.eyebrow}</p>
            <h1 id="ce-hero-title" data-hero="line">
              {HERO.titleLines[0]}
              <br />
              {HERO.titleLines[1]}
            </h1>
            <p className="sub" data-hero="line">{HERO.subLines.join(' ')}</p>
          </Copy>
          <Actions data-hero="cta">
            <Explainer href="#write">
              <span className="thumb">
                <img src={`${A}/hero-explainer.png`} alt="" width={96} height={54} />
                <i aria-hidden><Play size={14} weight="fill" /></i>
              </span>
              {HERO.explainer}
            </Explainer>
            <CtaLink href={SIGN_UP_HREF}>
              {HERO.cta}
              <img src={`${A}/hero-arrow.svg`} alt="" width={24.75} height={24.75} style={{ filter: 'brightness(0) invert(1)' }} />
            </CtaLink>
          </Actions>
        </Head>

        <Stage data-hero="preview">
          <Editor>
            <img src={`${A}/hero-editor.png`} alt="Ranksmile Content Editor — follow-up email templates draft" width={1386} height={746} />
          </Editor>
          <Toolbar aria-hidden>
            <img src={`${A}/hero-toolbar.png`} alt="" width={414} height={929} />
          </Toolbar>
          <WriteWrap id="write">
            <Write data-reveal>
              <Pill>{HERO.write.pill}</Pill>
              <WriteCopy>
                <p>
                  <img src={`${A}/hero-star.svg`} alt="" width={18} height={18} />
                  {HERO.write.kicker}
                </p>
                <h3>
                  {HERO.write.titleLines.map((l, i) => (
                    <React.Fragment key={l}>
                      {l}
                      {i < 2 ? <br /> : null}
                    </React.Fragment>
                  ))}
                </h3>
              </WriteCopy>
              <Arrow src={`${A}/hero-gauge.svg`} alt="" aria-hidden />
            </Write>
          </WriteWrap>
        </Stage>
      </Container>
    </Wrap>
  );
}

export default CeHero;
