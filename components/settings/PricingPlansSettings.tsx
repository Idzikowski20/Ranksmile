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
import type { RecommendedPlanSlug } from '../../lib/pricing/planRecommender';
import { Alert, Button, Link, SegmentedControl } from '../koala/core';
import { ComparePricingTable, PricingCard } from '../koala/product';
import type { PricingCardAction } from '../koala/product';
import { KoalaPanel, KoalaPanelHeader, KoalaPanelBody } from '../koala/layout';
import PlanRecommenderBanner from './PlanRecommenderBanner';

const FAQ_ITEMS = [
  { q: 'How does the 7-day trial work?', a: 'You get full access to all features in the chosen plan for 7 days, no credit card required. Cancel anytime before the trial ends to avoid being charged.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as PayPal and bank transfers for annual plans.' },
  { q: 'Can I upgrade or downgrade my account after purchase?', a: 'Yes, you can change your plan at any time from the billing settings. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
  { q: 'Where does the keyword and visibility data come from?', a: 'We combine first-party Google Search Console data (for your own pages), live SERP analysis, and a keyword database for search volume, difficulty, and competitor research — so the numbers are accurate without you connecting a Google Ads account.' },
  { q: 'What languages do you support?', a: 'Content analysis and optimization work across all major languages, including Polish, English, German, French, Spanish, and more.' },
  { q: 'How do AI Visibility prompts work?', a: 'We periodically query AI engines (ChatGPT, Gemini, Perplexity, and Google AI surfaces) with your tracked prompts and report whether and how your brand is mentioned, so you can optimize to win the citation.' },
  { q: 'What happens if I reach a monthly limit?', a: 'Usage limits (documents, AI prompts, keyword research, competitor gaps) reset at the start of each billing cycle. If you need more, you can add an overage pack or upgrade to a higher plan at any time.' },
  { q: 'What is your cancellation policy?', a: 'You can cancel your subscription at any time. Your access continues until the end of the current billing period, after which it will not renew.' },
  { q: 'If I choose the annual plan, do I have to pay upfront for the entire year?', a: 'Yes, annual plans are billed upfront for the full year, which is how we are able to offer the discounted rate compared to monthly billing.' },
];

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--koala-text-secondary)' }}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarFilled = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="#FACC15" aria-hidden="true">
    <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382z" />
  </svg>
);

function hierarchyHint(current: PlanSlug | null, slug: PlanSlug): string | null {
  if (current !== slug) return null;
  const parts: string[] = [];
  if (nextPlan(slug)) parts.push('Upgrade available');
  if (previousPlan(slug)) parts.push('Downgrade available');
  return parts.length ? parts.join(' · ') : null;
}

const PricingPlansSettings = ({ onSkip }: { onSkip?: () => void } = {}) => {
  const router = useRouter();
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>('yearly');
  const [recommendedSlug, setRecommendedSlug] = useState<RecommendedPlanSlug>('growth');

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

  const handleSeePlan = useCallback((planSlug: RecommendedPlanSlug) => {
    setRecommendedSlug(planSlug);
    if (typeof document === 'undefined') return;
    document.querySelector(`[data-plan="${planSlug}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
    void router.push(getPlanCheckoutHref(action.slug, action.billing));
  }, [router]);

  const resolveCta = useCallback(
    (slug: PlanSlug) => resolveCtaState(currentPlanSlug, slug),
    [currentPlanSlug],
  );

  const starter = getPlanDefinition('starter');
  const starterCta = resolveCta('starter');

  return (
    <div
      style={{
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
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

      <PlanRecommenderBanner
        billing={billing}
        onBillingChange={handleBillingChange}
        onRecommendChange={setRecommendedSlug}
        onSeePlan={handleSeePlan}
        currentPlanSlug={currentPlanSlug}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          /* Bottoms flush; Recommended ribbon sits above neighbors (Koala pricing). */
          alignItems: 'end',
        }}
      >
        {PRICING_GRID_SLUGS.map((slug) => {
          const plan = getPlanDefinition(slug);
          const ctaState = resolveCta(slug);
          const isSliderPick = recommendedSlug === slug;
          return (
            <div
              key={slug}
              style={{
                outline: isSliderPick && ctaState !== 'current' ? '3px solid rgba(248,68,22,0.25)' : undefined,
                borderRadius: 24,
              }}
            >
              <PricingCard
                slug={plan.slug}
                name={plan.name}
                description={plan.desc}
                price={planDisplayPrice(plan, billing)}
                billing={billing}
                ctaState={ctaState}
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

      {/* Starter discovery */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--koala-text-primary)' }}>Not sure yet?</span>
          <span style={{ fontSize: 15, color: 'var(--koala-text-secondary)' }}>Start smaller</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--koala-text-secondary)', maxWidth: 360, textAlign: 'right' }}>
            Choose Starter to get going. Upgrade anytime as your needs grow.
          </span>
        </div>
        <KoalaPanel>
          <KoalaPanelBody>
            <div
              data-plan="starter"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'wrap',
                opacity: starterCta === 'current' ? 0.72 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--koala-text-primary)' }}>
                  {starter.name}
                  {starterCta === 'current' ? (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--koala-text-secondary)' }}>Current plan</span>
                  ) : null}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--koala-text-primary)' }}>
                    €{planDisplayPrice(starter, billing)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)' }}>per month</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--koala-text-secondary)', lineHeight: 1.5, maxWidth: 380, margin: '6px 0 0' }}>
                  {starter.desc}
                </p>
                {hierarchyHint(currentPlanSlug, 'starter') ? (
                  <span style={{ fontSize: 12, color: 'var(--koala-text-secondary)', marginTop: 4 }}>
                    {hierarchyHint(currentPlanSlug, 'starter')}
                  </span>
                ) : null}
              </div>
              <div style={{ paddingTop: 4, flexShrink: 0 }}>
                <Button
                  type="button"
                  variant="transparent"
                  size="sm"
                  disabled={starterCta === 'current'}
                  onClick={() => handleAction({ slug: 'starter', billing, ctaState: starterCta })}
                >
                  {starterCta === 'current' ? 'Current plan' : 'Start with Starter'}
                </Button>
              </div>
            </div>
          </KoalaPanelBody>
        </KoalaPanel>
      </div>

      <ComparePricingTable
        billing={billing}
        sections={COMPARE_SECTIONS}
        resolveCta={resolveCta}
        onAction={handleAction}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => <StarFilled key={i} />)}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)' }}>Rated 4.7 / 5 stars</span>
      </div>

      <KoalaPanel noPadding>
        <KoalaPanelHeader title="FAQ" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FAQ_ITEMS.map((item, i) => {
            const open = faqOpen === i;
            return (
              <div key={item.q} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid var(--koala-border-primary)' : 'none' }}>
                <button
                  type="button"
                  onClick={() => setFaqOpen((prev) => (prev === i ? null : i))}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    gap: 12,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)', lineHeight: 1.4 }}>{item.q}</span>
                  <ChevronDown open={open} />
                </button>
                {open ? (
                  <div style={{ padding: '0 20px 16px' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--koala-text-secondary)', lineHeight: 1.6 }}>{item.a}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </KoalaPanel>
    </div>
  );
};

export default PricingPlansSettings;
