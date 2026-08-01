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
  validateCompanyFields,
  type CheckoutAddressValue,
  type CheckoutFieldErrors,
} from '../../lib/checkoutValidation';
const F = 'var(--font-family-primary)';

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
  onSuccess: () => void;
  onError: (message: string) => void;
  onSubmittingChange: (loading: boolean) => void;
};

const StripeCheckoutContext = React.createContext<StripeCheckoutContextValue | null>(null);

function useStripeCheckout(): StripeCheckoutContextValue {
  const ctx = React.useContext(StripeCheckoutContext);
  if (!ctx) throw new Error('Checkout Stripe components must be used inside CheckoutStripeProvider');
  return ctx;
}

const stripeAppearance: StripeElementsOptions['appearance'] = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#F84416',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorDanger: '#FF6F77',
    fontFamily: `${F}, system-ui, sans-serif`,
    borderRadius: '12px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e5e5',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #F84416',
      boxShadow: '0 0 0 2px rgba(248,68,22,0.1)',
    },
    '.Label': { fontWeight: '500' },
  },
};

export type CheckoutStripeHandle = {
  submit: () => Promise<void>;
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
  return (
    <PaymentElement
      options={{
        layout: 'tabs',
        wallets: { applePay: 'auto', googlePay: 'auto' },
        fields: {
          billingDetails: {
            address: 'auto',
            email: 'auto',
            name: 'auto',
          },
        },
      }}
    />
  );
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

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  height: 38,
  border: `1px solid ${hasError ? '#FF6F77' : '#D4D4D8'}`,
  borderRadius: 10,
  padding: '0 10px',
  fontSize: 14,
  fontFamily: F,
  color: '#18181B',
  background: '#fff',
  boxShadow: hasError ? '0 0 0 2px rgba(255,111,119,0.12)' : 'none',
  outline: 'none',
  boxSizing: 'border-box',
});

const FieldError = ({ message }: { message?: string }) => (
  message ? (
    <span style={{ fontSize: 13, color: '#FF6F77', lineHeight: '18px', fontFamily: F }} role="alert">
      {message}
    </span>
  ) : null
);

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
  return (
    <>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>
        Billing email
        <input
          type="email"
          autoComplete="email"
          value={billingEmail}
          onChange={(e) => onBillingEmailChange(e.target.value)}
          placeholder="invoices@company.com"
          style={inputStyle(Boolean(fieldErrors.billingEmail))}
        />
        <FieldError message={fieldErrors.billingEmail} />
        <span style={{ fontSize: 13, fontWeight: 400, color: '#3F3F47', lineHeight: '20px' }}>
          Optional — receive invoices on a different email than your account
        </span>
      </label>

      <div>
        <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Billing address</div>
        <CheckoutStripeAddress />
        <FieldError message={fieldErrors.address} />
        <span style={{ display: 'block', marginTop: 6, fontSize: 13, fontWeight: 400, color: '#3F3F47', lineHeight: '20px' }}>
          Optional — used on invoices; supports autofill via Stripe Link and your browser
        </span>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>
        Tax ID
        <input
          type="text"
          autoComplete="off"
          value={taxId}
          onChange={(e) => onTaxIdChange(e.target.value)}
          placeholder="e.g. PL1234567890"
          style={inputStyle(Boolean(fieldErrors.taxId))}
        />
        <FieldError message={fieldErrors.taxId} />
        <span style={{ fontSize: 13, fontWeight: 400, color: '#3F3F47', lineHeight: '20px' }}>
          Optional — shown on invoices when a billing address is provided
        </span>
      </label>
    </>
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
          company.addressComplete,
        );
        onFieldErrors(companyErrors);
        if (hasFieldErrors(companyErrors)) {
          onError('Please fix the highlighted fields');
          return;
        }

        onSubmittingChange(true);
        try {
          const submitResult = await elements.submit();
          if (submitResult.error) {
            onError(submitResult.error.message ?? 'Please check your payment details');
            return;
          }

          const confirmParams = {
            return_url: `${window.location.origin}/billing/confirmation/success?plan=${encodeURIComponent(planSlug)}&billing=${encodeURIComponent(billing)}`,
          };
          const result = intentType === 'setup'
            ? await stripe.confirmSetup({ elements, confirmParams, redirect: 'if_required' })
            : await stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' });

          if (result.error) {
            onError(result.error.message ?? 'Payment failed');
            return;
          }

          if (company.addressValue || company.billingEmail.trim() || company.taxId.trim()) {
            const addr = company.addressValue?.address;
            const response = await fetch('/api/billing/update-customer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                billingEmail: company.billingEmail.trim() || null,
                taxId: company.taxId.trim() || null,
                address: addr ? {
                  name: company.addressValue?.name,
                  line1: addr.line1,
                  line2: addr.line2,
                  city: addr.city,
                  state: addr.state,
                  postal_code: addr.postal_code,
                  country: addr.country,
                } : null,
              }),
            });
            if (!response.ok) {
              const data = await response.json() as { error?: string };
              onError(data.error ?? 'Payment succeeded but invoice details could not be saved');
              return;
            }
          }

          onSuccess();
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
  onSuccess: () => void;
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
      () => (intent ? loadStripe(intent.publishableKey) : null),
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
            options={{ clientSecret: intent.clientSecret, appearance: stripeAppearance }}
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
  if (!event.complete || !event.value.address) {
    return { complete: false, value: null };
  }
  const { name, address } = event.value;
  return {
    complete: true,
    value: {
      name: name ?? '',
      address: {
        line1: address.line1 ?? '',
        line2: address.line2 ?? null,
        city: address.city ?? '',
        state: address.state ?? '',
        postal_code: address.postal_code ?? '',
        country: address.country ?? '',
      },
    },
  };
}
