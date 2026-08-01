import type { GetServerSideProps, NextApiRequest, NextApiResponse, NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import toast from 'react-hot-toast';
import posthog from 'posthog-js';
import { useQuery } from 'react-query';
import { loadStripe } from '@stripe/stripe-js';
import AppShell from '../../../components/common/AppShell';
import { Icon } from '../../../components/koala/icons';
import {
  addressFromStripeEvent,
  CheckoutStripeProvider,
  type CheckoutStripeHandle,
  type CompanyState,
} from '../../../components/billing/CheckoutStripeProvider';
import CheckoutKoalaBody from '../../../components/billing/CheckoutKoalaBody';
import { CheckoutPageSkeleton } from '../../../components/billing/CheckoutPageSkeleton';
import type { CheckoutFieldErrors } from '../../../lib/checkoutValidation';
import {
  BillingPeriod,
  CheckoutPlan,
  getCheckoutPlan,
  getTrialEndDateLabel,
} from '../../../lib/billingPlans';
import { blocksNewPaidCheckout, getLockedCheckoutPlanSlug } from '../../../lib/billingPlanLock';
import { isAllowedSubscriptionChange, type UpgradePreview } from '../../../lib/billingUpgrade';
import { getOrgBillingState } from '../../../lib/orgBilling';
import type { SubscriptionDetails } from '../../../lib/subscriptionDetails';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';
import { isStripeCheckoutConfigured, type PlanSlug } from '../../../lib/stripePrices';

const F = 'var(--font-family-primary)';

const COUNTRIES = ['Afghanistan', 'Aland Islands', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola', 'Poland', 'Spain', 'United Kingdom', 'United States'];

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
  const router = useRouter();
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [country, setCountry] = React.useState(mode === 'upfront' ? 'Poland' : '');
  const [addressLine, setAddressLine] = React.useState('');
  const [city, setCity] = React.useState('');
  const [zip, setZip] = React.useState('');

  const { data: subscriptionPayload, isLoading: subscriptionLoading } = useQuery(
    'subscriptionDetails',
    async () => {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to load subscription');
      return res.json() as Promise<{ subscription: SubscriptionDetails }>;
    },
    { staleTime: 15 * 1000, retry: false },
  );
  const subscription = subscriptionPayload?.subscription ?? null;
  const lockedSlug = subscription?.lockedPlanSlug ?? null;
  const currentBilling = subscription?.billingPeriod ?? null;
  const hasLiveSubscription = blocksNewPaidCheckout(subscription?.subscriptionStatus);

  const checkoutFlow: 'subscribe' | 'upgrade' | 'blocked' | 'loading' = (() => {
    if (subscriptionLoading) return 'loading';
    if (!hasLiveSubscription || !lockedSlug || !currentBilling) return 'subscribe';
    if (lockedSlug === plan.slug && currentBilling === billing) return 'blocked';
    if (isAllowedSubscriptionChange(lockedSlug, currentBilling, plan.slug, billing)) return 'upgrade';
    return 'blocked';
  })();

  const isUpgrade = checkoutFlow === 'upgrade';
  const isUpfront = mode === 'upfront' || isUpgrade;

  const { data: upgradePreview, isLoading: previewLoading, error: previewError } = useQuery(
    ['upgradePreview', plan.slug, billing],
    async () => {
      const res = await fetch('/api/billing/upgrade-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: plan.slug, billing }),
      });
      const body = await res.json() as { preview?: UpgradePreview; error?: string };
      if (!res.ok || !body.preview) throw new Error(body.error ?? 'Could not preview upgrade');
      return body.preview;
    },
    { enabled: isUpgrade && stripeCheckoutEnabled, retry: false, staleTime: 30 * 1000 },
  );

  const goToOrderConfirmation = () => {
    const q = new URLSearchParams();
    q.set('plan', plan.slug);
    q.set('billing', billing);
    void router.push(`/billing/confirmation/success?${q.toString()}`);
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
    if (!stripeCheckoutEnabled && !country) {
      errors.country = 'Select your country';
    }
    setMockErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBillingChange = (period: BillingPeriod) => {
    if (period === billing) return;
    const q = new URLSearchParams();
    q.set('billing', period);
    if (mode === 'upfront' || isUpgrade) q.set('mode', 'upfront');
    void router.replace(`/billing/checkout/${plan.slug}?${q.toString()}`, undefined, { scroll: false });
  };

  const handlePlanChange = (slug: string) => {
    if (slug === plan.slug) return;
    const q = new URLSearchParams();
    q.set('billing', billing);
    if (mode === 'upfront' || isUpgrade) q.set('mode', 'upfront');
    void router.replace(`/billing/checkout/${slug}?${q.toString()}`, undefined, { scroll: false });
  };

  const handleTrialStart = async () => {
    posthog.capture('checkout_started', {
      plan: plan.name,
      billing,
      mode: 'trial',
    });
    if (stripeCheckoutEnabled) {
      await stripeRef.current?.submit();
      return;
    }
    if (!validateMockCard()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    goToOrderConfirmation();
  };

  const handleUpgradePurchase = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing/upgrade-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan.slug,
          billing,
          ...(upgradePreview?.prorationDate ? { prorationDate: upgradePreview.prorationDate } : {}),
        }),
      });
      const data = await res.json() as {
        status?: 'upgraded' | 'requires_payment';
        clientSecret?: string;
        publishableKey?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not upgrade subscription');
        return;
      }
      if (data.status === 'upgraded') {
        goToOrderConfirmation();
        return;
      }
      if (data.status === 'requires_payment' && data.clientSecret && data.publishableKey) {
        const stripe = await loadStripe(data.publishableKey);
        if (!stripe) {
          toast.error('Could not load Stripe');
          return;
        }
        const result = await stripe.confirmPayment({
          clientSecret: data.clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/billing/confirmation/success?plan=${encodeURIComponent(plan.slug)}&billing=${encodeURIComponent(billing)}`,
          },
          redirect: 'if_required',
        });
        if (result.error) {
          toast.error(result.error.message ?? 'Payment failed');
          return;
        }
        goToOrderConfirmation();
        return;
      }
      toast.error('Could not complete upgrade');
    } catch {
      toast.error('Could not upgrade subscription');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleUpfrontPurchase = async () => {
    posthog.capture('checkout_started', {
      plan: plan.name,
      billing,
      mode: 'upfront',
    });
    if (isUpgrade) {
      await handleUpgradePurchase();
      return;
    }
    if (stripeCheckoutEnabled) {
      await stripeRef.current?.submit();
      return;
    }
    if (!validateMockCard()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    goToOrderConfirmation();
  };

  const handleStripeSuccess = () => {
    goToOrderConfirmation();
  };

  const handleStripeError = (message: string) => {
    toast.error(message);
  };

  const checkoutBody = (
    <CheckoutKoalaBody
      plan={plan}
      billing={billing}
      isUpgrade={isUpgrade}
      isUpfront={isUpfront}
      stripeCheckoutEnabled={stripeCheckoutEnabled}
      nextChargeLabel={nextChargeLabel}
      trialStartLabel={trialStartLabel}
      trialEndLabel={trialEndLabel}
      checkoutLoading={checkoutLoading}
      upgradePreview={upgradePreview}
      previewLoading={previewLoading}
      previewError={previewError instanceof Error ? previewError : null}
      company={company}
      fieldErrors={fieldErrors}
      onCompanyEmail={(v) => {
        setCompany((p) => ({ ...p, billingEmail: v }));
        setFieldErrors((e) => ({ ...e, billingEmail: undefined }));
      }}
      onCompanyTaxId={(v) => {
        setCompany((p) => ({ ...p, taxId: v }));
        setFieldErrors((e) => ({ ...e, taxId: undefined }));
      }}
      onBillingChange={handleBillingChange}
      onPlanChange={handlePlanChange}
      onPurchase={handleUpfrontPurchase}
      onTrialStart={handleTrialStart}
      onSkipTrial={() => {
        void router.push(`/billing/checkout/${plan.slug}?billing=${billing}&mode=upfront`);
      }}
      cardNumber={cardNumber}
      cardExpiry={cardExpiry}
      cardCvc={cardCvc}
      country={country}
      countryOpen={countryOpen}
      countries={COUNTRIES}
      mockErrors={mockErrors}
      addressLine={addressLine}
      city={city}
      zip={zip}
      onCardNumber={setCardNumber}
      onCardExpiry={setCardExpiry}
      onCardCvc={setCardCvc}
      onCountry={setCountry}
      onCountryOpen={setCountryOpen}
      onAddressLine={setAddressLine}
      onCity={setCity}
      onZip={setZip}
    />
  );

  return (
    <AppShell domains={[]} showAddModal={() => {}} showSettings={() => {}} showSidebar={false} hideMobileNav>
      <Head><title>{isUpgrade ? `Upgrade to ${plan.name}` : isUpfront ? 'Complete your purchase' : 'Start your trial'} - Ranksmile</title></Head>
      <div className="relative flex-1 overflow-auto rounded-xl bg-white-base [color-scheme:light] styled-scrollbar">
        <div style={{ color: '#1a1a1a', fontFamily: F, padding: '40px 24px 64px', boxSizing: 'border-box' }}>
          {checkoutFlow === 'loading' ? (
            <CheckoutPageSkeleton />
          ) : checkoutFlow === 'blocked' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, margin: '0 auto' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#FF6F77', fontFamily: F }}>
                {lockedSlug === plan.slug && currentBilling === billing
                  ? 'You are already on this plan.'
                  : lockedSlug
                    ? `You're currently on ${lockedSlug}${currentBilling ? ` (${currentBilling})` : ''}. Downgrades to a lower plan are not available here — pick a higher plan or manage billing from settings.`
                    : 'Downgrades are not available on this page. Choose a higher plan or manage billing from settings.'}
              </p>
              <a href="/plans" style={{ fontSize: 14, color: '#1a1a1a', fontFamily: F, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="ArrowLeft" size={16} />
                Back to plans
              </a>
            </div>
          ) : stripeCheckoutEnabled && !isUpgrade ? (
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

  try {
    const user = await getCurrentUser(
      ctx.req as unknown as NextApiRequest,
      ctx.res as unknown as NextApiResponse,
    );
    if (user) {
      const { orgId } = await ensureUserTenancy(user.id);
      const billingState = await getOrgBillingState(orgId);
      const locked = getLockedCheckoutPlanSlug(billingState);
      if (locked && locked === plan.slug) {
        return {
          redirect: {
            destination: '/plans',
            permanent: false,
          },
        };
      }
    }
  } catch {
    // Unauthenticated or tenancy errors — fall through to checkout UI.
  }

  const nextCharge = new Date(now);
  if (billing === 'yearly') {
    nextCharge.setFullYear(nextCharge.getFullYear() + 1);
  } else {
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
