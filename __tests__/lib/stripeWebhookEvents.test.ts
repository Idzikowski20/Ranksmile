jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/ensureBillingTables', () => ({ ensureBillingTables: jest.fn(async () => undefined) }));

import type Stripe from 'stripe';
import db from '../../database/database';
import { claimStripeEvent, releaseStripeEvent } from '../../lib/stripeWebhookEvents';

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

const event = { id: 'evt_1', type: 'invoice.paid', created: 1_800_000_000 } as Stripe.Event;

describe('stripe webhook dedup ledger', () => {
  beforeEach(() => mockQuery.mockReset());

  it('claims an unseen event', async () => {
    mockQuery.mockResolvedValueOnce([[{ event_id: 'evt_1' }], {}] as never);
    await expect(claimStripeEvent(event)).resolves.toBe(true);
  });

  it('refuses an event already processed', async () => {
    // ON CONFLICT DO NOTHING returns no rows for a duplicate delivery.
    mockQuery.mockResolvedValueOnce([[], {}] as never);
    await expect(claimStripeEvent(event)).resolves.toBe(false);
  });

  it('releases the claim so a Stripe retry can reprocess', async () => {
    mockQuery.mockResolvedValueOnce([[], {}] as never);
    await releaseStripeEvent('evt_1');

    const [sql, options] = mockQuery.mock.calls[0];
    expect(String(sql)).toMatch(/DELETE FROM stripe_webhook_events/i);
    expect((options as { replacements: unknown[] }).replacements).toEqual(['evt_1']);
  });
});
