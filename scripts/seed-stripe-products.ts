/**
 * Creates SerpBear subscription products + prices in Stripe and prints .env lines.
 * Usage: npx ts-node scripts/seed-stripe-products.ts
 * Requires STRIPE_SECRET_KEY in environment (or stripe CLI logged in via `stripe config`).
 */
import Stripe from 'stripe';
import { CHECKOUT_PLANS } from '../lib/billingPlans';

const PLANS = CHECKOUT_PLANS.map((plan) => ({
  slug: plan.slug,
  name: plan.name,
  monthlyCents: plan.priceMonthly * 100,
  yearlyCents: plan.priceYearly * 12 * 100,
}));

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('Set STRIPE_SECRET_KEY before running this script.');
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const envLines: string[] = [];

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: `SerpBear ${plan.name}`,
      description: `${plan.name} subscription plan`,
      metadata: { plan_slug: plan.slug, app: 'serpbear' },
    });

    const monthly = await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: plan.monthlyCents,
      recurring: { interval: 'month' },
      metadata: { plan_slug: plan.slug, billing_period: 'monthly' },
    });

    const yearly = await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: plan.yearlyCents,
      recurring: { interval: 'year' },
      metadata: { plan_slug: plan.slug, billing_period: 'yearly' },
    });

    const slugUpper = plan.slug.toUpperCase();
    envLines.push(`STRIPE_PRICE_${slugUpper}_MONTHLY=${monthly.id}`);
    envLines.push(`STRIPE_PRICE_${slugUpper}_YEARLY=${yearly.id}`);
    console.log(`Created ${plan.name}: product=${product.id} monthly=${monthly.id} yearly=${yearly.id}`);
  }

  console.log('\n# Add to .env:\n');
  console.log(envLines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
