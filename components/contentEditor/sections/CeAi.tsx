import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { AI, A } from '../content';

/* Figma 5:483 — pt 125 gap 108: head (eyebrow · 45px H3 with underline svg under "in minutes?") ·
   purple grid .5fr/1fr h 519 (text + 887×499 r18 shot) · two #f8f9fa cards (E-E-A-T · Templates, art inset -15%). */

const Wrap = styled(Section)`
  padding-top: 125px;
  ${BP.md} {
    padding-top: 72px;
  }
`;

const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 108px;
  ${BP.md} {
    gap: 45px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 27px;
  max-width: 990px;
  padding: 0 27px;
  p {
    margin: 0;
    font-size: 20.3px;
    line-height: 20.25px;
    font-weight: ${fontWeight.medium};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  h3 {
    margin: 0;
    font-size: 45px;
    line-height: 54px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    span {
      position: relative;
      display: inline-block;
      img {
        position: absolute;
        left: 4.5%;
        right: 5.5%;
        bottom: -31.5px;
        width: 90%;
        height: auto;
      }
    }
  }
  ${BP.md} {
    padding: 0;
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
`;

const Main = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.5fr) minmax(0, 1fr);
  height: 518.83px;
  overflow: hidden;
  border-radius: 13.5px;
  border: 1px solid var(--landing-blue);
  background: var(--landing-blue);
  color: #fff;
  ${BP.lg} {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 672px;
  padding: 54px 27px;
  h5,
  h4 {
    margin: 0;
    font-size: 27px;
    line-height: 35.11px;
    letter-spacing: -0.72px;
    font-weight: ${fontWeight.bold};
    em {
      font-style: normal;
      color: var(--landing-blue);
    }
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
  }
  p.muted {
    opacity: 0.6;
  }
  ${BP.md} {
    padding: 27px 18px;
  }
`;

const MainShot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 36px 0;
  img {
    display: block;
    width: 100%;
    max-width: 887px;
    height: auto;
    border-radius: 18px 18px 0 0;
  }
`;

const Row = styled.div`
  display: flex;
  gap: 27px;
  ${BP.lg} {
    flex-direction: column;
  }
`;

const Card = styled.article`
  position: relative;
  display: flex;
  gap: 9px;
  width: 706.6px;
  max-width: 100%;
  overflow: hidden;
  border-radius: 13.5px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  color: ${semantic.text.primary};
  ${BP.lg} {
    width: auto;
    flex-direction: column;
  }
`;

const CardArt = styled.div<{ $w: number }>`
  position: relative;
  flex: 1;
  min-width: 0;
  max-height: 540px;
  overflow: hidden;
  img {
    position: absolute;
    left: 0;
    top: -15%;
    height: 130%;
    width: ${(p) => p.$w}%;
    max-width: none;
    object-fit: cover;
  }
  ${BP.lg} {
    height: 280px;
    img {
      position: static;
      width: 100%;
      height: 100%;
    }
  }
`;

export function CeAi() {
  return (
    <Wrap aria-labelledby="ai-title">
      <Container>
        <Inner>
          <Head data-reveal>
            <p>{AI.eyebrow}</p>
            <h3 id="ai-title">
              {AI.titleLines[0]}
              <br />
              {AI.titleLines[1]}
              <span>
                {AI.titleTail}
                <img src={`${A}/underline.svg`} alt="" aria-hidden />
              </span>
            </h3>
          </Head>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 27 }}>
            <Main data-reveal>
              <Text>
                <h5>
                  {AI.main.title[0]}
                  <br />
                  {AI.main.title[1]}
                </h5>
                <p>{AI.main.body}</p>
              </Text>
              <MainShot>
                <img src={`${A}/surfer-ai.png`} alt="Smily AI article generator" width={887} height={499} loading="lazy" />
              </MainShot>
            </Main>

            <Row>
              <Card data-reveal>
                <Text style={{ minWidth: 347, flexShrink: 0 }}>
                  <h4>
                    {AI.eeat.t1}
                    <br />
                    <em>{AI.eeat.accent}</em>
                    <br />
                    {AI.eeat.t2}
                  </h4>
                  <p className="muted">{AI.eeat.body}</p>
                </Text>
                <CardArt $w={153.49} aria-hidden>
                  <img src={`${A}/eeat.png`} alt="" loading="lazy" />
                </CardArt>
              </Card>
              <Card data-reveal>
                <Text style={{ minWidth: 347, flexShrink: 0 }}>
                  <h4>
                    {AI.templates.t1}
                    <em>{AI.templates.accent}</em>
                    <br />
                    {AI.templates.t2[0]}
                    <br />
                    {AI.templates.t2[1]}
                  </h4>
                  <p className="muted">{AI.templates.body}</p>
                </Text>
                <CardArt $w={160.9} aria-hidden>
                  <img src={`${A}/templates.png`} alt="" loading="lazy" />
                </CardArt>
              </Card>
            </Row>
          </div>
        </Inner>
      </Container>
    </Wrap>
  );
}

export default CeAi;
