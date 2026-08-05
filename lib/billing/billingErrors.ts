/** Structured billing API errors (HTTP status is secondary). */
export type BillingErrorCode =
  | 'PAYMENT_METHOD_REQUIRED'
  | 'DEFAULT_PAYMENT_METHOD_LOCKED'
  | 'PAYMENT_METHOD_REPLACE_LOCKED'
  | 'PAYMENT_METHOD_NOT_FOUND'
  | 'BILLING_NOT_CONFIGURED'
  | 'STRIPE_ERROR';

export type BillingErrorReason =
  | 'LAST_DEFAULT_CARD'
  | 'ONLY_CARD'
  | 'DEFAULT_WITHOUT_SUCCESSOR'
  | 'NOT_FOUND'
  | 'NO_CUSTOMER'
  | 'STRIPE_REJECTED';

export type BillingErrorBody = {
  code: BillingErrorCode;
  reason: BillingErrorReason;
  message: string;
};

export function billingError(
  code: BillingErrorCode,
  reason: BillingErrorReason,
  message: string,
): BillingErrorBody {
  return { code, reason, message };
}
