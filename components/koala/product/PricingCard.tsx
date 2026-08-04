import React from 'react';
import styled from '@emotion/styled';
import { Button } from '../core';
import { BenefitItem } from './BenefitItem';
import type {
  BenefitState,
  CtaState,
  PlanSlug,
} from '../../../lib/pricing/planDefinition';
import { ctaLabel } from '../../../lib/pricing/planDefinition';
import type { BillingPeriod } from '../../../lib/billingPlans';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';

export type PricingCardAction = {
  slug: PlanSlug;
  billing: BillingPeriod;
  ctaState: CtaState;
};

export type PricingCardProps = {
  slug: PlanSlug;
  name: string;
  description: string;
  price: number;
  currency?: string;
  frequency?: string;
  billing: BillingPeriod;
  ctaState: CtaState;
  /** Growth trial still available — drives CTA copy. Default true. */
  trialEligible?: boolean;
  benefits: Array<{ label: string; state: BenefitState; value?: string }>;
  recommended?: boolean;
  showMostPopularBadge?: boolean;
  hierarchyHint?: string | null;
  footer?: React.ReactNode;
  onAction: (action: PricingCardAction) => void;
  className?: string;
};

const Shell = styled.div<{ $recommended: boolean; $current: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  width: 100%;
  height: 100%;
  border-radius: ${radius['2xl']};
  overflow: hidden;
  font-family: ${typeface.body};
  opacity: ${(p) => (p.$current ? 0.78 : 1)};
  filter: ${(p) => (p.$current ? 'grayscale(0.2)' : 'none')};
  background: ${(p) => (p.$recommended ? 'var(--koala-bg-brand, #F84416)' : p.$current ? semantic.text.tertiary : 'transparent')};
  /* Same 2px rim on every card so white bodies share one top edge */
  padding: 2px;
  box-sizing: border-box;
`;

/** Same footprint as Ribbon so card bodies align across the pricing grid. */
const RibbonSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  flex-shrink: 0;
`;

const Ribbon = styled(RibbonSlot)<{ $tone: 'brand' | 'muted' }>`
  padding: 8px 12px 6px;
  background: ${(p) => (p.$tone === 'brand' ? 'var(--koala-bg-brand, #F84416)' : semantic.text.tertiary)};
  color: #fff;
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.medium};
  line-height: ${textScale.base.lineHeight};
  letter-spacing: ${textScale.base.letterSpacing};
`;

const RibbonSpacer = styled(RibbonSlot)`
  visibility: hidden;
  pointer-events: none;
  user-select: none;
`;

const Body = styled.div<{ $recommended: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  flex: 1;
  padding: 24px;
  background: ${semantic.background.primary};
  border: 2px solid ${(p) => (p.$recommended ? semantic.border.brand : semantic.border.primary)};
  border-radius: ${radius['2xl']};
  box-sizing: border-box;
`;

const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.sm};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${textScale.xl.fontSize};
  line-height: ${textScale.xl.lineHeight};
  font-weight: ${fontWeight.bold};
  letter-spacing: ${textScale.xl.letterSpacing};
  color: ${semantic.text.primary};
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 8px;
  background: #fff7ed;
  color: #ea580c;
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  line-height: ${textScale.sm.lineHeight};
`;

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
`;

const Desc = styled.p`
  margin: 0;
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  color: ${semantic.text.secondary};
  /* Longest plan blurbs are ~3 lines — equal block so price + CTA align across the grid */
  min-height: calc(3 * ${textScale.base.lineHeight});
`;

const PriceCta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  flex-shrink: 0;
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.tertiary};
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const Currency = styled.span`
  font-size: ${textScale.xl.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
`;

const Amount = styled.span`
  font-size: 48px;
  line-height: 52px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.24px;
  color: ${semantic.text.primary};
`;

const Freq = styled.span`
  font-size: ${textScale.base.fontSize};
  color: ${semantic.text.secondary};
`;

const Benefits = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  flex: 1;
`;

const FooterSlot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  color: ${semantic.text.tertiary};
`;

/** Presentational pricing card — never builds Stripe URLs; parent handles `onAction`. */
export function PricingCard({
  slug,
  name,
  description,
  price,
  currency = '€',
  frequency = '/month',
  billing,
  ctaState,
  trialEligible = true,
  benefits,
  recommended = false,
  showMostPopularBadge = false,
  hierarchyHint,
  footer,
  onAction,
  className,
}: PricingCardProps) {
  const isCurrent = ctaState === 'current';
  const showRibbon = recommended || isCurrent;
  const ribbonTone = isCurrent ? 'muted' : 'brand';
  const ribbonText = isCurrent ? 'Current plan' : 'Recommended';
  const primaryCta = recommended && !isCurrent;

  return (
    <Shell
      className={className}
      $recommended={Boolean(recommended) && !isCurrent}
      $current={isCurrent}
      data-plan={slug}
      data-cta={ctaState}
    >
      {showRibbon ? (
        <Ribbon $tone={ribbonTone}>{ribbonText}</Ribbon>
      ) : (
        <RibbonSpacer aria-hidden>Recommended</RibbonSpacer>
      )}
      <Body $recommended={Boolean(recommended) && !isCurrent}>
        <Intro>
          <TitleRow>
            <Title>{name}</Title>
            {showMostPopularBadge && recommended && !isCurrent ? (
              <Badge>Most popular</Badge>
            ) : null}
          </TitleRow>
          <Desc>{description}</Desc>
          {hierarchyHint ? <Hint>{hierarchyHint}</Hint> : null}
        </Intro>

        <PriceCta>
          <PriceRow>
            <Currency>{currency}</Currency>
            <Amount>{price}</Amount>
            <Freq>{frequency}</Freq>
          </PriceRow>

          <Button
            type="button"
            variant={primaryCta ? 'primary' : 'secondary'}
            size="md"
            disabled={isCurrent}
            style={{ width: '100%' }}
            onClick={() => onAction({ slug, billing, ctaState })}
          >
            {ctaLabel(ctaState, name, { planSlug: slug, trialEligible })}
          </Button>
        </PriceCta>

        <Benefits>
          {benefits.map((b) => (
            <li key={`${b.label}-${b.value ?? b.state}`}>
              <BenefitItem label={b.label} state={b.state} value={b.value} />
            </li>
          ))}
        </Benefits>

        {footer != null ? <FooterSlot>{footer}</FooterSlot> : null}
      </Body>
    </Shell>
  );
}

export default PricingCard;
