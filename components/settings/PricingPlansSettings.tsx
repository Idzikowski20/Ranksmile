import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import { getPlanCheckoutHref, type BillingPeriod } from '../../lib/billingPlans';
import type { SubscriptionDetails } from '../../lib/subscriptionDetails';
import {
  COMPARE_SECTIONS,
  PRICING_GRID_SLUGS,
  billingSavePercentLabel,
  getPlanDefinition,
  isPlanSlug,
  nextPlan,
  planDisplayPrice,
  previousPlan,
  resolveCtaState,
  trackPricingEvent,
  type PlanSlug,
} from '../../lib/pricing/planDefinition';
import { Alert, Button, Link, SegmentedControl } from '../koala/core';
import { ComparePricingTable, PricingCard, PricingFaqSection } from '../koala/product';
import type { FaqItem, PricingCardAction } from '../koala/product';
import { KoalaPanel } from '../koala/layout';

const FAQ_ITEMS: FaqItem[] = [
  { category: 'billing', q: 'How does the 7-day trial work?', a: 'Growth includes a one-time 7-day free trial with full plan access. A card is required to start the trial; you will not be charged until the trial ends. Scale and Agency are billed upfront (monthly or yearly) with no trial. Each organization can use the free trial only once.' },
  { category: 'billing', q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as PayPal and bank transfers for annual plans.' },
  { category: 'billing', q: 'Can I upgrade or downgrade my account after purchase?', a: 'Yes, you can change your plan at any time from the billing settings. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
  { category: 'billing', q: 'If I choose the annual plan, do I have to pay upfront for the entire year?', a: 'Yes, annual plans are billed upfront for the full year, which is how we are able to offer the discounted rate compared to monthly billing.' },
  { category: 'billing', q: 'What is your cancellation policy?', a: 'You can cancel your subscription at any time. Your access continues until the end of the current billing period, after which it will not renew.' },
  { category: 'billing', q: 'What happens if I reach a monthly limit?', a: 'Usage limits (documents, AI prompts, keyword research, competitor gaps) reset at the start of each billing cycle. If you need more, you can add an overage pack or upgrade to a higher plan at any time.' },
  { category: 'product', q: 'Where does the keyword and visibility data come from?', a: 'We combine first-party Google Search Console data (for your own pages), live SERP analysis, and a keyword database for search volume, difficulty, and competitor research — so the numbers are accurate without you connecting a Google Ads account.' },
  { category: 'product', q: 'What languages do you support?', a: 'Content analysis and optimization work across all major languages, including Polish, English, German, French, Spanish, and more.' },
  { category: 'product', q: 'How do AI Visibility prompts work?', a: 'We periodically query AI engines (ChatGPT, Gemini, Perplexity, and Google AI surfaces) with your tracked prompts and report whether and how your brand is mentioned, so you can optimize to win the citation.' },
  { category: 'usage', q: 'How many Brand Spaces do I get?', a: 'Growth includes 5 Brand Spaces, Scale includes 15, and Agency is unlimited. Each Brand Space maps to a site or client workspace with its own tracking and content.' },
  { category: 'usage', q: 'What counts as a document?', a: 'A document is any article or page you create or optimize in the Content Editor. Drafts and published pieces both count toward your plan limit.' },
  { category: 'usage', q: 'Do unused AI prompts roll over?', a: 'No — AI prompt allowances reset with each billing cycle. Upgrade or add capacity if you need more headroom mid-cycle.' },
];

function hierarchyHint(current: PlanSlug | null, slug: PlanSlug): string | null {
  if (current !== slug) return null;
  const parts: string[] = [];
  if (nextPlan(slug)) parts.push('Upgrade available');
  if (previousPlan(slug)) parts.push('Downgrade available');
  return parts.length ? parts.join(' · ') : null;
}

const PricingPlansSettings = ({ onSkip }: { onSkip?: () => void } = {}) => {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingPeriod>('yearly');

  const { data: subscriptionData } = useQuery(
    'subscriptionDetails',
    async () => {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to load subscription');
      return res.json() as Promise<{ subscription: SubscriptionDetails }>;
    },
    { staleTime: 30 * 1000, retry: false },
  );
  const locked = subscriptionData?.subscription?.lockedPlanSlug ?? null;
  const currentPlanSlug: PlanSlug | null = isPlanSlug(locked) ? locked : null;
  const trialEligible = subscriptionData?.subscription?.trialEligible !== false;
  const paymentFailedLocked = subscriptionData?.subscription?.paymentFailedLocked === true;
  const paymentFailedLockedAt = subscriptionData?.subscription?.paymentFailedLockedAt ?? null;
  const lockedLabel = paymentFailedLockedAt
    ? new Date(paymentFailedLockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const savePct = billingSavePercentLabel();

  const handleBillingChange = (next: BillingPeriod) => {
    setBilling(next);
    trackPricingEvent({ type: 'billing_toggle', billing: next });
  };

  const handleAction = useCallback((action: PricingCardAction) => {
    trackPricingEvent({
      type: 'cta_click',
      slug: action.slug,
      ctaState: action.ctaState,
      billing: action.billing,
    });
    if (action.ctaState === 'current') return;
    if (action.ctaState === 'contactSales') {
      toast('Contact our sales team!');
      return;
    }
    const mode = action.slug === 'growth' && trialEligible ? 'trial' : 'upfront';
    void router.push(getPlanCheckoutHref(action.slug, action.billing, mode));
  }, [router, trialEligible]);

  const resolveCta = useCallback(
    (slug: PlanSlug) => resolveCtaState(currentPlanSlug, slug),
    [currentPlanSlug],
  );

  return (
    <div
      style={{
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 64,
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      {paymentFailedLocked && (
        <Alert variant="warning" title="Payment failed">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>Your last payment could not be processed. Update your payment method to restore access.</div>
            {lockedLabel && <div style={{ color: 'var(--koala-text-secondary)' }}>Last failure: {lockedLabel}</div>}
            <div>
              <Link href="/settings/billing_subscription" style={{ color: 'var(--koala-brand)', fontWeight: 500 }}>
                Update payment method
              </Link>
            </div>
          </div>
        </Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--koala-text-primary)', display: 'block' }}>Pricing &amp; Plans</span>
            <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', display: 'block', marginTop: 2 }}>For every stage of your journey.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {onSkip && (
              <Button type="button" variant="secondary" size="sm" onClick={onSkip} style={{ whiteSpace: 'nowrap' }}>
                Skip for now
              </Button>
            )}
            <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', whiteSpace: 'nowrap' }}>
              Need more?{' '}
              <a
                href="#"
                style={{ color: 'var(--koala-text-primary)', textDecoration: 'underline', fontWeight: 500 }}
                onClick={(e) => { e.preventDefault(); toast('Contact our sales team!'); }}
              >
                Contact Sales
              </a>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SegmentedControl
            name="pricing-billing"
            size="md"
            value={billing}
            onChange={handleBillingChange}
            options={[
              { value: 'monthly', label: 'Monthly' },
              {
                value: 'yearly',
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Annually
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: '2px 6px',
                        borderRadius: 6,
                        border: '1px solid var(--koala-border-primary)',
                        background: 'var(--koala-bg-primary)',
                        color: 'var(--koala-text-secondary)',
                      }}
                    >
                      You save {savePct}%
                    </span>
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {PRICING_GRID_SLUGS.map((slug) => {
          const plan = getPlanDefinition(slug);
          const ctaState = resolveCta(slug);
          return (
            <div key={slug} data-plan={slug} style={{ display: 'flex', minHeight: 0 }}>
              <PricingCard
                slug={plan.slug}
                name={plan.name}
                description={plan.desc}
                price={planDisplayPrice(plan, billing)}
                billing={billing}
                ctaState={ctaState}
                trialEligible={trialEligible}
                benefits={plan.cardBenefits}
                recommended={Boolean(plan.recommended)}
                showMostPopularBadge={Boolean(plan.recommended)}
                hierarchyHint={hierarchyHint(currentPlanSlug, slug)}
                footer={(plan.footerHints ?? []).map((h) => <span key={h}>{h}</span>)}
                onAction={handleAction}
              />
            </div>
          );
        })}
      </div>

      <KoalaPanel>
        <div style={{ padding: 16 }}>
          <ComparePricingTable
            billing={billing}
            sections={COMPARE_SECTIONS}
            resolveCta={resolveCta}
            onAction={handleAction}
          />
        </div>
      </KoalaPanel>

      <PricingFaqSection items={FAQ_ITEMS} />
    </div>
  );
};

export default PricingPlansSettings;
