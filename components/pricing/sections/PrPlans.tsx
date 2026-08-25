import React from 'react';
import styled from '@emotion/styled';
import { Check } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { PLANS, SIGN_UP_HREF, type Plan } from '../content';

/* Figma 5:2667 — 3 cards (Standard/Pro/Peace of Mind); Pro recommended with ribbon + tinted body + footer. */

const Wrap = styled(Section)`
  padding: 45px 0 0;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  align-items: start;
  ${BP.lg} {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const Card = styled.article<{ $rec?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 13.5px;
  border: 1px solid ${(p) => (p.$rec ? 'var(--landing-blue)' : semantic.border.primary)};
  background: ${(p) => (p.$rec ? 'color-mix(in srgb, var(--landing-blue) 8%, var(--koala-bg-primary))' : semantic.background.primary)};
  margin-top: ${(p) => (p.$rec ? '0' : '54px')};
  ${BP.lg} {
    margin-top: 0;
  }
`;

const Ribbon = styled.div`
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--landing-blue);
  color: #fff;
  font-size: 18px;
  font-weight: ${fontWeight.bold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 45px;
  padding: 36px;
  ${BP.md} {
    padding: 27px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  h3 {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

const Price = styled.p`
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.secondary};
    margin-left: 5.4px;
  }
`;

const Billing = styled.div`
  display: flex;
  align-items: center;
  gap: 5.9px;
  font-size: 15.8px;
  line-height: 15.75px;
  color: ${semantic.text.primary};
  i {
    width: 31.5px;
    height: 18px;
    border-radius: 18px;
    background: var(--landing-blue);
    position: relative;
    &::after {
      content: '';
      position: absolute;
      top: 2.25px;
      left: 16.19px;
      width: 13.5px;
      height: 13.5px;
      border-radius: 6.75px;
      background: #fff;
    }
  }
`;

const Saving = styled.span`
  margin-left: 3.6px;
  padding: 4.5px 11.25px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 9999px;
  font-size: 13.5px;
  line-height: 13.5px;
  color: ${semantic.text.primary};
`;

const Desc = styled.p`
  margin: 0;
  min-height: 48px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.secondary};
`;

const Cta = styled.a<{ $rec?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13.5px 27px;
  border-radius: 13.5px;
  background: ${(p) => (p.$rec ? 'var(--landing-blue)' : semantic.background.inverse)};
  color: ${(p) => (p.$rec ? '#fff' : semantic.text.onInverse)};
  text-decoration: none;
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  box-shadow: inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25);
  &:hover {
    filter: brightness(0.96);
  }
`;

const Features = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 36px 36px 9px;
  border-top: 1px solid rgba(0,0,0,0.05);
  ${BP.md} {
    padding: 27px 27px 9px;
  }
`;

const Feat = styled.div<{ $bold?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 15.8px;
  line-height: 23.63px;
  font-weight: ${(p) => (p.$bold ? fontWeight.bold : fontWeight.regular)};
  color: ${semantic.text.primary};
  svg {
    flex-shrink: 0;
    margin-top: 3.9px;
    color: var(--landing-blue);
  }
  span u {
    text-decoration-style: dotted;
    text-underline-position: from-font;
  }
`;

const Footer = styled.div<{ $rec?: boolean }>`
  margin-top: auto;
  padding: 18px;
  text-align: center;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${(p) => (p.$rec ? 'var(--landing-blue)' : semantic.text.secondary)};
  background: ${(p) => (p.$rec ? 'color-mix(in srgb, var(--landing-blue) 12%, transparent)' : 'transparent')};
  font-weight: ${(p) => (p.$rec ? fontWeight.medium : fontWeight.regular)};
`;

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card $rec={plan.recommended}>
      {plan.recommended ? <Ribbon>Recommended</Ribbon> : null}
      <Body>
        <Head>
          <h3>{plan.name}</h3>
          <Price>
            {`${plan.price} USD`}
            <span>per month</span>
          </Price>
          <Billing>
            <i aria-hidden />
            Billed yearly
            <Saving>{`Saving $${plan.yearlySaving}`}</Saving>
          </Billing>
          <Desc>{plan.desc}</Desc>
        </Head>
        <Cta href={`${SIGN_UP_HREF}?plan=${plan.slug}`} $rec={plan.recommended}>Start for Free</Cta>
      </Body>
      <Features>
        {plan.everything ? (
          <Feat $bold>
            <Check size={15.75} weight="bold" aria-hidden />
            <span>{plan.everything}</span>
          </Feat>
        ) : null}
        {plan.features.map((f) => (
          <Feat key={f}>
            <Check size={15.75} weight="bold" aria-hidden />
            <span>{f}</span>
          </Feat>
        ))}
      </Features>
      <Footer $rec={plan.recommended}>{plan.footer}</Footer>
    </Card>
  );
}

export function PrPlans() {
  return (
    <Wrap aria-label="Plans">
      <Container>
        <Grid data-reveal>
          {PLANS.map((p) => <PlanCard key={p.slug} plan={p} />)}
        </Grid>
      </Container>
    </Wrap>
  );
}

export default PrPlans;
