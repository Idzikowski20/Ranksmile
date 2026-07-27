# Stripe E2E TEST GATE checklist (v2.2)

Manual / staging verification before LIVE cutover.

## Automated (unit)

- [x] `hasActiveBillingEntitlement` (cancel_at_period_end)
- [x] Stripe mode mismatch gate
- [x] Abandoned conversion suppress (later active / canceled-after-period)
- [x] Billing guards + checkoutAttemptId UUID

## Manual TEST GATE

- [ ] Happy: Elements + test card → trialing/active → entitlement UI
- [ ] Second checkout: A incomplete → B active → A expires → no abandoned mail
- [ ] A+B incomplete expire → abandoned per subscription id
- [ ] A → B active → B canceled → A expires → no abandoned
- [ ] Duplicate webhook → one `billing_email_events` claim
- [ ] Reconciler orphan: Stripe sub without DB → recover
- [ ] payment_failed → outbox → Resend; portal update → invoice.paid → sync
- [ ] cancel_at_period_end → access until deleted
- [ ] Outbox Redis miss → reconciler re-enqueues `queued` jobs
- [ ] Quota usage preserved after plan sync

## LIVE GATE

- [ ] Seed live products (`STRIPE_SECRET_KEY=sk_live_…` + seed script)
- [ ] Live webhook + secret + `STRIPE_MODE=live`
- [ ] Live portal config
- [ ] First real payment verified manually

Webhook (test): `https://ranksmile.pl/api/webhooks/stripe` (`we_1TxmkO…`)  
Event matrix: [`docs/stripe-event-matrix.md`](./stripe-event-matrix.md)
