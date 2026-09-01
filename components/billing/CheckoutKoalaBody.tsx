import Link from 'next/link';
import React from 'react';
import toast from 'react-hot-toast';
import Button from '../koala/primitives/Button';
import Input from '../koala/primitives/Input';
import { Select } from '../koala/core';
import { Field } from '../koala/forms';
import { Icon } from '../koala/icons';
import {
  CheckoutCompanyFields,
  CheckoutStripeAddress,
  CheckoutStripePayment,
  type CompanyState,
} from './CheckoutStripeProvider';
import type { CheckoutFieldErrors } from '../../lib/checkoutValidation';
import type { BillingPeriod, CheckoutPlan } from '../../lib/billingPlans';
import type { UpgradePreview } from '../../lib/billingUpgrade';
import {
  CHECKOUT_PLANS,
  formatEuro,
  getPlanMonthlyPrice,
  getPlanPeriodPrice,
} from '../../lib/billingPlans';
import { typeface } from '../koala/tokens/typography';
import { shadow } from '../koala/tokens/effects';

function formatPriceDelta(delta: number): string | null {
  if (delta === 0) return null;
  const amount = formatEuro(Math.abs(delta));
  return delta > 0 ? `+${amount}` : `−${amount}`;
}

const F = typeface.body;
const BRAND = 'var(--koala-brand)';
const BORDER = 'var(--koala-border-primary)';
const TEXT = 'var(--koala-text-primary)';
const MUTED = 'var(--koala-text-secondary)';
const SURFACE = 'var(--koala-bg-primary)';
const SURFACE_MUTED = 'var(--koala-bg-secondary)';
const DANGER = 'var(--koala-status-danger)';
const SUCCESS = 'var(--koala-status-success)';

const formatEuro2 = (amount: number): string =>
  `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatEuroCents = (cents: number): string => formatEuro2(cents / 100);

export type CheckoutTaxPreview = {
  taxAmountCents: number;
  amountTotalCents: number;
  taxPercent: number | null;
  taxLabel: string;
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 8 }}>
      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '24px', color: TEXT, fontFamily: F }}>{children}</span>
      {required ? <span style={{ fontSize: 14, color: BRAND }}>*</span> : null}
    </div>
  );
}

const RadioDot = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden
    style={{
      width: 16,
      height: 16,
      borderRadius: 9999,
      border: checked ? `5px solid ${BRAND}` : `1.5px solid ${BORDER}`,
      background: SURFACE,
      boxSizing: 'border-box',
      flexShrink: 0,
    }}
  />
);

const SelectCard = ({
  selected,
  disabled,
  onClick,
  children,
  style,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={(e) => {
      e.preventDefault();
      if (!disabled) onClick?.();
    }}
    style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: 16,
      borderRadius: 16,
      border: selected ? `1.5px solid ${BRAND}` : `1px solid ${BORDER}`,
      boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${BRAND} 10%, transparent)` : 'none',
      background: SURFACE,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      textAlign: 'left',
      fontFamily: F,
      ...style,
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    <RadioDot checked={selected} />
  </button>
);

const VisaMark = () => (
  <span
    style={{
      width: 36,
      height: 24,
      borderRadius: 3,
      border: `0.5px solid ${BORDER}`,
      // Card-brand plate keeps its own white, like the printed mark — the navy
      // wordmark below is unreadable once this follows a dark surface.
      background: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 10,
      fontWeight: 700,
      color: '#172B85',
      letterSpacing: 0.2,
    }}
  >
    VISA
  </span>
);

