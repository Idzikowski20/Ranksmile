import React, { useState } from 'react';
import styled from '@emotion/styled';
import { useRouter } from 'next/router';
import { SegmentedControl } from '../../koala/core/segmentedControl';
import { PricingCard, type PricingCardAction } from '../../koala/product/PricingCard';
import type { BillingPeriod } from '../../../lib/billingPlans';
import { fontWeight } from '../../koala/tokens/typography';
import { semantic } from '../../koala/tokens/semantic';
import { BP, ArrowLink, Container, Eyebrow, H2, Section } from '../../landing/primitives';
import { PLANS, PRICING, PRICING_HREF, SIGN_UP_HREF } from '../content';

/* Figma 3:4942 — "AI visibility tracking without hidden fees" + plan cards. */

const Wrap = styled(Section)`
  padding: 126px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 40px;
  text-align: center;
`;

const Toggle = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
`;

const Grid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, 1fr);
  align-items: stretch;
  ${BP.md} {
    grid-template-columns: 1fr;
  }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid ${semantic.border.primary};
  font-size: 18px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

export function AiPricing() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingPeriod>('yearly');

  const onAction = (action: PricingCardAction) => {
    router.push(`${SIGN_UP_HREF}?plan=${action.slug}&billing=${action.billing}`);
  };

  return (
    <Wrap id="pricing" aria-labelledby="ai-pricing-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tone="brand">{PRICING.eyebrow}</Eyebrow>
          <H2 id="ai-pricing-title" $size={44.5}>
            {PRICING.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </H2>
        </Head>

        <Toggle data-reveal>
          <SegmentedControl<BillingPeriod>
            name="ai-billing"
            value={billing}
            onChange={setBilling}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: `Yearly · save ${PLANS[0].yearlySavePct}%` },
            ]}
          />
        </Toggle>

        <Grid>
          {PLANS.map((plan) => (
            <div key={plan.slug} data-reveal>
              <PricingCard
                slug={plan.slug}
                name={plan.name}
                description={plan.desc}
                price={billing === 'yearly' ? plan.priceYearly : plan.priceMonthly}
                billing={billing}
                ctaState="subscribe"
                benefits={plan.cardBenefits}
                recommended={plan.recommended}
                footer={plan.footerHints?.join(' · ')}
                onAction={onAction}
              />
            </div>
          ))}
        </Grid>

        <Foot data-reveal>
          <span>
            <b>Not sure yet?</b>
            {' '}
            Start smaller — or go bigger.
          </span>
          <ArrowLink href={PRICING_HREF}>
            <span>Compare all plans</span>
            <span>→</span>
          </ArrowLink>
        </Foot>
      </Container>
    </Wrap>
  );
}

export default AiPricing;
