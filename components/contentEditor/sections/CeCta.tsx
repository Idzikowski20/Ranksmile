import React from 'react';
import styled from '@emotion/styled';
import { fontWeight } from '../../koala/tokens/typography';
import { semantic } from '../../koala/tokens/semantic';
import { BP, Container, Section } from '../../landing/primitives';
import { CTA, SIGN_UP_HREF, A } from '../content';

/* Figma 5:2308 — purple rounded-top 27 band: 55.2px H2 · 24.7 sub · black CTA · 18px note · 1440×920 r18 shot. */

const Wrap = styled(Section)`
  overflow: hidden;
  border-radius: 27px 27px 0 0;
  background: var(--landing-blue);
  color: #fff;
  padding-top: 126px;
  ${BP.md} {
    padding-top: 72px;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 45px;
  max-width: 990px;
  margin: 0 auto;
  padding: 0 27px;
  text-align: center;
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
  }
  p.sub {
    margin: 17px 0 0;
    font-size: 24.7px;
    line-height: 37px;
  }
  p.note {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    opacity: 0.5;
  }
  ${BP.md} {
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
    p.sub {
      font-size: 18px;
      line-height: 28px;
    }
  }
`;

const Btn = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 18px 27px;
  border-radius: 13.5px;
  background: ${semantic.background.inverse};
  color: ${semantic.text.onInverse};
  text-decoration: none;
  font-size: 19.8px;
  line-height: 24.75px;
  font-weight: ${fontWeight.bold};
  box-shadow: inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25);
`;

const Shot = styled.div`
  margin-top: 90px;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  img {
    display: block;
    width: 100%;
    height: auto;
  }
  ${BP.md} {
    margin-top: 45px;
  }
`;

export function CeCta() {
  return (
    <Wrap aria-labelledby="ce-cta-title">
      <Container>
        <Copy data-reveal>
          <div>
            <h2 id="ce-cta-title">
              {CTA.titleLines[0]}
              <br />
              {CTA.titleLines[1]}
            </h2>
            <p className="sub">
              {CTA.subLines[0]}
              <br />
              {CTA.subLines[1]}
            </p>
          </div>
          <Btn href={SIGN_UP_HREF}>{CTA.cta}</Btn>
          <p className="note">{CTA.note}</p>
        </Copy>
        <Shot data-cta-mock>
          <img src={`${A}/cta-dashboard.png`} alt="Ranksmile SEO Content Editor dashboard" width={1440} height={920} loading="lazy" />
        </Shot>
      </Container>
    </Wrap>
  );
}

export default CeCta;
