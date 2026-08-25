import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Section, Tag } from '../../landing/primitives';
import { CTA, SIGN_UP_HREF } from '../content';

/*
 * Figma 3:9779 — 1367 tall, radar-ring background, copy block 990 (tag at 192 · 69.1 H2 at 231 ·
 * 24.7 sub at 409 · CTA at 547); 1440×920 r18 dashboard image; bottom fade.
 */

const Wrap = styled(Section)`
  position: relative;
  overflow: hidden;
  border-radius: 27px 27px 0 0;
  padding-top: 192px;
  ${BP.md} {
    padding-top: 72px;
  }
`;

/* The reference background is concentric rings on black — drawn here as rings on white. */
const Rings = styled.div`
  position: absolute;
  left: 50%;
  top: 430px;
  width: 2400px;
  height: 2400px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  i {
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 50%;
    border: 1px solid ${semantic.border.primary};
    transform: translate(-50%, -50%);
  }
`;

const Copy = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  max-width: 990px;
  margin: 0 auto;
  text-align: center;
  h2 {
    margin: 15px 0 0;
    font-size: 69.1px;
    line-height: 75.99px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p {
    margin: 26px 0 0;
    font-size: 24.7px;
    line-height: 37px;
    color: ${semantic.text.secondary};
    strong {
      font-weight: ${fontWeight.regular};
      color: ${semantic.text.primary};
    }
  }
  a {
    margin-top: 36px;
  }
  ${BP.md} {
    h2 {
      font-size: 40px;
      line-height: 46px;
    }
    p {
      font-size: 18px;
      line-height: 28px;
    }
  }
`;

const Shot = styled.div`
  position: relative;
  width: 100%;
  margin-top: 72px;
  aspect-ratio: 1440.23 / 920.86;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
  ${BP.md} {
    margin-top: 45px;
  }
`;

const Fade = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 20%;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, ${semantic.background.primary});
`;

export function AiCta() {
  return (
    <Wrap aria-labelledby="ai-cta-title">
      <Rings aria-hidden>
        {[300, 560, 840, 1120, 1400, 1700].map((d, i) => (
          <i key={d} style={{ width: d, height: d, opacity: 0.9 - i * 0.13 }} />
        ))}
      </Rings>
      <Container style={{ position: 'relative' }}>
        <Copy data-reveal>
          <Tag>{CTA.eyebrow}</Tag>
          <h2 id="ai-cta-title">
            {CTA.titleLines[0]}
            <br />
            {CTA.titleLines[1]}
          </h2>
          <p>
            {CTA.sub}
            <strong>{CTA.subStrong}</strong>
          </p>
          <CtaLink href={SIGN_UP_HREF}>{CTA.cta}</CtaLink>
        </Copy>
        <Shot data-cta-mock role="img" aria-label="Ranksmile AI Tracker prompts dashboard">
          <img src="/ai-tracking/cta-prompts.png" alt="" loading="lazy" width={1440} height={920} />
        </Shot>
      </Container>
      <Fade aria-hidden />
    </Wrap>
  );
}

export default AiCta;