export type CheckoutKoalaBodyProps = {
  plan: CheckoutPlan;
  billing: BillingPeriod;
  isUpgrade: boolean;
  isUpfront: boolean;
  stripeCheckoutEnabled: boolean;
  nextChargeLabel: string;
  trialStartLabel: string;
  trialEndLabel: string;
  checkoutLoading: boolean;
  upgradePreview?: UpgradePreview | null;
  previewLoading?: boolean;
  previewError?: Error | null;
  company: CompanyState;
  fieldErrors: CheckoutFieldErrors;
  onCompanyEmail: (v: string) => void;
  onCompanyTaxId: (v: string) => void;
  onBillingChange: (period: BillingPeriod) => void;
  onPlanChange: (slug: string) => void;
  onPurchase: () => void;
  onTrialStart: () => void;
  onSkipTrial?: () => void;
  // mock card (no Stripe)
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  country: string;
  countryOpen: boolean;
  countries: string[];
  mockErrors: Record<string, string>;
  addressLine: string;
  city: string;
  zip: string;
  onCardNumber: (v: string) => void;
  onCardExpiry: (v: string) => void;
  onCardCvc: (v: string) => void;
  onCountry: (v: string) => void;
  onCountryOpen: (open: boolean) => void;
  onAddressLine: (v: string) => void;
  onCity: (v: string) => void;
  onZip: (v: string) => void;
  taxPreview?: CheckoutTaxPreview | null;
  taxLoading?: boolean;
  /** Address incomplete or VAT still loading — blocks trial/purchase CTAs. */
  ctaBlocked?: boolean;
};

