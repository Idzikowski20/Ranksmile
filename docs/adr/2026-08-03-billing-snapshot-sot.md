# ADR: Billing Snapshot is the canonical read model

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

Settings and future billing surfaces (Portal CTAs, Dashboard widgets) historically risked parallel fetches (`invoices` + `payment methods` + `subscription`), coupling UI to Stripe’s resource layout.

## Decision

**Billing Snapshot** (`GET /api/billing/snapshot`) is the **single source of truth for billing read models**.

- All billing UI (Dashboard, Settings, Portal-linked pages, Payment Methods, future widgets) **must** read from the snapshot.
- No UI component may query Stripe-derived resources directly when that data exists in the snapshot.
- Forbidden: composing billing screens from multiple independent Stripe-shaped endpoints beside the snapshot.

Mutations remain thin write APIs that go through domain services; after writes, clients re-fetch the snapshot.

## Consequences

- UI is decoupled from Stripe object shapes (ViewModels inside snapshot).
- Schema evolves via `schemaVersion` on the snapshot envelope.
- New billing widgets consume the same aggregate instead of inventing endpoints.
