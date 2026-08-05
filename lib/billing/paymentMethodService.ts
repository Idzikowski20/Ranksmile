import type Stripe from 'stripe';
import type { SubscriptionStatus } from '../orgBilling';
import { BillingPolicy } from './billingPolicy';
import { billingError, type BillingErrorBody } from './billingErrors';
import { chooseReplacement } from './chooseReplacement';
import type {
  PaymentMethodRole,
  PaymentMethodViewModel,
} from './paymentMethodViewModel';

function pmId(ref: string | Stripe.PaymentMethod | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

function isCardExpired(expMonth: number | null, expYear: number | null): boolean {
  if (expMonth == null || expYear == null) return false;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return expYear < y || (expYear === y && expMonth < m);
}

export function mapStripeCardToDraft(
  pm: Stripe.PaymentMethod,
): Omit<PaymentMethodViewModel, 'roles' | 'capabilities' | 'rankingHint'> {
  const card = pm.card;
  return {
    id: pm.id,
    brand: card?.brand ?? 'card',
    last4: card?.last4 ?? '••••',
    expMonth: card?.exp_month ?? null,
    expYear: card?.exp_year ?? null,
    created: pm.created,
    lastSuccessAt: null,
  };
}

export function enrichPaymentMethodViewModels(args: {
  drafts: Array<Omit<PaymentMethodViewModel, 'roles' | 'capabilities' | 'rankingHint'>>;
  customerDefaultId: string | null;
  subscriptionDefaultId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
}): PaymentMethodViewModel[] {
  const { drafts, customerDefaultId, subscriptionDefaultId, subscriptionStatus } = args;

  const withRoles: PaymentMethodViewModel[] = drafts.map((draft) => {
    const roles: PaymentMethodRole[] = [];
    const isDefault = draft.id === customerDefaultId || draft.id === subscriptionDefaultId;
    if (isDefault) roles.push('default');
    if (subscriptionStatus === 'trialing' && draft.id === subscriptionDefaultId) {
      roles.push('trial_card');
    }
    if (!isDefault && drafts.length > 1) roles.push('backup');
    if (isCardExpired(draft.expMonth, draft.expYear)) roles.push('expired');
    if (
      customerDefaultId
      && !isDefault
      && drafts.length > 1
      && !roles.includes('backup')
    ) {
      roles.push('orphan');
    }

    return {
      ...draft,
      roles,
      rankingHint: draft.id === customerDefaultId ? 'default' : 'created',
      capabilities: {
        canDelete: false,
        canDetach: false,
        canReplace: false,
        canSetDefault: false,
        canBeTrialCard: false,
        canBeBackup: false,
      },
    };
  });

  return withRoles.map((vm) => ({
    ...vm,
    capabilities: BillingPolicy.capabilitiesFor({
      subscriptionStatus,
      paymentMethods: withRoles,
      targetPaymentMethodId: vm.id,
      customerDefaultId,
      subscriptionDefaultId,
    }),
  }));
}

export type ListPaymentMethodsResult = {
  paymentMethods: PaymentMethodViewModel[];
  customerDefaultId: string | null;
  subscriptionDefaultId: string | null;
};

export async function listPaymentMethods(
  stripe: Stripe,
  args: {
    customerId: string;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionDefaultPaymentMethodId: string | null;
  },
): Promise<ListPaymentMethodsResult> {
  const [listed, customer] = await Promise.all([
    stripe.paymentMethods.list({ customer: args.customerId, type: 'card', limit: 20 }),
    stripe.customers.retrieve(args.customerId, {
      expand: ['invoice_settings.default_payment_method'],
    }),
  ]);

  let customerDefaultId: string | null = null;
  if (!customer.deleted) {
    customerDefaultId = pmId(customer.invoice_settings?.default_payment_method);
  }

  const drafts = listed.data.map(mapStripeCardToDraft);
  const paymentMethods = enrichPaymentMethodViewModels({
    drafts,
    customerDefaultId,
    subscriptionDefaultId: args.subscriptionDefaultPaymentMethodId,
    subscriptionStatus: args.subscriptionStatus,
  });

  return {
    paymentMethods,
    customerDefaultId,
    subscriptionDefaultId: args.subscriptionDefaultPaymentMethodId,
  };
}

export async function setDefaultPaymentMethod(
  stripe: Stripe,
  args: {
    orgId: number;
    customerId: string;
    paymentMethodId: string;
    subscriptionId: string | null;
  },
): Promise<{ ok: true } | { ok: false; status: number; error: BillingErrorBody }> {
  await stripe.customers.update(
    args.customerId,
    { invoice_settings: { default_payment_method: args.paymentMethodId } },
    { idempotencyKey: `org-${args.orgId}-pm-default-${args.paymentMethodId}` },
  );

  if (args.subscriptionId) {
    await stripe.subscriptions.update(
      args.subscriptionId,
      { default_payment_method: args.paymentMethodId },
      { idempotencyKey: `org-${args.orgId}-sub-default-${args.subscriptionId}-${args.paymentMethodId}` },
    );
  }

  return { ok: true };
}

export async function deletePaymentMethod(
  stripe: Stripe,
  args: {
    orgId: number;
    customerId: string;
    paymentMethodId: string;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionId: string | null;
    subscriptionDefaultPaymentMethodId: string | null;
  },
): Promise<{ ok: true; newDefaultId: string | null } | { ok: false; status: number; error: BillingErrorBody }> {
  const listed = await listPaymentMethods(stripe, {
    customerId: args.customerId,
    subscriptionStatus: args.subscriptionStatus,
    subscriptionDefaultPaymentMethodId: args.subscriptionDefaultPaymentMethodId,
  });

  const target = listed.paymentMethods.find((pm) => pm.id === args.paymentMethodId);
  if (!target) {
    return {
      ok: false,
      status: 404,
      error: billingError('PAYMENT_METHOD_NOT_FOUND', 'NOT_FOUND', 'Payment method not found'),
    };
  }

  const ctx = {
    subscriptionStatus: args.subscriptionStatus,
    paymentMethods: listed.paymentMethods,
    targetPaymentMethodId: args.paymentMethodId,
    customerDefaultId: listed.customerDefaultId,
    subscriptionDefaultId: listed.subscriptionDefaultId,
  };

  if (!BillingPolicy.canDelete(ctx)) {
    const reason = listed.paymentMethods.length <= 1 ? 'ONLY_CARD' : 'LAST_DEFAULT_CARD';
    return {
      ok: false,
      status: 409,
      error: billingError(
        'PAYMENT_METHOD_REQUIRED',
        reason,
        'This payment method cannot be removed while your trial or plan is active',
      ),
    };
  }

  const wasDefault = args.paymentMethodId === listed.customerDefaultId
    || args.paymentMethodId === listed.subscriptionDefaultId;

  let newDefaultId: string | null = listed.customerDefaultId;
  if (wasDefault) {
    const replacement = chooseReplacement(
      listed.paymentMethods,
      args.paymentMethodId,
      listed.customerDefaultId,
    );
    if (!replacement) {
      return {
        ok: false,
        status: 409,
        error: billingError(
          'PAYMENT_METHOD_REQUIRED',
          'DEFAULT_WITHOUT_SUCCESSOR',
          'Cannot remove the default card without a replacement',
        ),
      };
    }
    const set = await setDefaultPaymentMethod(stripe, {
      orgId: args.orgId,
      customerId: args.customerId,
      paymentMethodId: replacement.id,
      subscriptionId: args.subscriptionId,
    });
    if (!set.ok) return set;
    newDefaultId = replacement.id;
  }

  await stripe.paymentMethods.detach(args.paymentMethodId, {}, {
    idempotencyKey: `org-${args.orgId}-pm-detach-${args.paymentMethodId}`,
  });

  return { ok: true, newDefaultId };
}
