import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  loadStripe,
  type StripeAddressElementChangeEvent,
  type StripeElementsOptions,
} from '@stripe/stripe-js';
import React from 'react';
import type { BillingPeriod } from '../../lib/billingPlans';
import {
  hasFieldErrors,
  hasRequiredBillingAddressFields,
  validateCompanyFields,
  type CheckoutAddressValue,
  type CheckoutFieldErrors,
} from '../../lib/checkoutValidation';
import { Field } from '../koala/forms';
import { Icon } from '../koala/icons';
import Input from '../koala/primitives/Input';
import { typeface } from '../koala/tokens/typography';

const F = typeface.body;
const DM_SANS_CSS =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap';

type CheckoutMode = 'trial' | 'upfront';

type IntentPayload = {
  clientSecret: string;
  intentType: 'setup' | 'payment';
  publishableKey: string;
};

export type CompanyState = {
  billingEmail: string;
  taxId: string;
  addressComplete: boolean;
  addressValue: CheckoutAddressValue | null;
};

type StripeCheckoutContextValue = {
  planSlug: string;
  billing: BillingPeriod;
  intentType: 'setup' | 'payment';
  paymentReady: boolean;
  company: CompanyState;
  fieldErrors: CheckoutFieldErrors;
  onFieldErrors: (errors: CheckoutFieldErrors) => void;
  onAddressChange: (event: StripeAddressElementChangeEvent) => void;
  onSuccess: (confirmationToken?: string | null) => void;
  onError: (message: string) => void;
  onSubmittingChange: (loading: boolean) => void;
};

const StripeCheckoutContext = React.createContext<StripeCheckoutContextValue | null>(null);

function useStripeCheckout(): StripeCheckoutContextValue {
  const ctx = React.useContext(StripeCheckoutContext);
  if (!ctx) throw new Error('Checkout Stripe components must be used inside CheckoutStripeProvider');
  return ctx;
}

/** Match Koala Input md: 40px / 12px radius / #e5e5e5 border. DM Sans must be a
 *  concrete family name + fonts.cssSrc — Stripe iframes cannot resolve CSS vars. */
const stripeAppearance: StripeElementsOptions['appearance'] = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#F84416',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorTextSecondary: '#575757',
    colorTextPlaceholder: '#a3a3a3',
    colorDanger: '#FF6F77',
    fontFamily: typeface.body,
    fontSizeBase: '14px',
    borderRadius: '12px',
    spacingUnit: '4px',
    spacingGridRow: '16px',
    spacingGridColumn: '16px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e5e5',
      boxShadow: 'none',
      padding: '8px 12px',
      minHeight: '40px',
      lineHeight: '20px',
      fontFamily: typeface.body,
    },
    '.Input:hover': {
      border: '1px solid #d4d4d4',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #F84416',
      boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px rgba(248,68,22,0.2)',
    },
    '.Label': {
      fontWeight: '500',
      fontSize: '14px',
      lineHeight: '20px',
      marginBottom: '6px',
      color: '#1a1a1a',
      fontFamily: typeface.body,
    },
    '.Error': {
      fontSize: '13px',
      marginTop: '6px',
      fontFamily: typeface.body,
    },
    '.Tab': {
      fontFamily: typeface.body,
    },
    '.TabLabel': {
      fontFamily: typeface.body,
    },
  },
};

export type CheckoutStripeHandle = {
  submit: () => Promise<void>;
};

/** Payment Element options for checkout.
 *  billingDetails must stay "auto" unless confirmSetup/confirmPayment also
 *  passes confirmParams.payment_method_data.billing_details (Stripe IntegrationError). */
export const CHECKOUT_PAYMENT_ELEMENT_OPTIONS = {
  layout: 'tabs' as const,
  wallets: { applePay: 'auto' as const, googlePay: 'auto' as const, link: 'never' as const },
  terms: { card: 'never' as const },
  fields: {
    billingDetails: {
      address: 'auto' as const,
      email: 'auto' as const,
      name: 'auto' as const,
    },
  },
};

export function CheckoutStripePayment() {
  const { paymentReady } = useStripeCheckout();
  if (!paymentReady) {
    return (
      <div
        aria-busy
        aria-label="Loading payment form"
        style={{
          minHeight: 120,
          borderRadius: 12,
          border: '1px solid #e5e5e5',
          background: '#f5f5f5',
        }}
      />
    );
  }
  return <PaymentElement options={CHECKOUT_PAYMENT_ELEMENT_OPTIONS} />;
}

export function CheckoutStripeAddress() {
  const { paymentReady, onAddressChange } = useStripeCheckout();
  if (!paymentReady) {
    return (
      <div
        aria-busy
        aria-label="Loading billing address"
        style={{
          minHeight: 160,
          borderRadius: 12,
          border: '1px solid #e5e5e5',
          background: '#f5f5f5',
        }}
      />
    );
  }
  return (
    <AddressElement
      onChange={onAddressChange}
      options={{
        mode: 'billing',
        autocomplete: { mode: 'automatic' },
        fields: { phone: 'never' },
        display: { name: 'split' },
      }}
    />
  );
}

