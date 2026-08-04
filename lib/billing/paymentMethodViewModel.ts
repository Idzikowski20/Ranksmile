import type { SubscriptionStatus } from '../orgBilling';

/** UI-facing payment method roles (snapshot). */
export type PaymentMethodRole =
  | 'default'
  | 'trial_card'
  | 'backup'
  | 'expired'
  | 'orphan';

export type PaymentMethodCapabilities = {
  canDelete: boolean;
  canDetach: boolean;
  canReplace: boolean;
  canSetDefault: boolean;
  canBeTrialCard: boolean;
  canBeBackup: boolean;
};

export type PaymentMethodRankingHint = 'preferred' | 'default' | 'most_recent_success' | 'created';

/** DTO for Settings / Snapshot — never expose raw Stripe PM objects to UI. */
export type PaymentMethodViewModel = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  roles: PaymentMethodRole[];
  capabilities: PaymentMethodCapabilities;
  rankingHint: PaymentMethodRankingHint;
  /** Unix seconds from Stripe `created` — used by chooseReplacement. */
  created: number;
  /** Optional signal for ranking (future). */
  lastSuccessAt: number | null;
};

export type BillingContext = {
  subscriptionStatus: SubscriptionStatus | null;
  paymentMethods: PaymentMethodViewModel[];
  targetPaymentMethodId: string;
  customerDefaultId: string | null;
  subscriptionDefaultId: string | null;
};
