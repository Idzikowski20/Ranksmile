import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CtaLink, Section } from '../primitives';
import { SIGN_UP_HREF } from '../content';

/* Figma 1:3692 — section py 126 px 27; band radius 27, pt 125, gap 45; dashboard 1440×675 crop. */

const Wrap = styled(Section)`
  padding: 126px 27px;
  ${BP.md} {
    padding: 54px 18px;
  }
`;

const Band = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 45px;
  max-width: 1866px;
  margin: 0 auto;
  padding-top: 125px;
  overflow: hidden;
  border-radius: 27px;
  background: ${semantic.background.brand};
  background-image: radial-gradient(ellipse 42% 42% at 50% 50%, rgba(0,0,0,0.14), transparent 70%);
  color: ${semantic.text.onBrand};
  text-align: center;
  ${BP.md} {
    padding-top: 63px;
    gap: 27px;
    border-radius: 18px;
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  max-width: 990px;
  padding: 0 27px;
  h2 {
    margin: 0;
    font-size: 44.5px;
    line-height: 53.41px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.onBrand};
  }
  p {
    margin: 0;
    max-width: 760px;
    font-size: 20.3px;
    line-height: 30.39px;
    color: ${semantic.text.onBrand};
    strong {
      font-weight: ${fontWeight.bold};
    }
  }
  ${BP.md} {
    h2 {
      font-size: 32px;
      line-height: 38px;
    }
    p {
      font-size: 17px;
      line-height: 26px;
    }
  }
`;

const Stage = styled.div`
  position: relative;
  width: 100%;
  max-width: 1440px;
  height: 675px;
  ${BP.md} {
    height: 420px;
  }
`;

const Shot = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 45px;
  height: 1160px;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  background: ${semantic.background.primary};
  box-shadow: 0 -10px 60px rgba(0,0,0,0.18);
  ${BP.md} {
    top: 0;
    height: 100%;
  }
`;

export function CtaBand() {
  return (
    <Wrap aria-labelledby="cta-title">
      <Band data-reveal>
        <Copy>
          <h2 id="cta-title">
            Elite Visibility System Without
            <br />
            the Enterprise Price Tag
          </h2>
          <p>
            Your buyers are already looking for you. Turn content into connections and
            {' '}
            <strong>become the brand that&apos;s seen, cited, and trusted — no matter where people search.</strong>
          </p>
        </Copy>
        <CtaLink href={SIGN_UP_HREF} $tone="inverse">Try Ranksmile for free →</CtaLink>
        <Stage>
          <Shot data-cta-mock>
            <img
              src="/landing/cta-dashboard.png"
              alt="Ranksmile dashboard with AI visibility metrics"
              loading="lazy"
              width={1440}
              height={1160}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          </Shot>
        </Stage>
      </Band>
    </Wrap>
  );
}

export default CtaBand;
