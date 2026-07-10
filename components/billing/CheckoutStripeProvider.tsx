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
  intentType: 'setup' | 'payment';
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
    colorPrimary: '#2F2F34',
    colorBackground: '#ffffff',
    colorText: '#18181B',
    colorDanger: '#FF6F77',
    fontFamily: `${F}, system-ui, sans-serif`,
    borderRadius: '10px',
  },
  rules: {
    '.Input': {
      border: '1px solid #D4D4D8',
      boxShadow: '0px 2px 0px 0px #DAD9DE',
    },
    '.Input:focus': {
      border: '1px solid #AA93FD',
      boxShadow: '0 0 0 2px rgba(120,58,251,0.1)',
    },
    '.Label': { fontWeight: '500' },
  },
};

export type CheckoutStripeHandle = {
  submit: () => Promise<void>;
};

export function CheckoutStripePayment() {
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
  const { onAddressChange } = useStripeCheckout();
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
  boxShadow: hasError ? '0 0 0 2px rgba(255,111,119,0.12)' : '0px 2px 0px 0px #DAD9DE',
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
      intentType, company, onFieldErrors, onSuccess, onError, onSubmittingChange,
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

          const confirmParams = { return_url: `${window.location.origin}/dashboard?checkout=success` };
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
    }), [stripe, elements, intentType, company, onFieldErrors, onSuccess, onError, onSubmittingChange]);

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
      (async () => {
        try {
          const response = await fetch('/api/billing/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planSlug, billing, mode }),
          });
          const data = await response.json() as IntentPayload & { error?: string };
          if (!response.ok || !data.clientSecret || !data.publishableKey) {
            if (!cancelled) setLoadError(data.error ?? 'Could not load payment form');
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

    const contextValue = React.useMemo<StripeCheckoutContextValue>(() => ({
      intentType: intent?.intentType ?? 'setup',
      company,
      fieldErrors,
      onFieldErrors,
      onAddressChange,
      onSuccess,
      onError,
      onSubmittingChange,
    }), [intent?.intentType, company, fieldErrors, onFieldErrors, onAddressChange, onSuccess, onError, onSubmittingChange]);

    if (loadError) {
      return <p style={{ margin: 0, fontSize: 14, color: '#FF6F77', fontFamily: F }}>{loadError}</p>;
    }

    if (!intent || !stripePromise) {
      return <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: F }}>Loading secure payment form…</p>;
    }

    const options: StripeElementsOptions = {
      clientSecret: intent.clientSecret,
      appearance: stripeAppearance,
    };

    return (
      <StripeCheckoutContext.Provider value={contextValue}>
        <Elements stripe={stripePromise} options={options}>
          <SubmitBridge ref={ref} />
          {children}
        </Elements>
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
