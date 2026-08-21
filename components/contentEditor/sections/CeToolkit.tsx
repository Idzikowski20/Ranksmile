import React from 'react';
import styled from '@emotion/styled';
import { Star } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { TOOLKIT, A } from '../content';

/* Figma 5:442 — py 126 gap 126: centred head (20.3 eyebrow · 63px H2 · 20.3 sub) · 81px-radius band
   p 27 with 324×450 r27 image + quote (5 stars · 45px · author + mark). Rounded bottom 27. */

const Wrap = styled(Section)`
  border-radius: 0 0 27px 27px;
  padding: 126px 0;
  ${BP.md} {
    padding: 72px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 34.8px;
  padding: 0 27px;
  margin-bottom: 126px;
  text-align: center;
  p.eyebrow {
    margin: 0;
    font-size: 20.3px;
    line-height: 20.25px;
    font-weight: ${fontWeight.medium};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  h2 {
    margin: 0;
    font-size: 63px;
    line-height: 69.31px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p.sub {
    margin: 0;
    max-width: 990px;
    font-size: 20.3px;
    line-height: 30.38px;
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    margin-bottom: 54px;
    h2 {
      font-size: 34px;
      line-height: 40px;
    }
    p.sub {
      font-size: 17px;
      line-height: 26px;
    }
  }
`;

const Band = styled.div`
  display: flex;
  gap: 144px;
  padding: 27px;
  border-radius: 81px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  ${BP.lg} {
    flex-direction: column;
    gap: 45px;
    border-radius: 36px;
  }
`;

const Photo = styled.div`
  position: relative;
  width: 324px;
  height: 450px;
  flex-shrink: 0;
  border-radius: 27px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  i {
    position: absolute;
    right: -36px;
    top: 15%;
    width: 72px;
    height: 72px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    img {
      width: 72px;
      height: 72px;
    }
  }
  ${BP.lg} {
    width: 100%;
    height: 320px;
    i {
      display: none;
    }
  }
`;

const Quote = styled.div`
  position: relative;
  flex: 1;
  min-height: 450px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 36px;
  .stars {
    display: flex;
    gap: 3px;
    color: ${semantic.text.brand};
  }
  p {
    margin: 0;
    font-size: 45px;
    line-height: 54px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  .author {
    display: flex;
    align-items: center;
    gap: 45px;
    b {
      display: block;
      font-size: 18px;
      line-height: 27px;
      font-weight: ${fontWeight.bold};
      color: ${semantic.text.primary};
    }
    span {
      font-size: 18px;
      line-height: 27px;
      color: ${semantic.text.secondary};
    }
    img {
      width: 45px;
      height: 45px;
    }
  }
  ${BP.lg} {
    min-height: 0;
    p {
      font-size: 28px;
      line-height: 34px;
    }
  }
`;

export function CeToolkit() {
  return (
    <Wrap aria-labelledby="toolkit-title">
      <Container>
        <Head data-reveal>
          <p className="eyebrow">{TOOLKIT.eyebrow}</p>
          <h2 id="toolkit-title">
            {TOOLKIT.titleLines[0]}
            <br />
            {TOOLKIT.titleLines[1]}
          </h2>
          <p className="sub">
            {TOOLKIT.subLines[0]}
            <br />
            {TOOLKIT.subLines[1]}
          </p>
        </Head>
        <Band data-reveal>
          <Photo>
            <img src={`${A}/hero-explainer.png`} alt="" loading="lazy" />
            <i aria-hidden><img src={`${A}/quote-mark.svg`} alt="" /></i>
          </Photo>
          <Quote>
            <div className="stars" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} weight="fill" />)}
            </div>
            <p>
              {TOOLKIT.quoteLines.map((l, i) => (
                <React.Fragment key={l}>
                  {l}
                  {i < 2 ? <br /> : null}
                </React.Fragment>
              ))}
            </p>
            <div className="author">
              <div>
                <b>{TOOLKIT.name}</b>
                <span>{TOOLKIT.role}</span>
              </div>
              <img src="/favicon.svg" alt="" />
            </div>
          </Quote>
        </Band>
      </Container>
    </Wrap>
  );
}

export default CeToolkit;
