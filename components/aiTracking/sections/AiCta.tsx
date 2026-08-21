import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, DotCanvas, Eyebrow, Section } from '../../landing/primitives';
import { DashboardMock } from '../../landing/mocks/DashboardMock';
import { CTA, SIGN_UP_HREF } from '../content';

/* Figma 3:9779 — "Your Brand Deserves to Be Seen—Everywhere" + CTA + dashboard crop. */

const Wrap = styled(Section)`
  position: relative;
  overflow: hidden;
  padding: 126px 0 0;
  ${BP.md} {
    padding: 72px 0 0;
  }
`;

const Copy = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 810px;
  margin: 0 auto;
  text-align: center;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 55.2px;
  line-height: 60.67px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 36px;
    line-height: 42px;
  }
`;

const Sub = styled.p`
  margin: 0;
  max-width: 620px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.tertiary};
  strong {
    color: ${semantic.text.primary};
    font-weight: ${fontWeight.bold};
  }
`;

const Stage = styled.div`
  position: relative;
  width: 100%;
  max-width: 1216px;
  height: 520px;
  margin: 56px auto 0;
  ${BP.md} {
    height: 360px;
  }
`;

const Shot = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 900px;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  border: 1px solid ${semantic.border.primary};
  border-bottom: 0;
  background: ${semantic.background.primary};
  box-shadow: 0 -6px 60px rgba(0,0,0,0.12);
`;

export function AiCta() {
  return (
    <Wrap aria-labelledby="ai-cta-title">
      <DotCanvas aria-hidden style={{ top: 0, height: 520 }} />
      <Container style={{ position: 'relative' }}>
        <Copy data-reveal>
          <Eyebrow $tone="brand">{CTA.eyebrow}</Eyebrow>
          <Title id="ai-cta-title">
            {CTA.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </Title>
          <Sub>
            {CTA.sub}
            <strong>{CTA.subStrong}</strong>
          </Sub>
          <CtaLink href={SIGN_UP_HREF} style={{ marginTop: 12 }}>
            {CTA.cta}
            <ArrowRight size={18} weight="bold" aria-hidden />
          </CtaLink>
        </Copy>

        <Stage>
          <Shot data-cta-mock role="img" aria-label="Ranksmile AI Tracker dashboard">
            <DashboardMock org="Acme · AI Tracker" />
          </Shot>
        </Stage>
      </Container>
    </Wrap>
  );
}

export default AiCta;