export function CheckoutCompanyFields({
  billingEmail,
  taxId,
  fieldErrors,
  onBillingEmailChange,
  onTaxIdChange,
}: {
  billingEmail: string;
  taxId: string;
  fieldErrors: CheckoutFieldErrors;
  onBillingEmailChange: (value: string) => void;
  onTaxIdChange: (value: string) => void;
}) {
  const hasErrors = Boolean(fieldErrors.billingEmail || fieldErrors.taxId);
  const [open, setOpen] = React.useState(hasErrors);

  React.useEffect(() => {
    if (hasErrors) setOpen(true);
  }, [hasErrors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          padding: '12px 0',
          border: 'none',
          borderTop: '1px solid #e5e5e5',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: F,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '24px', color: '#1a1a1a' }}>
            Billing details
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, color: '#575757' }}>Optional</span>
        </span>
        <Icon
          name={open ? 'CaretUp' : 'CaretDown'}
          size={16}
          color="#575757"
        />
      </button>

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
          <Field
            label="Billing email"
            error={fieldErrors.billingEmail}
            description="Optional — receive invoices on a different email than your account"
          >
            <Input
              type="email"
              autoComplete="email"
              value={billingEmail}
              onChange={(e) => onBillingEmailChange(e.target.value)}
              placeholder="invoices@company.com"
              hasError={Boolean(fieldErrors.billingEmail)}
            />
          </Field>

          <Field
            label="Tax ID"
            error={fieldErrors.taxId}
            description="Optional — shown on invoices"
          >
            <Input
              type="text"
              autoComplete="off"
              value={taxId}
              onChange={(e) => onTaxIdChange(e.target.value)}
              placeholder="e.g. PL1234567890"
              hasError={Boolean(fieldErrors.taxId)}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

const SubmitBridge = React.forwardRef<CheckoutStripeHandle>(function SubmitBridge(_props, ref) {
    const stripe = useStripe();
    const elements = useElements();
    const {
      planSlug, billing, intentType, company, onFieldErrors, onSuccess, onError, onSubmittingChange,
    } = useStripeCheckout();

    React.useImperativeHandle(ref, () => ({
      submit: async () => {
        if (!stripe || !elements) {
          onError('Payment form is still loading');
          return;
        }

        const companyErrors = validateCompanyFields(
          { billingEmail: company.billingEmail, taxId: company.taxId },
          company.addressValue,
          company.addressComplete && hasRequiredBillingAddressFields(company.addressValue),
        );
        onFieldErrors(companyErrors);
        if (hasFieldErrors(companyErrors)) {
          onError('Enter street address, city, and postal code to continue');
          return;
        }
        if (!hasRequiredBillingAddressFields(company.addressValue)) {
          onFieldErrors({ address: 'Enter street address, city, and postal code' });
          onError('Enter street address, city, and postal code to continue');
          return;
        }

        onSubmittingChange(true);
        try {
          const submitResult = await elements.submit();
          if (submitResult.error) {
            onError(submitResult.error.message ?? 'Please check your payment details');
            return;
          }

          // Stripe Tax must see a validated customer location before invoice payment.
          const addr = company.addressValue!.address;
          const response = await fetch('/api/billing/update-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              billingEmail: company.billingEmail.trim() || null,
              taxId: company.taxId.trim() || null,
              address: {
                name: company.addressValue?.name,
                line1: addr.line1,
                line2: addr.line2,
                city: addr.city,
                state: addr.state,
                postal_code: addr.postal_code,
                country: addr.country,
              },
            }),
          });
          if (!response.ok) {
            const data = await response.json() as { error?: string };
            onError(data.error ?? 'Could not save billing address for tax');
            return;
          }

          const confirmParams = {
            return_url: `${window.location.origin}/dashboard`,
          };
          const result = intentType === 'setup'
            ? await stripe.confirmSetup({ elements, confirmParams, redirect: 'if_required' })
            : await stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' });

          if (result.error) {
            onError(result.error.message ?? 'Payment failed');
            return;
          }

          if (intentType === 'setup') {
            const setupIntentId = 'setupIntent' in result && result.setupIntent && typeof result.setupIntent === 'object'
              ? result.setupIntent.id
              : null;
            if (!setupIntentId) {
              onError('Card saved but trial could not be started');
              return;
            }
            const activate = await fetch('/api/billing/activate-trial', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ setupIntentId }),
            });
            if (!activate.ok) {
              const data = await activate.json() as { error?: string };
              onError(data.error ?? 'Card saved but trial could not be started');
              return;
            }
            const activated = await activate.json() as { confirmationToken?: string | null };
            onSuccess(activated.confirmationToken ?? null);
            return;
          }

          // Upfront / payment intent path — mint short-lived confirmation token.
          const issued = await fetch('/api/billing/issue-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planSlug, billing }),
          });
          if (issued.ok) {
            const data = await issued.json() as { confirmationToken?: string };
            onSuccess(data.confirmationToken ?? null);
          } else {
            onSuccess(null);
          }
        } finally {
          onSubmittingChange(false);
        }
      },
    }), [stripe, elements, planSlug, billing, intentType, company, onFieldErrors, onSuccess, onError, onSubmittingChange]);

    return null;
});