export default function CheckoutKoalaBody(props: CheckoutKoalaBodyProps) {
  const {
    plan, billing, isUpgrade, isUpfront, stripeCheckoutEnabled,
    nextChargeLabel, trialStartLabel, trialEndLabel,
    checkoutLoading, upgradePreview, previewLoading, previewError,
    company, fieldErrors, onCompanyEmail, onCompanyTaxId, onBillingChange, onPlanChange,
    onPurchase, onTrialStart, onSkipTrial,
    cardNumber, cardExpiry, cardCvc, country, countryOpen, countries, mockErrors,
    addressLine, city, zip,
    onCardNumber, onCardExpiry, onCardCvc, onCountry, onCountryOpen,
    onAddressLine, onCity, onZip,
    taxPreview = null,
    taxLoading = false,
    ctaBlocked = false,
  } = props;

  const [discount, setDiscount] = React.useState('');

  const isYearly = billing === 'yearly';
  const periodPrice = getPlanPeriodPrice(plan, billing);
  const monthlyPrice = getPlanMonthlyPrice(plan, billing);
  const taxAmountCents = taxPreview?.taxAmountCents ?? null;
  const taxLabel = taxPreview?.taxLabel ?? 'VAT';
  const totalWithTaxCents = taxPreview?.amountTotalCents
    ?? Math.round(periodPrice * 100) + (taxAmountCents ?? 0);
  const originalYearPrice = plan.priceMonthly * 12;
  const currentMonthly = monthlyPrice;
  const planOptions = CHECKOUT_PLANS.map((p) => ({
    value: p.slug,
    label: `${p.name} plan`,
  }));

  const title = isUpgrade
    ? `Upgrade to ${plan.name}`
    : isUpfront
      ? 'Complete checkout'
      : 'Try Ranksmile free for 7 days';
  const subtitle = isUpgrade
    ? 'Review the prorated charge and confirm your upgrade.'
    : isUpfront
      ? 'Please enter your details to complete your purchase.'
      : `Start your 7-day free trial of the ${plan.name} plan — no charge today.`;

  const ctaLabel = (() => {
    if (checkoutLoading) {
      if (isUpgrade) return 'Upgrading…';
      if (isUpfront) return 'Processing…';
      return 'Starting…';
    }
    if (isUpgrade) {
      if (upgradePreview && upgradePreview.amountDueCents > 0) {
        return `Pay ${formatEuroCents(upgradePreview.amountDueCents)}`;
      }
      return `Upgrade to ${plan.name}`;
    }
    if (isUpfront) return 'Purchase';
    return 'Start my trial';
  })();

  const onCta = isUpfront || isUpgrade ? onPurchase : onTrialStart;

  return (
    <div className="cko-figma">
      <style>{`
        .cko-figma { color: ${TEXT}; font-family: ${F}; width: 100%; max-width: 1120px; margin: 0 auto; }
        .cko-figma-grid { display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(280px, 384px); gap: 0 40px; align-items: start; }
        .cko-figma-rail { width: 1px; background: ${BORDER}; align-self: stretch; min-height: 100%; }
        .cko-figma-left { display: flex; flex-direction: column; gap: 24px; min-width: 0; padding-bottom: 32px; }
        .cko-figma-right { display: flex; flex-direction: column; gap: 24px; min-width: 0; position: sticky; top: 24px; }
        .cko-billing { display: flex; gap: 16px; }
        .cko-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cko-row-city { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
        .cko-divider-text { display: flex; align-items: center; gap: 12px; width: 100%; }
        .cko-divider-text::before, .cko-divider-text::after { content: ''; flex: 1; height: 1px; background: ${BORDER}; }
        @media (max-width: 960px) {
          .cko-figma-grid { grid-template-columns: 1fr; gap: 32px; }
          .cko-figma-rail { display: none; }
          .cko-figma-right { position: static; }
        }
        @media (max-width: 640px) {
          .cko-row2, .cko-row-city, .cko-billing { grid-template-columns: 1fr; display: grid; }
        }
      `}</style>

      <div className="cko-figma-grid">
        {/* ── Left: form ─────────────────────────────────────────── */}
        <div className="cko-figma-left">
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: '38px', fontWeight: 700, letterSpacing: '-0.5px' }}>{title}</h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', color: MUTED }}>{subtitle}</p>
          </header>

          <div>
            <FieldLabel required>Plan</FieldLabel>
            <Select
              size="md"
              width="100%"
              value={plan.slug}
              onChange={onPlanChange}
              options={planOptions}
              renderOption={(opt, selected) => {
                const optPlan = CHECKOUT_PLANS.find((p) => p.slug === opt.value);
                const delta = optPlan
                  ? getPlanMonthlyPrice(optPlan, billing) - currentMonthly
                  : 0;
                const deltaLabel = formatPriceDelta(delta);
                return (
                  <>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                      {deltaLabel ? (
                        <span style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: delta > 0 ? BRAND : MUTED,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                        >
                          {deltaLabel}
                        </span>
                      ) : null}
                      {selected ? <Icon name="Check" size={14} color={BRAND} /> : null}
                    </span>
                  </>
                );
              }}
            />
          </div>

          <div className="cko-divider-text">
            <span style={{ fontSize: 14, fontWeight: 500, color: MUTED, whiteSpace: 'nowrap' }}>Payment Information</span>
          </div>

          <div>
            <FieldLabel required>Billing</FieldLabel>
            <div className="cko-billing" role="radiogroup" aria-label="Billing period">
              <SelectCard
                selected={!isYearly}
                onClick={() => onBillingChange('monthly')}
                style={{ padding: 12, gap: 16 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Monthly</span>
                  <span style={{ fontSize: 14, color: MUTED }}>{formatEuro(plan.priceMonthly)}/Month</span>
                </div>
              </SelectCard>
              <SelectCard
                selected={isYearly}
                onClick={() => onBillingChange('yearly')}
                style={{ padding: 12, gap: 16 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Yearly</span>
                  <span style={{ fontSize: 14, color: MUTED }}>{formatEuro(plan.priceYearly)}/Month</span>
                </div>
              </SelectCard>
            </div>
          </div>

          {isUpgrade ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: MUTED }}>
              We&apos;ll charge the prorated difference to your card on file. Unused time on your current plan is credited automatically.
            </p>
          ) : stripeCheckoutEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <FieldLabel required>Card details</FieldLabel>
                <CheckoutStripePayment />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel required>Billing address</FieldLabel>
                <CheckoutStripeAddress />
                {fieldErrors.address ? (
                  <span style={{ fontSize: 13, color: DANGER, lineHeight: '18px' }} role="alert">
                    {fieldErrors.address}
                  </span>
                ) : null}
              </div>
              <CheckoutCompanyFields
                billingEmail={company.billingEmail}
                taxId={company.taxId}
                fieldErrors={fieldErrors}
                onBillingEmailChange={onCompanyEmail}
                onTaxIdChange={onCompanyTaxId}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Card number *" error={mockErrors.cardNumber}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <VisaMark />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Input
                      placeholder="Card number"
                      value={cardNumber}
                      onChange={(e) => onCardNumber(e.target.value)}
                      hasError={Boolean(mockErrors.cardNumber)}
                      autoComplete="cc-number"
                    />
                  </div>
                </div>
              </Field>
              <div className="cko-row2">
                <Field label="Expiration *" error={mockErrors.cardExpiry}>
                  <Input
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => onCardExpiry(e.target.value)}
                    hasError={Boolean(mockErrors.cardExpiry)}
                    autoComplete="cc-exp"
                  />
                </Field>
                <Field label="Security Code *" error={mockErrors.cardCvc}>
                  <Input
                    placeholder="CVC"
                    value={cardCvc}
                    onChange={(e) => onCardCvc(e.target.value)}
                    hasError={Boolean(mockErrors.cardCvc)}
                    autoComplete="cc-csc"
                  />
                </Field>
              </div>
              <div style={{ position: 'relative' }}>
                <Field label="Country or region *" error={mockErrors.country}>
                  <button
                    type="button"
                    onClick={() => onCountryOpen(!countryOpen)}
                    style={{
                      width: '100%',
                      height: 40,
                      border: `1px solid ${mockErrors.country ? DANGER : BORDER}`,
                      borderRadius: 12,
                      background: SURFACE,
                      padding: '0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      fontFamily: F,
                      color: country ? TEXT : MUTED,
                      cursor: 'pointer',
                    }}
                  >
                    {country || 'Select country'}
                    <Icon name="CaretDown" size={16} color={MUTED} />
                  </button>
                </Field>
                {countryOpen && (
                  <div style={{ position: 'absolute', zIndex: 150, top: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: shadow.md, padding: 6 }}>
                    {countries.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => { onCountry(item); onCountryOpen(false); }}
                        style={{ width: '100%', textAlign: 'left', border: 'none', background: item === country ? SURFACE_MUTED : 'transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: MUTED, fontFamily: F, cursor: 'pointer' }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Field label="Address line *">
                <Input value={addressLine} onChange={(e) => onAddressLine(e.target.value)} autoComplete="address-line1" />
              </Field>
              <div className="cko-row-city">
                <Field label="City *">
                  <Input value={city} onChange={(e) => onCity(e.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label="ZIP *">
                  <Input value={zip} onChange={(e) => onZip(e.target.value)} autoComplete="postal-code" />
                </Field>
              </div>
            </div>
          )}

        </div>

        <div className="cko-figma-rail" aria-hidden />

        {/* ── Right: summary ─────────────────────────────────────── */}
        <aside className="cko-figma-right">
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 700, letterSpacing: '-0.4px' }}>Summary</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: MUTED }}>
              Review your items carefully before proceeding to checkout.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px' }}>{plan.name} plan</div>
                  <div style={{ fontSize: 14, color: MUTED, lineHeight: '20px' }}>
                    {isYearly ? 'Billed yearly' : 'Billed monthly'}
                    {isYearly ? (
                      <>
                        {' · '}
                        <span style={{ textDecoration: 'line-through' }}>{formatEuro(originalYearPrice)}</span>
                        {' '}
                        {formatEuro(periodPrice)}/year
                      </>
                    ) : (
                      <> · {formatEuro(periodPrice)}/month</>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {isUpgrade && upgradePreview
                    ? formatEuroCents(upgradePreview.targetPeriodPriceCents)
                    : formatEuro2(periodPrice)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 10,
                    background: SURFACE_MUTED,
                    color: MUTED,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  <Icon name="Minus" size={14} />
                  1
                  <Icon name="Plus" size={14} />
                </div>
                <Link href="/plans" passHref>
                  <a style={{ display: 'inline-flex', color: MUTED }} title="Change plan" aria-label="Change plan">
                    <Icon name="Trash" size={18} />
                  </a>
                </Link>
              </div>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.features.slice(0, 4).map((f) => (
                <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: '18px', color: MUTED }}>
                  <Icon name="Check" size={14} color={TEXT} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input
                placeholder="Discount code"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (!discount.trim()) return;
                toast.error('Promo codes are not available yet');
              }}
              disabled={!discount.trim()}
              style={{ flexShrink: 0 }}
            >
              Apply code
            </Button>
          </div>

          {isUpgrade ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {previewLoading || !upgradePreview ? (
                <>
                  <div className="koala-skeleton-block" style={{ height: 16, borderRadius: 6, width: '70%' }} />
                  <div className="koala-skeleton-block" style={{ height: 16, borderRadius: 6, width: '55%' }} />
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: MUTED }}>Subtotal</span>
                    <span>{formatEuroCents(upgradePreview.targetPeriodPriceCents)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: MUTED }}>Credit from {upgradePreview.currentPlanName}</span>
                    <span style={{ color: SUCCESS }}>−{formatEuroCents(upgradePreview.creditCents)}</span>
                  </div>
                  <div style={{ height: 1, background: BORDER }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{formatEuroCents(upgradePreview.amountDueCents)}</span>
                  </div>
                  {previewError ? (
                    <p style={{ margin: 0, fontSize: 13, color: DANGER }}>{previewError.message}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: MUTED }}>Subtotal</span>
                <span>{formatEuro2(periodPrice)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                <span style={{ color: MUTED }}>{taxLabel}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                  {taxLoading ? (
                    <>
                      <span
                        aria-hidden
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: `2px solid ${BORDER}`,
                          borderTopColor: BRAND,
                          animation: 'rs-tax-spin 0.7s linear infinite',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: MUTED, fontSize: 13 }}>Calculating…</span>
                      <style>{`@keyframes rs-tax-spin{to{transform:rotate(360deg)}}`}</style>
                    </>
                  ) : taxAmountCents != null
                    ? formatEuroCents(taxAmountCents)
                    : '—'}
                </span>
              </div>
              {!isUpfront && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: MUTED }}>Due today</span>
                  <span>{formatEuro2(0)}</span>
                </div>
              )}
              <div style={{ height: 1, background: BORDER }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {isUpfront ? 'Total' : 'Total today'}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  {isUpfront
                    ? (taxAmountCents != null ? formatEuroCents(totalWithTaxCents) : formatEuro2(periodPrice))
                    : formatEuro2(0)}
                </span>
              </div>
              {!isUpfront && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: MUTED }}>
                  On {trialEndLabel}, you will be charged{' '}
                  {taxAmountCents != null
                    ? formatEuroCents(totalWithTaxCents)
                    : formatEuro(periodPrice)}
                  {taxAmountCents != null ? ` (incl. ${taxLabel})` : ''}. Trial starts {trialStartLabel}.
                </p>
              )}
              {isUpfront && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: MUTED }}>
                  Charged every {isYearly ? 'year' : 'month'} until canceled. Next charge {nextChargeLabel}.
                  {' '}
                  ({formatEuro(monthlyPrice)}/mo effective
                  {taxAmountCents != null ? ` + ${taxLabel}` : ''})
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onCta}
              disabled={
                checkoutLoading
                || ctaBlocked
                || (isUpgrade && (previewLoading || Boolean(previewError)))
              }
              style={{ width: '100%' }}
            >
              {ctaLabel}
            </Button>
            {!isUpfront && !isUpgrade && onSkipTrial && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onSkipTrial}
                disabled={checkoutLoading || ctaBlocked}
                style={{ width: '100%' }}
              >
                Skip trial and buy {plan.name} now
              </Button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: MUTED }}>
              <Icon name="LockSimple" size={16} color={MUTED} />
              <span>Checkout secured by Stripe</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
