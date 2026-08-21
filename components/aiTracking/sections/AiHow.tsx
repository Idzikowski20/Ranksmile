import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, CtaLink, Eyebrow, H2, Section } from '../../landing/primitives';
import { AnalyticsMock, OutreachMock, PromptsMock, StrategyMock } from '../mocks';
import { HOW, SIGN_UP_HREF, type HowStep } from '../content';

const Wrap = styled(Section)`
  padding: 0 0 126px;
  ${BP.md} {
    padding-bottom: 54px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  text-align: center;
  padding: 0 27px;
  margin-bottom: 90px;
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
`;

const Step = styled.div<{ $imageLeft: boolean }>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 90px;
  align-items: center;
  padding: 63px 27px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  ${BP.md} {
    padding: 32px 0;
  }
  /* image column order per step */
  & > [data-col='art'] {
    order: ${(p) => (p.$imageLeft ? 0 : 1)};
    ${BP.lg} {
      order: 1;
    }
  }
`;

const Copy = styled.div`
  display: flex;
  flex-direction: column;
`;

const Kicker = styled.p`
  margin: 0 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.brand};
  }
`;

const StepTitle = styled.h3`
  margin: 0 0 24px;
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
  margin: 0 0 18px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
`;

const Bullet = styled.p`
  margin: 0 0 6px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

const Art = styled.div`
  min-height: 460px;
  ${BP.md} {
    min-height: 0;
  }
`;

const MOCKS: Record<HowStep['art'], () => JSX.Element> = {
  track: PromptsMock,
  evaluate: AnalyticsMock,
  bridge: OutreachMock,
  strategize: StrategyMock,
};

export function AiHow() {
  return (
    <Wrap id="how-it-works" aria-labelledby="how-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tone="brand">{HOW.eyebrow}</Eyebrow>
          <H2 id="how-title" $size={55.2}>
            {HOW.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </H2>
          <CtaLink href={SIGN_UP_HREF}>
            {HOW.cta}
            <ArrowRight size={18} weight="bold" aria-hidden />
          </CtaLink>
        </Head>

        <Rows>
          {HOW.steps.map((step) => {
            const MockFor = MOCKS[step.art];
            return (
              <Step key={step.index} $imageLeft={step.imageSide === 'left'}>
                <Copy data-reveal>
                  <Kicker>
                    {step.index}
                    {' → '}
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
                <Art data-col="art" data-reveal>
                  <MockFor />
                </Art>
              </Step>
            );
          })}
        </Rows>
      </Container>
    </Wrap>
  );
}

export default AiHow;
