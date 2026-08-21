import React, { useState } from 'react';
import styled from '@emotion/styled';
import { useRouter } from 'next/router';
import { SegmentedControl } from '../../koala/core/segmentedControl';
import { PricingCard, type PricingCardAction } from '../../koala/product/PricingCard';
import type { BillingPeriod } from '../../../lib/billingPlans';
import { media } from '../../koala/tokens/breakpoints';
import { Container, Eyebrow, H2, Lead, Muted, Section, SectionHead } from '../primitives';
import { PLANS, SIGN_UP_HREF } from '../content';

const Toggle = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
`;

const Grid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
  align-items: stretch;
  ${media.md} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export function Pricing() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingPeriod>('yearly');

  const onAction = (action: PricingCardAction) => {
    router.push(`${SIGN_UP_HREF}?plan=${action.slug}&billing=${action.billing}`);
  };

  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <Container>
        <SectionHead data-reveal>
          <Eyebrow>Pricing</Eyebrow>
          <H2 id="pricing-title">Elite visibility system without the enterprise price tag.</H2>
          <Lead>
            Every plan includes Content Score, daily rank tracking, AI visibility and the WordPress plugin.
            {' '}
            <Muted>Prices in EUR, VAT excluded. Cancel anytime.</Muted>
          </Lead>
        </SectionHead>

        <Toggle data-reveal>
          <SegmentedControl<BillingPeriod>
            name="landing-billing"
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
      </Container>
    </Section>
  );
}

export default Pricing;
