import type Stripe from 'stripe';
import { BillingSource } from './billingAudit';
import { updateOrgBillingState } from './orgBilling';

export async function ensureStripeCustomer(
  stripe: Stripe,
  orgId: number,
  email: string | null,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { org_id: String(orgId) },
  });
  await updateOrgBillingState(orgId, { stripeCustomerId: customer.id }, {
    source: BillingSource.STRIPE_CUSTOMER,
    reason: 'customers.create',
  });
  return customer.id;
}
