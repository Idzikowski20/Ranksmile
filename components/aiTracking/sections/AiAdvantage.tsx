import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Section } from '../../landing/primitives';
import { ADVANTAGE, ENGINES, SIGN_UP_HREF } from '../content';

/*
 * Figma 3:4794 — px 135, py 180, gap 270: head (blue tag · 55.2 H2 · 23.2 sub);
 * two r45 cards (text 63px padding + 575×383 image); 1170×585 r45 media (360° wire + gradient);
 * 28.8px body lines; CTA.
 */

const Wrap = styled(Section)`
  padding: 180px 0;
  ${BP.md} {
    padding: 72px 0;
  }
`;

const Inner = styled.div`
  max-width: 1170px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 270px;
  ${BP.md} {
    gap: 90px;
  }
`;

const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: 90px;
  ${BP.md} {
    gap: 45px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26.6px;
  max-width: 810px;
  margin: 0 auto;
  text-align: center;
  p.tag {
    margin: 0;
    font-size: 20.3px;
    line-height: 24.3px;
    font-weight: ${fontWeight.bold};
    text-transform: uppercase;
    color: var(--landing-blue);
  }
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p.sub {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.secondary};
  }
  ${BP.md} {
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
    p.sub {
      font-size: 18px;
      line-height: 26px;
    }
  }
`;

const Cards = styled.div`
  display: flex;
  gap: 16px;
  align-items: stretch;
  ${BP.lg} {
    flex-direction: column;
  }
`;

const Card = styled.article<{ $imageFirst: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: ${(p) => (p.$imageFirst ? 'column-reverse' : 'column')};
  overflow: hidden;
  border-radius: 45px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  ${BP.md} {
    border-radius: 27px;
  }
`;

const CardText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 78px 63px;
  h3 {
    margin: 0;
    font-size: 28.8px;
    line-height: 36px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    i {
      font-style: italic;
    }
  }
  p {
    margin: 0;
    font-size: 20.3px;
    line-height: 30.39px;
    color: ${semantic.text.primary};
    span {
      color: ${semantic.text.secondary};
    }
  }
  ${BP.md} {
    padding: 36px 27px;
  }
`;

const CardImg = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 575.09 / 383.39;
  object-fit: cover;
`;

const Bottom = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 44.5px;
  text-align: center;
`;

const Media = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1170.19 / 585.09;
  margin-bottom: 0.5px;
  border-radius: 45px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.inverse};
  img.wire {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100%;
    height: 191%;
    transform: translate(-50%, -50%);
    object-fit: cover;
    opacity: 0.9;
  }
  &::after {
    content: '';
    position: absolute;
    inset: -1px;
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.73) 100%), rgba(0,0,0,0.35);
  }
  ${BP.md} {
    border-radius: 27px;
  }
`;

const MediaEngines = styled.div`
  position: absolute;
  z-index: 1;
  inset: auto 0 54px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 0 27px;
  span {
    padding: 9px 18px;
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.08);
    color: #fff;
    font-size: 18px;
    font-weight: ${fontWeight.medium};
  }
`;

const Body = styled.p`
  margin: 0;
  max-width: 990px;
  font-size: 28.8px;
  line-height: 36px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.secondary};
  }
  em {
    font-style: normal;
    color: ${semantic.text.brand};
  }
  ${BP.md} {
    font-size: 20px;
    line-height: 28px;
  }
`;

export function AiAdvantage() {
  return (
    <Wrap aria-labelledby="advantage-title">
      <Container>
        <Inner>
          <Top>
            <Head data-reveal>
              <p className="tag">{ADVANTAGE.eyebrow}</p>
              <h2 id="advantage-title">
                {ADVANTAGE.titleLines[0]}
                <br />
                {ADVANTAGE.titleLines[1]}
              </h2>
              <p className="sub">
                {ADVANTAGE.subLines[0]}
                <br />
                {ADVANTAGE.subLines[1]}
              </p>
            </Head>
            <Cards>
              {ADVANTAGE.cards.map((c) => (
                <Card key={c.strong} $imageFirst={c.imageFirst} data-reveal>
                  <CardText>
                    <h3>
                      <i>{c.italic}</i>
                      {c.strong}
                    </h3>
                    <p>
                      {c.lead}
                      <span>{c.muted}</span>
                    </p>
                  </CardText>
                  <CardImg src={c.image} alt="" loading="lazy" width={575} height={383} />
                </Card>
              ))}
            </Cards>
          </Top>

          <Bottom>
            <Media data-reveal role="img" aria-label="Ranksmile tracks every major AI engine">
              <img className="wire" src="/ai-tracking/advantage-360.svg" alt="" loading="lazy" />
              <MediaEngines>
                {ENGINES.map((e) => <span key={e}>{e}</span>)}
              </MediaEngines>
            </Media>
            <Body data-reveal>
              {ADVANTAGE.body1strong}
              <span>{ADVANTAGE.body1}</span>
            </Body>
            <Body data-reveal style={{ maxWidth: 810 }}>
              {ADVANTAGE.body2}
              <em>{ADVANTAGE.body2accent}</em>
            </Body>
            <CtaLink href={SIGN_UP_HREF} data-reveal>{ADVANTAGE.cta}</CtaLink>
          </Bottom>
        </Inner>
      </Container>
    </Wrap>
  );
}

export default AiAdvantage;
