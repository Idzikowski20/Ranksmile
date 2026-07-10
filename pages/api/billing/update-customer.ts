import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { formatTaxIdForStripe, stripeTaxIdType } from '../../../lib/checkoutValidation';
import { getStripe } from '../../../lib/stripe';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';

const addressSchema = z.object({
  name: z.string().max(120).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional().nullable(),
  postal_code: z.string().min(1).max(32),
  country: z.string().length(2),
});

const bodySchema = z.object({
  billingEmail: z.string().email().max(254).optional().nullable(),
  taxId: z.string().max(32).optional().nullable(),
  address: addressSchema.optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
  }

  const { billingEmail, taxId, address } = parsed.data;
  if (!address && !billingEmail && !taxId) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const { orgId } = await ensureUserTenancy(userId);
  const billing = await getOrgBillingState(orgId);
  if (!billing?.stripeCustomerId) {
    return res.status(400).json({ error: 'No Stripe customer on file' });
  }

  const stripe = getStripe();
  const customerId = billing.stripeCustomerId;

  if (address) {
    await stripe.customers.update(customerId, {
      name: address.name?.trim() || undefined,
      email: billingEmail ?? undefined,
      address: {
        line1: address.line1,
        line2: address.line2 ?? undefined,
        city: address.city,
        state: address.state ?? undefined,
        postal_code: address.postal_code,
        country: address.country,
      },
    });
  } else if (billingEmail) {
    await stripe.customers.update(customerId, { email: billingEmail });
  }

  if (taxId && address?.country) {
    const formatted = formatTaxIdForStripe(address.country, taxId);
    const type = stripeTaxIdType(address.country);
    const existing = await stripe.customers.listTaxIds(customerId, { limit: 20 });
    const duplicate = existing.data.some((row) => row.value === formatted);
    if (!duplicate) {
      await stripe.customers.createTaxId(customerId, { type, value: formatted });
    }
  }

  return res.status(200).json({ ok: true });
}
