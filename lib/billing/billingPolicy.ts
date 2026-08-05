import type { BillingContext, PaymentMethodCapabilities } from './paymentMethodViewModel';
import { isPaymentMethodLockedStatus } from './billingLockedStatuses';

function isOnlyCard(ctx: BillingContext): boolean {
  return ctx.paymentMethods.length <= 1;
}

function isDefaultTarget(ctx: BillingContext): boolean {
  const id = ctx.targetPaymentMethodId;
  return id === ctx.customerDefaultId || id === ctx.subscriptionDefaultId;
}

function hasReplacement(ctx: BillingContext): boolean {
  return ctx.paymentMethods.some((pm) => pm.id !== ctx.targetPaymentMethodId && !pm.roles.includes('expired'));
}

/** Domain rules for payment-method mutations. */
export const BillingPolicy = {
  canDelete(ctx: BillingContext): boolean {
    if (!isPaymentMethodLockedStatus(ctx.subscriptionStatus)) return true;
    if (isOnlyCard(ctx)) return false;
    // Default may be removed only when a successor exists (deletePaymentMethod + chooseReplacement).
    if (isDefaultTarget(ctx) && !hasReplacement(ctx)) return false;
    return true;
  },

  canDetach(ctx: BillingContext): boolean {
    return BillingPolicy.canDelete(ctx);
  },

  canReplace(ctx: BillingContext): boolean {
    if (!isPaymentMethodLockedStatus(ctx.subscriptionStatus)) return true;
    return hasReplacement(ctx) || !isOnlyCard(ctx);
  },

  canSetDefault(ctx: BillingContext): boolean {
    const target = ctx.paymentMethods.find((pm) => pm.id === ctx.targetPaymentMethodId);
    if (!target || target.roles.includes('expired')) return false;
    if (ctx.targetPaymentMethodId === ctx.customerDefaultId) return false;
    return true;
  },

  canBeTrialCard(ctx: BillingContext): boolean {
    return ctx.subscriptionStatus === 'trialing'
      && ctx.targetPaymentMethodId === ctx.subscriptionDefaultId;
  },

  canBeBackup(ctx: BillingContext): boolean {
    return !isDefaultTarget(ctx) && ctx.paymentMethods.length > 1;
  },

  capabilitiesFor(ctx: BillingContext): PaymentMethodCapabilities {
    return {
      canDelete: BillingPolicy.canDelete(ctx),
      canDetach: BillingPolicy.canDetach(ctx),
      canReplace: BillingPolicy.canReplace(ctx),
      canSetDefault: BillingPolicy.canSetDefault(ctx),
      canBeTrialCard: BillingPolicy.canBeTrialCard(ctx),
      canBeBackup: BillingPolicy.canBeBackup(ctx),
    };
  },
};
