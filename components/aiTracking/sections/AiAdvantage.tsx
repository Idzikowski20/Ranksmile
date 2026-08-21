import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight, Waveform } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Eyebrow, H2, Lead, Section } from '../../landing/primitives';
import { ADVANTAGE, ENGINES, SIGN_UP_HREF } from '../content';

/* Figma 3:4794 — advantage head + wide media panel + two-line body + CTA. */

const Wrap = styled(Section)`
  padding: 90px 0 180px;
  ${BP.md} {
    padding: 54px 0 90px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 810px;
  margin: 0 auto 90px;
  text-align: center;
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const Media = styled.div`
  position: relative;
  aspect-ratio: 780 / 360;
  border-radius: 27px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background:
    radial-gradient(120% 120% at 50% 40%, color-mix(in srgb, var(--landing-blue) 22%, transparent), transparent 60%),
    ${semantic.background.inverse};
  display: flex;
  align-items: center;
  justify-content: center;
  ${BP.md} {
    aspect-ratio: 16 / 10;
  }
`;

const Waves = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 14px);
  mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, black, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, black, transparent 75%);
`;

const Engines = styled.div`
  position: relative;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  span {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    color: #fff;
    font-size: 15px;
    font-weight: ${fontWeight.medium};
  }
`;

const Body = styled.div`
  max-width: 760px;
  margin: 54px auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
  p {
    margin: 0;
    font-size: 20.3px;
    line-height: 30.39px;
    color: ${semantic.text.secondary};
    b {
      font-weight: ${fontWeight.bold};
      color: ${semantic.text.primary};
    }
    em {
      font-style: normal;
      color: ${semantic.text.brand};
      font-weight: ${fontWeight.bold};
    }
  }
`;

export function AiAdvantage() {
  return (
    <Wrap aria-labelledby="advantage-title">
      <Container>
        <Head data-reveal>
          <Eyebrow style={{ color: 'var(--landing-blue)' }}>{ADVANTAGE.eyebrow}</Eyebrow>
          <H2 id="advantage-title" $size={44.5}>
            {ADVANTAGE.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </H2>
          <Lead>{ADVANTAGE.sub}</Lead>
        </Head>

        <Media data-reveal role="img" aria-label="Ranksmile tracks every major AI engine">
          <Waves aria-hidden />
          <Engines>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Waveform size={18} weight="bold" aria-hidden />
              Live across
            </span>
            {ENGINES.map((e) => <span key={e}>{e}</span>)}
          </Engines>
        </Media>

        <Body data-reveal>
          <p>
            <b>{ADVANTAGE.body1strong}</b>
            {ADVANTAGE.body1}
          </p>
          <p>
            {ADVANTAGE.body2}
            <em>{ADVANTAGE.body2accent}</em>
          </p>
          <CtaLink href={SIGN_UP_HREF}>
            {ADVANTAGE.cta}
            <ArrowRight size={18} weight="bold" aria-hidden />
          </CtaLink>
        </Body>
      </Container>
    </Wrap>
  );
}

export default AiAdvantage;
