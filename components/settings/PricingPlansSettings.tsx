import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { getPlanCheckoutHref } from '../../lib/billingPlans';
import type { RecommendedPlanSlug } from '../../lib/pricing/planRecommender';
import type { SubscriptionDetails } from '../../lib/subscriptionDetails';
import { Button, Alert, Link } from '../core';
import { SentryPanel, SentryPanelHeader, SentryPanelBody } from '../sentry-pages';
import PlanRecommenderBanner from './PlanRecommenderBanner';

// ─── Tiny reusable SVG atoms ──────────────────────────────────────────────────

const Check = ({ color = '#18181B' }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207"
      fill={color}
    />
  </svg>
);

const StarFilled = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="#FACC15" aria-hidden="true">
    <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382z" />
  </svg>
);

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: '#52525C' }}
  >
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Static data ──────────────────────────────────────────────────────────────

interface PlanCard {
  name: string;
  priceMonthly: number;
  priceYearly: number;
  save: number;
  recommended?: boolean;
  desc: string;
  cta: string;
  ctaStyle: 'primary' | 'gray' | 'ghost';
  featuresHeader?: string;
  features: string[];
}

const PLAN_CARDS: PlanCard[] = [
  {
    name: 'Growth',
    priceMonthly: 59,
    priceYearly: 49,
    save: 120,
    recommended: true,
    desc: 'Win the AI citation and close your content gaps — daily visibility tracking, coverage gaps, and competitor keyword research.',
    cta: 'Start with Growth',
    ctaStyle: 'primary',
    featuresHeader: 'Everything in Starter, plus:',
    features: [
      'Create and Optimize 30 Documents',
      'Track 50 AI Prompts, refreshed daily',
      'AI Visibility across 4 engines',
      '5 Brand Spaces',
      'Site Audit — 100 pages per crawl',
      'Keyword Research — 200 / month',
      'Competitor Keyword Gap — 25 / month',
      'Content Ideas & Coverage Gap',
      '1-click Internal Linking',
      'Templates & Custom Voices',
      'Cannibalization Report',
    ],
  },
  {
    name: 'Scale',
    priceMonthly: 119,
    priceYearly: 99,
    save: 240,
    desc: 'Scale optimization across brands with advanced SERP analysis, API access, and higher limits.',
    cta: 'Scale up',
    ctaStyle: 'gray',
    featuresHeader: 'Everything in Growth, plus:',
    features: [
      'Create and Optimize 100 Documents',
      'Track 100 AI Prompts (all 5 engines)',
      '15 Brand Spaces',
      'Site Audit — 100 pages per crawl',
      'Keyword Research — 500 / month',
      'Competitor Keyword Gap — 60 / month',
      'Advanced SERP Analysis',
      'Topical Map',
      'API Access',
      'Priority Support',
    ],
  },
  {
    name: 'Agency',
    priceMonthly: 249,
    priceYearly: 207,
    save: 504,
    desc: 'Run many brands and clients with uncapped optimization, white-label, and full API access.',
    cta: 'Get Agency',
    ctaStyle: 'gray',
    featuresHeader: 'Everything in Scale, plus:',
    features: [
      'Unlimited* Documents',
      'Track 250 AI Prompts, refreshed daily',
      'Unlimited* Brand Spaces',
      'Site Audit — 1,000 pages per crawl',
      'Keyword Research — 2,000 / month',
      'Competitor Keyword Gap — 250 / month',
      'White-label & full API Access',
      'Personalized Onboarding',
      'Dedicated Success Manager',
    ],
  },
];

const STARTER_FEATURES = [
  'Create and Optimize 10 Documents',
  'Track 15 AI Prompts (ChatGPT, Gemini), weekly',
  'Keyword Research — 50 / month',
  'Site Audit — 100 pages per crawl',
  'Visible Keywords & Rank-Drop Alerts (Search Console)',
  '1 Brand Space',
  'Content Score & AI Writing Assistant',
];

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

// ─── Sub-components ───────────────────────────────────────────────────────────

const Separator = () => (
  <div role="separator" style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />
);

const CtaButton = ({
  label,
  style: ctaStyle,
  fullWidth,
  href,
  disabled,
}: {
  label: string;
  style: 'primary' | 'gray' | 'ghost';
  fullWidth?: boolean;
  href: string;
  disabled?: boolean;
}) => {
  const variant = ctaStyle === 'primary' ? 'primary' : ctaStyle === 'gray' ? 'secondary' : 'transparent';

  if (disabled) {
    return (
      <Button variant="secondary" size="sm" disabled style={{ width: fullWidth ? '100%' : undefined, opacity: 0.7 }}>
        {label}
      </Button>
    );
  }

  return (
    <a href={href} style={{ display: fullWidth ? 'block' : 'inline-block', textDecoration: 'none', width: fullWidth ? '100%' : undefined }}>
      <Button variant={variant} size="sm" style={{ width: fullWidth ? '100%' : undefined }}>
        {label}
      </Button>
    </a>
  );
};

