import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import toast from 'react-hot-toast';
import AppShell from '../../../components/common/AppShell';
import { Button } from '../../../components/core';
import {
  addressFromStripeEvent,
  CheckoutCompanyFields,
  CheckoutStripePayment,
  CheckoutStripeProvider,
  type CheckoutStripeHandle,
  type CompanyState,
} from '../../../components/billing/CheckoutStripeProvider';
import type { CheckoutFieldErrors } from '../../../lib/checkoutValidation';
import {
  BillingPeriod,
  CheckoutPlan,
  formatEuro,
  getCheckoutPlan,
  getPlanMonthlyPrice,
  getPlanPeriodPrice,
  getTrialEndDateLabel,
} from '../../../lib/billingPlans';
import { isStripeCheckoutConfigured, type PlanSlug } from '../../../lib/stripePrices';

const F = 'var(--font-family-primary)';

const TAX_RATE = 0.23;
const MOCK_CARDHOLDER = 'John Doe';
const formatEuro2 = (amount: number): string => `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VisaCard = () => (
  <svg width="56" height="40" viewBox="0 0 34 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="0.5" y="0.5" width="33" height="23" rx="3.5" fill="white" stroke="#EDF2F7" />
    <path fillRule="evenodd" clipRule="evenodd" d="M10.7503 15.8579H8.69056L7.146 9.79198C7.07269 9.51295 6.91703 9.26627 6.68806 9.15001C6.11664 8.85784 5.48696 8.62531 4.80005 8.50804V8.2745H8.11813C8.57607 8.2745 8.91953 8.62531 8.97677 9.03274L9.77817 13.4083L11.8369 8.2745H13.8394L10.7503 15.8579ZM14.9843 15.8579H13.039L14.6408 8.2745H16.5861L14.9843 15.8579ZM19.1028 10.3753C19.16 9.96689 19.5035 9.73335 19.9042 9.73335C20.5338 9.67471 21.2197 9.79199 21.7922 10.0832L22.1356 8.45042C21.5632 8.21688 20.9335 8.09961 20.3621 8.09961C18.4741 8.09961 17.1003 9.15002 17.1003 10.6078C17.1003 11.7169 18.0734 12.2992 18.7603 12.65C19.5035 12.9998 19.7897 13.2334 19.7324 13.5832C19.7324 14.1079 19.16 14.3414 18.5886 14.3414C17.9017 14.3414 17.2147 14.1665 16.5861 13.8743L16.2426 15.5081C16.9295 15.7992 17.6727 15.9165 18.3596 15.9165C20.4766 15.9741 21.7922 14.9247 21.7922 13.3496C21.7922 11.3661 19.1028 11.2498 19.1028 10.3753ZM28.6 15.8579L27.0555 8.2745H25.3965C25.053 8.2745 24.7095 8.50804 24.5951 8.85784L21.7349 15.8579H23.7374L24.1371 14.7498H26.5976L26.8265 15.8579H28.6ZM25.6827 10.3164L26.2541 13.1744H24.6523L25.6827 10.3164Z" fill="#172B85" />
  </svg>
);

const CheckIcon = ({ color = '#18181B' }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill={color} fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
  </svg>
);

const CardIcon = ({ muted = false }: { muted?: boolean }) => (
  <span style={{ width: 26, height: 26, borderRadius: 9999, background: muted ? '#E4E4E7' : '#F0FDF4', color: muted ? '#3F3F47' : '#15803D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3z" />
      <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75m.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5z" clipRule="evenodd" />
    </svg>
  </span>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: '#3F3F47' }}>
    <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, color: '#3F3F47' }}>
    <path d="M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16M96 56a32 32 0 0 1 64 0v24H96Zm112 152H48V96h160zm-68-56a12 12 0 1 1-12-12a12 12 0 0 1 12 12" />
  </svg>
);

const Input = ({
  placeholder = '',
  disabled = false,
  value,
  onChange,
  type = 'text',
  hasError = false,
  autoComplete,
}: {
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  hasError?: boolean;
  autoComplete?: string;
}) => (
  <input
    type={type}
    disabled={disabled}
    value={value}
    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    autoComplete={autoComplete}
    placeholder={placeholder}
    style={{
      width: '100%',
      height: 38,
      border: `1px solid ${hasError ? '#FF6F77' : '#D4D4D8'}`,
      borderRadius: 10,
      padding: '0 10px',
      fontSize: 14,
      fontFamily: F,
      color: '#18181B',
      background: disabled ? '#F8F8F9' : '#fff',
      boxShadow: hasError ? '0 0 0 2px rgba(255,111,119,0.12)' : disabled ? 'none' : '0px 2px 0px 0px #DAD9DE',
      outline: 'none',
      boxSizing: 'border-box',
    }}
  />
);

const FieldError = ({ message }: { message?: string }) => (
  message ? <span style={{ fontSize: 13, color: '#FF6F77', lineHeight: '18px' }} role="alert">{message}</span> : null
);

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>
    {label}
    {children}
    <FieldError message={error} />
    {hint && <span style={{ fontSize: 13, fontWeight: 400, color: '#3F3F47', lineHeight: '20px' }}>{hint}</span>}
  </label>
);

const COUNTRIES = ['Afghanistan', 'Aland Islands', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola', 'Poland', 'United Kingdom', 'United States'];

type CheckoutMode = 'trial' | 'upfront';

type CheckoutProps = {
  plan: CheckoutPlan;
  billing: BillingPeriod;
  mode: CheckoutMode;
  trialStartLabel: string;
  trialEndLabel: string;
  nextChargeLabel: string;
  stripeCheckoutEnabled: boolean;
};

const CheckoutPage: NextPage<CheckoutProps> = ({
  plan, billing, mode, trialStartLabel, trialEndLabel, nextChargeLabel, stripeCheckoutEnabled,
}) => {
  const isUpfront = mode === 'upfront';
  const router = useRouter();
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [country, setCountry] = React.useState(isUpfront ? 'Poland' : '');
  const periodPrice = getPlanPeriodPrice(plan, billing);
  const monthlyPrice = getPlanMonthlyPrice(plan, billing);
  const originalYearPrice = plan.priceMonthly * 12;
  const isYearly = billing === 'yearly';
  const taxAmount = periodPrice * TAX_RATE;
  const totalToday = periodPrice + taxAmount;

  const showWelcomeToast = (title: string, body: string, emoji = '🙌') => {
    toast.custom((t) => (
      <div style={{
        width: 356,
        maxWidth: 'calc(100vw - 32px)',
        background: '#18181B',
        color: '#fff',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 14px 40px rgba(0,0,0,0.18)',
        fontFamily: F,
      }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ color: '#7DE68D', width: 20, height: 20, borderRadius: 9999, border: '1.5px solid #7DE68D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <CheckIcon color="#7DE68D" />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ color: '#8BE998', fontSize: 15, fontWeight: 700, lineHeight: '20px' }}>{title}</div>
            <div style={{ fontSize: 16, lineHeight: '18px' }}>{emoji}</div>
            <div style={{ color: '#fff', fontSize: 14, lineHeight: '20px' }}>{body}</div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => toast.dismiss(t.id)}
            style={{ marginLeft: 'auto', alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
    ), { duration: 7000 });
  };

  const goToDashboardWithTrialToast = () => {
    router.push('/dashboard').then(() => showWelcomeToast(
      'Welcome to your 7-day Surfer trial',
      'Give our AI SEO workflow a try before you commit. Follow the checklist on the left or explore on your own. Happy Surfing!',
    ));
  };

  const goToDashboardWithPurchaseToast = () => {
    router.push('/dashboard').then(() => showWelcomeToast(
      `You're all set with ${plan.name}`,
      `Your ${plan.name} plan is now active. Jump in — optimize your content and track your AI visibility. Happy Surfing!`,
      '🎉',
    ));
  };

  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const stripeRef = React.useRef<CheckoutStripeHandle>(null);
  const [fieldErrors, setFieldErrors] = React.useState<CheckoutFieldErrors>({});
  const [company, setCompany] = React.useState<CompanyState>({
    billingEmail: '',
    taxId: '',
    addressComplete: false,
    addressValue: null,
  });

  // Mock card fields (dev / no Stripe)
  const [cardholderName, setCardholderName] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [cardExpiry, setCardExpiry] = React.useState('');
  const [cardCvc, setCardCvc] = React.useState('');
  const [mockErrors, setMockErrors] = React.useState<Record<string, string>>({});

  const handleAddressChange = React.useCallback((event: Parameters<typeof addressFromStripeEvent>[0]) => {
    const parsed = addressFromStripeEvent(event);
    setCompany((prev) => ({
      ...prev,
      addressComplete: parsed.complete,
      addressValue: parsed.value,
    }));
    setFieldErrors((prev) => ({ ...prev, address: undefined, taxId: undefined }));
  }, []);

  const validateMockCard = (): boolean => {
    const errors: Record<string, string> = {};
    if (!cardholderName.trim() || cardholderName.trim().length < 2) {
      errors.cardholderName = 'Enter the cardholder name';
    }
    const digits = cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(digits)) {
      errors.cardNumber = 'Enter a valid card number';
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
      errors.cardExpiry = 'Use MM/YY format';
    }
    if (!/^\d{3,4}$/.test(cardCvc.trim())) {
      errors.cardCvc = 'Enter a valid CVC';
    }
    if (!stripeCheckoutEnabled && !isUpfront && !country) {
      errors.country = 'Select your country';
    }
    setMockErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTrialStart = async () => {
    if (stripeCheckoutEnabled) {
      await stripeRef.current?.submit();
      return;
    }
    if (!validateMockCard()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    goToDashboardWithTrialToast();
  };

  const handleUpfrontPurchase = async () => {
    if (stripeCheckoutEnabled) {
      await stripeRef.current?.submit();
      return;
    }
    if (!validateMockCard()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    goToDashboardWithPurchaseToast();
  };

  const handleStripeSuccess = () => {
    if (isUpfront) goToDashboardWithPurchaseToast();
    else goToDashboardWithTrialToast();
  };

  const handleStripeError = (message: string) => {
    toast.error(message);
  };

  const checkoutBody = (
    <>
          <h1 style={{ margin: '0 0 28px', textAlign: 'center', fontSize: 24, lineHeight: '32px', fontWeight: 700, letterSpacing: 0 }}>
            {isUpfront ? `Finalize your order for the ${plan.name} plan` : 'Try Surfer free for 7 days'}
          </h1>

          <div className="checkout-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Plan Details</h2>
                  <Link href="/settings/billing_subscription?view=plans" passHref>
                    <a style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#3F3F47', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157l3.712 3.712l1.157-1.157a2.625 2.625 0 0 0 0-3.712m-2.218 5.93l-3.712-3.712l-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32z" />
                      </svg>
                      Change Plan
                    </a>
                  </Link>
                </div>
                <div className="checkout-card" style={{ border: '2px solid #18181B', borderRadius: 12, padding: 16, background: '#fff', boxShadow: '0 4px 0 0 #e4e4e7' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: '20px' }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 4, fontSize: 14, lineHeight: '20px' }}>
                    {isYearly && <span style={{ color: '#71717B', textDecoration: 'line-through' }}>{formatEuro(originalYearPrice)}/year</span>}
                    <span style={{ fontWeight: 600 }}>{formatEuro(periodPrice)}{isYearly ? '/year' : '/month'}</span>
                    {!isUpfront && <span>after 7-day free trial</span>}
                  </div>
                </div>
              </section>

              <section className="checkout-card" style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: 20, background: '#fff' }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Plan Features</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, lineHeight: '20px', color: '#18181B' }}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="checkout-card" style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: 20, background: '#fff' }}>
                <h2 style={{ margin: '0 0 18px', fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Payment Details</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {stripeCheckoutEnabled ? (
                    <CheckoutStripePayment />
                  ) : isUpfront ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>Cardholder name: {MOCK_CARDHOLDER}</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <VisaCard />
                          <span style={{ fontSize: 14 }}><span style={{ paddingRight: 2 }}>•••• •••• ••••</span> 3692</span>
                          <span style={{ fontSize: 14, paddingLeft: 8 }}><span style={{ color: '#71717B' }}>Exp: </span>7/2031</span>
                        </div>
                        <Button type="button" variant="secondary" size="sm">Update</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Field label="Cardholder Name" error={mockErrors.cardholderName}>
                        <Input
                          placeholder="e.g. John Doe"
                          value={cardholderName}
                          onChange={setCardholderName}
                          hasError={Boolean(mockErrors.cardholderName)}
                          autoComplete="cc-name"
                        />
                      </Field>
                      <Field label="Card Number" error={mockErrors.cardNumber}>
                        <Input
                          placeholder="Card Number"
                          value={cardNumber}
                          onChange={setCardNumber}
                          hasError={Boolean(mockErrors.cardNumber)}
                          autoComplete="cc-number"
                        />
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <Field label="Expiration Date" error={mockErrors.cardExpiry}>
                          <Input
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={setCardExpiry}
                            hasError={Boolean(mockErrors.cardExpiry)}
                            autoComplete="cc-exp"
                          />
                        </Field>
                        <Field label="CVC" error={mockErrors.cardCvc}>
                          <Input
                            placeholder="CVC"
                            value={cardCvc}
                            onChange={setCardCvc}
                            hasError={Boolean(mockErrors.cardCvc)}
                            autoComplete="cc-csc"
                          />
                        </Field>
                      </div>
                    </>
                  )}
                  {!stripeCheckoutEnabled && (isUpfront ? (
                    <Field label="Country">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: 42, border: '1px solid #D4D4D8', borderRadius: 10, background: '#F8F8F9', padding: '0 12px', opacity: 0.75 }}>
                        <span style={{ flex: 1, fontSize: 14, color: '#18181B' }}>Poland</span>
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: '#9F9FA9' }}>
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                        </svg>
                      </div>
                    </Field>
                  ) : (
                  <div style={{ position: 'relative' }}>
                    <Field label="Country" error={mockErrors.country}>
                      <button
                        type="button"
                        onClick={() => setCountryOpen((open) => !open)}
                        style={{
                          width: '100%',
                          height: 42,
                          border: `1px solid ${mockErrors.country ? '#FF6F77' : '#D4D4D8'}`,
                          borderRadius: 10,
                          background: '#fff',
                          padding: '0 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 14,
                          fontFamily: F,
                          color: country ? '#18181B' : '#52525C',
                          boxShadow: countryOpen ? '0 0 0 2px rgba(120,58,251,0.1)' : '0px 2px 0px 0px #DAD9DE',
                          cursor: 'pointer',
                        }}
                      >
                        {country || 'Select country'}
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ transform: countryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                        </svg>
                      </button>
                    </Field>
                    {countryOpen && (
                      <div style={{ position: 'absolute', zIndex: 150, top: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', borderRadius: 12, background: '#fff', boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)', padding: 6 }}>
                        {COUNTRIES.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => { setCountry(item); setCountryOpen(false); }}
                            style={{ width: '100%', textAlign: 'left', border: 'none', background: item === country ? '#F4F4F5' : 'transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, lineHeight: '20px', color: '#3F3F47', fontFamily: F, cursor: 'pointer' }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              </section>

              <section className="checkout-card" style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: 20, background: '#F8F8F9' }}>
                <h2 style={{ margin: 0, fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Company Information (Optional)</h2>
                <p style={{ margin: '4px 0 16px', fontSize: 14, lineHeight: '20px', color: '#3F3F47' }}>If you&apos;d like your company details listed on your invoices, enter them here</p>
                <div style={{ display: 'grid', gap: 14 }}>
                  {stripeCheckoutEnabled ? (
                    <CheckoutCompanyFields
                      billingEmail={company.billingEmail}
                      taxId={company.taxId}
                      fieldErrors={fieldErrors}
                      onBillingEmailChange={(v) => {
                        setCompany((p) => ({ ...p, billingEmail: v }));
                        setFieldErrors((e) => ({ ...e, billingEmail: undefined }));
                      }}
                      onTaxIdChange={(v) => {
                        setCompany((p) => ({ ...p, taxId: v }));
                        setFieldErrors((e) => ({ ...e, taxId: undefined }));
                      }}
                    />
                  ) : (
                    <>
                  <Field label="Billing email" hint="Fill in to receive invoices on an email address other than the one associated with your account">
                    <Input />
                  </Field>
                  <Field label="Tax ID" hint={country ? 'Tax ID will be shown on your invoices.' : 'Please select a country to be able to add a tax ID'}>
                    <Input disabled={!country} />
                  </Field>
                  <Field label="Name/Company name"><Input /></Field>
                  <Field label="Address"><Input /></Field>
                  <Field label="City"><Input /></Field>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 124px', gap: 12 }}>
                    <Field label="State/Province/Region"><Input /></Field>
                    <Field label="ZIP Code"><Input /></Field>
                  </div>
                    </>
                  )}
                </div>
              </section>
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isUpfront ? (
                <section style={{ background: '#fff', border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: 20 }}>
                  <h2 style={{ margin: '0 0 16px', fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Order summary</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>{plan.name} plan</span>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{formatEuro2(periodPrice)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>TAX (23%)</span>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{formatEuro2(taxAmount)}</span>
                    </div>
                    <div style={{ height: 1, background: '#F4F4F5' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 500, textTransform: 'uppercase' }}>Total today</span>
                      <span style={{ fontSize: 24, fontWeight: 500 }}>{formatEuro2(totalToday)}</span>
                    </div>
                    <Button type="button" variant="primary" size="md" onClick={handleUpfrontPurchase} disabled={checkoutLoading} style={{ width: '100%' }}>
                      Pay {formatEuro2(totalToday)}
                    </Button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>
                      <InfoIcon />
                      <span>You will be charged every {isYearly ? 'year' : 'month'} until canceled. The next payment will be charged at {nextChargeLabel}.</span>
                    </div>
                  </div>
                </section>
              ) : (
              <>
              <section style={{ background: '#F8F8F9', border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>How your free trial works</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '22px' }}>Your free trial includes a 7-day access to our most popular plan - <strong>{plan.name}</strong>.</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, fontSize: 14 }}>
                  {['Full AI Visibility coverage', 'AI writing and 1-click automations', 'Audit, Recommendations, and much more'].map((feature) => (
                    <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckIcon />{feature}</li>
                  ))}
                </ul>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
                  <div style={{ position: 'absolute', top: 20, left: 22, right: 22, height: 2, background: '#E4E4E7' }} />
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', background: '#F8F8F9', paddingRight: 8 }}>
                    <CardIcon />
                    <span style={{ color: '#15803D', fontSize: 14 }}>{trialStartLabel}</span>
                    <strong style={{ color: '#15803D', fontSize: 14 }}>Trial start</strong>
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', background: '#F8F8F9', paddingLeft: 8 }}>
                    <CardIcon muted />
                    <span style={{ fontSize: 14 }}>{trialEndLabel}</span>
                    <strong style={{ fontSize: 14 }}>{plan.name} starts</strong>
                  </div>
                </div>
              </section>

              <section style={{ background: '#fff', border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, padding: 20 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: 13, lineHeight: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>Order Summary</h2>
                <Button type="button" variant="primary" size="md" onClick={handleTrialStart} disabled={checkoutLoading} style={{ width: '100%' }}>
                  Start my trial
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => router.push(`/billing/checkout/${plan.slug}?billing=${billing}&mode=upfront`)}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Skip trial and buy {plan.name} now
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>
                  <InfoIcon />
                  <span>On {trialEndLabel}, you will be charged {formatEuro(periodPrice)} for the {plan.name} plan.</span>
                </div>
              </section>
              </>
              )}

              <div style={{ display: 'flex', gap: 12, color: '#3F3F47', fontSize: 14, lineHeight: '20px', padding: '4px 2px' }}>
                <LockIcon />
                <span>Your payment data will be processed and <a href="https://stripe.com/docs/security/stripe" target="_blank" rel="noopener noreferrer" style={{ color: '#18181B', textDecoration: 'underline', fontWeight: 600 }}>secured by Stripe</a> and their stringent level of certification.</span>
              </div>

              {!isUpfront && (
                <div style={{ color: '#71717B', fontSize: 12, lineHeight: '16px' }}>
                  {isYearly ? `${formatEuro(monthlyPrice)} per month, billed yearly.` : `${formatEuro(monthlyPrice)} billed monthly.`}
                </div>
              )}
            </aside>
          </div>
    </>
  );

  return (
    <AppShell domains={[]} showAddModal={() => {}} showSettings={() => {}} showSidebar={false} hideMobileNav>
      <Head><title>{isUpfront ? 'Complete your purchase' : 'Start your trial'} - SerpBear</title></Head>
      <style>{`
        .checkout-grid { display: grid; grid-template-columns: minmax(0, 1fr) 328px; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .checkout-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .checkout-page { padding: 16px !important; } .checkout-card { padding: 16px !important; } }
      `}</style>
      <div className="relative flex-1 overflow-auto rounded-xl bg-white-base [color-scheme:light] styled-scrollbar">
        <div className="checkout-page" style={{ color: '#18181B', fontFamily: F, padding: '48px 24px', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', maxWidth: 1094, margin: '0 auto' }}>
          {stripeCheckoutEnabled ? (
            <CheckoutStripeProvider
              ref={stripeRef}
              planSlug={plan.slug}
              billing={billing}
              mode={mode}
              company={company}
              fieldErrors={fieldErrors}
              onFieldErrors={setFieldErrors}
              onAddressChange={handleAddressChange}
              onSuccess={handleStripeSuccess}
              onError={handleStripeError}
              onSubmittingChange={setCheckoutLoading}
            >
              {checkoutBody}
            </CheckoutStripeProvider>
          ) : checkoutBody}
        </div>
        </div>
      </div>
    </AppShell>
  );
};

export const getServerSideProps: GetServerSideProps<CheckoutProps> = async (ctx) => {
  const rawPlan = typeof ctx.params?.plan === 'string' ? ctx.params.plan : '';
  const plan = getCheckoutPlan(rawPlan);
  if (!plan) return { notFound: true };

  const billing = ctx.query.billing === 'monthly' ? 'monthly' : 'yearly';
  const mode: CheckoutMode = ctx.query.mode === 'upfront' ? 'upfront' : 'trial';
  const now = new Date();

  // Next renewal: one billing period from today (yearly → +1 year, monthly → +1 month).
  const nextCharge = new Date(now);
  if (billing === 'yearly') {
    nextCharge.setFullYear(nextCharge.getFullYear() + 1);
  } else {
    // Clamp to the target month's last day so e.g. Jan 31 → Feb 28, not Mar 3 (setMonth overflow).
    const targetLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    nextCharge.setDate(Math.min(now.getDate(), targetLastDay));
    nextCharge.setMonth(now.getMonth() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextChargeLabel = `${pad(nextCharge.getDate())}.${pad(nextCharge.getMonth() + 1)}.${nextCharge.getFullYear()}`;

  return {
    props: {
      plan,
      billing,
      mode,
      trialStartLabel: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      trialEndLabel: getTrialEndDateLabel(now),
      nextChargeLabel,
      stripeCheckoutEnabled: isStripeCheckoutConfigured(plan.slug as PlanSlug, billing),
    },
  };
};

export default CheckoutPage;
