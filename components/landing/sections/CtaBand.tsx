import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, CtaLink, H2, Section } from '../primitives';
import { SIGN_UP_HREF } from '../content';

const Band = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${radius['2xl']};
  background: ${semantic.background.brand};
  color: ${semantic.text.onBrand};
  padding: 64px 20px 0;
  text-align: center;
  ${media.md} {
    padding: 96px 48px 0;
  }
`;

const Title = styled(H2)`
  color: ${semantic.text.onBrand};
  max-width: 720px;
  margin: 0 auto;
`;

const Sub = styled.p`
  margin: 20px auto 0;
  max-width: 620px;
  font-family: ${typeface.body};
  font-size: ${textScale.lg.fontSize};
  line-height: 1.5;
  color: ${semantic.text.onBrandSecondary};
  strong {
    color: ${semantic.text.onBrand};
    font-weight: ${fontWeight.medium};
  }
`;

const Cta = styled.div`
  display: flex;
  justify-content: center;
  margin: 32px 0 56px;
`;

const Mock = styled.div`
  margin: 0 auto;
  max-width: 1040px;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  border-radius: ${radius.card.default} ${radius.card.default} 0 0;
  box-shadow: ${shadow.lg};
  text-align: left;
  font-family: ${typeface.body};
  overflow: hidden;
`;

const MockBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid ${semantic.border.primary};
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.secondary};
  span:first-of-type {
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  span:last-of-type {
    margin-left: auto;
    height: 28px;
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border-radius: ${radius.full};
    background: ${semantic.status.successBg};
    color: ${semantic.status.success};
    font-weight: ${fontWeight.medium};
    font-size: ${textScale.xs.fontSize};
  }
`;

const MockBody = styled.div`
  padding: 24px 20px 0;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  min-height: 180px;
  ${media.md} {
    grid-template-columns: repeat(4, 1fr);
    padding: 28px 28px 0;
  }
`;

const Metric = styled.div`
  border: 1px solid ${semantic.border.primary};
  border-bottom: 0;
  border-radius: ${radius.card.sm} ${radius.card.sm} 0 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  span {
    font-size: ${textScale.xs.fontSize};
    color: ${semantic.text.tertiary};
  }
  b {
    font-size: ${textScale['2xl'].fontSize};
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
  }
  small {
    font-size: ${textScale.xs.fontSize};
    color: ${semantic.status.success};
    font-weight: ${fontWeight.medium};
  }
`;

const METRICS = [
  { label: 'Keywords in top 10', value: '184', delta: '+37 this month' },
  { label: 'AI visibility', value: '64', delta: '+43 since start' },
  { label: 'Pages scored 80+', value: '92%', delta: '+18 pts' },
  { label: 'Open recommendations', value: '6', delta: '41 resolved' },
];

export function CtaBand() {
  return (
    <Section aria-labelledby="cta-title">
      <Container>
        <Band data-reveal>
          <Title id="cta-title">Start being the answer — before your competitors do.</Title>
          <Sub>
            Your buyers are already looking for you. Turn content into connections and
            {' '}
            <strong>become the brand that&apos;s seen, cited, and trusted — no matter where people search.</strong>
          </Sub>
          <Cta>
            <CtaLink href={SIGN_UP_HREF} $variant="onBrand">
              Try Ranksmile for free
              <ArrowRight size={18} weight="bold" aria-hidden />
            </CtaLink>
          </Cta>
          <Mock data-cta-mock aria-hidden>
            <MockBar>
              <span>Northwind Inc.</span>
              <span>All engines up</span>
            </MockBar>
            <MockBody>
              {METRICS.map((m) => (
                <Metric key={m.label}>
                  <span>{m.label}</span>
                  <b>{m.value}</b>
                  <small>{m.delta}</small>
                </Metric>
              ))}
            </MockBody>
          </Mock>
        </Band>
      </Container>
    </Section>
  );
}

export default CtaBand;