/** Billing-period toggle pill */
const TogglePill = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{
      width: 32,
      height: 16,
      borderRadius: 9999,
      background: on ? '#F29964' : '#E4E4E7',
      position: 'relative',
      flexShrink: 0,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      transition: 'background 150ms ease',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: on ? 18 : 2,
        width: 12,
        height: 12,
        borderRadius: 9999,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 150ms ease',
      }}
    />
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const PricingPlansSettings = ({ onSkip }: { onSkip?: () => void } = {}) => {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
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
  const currentPlanSlug = subscriptionData?.subscription?.lockedPlanSlug ?? null;
  const paymentFailedLocked = subscriptionData?.subscription?.paymentFailedLocked === true;
  const paymentFailedLockedAt = subscriptionData?.subscription?.paymentFailedLockedAt ?? null;
  const lockedLabel = paymentFailedLockedAt
    ? new Date(paymentFailedLockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const toggleFaq = (i: number) => setFaqOpen((prev) => (prev === i ? null : i));
  const toggleBilling = () => setBilling((prev) => (prev === 'yearly' ? 'monthly' : 'yearly'));

  const handleSeePlan = useCallback((planSlug: RecommendedPlanSlug) => {
    setRecommendedSlug(planSlug);
    if (typeof document === 'undefined') return;
    const el = document.querySelector(`[data-plan="${planSlug}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
            <div>
              Your last payment could not be processed. Update your payment method to restore access.
            </div>
            {lockedLabel && <div style={{ color: '#6A6772' }}>Last failure: {lockedLabel}</div>}
            <div>
              <Link href="/settings/billing_subscription" style={{ color: '#E07D42', fontWeight: 500 }}>
                Update payment method
              </Link>
            </div>
          </div>
        </Alert>
      )}

      {/* ── A) Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 20, borderBottom: '1px solid #F4F4F5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#18181B', display: 'block' }}>Pricing &amp; Plans</span>
            <span style={{ fontSize: 14, color: '#9F9FA9', display: 'block', marginTop: 2 }}>For every stage of your journey.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 2 }}>
            {onSkip && (
              <Button type="button" variant="secondary" size="sm" onClick={onSkip} style={{ whiteSpace: 'nowrap' }}>
                Skip for now
              </Button>
            )}
            <span style={{ fontSize: 14, color: '#52525C', whiteSpace: 'nowrap' }}>
              Need more?{' '}
              <a
                href="#"
                style={{ color: '#18181B', textDecoration: 'underline', fontWeight: 500 }}
                onClick={(e) => { e.preventDefault(); toast('Contact our sales team!'); }}
              >
                Contact Sales
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* ── A2) Plan recommender ──────────────────────────────────────── */}
      <PlanRecommenderBanner
        billing={billing}
        onBillingChange={setBilling}
        onRecommendChange={setRecommendedSlug}
        onSeePlan={handleSeePlan}
        currentPlanSlug={currentPlanSlug}
      />

      {/* ── B) Three plan cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {PLAN_CARDS.map((plan) => {
          const planSlug = plan.name.toLowerCase() as RecommendedPlanSlug;
          const isSliderPick = recommendedSlug === planSlug;
          const isCurrent = currentPlanSlug === planSlug;
          return (
          <div
            key={plan.name}
            data-plan={planSlug}
            aria-disabled={isCurrent || undefined}
            style={{
              position: 'relative',
              border: isCurrent
                ? '1px solid #dbded4'
                : isSliderPick
                  ? '2px solid #F29964'
                  : '1px solid #dbded4',
              boxShadow: isCurrent
                ? 'none' : isSliderPick
                  ? '0 0 0 3px rgba(242,153,100,0.2)'
                  : 'none',
              borderRadius: plan.recommended || isCurrent ? '0 0 12px 12px' : 12,
              padding: '24px',
              background: isCurrent
                ? '#F0F0F2'
                : isSliderPick
                  ? 'linear-gradient(160deg, #FFF6F0 0%, #fff 60%)'
                  : '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              opacity: isCurrent ? 0.72 : 1,
              filter: isCurrent ? 'grayscale(0.35)' : undefined,
              transition: 'box-shadow 160ms ease, border-color 160ms ease',
            }}
          >
            {/* "Recommended" / "Current plan" pill */}
            {(plan.recommended || isCurrent) && (
              <div
                style={{
                  position: 'absolute',
                  top: -28,
                  left: -2,
                  right: -2,
                  background: isCurrent ? '#6A6772' : '#F29964',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '4px 0',
                  borderRadius: '8px 8px 0 0',
                  letterSpacing: '0.04em',
                }}
              >
                {isCurrent ? 'Current plan' : 'Recommended'}
              </div>
            )}

            {/* Name + price */}
            <div>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', display: 'block' }}>{plan.name}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>€{billing === 'yearly' ? plan.priceYearly : plan.priceMonthly}</span>
                <span style={{ fontSize: 13, color: '#9F9FA9' }}>per month</span>
              </div>
            </div>

            {/* Billed yearly toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TogglePill on={billing === 'yearly'} onClick={toggleBilling} />
              <span style={{ fontSize: 13, color: '#52525C' }}>Billed yearly</span>
              {billing === 'yearly' && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#1AB25E',
                    background: 'rgba(26,178,94,0.1)',
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  Save €{plan.save}
                </span>
              )}
            </div>

            {/* Description */}
            <p style={{ fontSize: 13, color: '#52525C', lineHeight: '1.55', minHeight: 72, margin: 0 }}>
              {plan.desc}
            </p>

            {/* CTA */}
            <CtaButton
              label={isCurrent ? 'Current plan' : plan.cta}
              style={plan.ctaStyle}
              href={getPlanCheckoutHref(plan.name, billing)}
              fullWidth
              disabled={isCurrent}
            />

            {/* Divider */}
            <Separator />

            {/* Features */}
            {plan.featuresHeader && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9F9FA9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {plan.featuresHeader}
              </span>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ marginTop: 1, flexShrink: 0 }}>
                    <Check color={!isCurrent && plan.recommended ? '#F29964' : '#18181B'} />
                  </span>
                  <span style={{ fontSize: 13, color: '#3F3F47', lineHeight: '1.45' }}>{f}</span>
                </li>
              ))}
            </ul>

            {/* "Most teams choose Growth" chip — hide when this card is the locked current plan */}
            {plan.recommended && !isCurrent && (
              <div
                style={{
                  marginTop: 4,
                  padding: '5px 12px',
                  background: 'rgba(242,153,100,0.08)',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#F29964',
                  textAlign: 'center',
                }}
              >
                Most teams choose Growth
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* ── C) Discovery card ─────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Not sure yet?</span>
          <span style={{ fontSize: 15, color: '#9F9FA9' }}>Start smaller</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#52525C', maxWidth: 360, textAlign: 'right' }}>
            Choose Starter to get going. Upgrade anytime as your needs grow.
          </span>
        </div>

        <SentryPanel>
          <SentryPanelBody>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap',
              opacity: currentPlanSlug === 'starter' ? 0.72 : 1,
              filter: currentPlanSlug === 'starter' ? 'grayscale(0.35)' : undefined,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#18181B' }}>
                Starter
                {currentPlanSlug === 'starter' && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#6A6772' }}>
                    Current plan
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#18181B' }}>€{billing === 'yearly' ? 24 : 29}</span>
                <span style={{ fontSize: 13, color: '#9F9FA9' }}>per month</span>
              </div>
              <p style={{ fontSize: 13, color: '#52525C', lineHeight: '1.5', maxWidth: 380, margin: '6px 0 0 0' }}>
                Draft and optimize content and start tracking your visibility in Google and AI search results.
              </p>
            </div>
            <div style={{ paddingTop: 4, flexShrink: 0 }}>
              <CtaButton
                label={currentPlanSlug === 'starter' ? 'Current plan' : 'Start with Starter'}
                style="ghost"
                href={getPlanCheckoutHref('Starter', billing)}
                disabled={currentPlanSlug === 'starter'}
              />
            </div>
          </div>

          <Separator />

          <ul
            style={{
              listStyle: 'none',
              margin: '16px 0 0 0',
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px 24px',
            }}
          >
            {STARTER_FEATURES.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ marginTop: 1, flexShrink: 0 }}><Check /></span>
                <span style={{ fontSize: 13, color: '#3F3F47', lineHeight: '1.45' }}>{f}</span>
              </li>
            ))}
          </ul>
          </SentryPanelBody>
        </SentryPanel>
      </div>

      {/* ── Rating + FAQ ──────────────────────────────────────────────── */}

      {/* Rating row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => <StarFilled key={i} />)}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
          Rated 4.7 / 5 stars
        </span>
        <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center' }}>
          {[
            { i: 'JK', c: '#F4A4B0' },
            { i: 'MR', c: '#F6C177' },
            { i: 'AL', c: '#A4C8F0' },
            { i: 'SP', c: '#B7E2C0' },
            { i: 'TD', c: '#D4B7F0' },
          ].map((a, idx) => (
            <span
              key={a.i}
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: a.c,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                marginLeft: idx === 0 ? 0 : -8,
                fontFamily: 'var(--font-family-primary)',
              }}
            >
              {a.i}
            </span>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <SentryPanel noPadding>
        <SentryPanelHeader title="FAQ" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        {FAQ_ITEMS.map((item, i) => {
          const open = faqOpen === i;
          return (
            <div
              key={i}
              style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid #F4F4F5' : 'none' }}
            >
              <button
                type="button"
                onClick={() => toggleFaq(i)}
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
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#18181B',
                    fontFamily: 'var(--font-family-primary)',
                    lineHeight: '1.4',
                  }}
                >
                  {item.q}
                </span>
                <ChevronDown open={open} />
              </button>
              {open && (
                <div style={{ padding: '0 20px 16px 20px' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: '#52525C',
                      lineHeight: '1.6',
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </SentryPanel>

    </div>
  );
};

export default PricingPlansSettings;
