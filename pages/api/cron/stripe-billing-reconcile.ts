import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';
import { reconcileStripeBilling } from '../../../lib/stripeBillingReconcile';
import { pruneStripeWebhookEvents } from '../../../lib/stripeWebhookEvents';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { withCronWatchdog } from '../../../lib/cronWatchdog';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await reconcileStripeBilling();

    // Drift means webhooks lost or mis-projected an event — the repair is silent, the alert isn't.
    const drift = result.orphansRecovered + result.staleCleared + result.errors;
    if (drift > 0) {
      Sentry.captureMessage('[billing] Stripe↔DB reconcile found drift', {
        level: result.errors > 0 ? 'error' : 'warning',
        extra: { ...result },
      });
    }

    await pruneStripeWebhookEvents().catch((e) => {
      console.warn('[billing] prune stripe_webhook_events', getErrorMessage(e));
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}

export default withOrgPaymentAccess(withCronWatchdog('stripe-billing-reconcile', handler));
