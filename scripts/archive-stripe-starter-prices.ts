/**
 * Archive retired Starter Stripe Prices (active → archived).
 * Usage: node -r dotenv/config -r ts-node/register/transpile-only scripts/archive-stripe-starter-prices.ts
 * Or: npx tsx --env-file=.env scripts/archive-stripe-starter-prices.ts
 *
 * Requires STRIPE_SECRET_KEY and optionally STRIPE_PRICE_STARTER_MONTHLY / _YEARLY.
 * Idempotent — skips already-archived or missing prices.
 */
import Stripe from 'stripe';

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('STRIPE_SECRET_KEY missing — skip archive');
    process.exit(1);
  }
  const ids = [
    process.env.STRIPE_PRICE_STARTER_MONTHLY?.trim(),
    process.env.STRIPE_PRICE_STARTER_YEARLY?.trim(),
  ].filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    console.log('No STRIPE_PRICE_STARTER_* set — nothing to archive');
    return;
  }

  const stripe = new Stripe(key);
  for (const id of ids) {
    const price = await stripe.prices.retrieve(id);
    if (price.active === false) {
      console.log(`already archived: ${id}`);
      continue;
    }
    await stripe.prices.update(id, { active: false });
    console.log(`archived: ${id} (${price.nickname || price.unit_amount}/${price.currency})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
