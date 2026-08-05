# ADR: Stripe writes require idempotency keys

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

Checkout, webhooks, and retries can double-submit Stripe creates (SetupIntent activate, customer default PM, detach). Without idempotency keys, duplicate subscriptions or inconsistent defaults appear.

## Decision

**Every Stripe write** originating from Ranksmile server code **must** pass an `idempotencyKey`.

- Keys are deterministic from `orgId` + operation + business id (e.g. `checkout_attempt_id`, `paymentMethodId`).
- Retries (including `activateTrial` timeouts) **reuse the same key**.
- Never retry a write with a freshly generated random key.

## Consequences

- Safe client + webhook dual-path activation.
- Transient network failures become recoverable without duplicate side effects.
