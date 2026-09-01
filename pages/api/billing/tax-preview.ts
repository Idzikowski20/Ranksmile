import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getCheckoutPlan, getPlanPeriodPrice } from '../../../lib/billingPlans';
import {
  calculateStripeTaxPreview,
  type TaxPreviewResult,
} from '../../../lib/billing/stripeTaxPreview';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { getStripe, isStripeConfigured } from '../../../lib/stripe';
import { getCurrentUserId } from '../../../utils/getUser';

const addressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional().nullable(),
  postal_code: z.string().min(1).max(32),
  country: z.string().length(2),
});

const bodySchema = z.object({
  planSlug: z.string().min(1),
  billing: z.enum(['monthly', 'yearly']),
  address: addressSchema,
  taxId: z.string().max(32).optional().nullable(),
});

/** In-process memo — Stripe Tax is slow; identical address/plan hits reuse for a few minutes. */
const TAX_PREVIEW_TTL_MS = 5 * 60 * 1000;
const TAX_PREVIEW_CACHE_MAX = 200;
const taxPreviewCache = new Map<string, { at: number; value: TaxPreviewResult }>();

function taxPreviewCacheKey(
  amountCents: number,
  address: z.infer<typeof addressSchema>,
  taxId: string | null | undefined,
): string {
  return [
    amountCents,
    address.country.toUpperCase(),
    address.postal_code.trim(),
    address.city.trim().toLowerCase(),
    address.line1.trim().toLowerCase(),
    (address.state ?? '').trim().toLowerCase(),
    (taxId ?? '').trim().toUpperCase(),
  ].join('|');
}

function getCachedTaxPreview(key: string): TaxPreviewResult | null {
  const hit = taxPreviewCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TAX_PREVIEW_TTL_MS) {
    taxPreviewCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedTaxPreview(key: string, value: TaxPreviewResult): void {
  if (taxPreviewCache.size >= TAX_PREVIEW_CACHE_MAX) {
    const oldest = taxPreviewCache.keys().next().value;
    if (oldest != null) taxPreviewCache.delete(oldest);
  }
  taxPreviewCache.set(key, { at: Date.now(), value });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  // Auth / manager gate is in withOrgPaymentAccess (tax-preview fast path).
  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
  }

  const plan = getCheckoutPlan(parsed.data.planSlug.trim().toLowerCase());
  if (!plan) return res.status(400).json({ error: 'Unknown plan' });

  const periodEuro = getPlanPeriodPrice(plan, parsed.data.billing);
  const amountCents = Math.round(periodEuro * 100);
  if (amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid plan amount' });
  }

  const cacheKey = taxPreviewCacheKey(amountCents, parsed.data.address, parsed.data.taxId);
  const cached = getCachedTaxPreview(cacheKey);
  if (cached) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Tax-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const stripe = getStripe();
    const preview = await calculateStripeTaxPreview(stripe, {
      amountCents,
      currency: 'eur',
      address: parsed.data.address,
      taxId: parsed.data.taxId,
      reference: `plan-${plan.slug}-${parsed.data.billing}`,
    });
    setCachedTaxPreview(cacheKey, preview);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Tax-Cache', 'MISS');
    return res.status(200).json(preview);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Tax calculation failed';
    console.warn('[billing] tax-preview failed:', message);
    return res.status(422).json({ error: message, code: 'TAX_CALCULATION_FAILED' });
  }
}

export default withOrgPaymentAccess(handler);