type ProviderProps = {
  planSlug: string;
  billing: BillingPeriod;
  mode: CheckoutMode;
  company: CompanyState;
  fieldErrors: CheckoutFieldErrors;
  onFieldErrors: (errors: CheckoutFieldErrors) => void;
  onAddressChange: (event: StripeAddressElementChangeEvent) => void;
  onSuccess: (confirmationToken?: string | null) => void;
  onError: (message: string) => void;
  onSubmittingChange: (loading: boolean) => void;
  children: React.ReactNode;
};

export const CheckoutStripeProvider = React.forwardRef<CheckoutStripeHandle, ProviderProps>(
  function CheckoutStripeProvider({
    planSlug, billing, mode, company, fieldErrors, onFieldErrors, onAddressChange,
    onSuccess, onError, onSubmittingChange, children,
  }, ref) {
    const [intent, setIntent] = React.useState<IntentPayload | null>(null);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    React.useEffect(() => {
      let cancelled = false;
      const checkoutAttemptId = crypto.randomUUID();
      (async () => {
        try {
          const response = await fetch('/api/billing/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planSlug, billing, mode, checkoutAttemptId }),
          });
          const data = await response.json() as IntentPayload & { error?: string };
          if (!response.ok || !data.clientSecret || !data.publishableKey) {
            if (cancelled) return;
            const message = data.error ?? 'Could not load payment form';
            if (response.status === 409 && message.includes('already on this plan')) {
              window.location.replace('/plans');
              return;
            }
            setLoadError(message);
            return;
          }
          if (!cancelled) {
            setIntent({
              clientSecret: data.clientSecret,
              intentType: data.intentType,
              publishableKey: data.publishableKey,
            });
          }
        } catch {
          if (!cancelled) setLoadError('Could not load payment form');
        }
      })();
      return () => { cancelled = true; };
    }, [planSlug, billing, mode]);

    const stripePromise = React.useMemo(
      () => (intent ? loadStripe(intent.publishableKey, { locale: 'en' }) : null),
      [intent],
    );

    const paymentReady = Boolean(intent && stripePromise);
    const contextValue = React.useMemo<StripeCheckoutContextValue>(() => ({
      planSlug,
      billing,
      intentType: intent?.intentType ?? 'setup',
      paymentReady,
      company,
      fieldErrors,
      onFieldErrors,
      onAddressChange,
      onSuccess,
      onError,
      onSubmittingChange,
    }), [planSlug, billing, intent?.intentType, paymentReady, company, fieldErrors, onFieldErrors, onAddressChange, onSuccess, onError, onSubmittingChange]);

    // Always keep children mounted so plan/billing toggles stay clickable while
    // Stripe intent reloads (billing/plan change). Only the payment slot waits.
    const body = (
      <>
        {loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#FF6F77', fontFamily: F }}>{loadError}</p>
            <a href="/plans" style={{ fontSize: 14, color: '#18181B', fontFamily: F, fontWeight: 500 }}>
              ← Back to plans
            </a>
          </div>
        ) : null}
        {children}
      </>
    );

    return (
      <StripeCheckoutContext.Provider value={contextValue}>
        {paymentReady && intent && stripePromise ? (
          <Elements
            key={intent.clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance: stripeAppearance,
              locale: 'en',
              fonts: [{ cssSrc: DM_SANS_CSS }],
            }}
          >
            <SubmitBridge ref={ref} />
            {body}
          </Elements>
        ) : (
          body
        )}
      </StripeCheckoutContext.Provider>
    );
  },
);

export function addressFromStripeEvent(
  event: StripeAddressElementChangeEvent,
): { complete: boolean; value: CheckoutAddressValue | null } {
  if (!event.value.address) {
    return { complete: false, value: null };
  }
  const { name, address } = event.value;
  const value: CheckoutAddressValue = {
    name: name ?? '',
    address: {
      line1: address.line1 ?? '',
      line2: address.line2 ?? null,
      city: address.city ?? '',
      state: address.state ?? '',
      postal_code: address.postal_code ?? '',
      country: address.country ?? '',
    },
  };
  const fieldsOk = hasRequiredBillingAddressFields(value);
  // Keep partial value for tax preview while typing; gate submit on `complete`.
  if (!event.complete || !fieldsOk) {
    return { complete: false, value };
  }
  return { complete: true, value };
}
