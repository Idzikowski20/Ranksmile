import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Section, Tag } from '../../landing/primitives';
import { HOW, SIGN_UP_HREF, type HowStep } from '../content';

/*
 * Figma 3:4710 — head 990 (tag · 55.2 H2 · CTA); four rows py 126 gap 90:
 * 648×576 image (r27) ↔ copy column (kicker "01 -> TRACK" 20.3 · 44.5 H2 · 20.3 paras at left 99).
 */

const Wrap = styled(Section)`
  padding-bottom: 0;
`;

const Head = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 27px;
  min-height: 305px;
  padding: 0 27px;
  text-align: center;
  h2 {
    margin: 12px 0 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    min-height: 0;
    padding: 0;
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
  }
`;

const Step = styled.div<{ $imageLeft: boolean }>`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 90px;
  padding: 126px 27px;
  & > [data-col='art'] {
    order: ${(p) => (p.$imageLeft ? 0 : 1)};
  }
  ${BP.lg} {
    flex-direction: column;
    gap: 36px;
    padding: 54px 0;
    & > [data-col='art'] {
      order: 1;
    }
  }
`;

const Art = styled.div`
  width: 648.11px;
  max-width: 100%;
  flex-shrink: 0;
  aspect-ratio: 648.11 / 576.09;
  border-radius: 27px;
  overflow: hidden;
  background: ${semantic.background.secondary};
  border: 1px solid ${semantic.border.primary};
  img {
    display: block;
    width: 100%;
    height: 112.6%;
    margin-top: -6.3%;
    object-fit: cover;
  }
`;

const Copy = styled.div`
  position: relative;
  width: 648.13px;
  max-width: 100%;
  min-height: 576.09px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 99px;
  box-sizing: border-box;
  ${BP.lg} {
    min-height: 0;
    padding-left: 0;
  }
`;

const Kicker = styled.p`
  margin: 0 0 28px -54px;
  display: flex;
  align-items: center;
  gap: 45px;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.brand};
  }
  ${BP.lg} {
    margin-left: 0;
    gap: 18px;
  }
`;

const StepTitle = styled.h3`
  margin: 0 0 32px;
  font-size: 44.5px;
  line-height: 53.41px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 32px;
    line-height: 38px;
  }
`;

const Para = styled.p`
  margin: 0 0 27px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
  &:last-child {
    margin-bottom: 0;
  }
`;

const Bullet = styled.p`
  margin: 0 0 27px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  &:last-child {
    margin-bottom: 0;
  }
`;

const IMAGES: Record<HowStep['art'], string> = {
  track: '/ai-tracking/how-01.png',
  evaluate: '/ai-tracking/how-02.png',
  bridge: '/ai-tracking/how-03.png',
  strategize: '/ai-tracking/how-04.png',
};

export function AiHow() {
  return (
    <Wrap id="how-it-works" aria-labelledby="how-title">
      <Container>
        <Head data-reveal>
          <Tag>{HOW.eyebrow}</Tag>
          <h2 id="how-title">
            {HOW.titleLines[0]}
            <br />
            {HOW.titleLines[1]}
          </h2>
          <CtaLink href={SIGN_UP_HREF} style={{ marginTop: 9 }}>{HOW.cta}</CtaLink>
        </Head>

        {HOW.steps.map((step) => (
          <Step key={step.index} $imageLeft={step.imageSide === 'left'}>
            <Art data-col="art" data-reveal>
              <img src={IMAGES[step.art]} alt="" loading="lazy" width={648} height={576} />
            </Art>
            <Copy data-reveal>
              <Kicker>
                {`${step.index} ->`}
                <span>{step.label}</span>
              </Kicker>
              <StepTitle>
                {step.titleLines.map((l, i) => (
                  <React.Fragment key={l}>
                    {l}
                    {i < step.titleLines.length - 1 ? <br /> : null}
                  </React.Fragment>
                ))}
              </StepTitle>
              {step.paras.map((p) => <Para key={p}>{p}</Para>)}
              {step.bullets?.map((b) => (
                <Bullet key={b.label}>
                  <b>{b.label}</b>
                  {b.body}
                </Bullet>
              ))}
            </Copy>
          </Step>
        ))}
      </Container>
    </Wrap>
  );
}

export default AiHow;
