# Stripe event matrix (v2.2)

**SoT:** Stripe subscription/customer. **Projection:** `organizations.*` billing columns. **Delivery:** `notification_email_jobs` (Outbox #2). **Dedup:** `billing_email_events` claim-only.

| Event | Handler | DB mutation | Email | Idempotency |
|-------|---------|------------|-------|-------------|
| `customer.subscription.created` | retrieve/sync via `org_id` metadata | projection + quota seed | — | upsert |
| `customer.subscription.updated` | sync; abandoned if `incomplete_expired` + guards | projection | abandoned → outbox | claim per `subscription_id` |
| `customer.subscription.deleted` | sync object → `hasActiveBillingEntitlement` | canceled / clear | — | — |
| `invoice.payment_failed` | retrieve sub → sync | projection | payment_failed → outbox | claim per `invoice_id` |
| `invoice.paid` | retrieve sub → sync (never force active) | projection | — | — |
| `invoice.payment_succeeded` | same as paid | projection | — | — |
| `checkout.session.completed` | sync session + sub | projection | — | — |
| `checkout.session.expired` | Hosted abandoned | — | abandoned → outbox | claim per `session_id` |

## Entitlement (`hasActiveBillingEntitlement`)

| Status | Access |
|--------|--------|
| `active` / `trialing` (incl. `cancel_at_period_end` before period end) | YES |
| `past_due` / `unpaid` | YES (recovery) |
| `incomplete` / `incomplete_expired` / canceled / deleted / period ended | NO |

## create-subscription (Opcja B)

- `checkoutAttemptId` = crypto UUID
- Idempotency-Key: `org-{orgId}-checkout-{attemptId}`
- Same attempt retry → reuse sub; new attempt → new sub (cancel prior incomplete first)
- Persist incomplete immediately after Stripe create

## Abandoned guards

1. Retrieve sub; status must be `incomplete_expired`
2. Suppress if customer had later successful conversion (reached active/trialing after this sub's created), even if that sub is now canceled
