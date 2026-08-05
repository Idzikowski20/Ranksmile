# ADR: Application Access State

- **Status:** Accepted
- **Date:** 2026-08-03
- **Related:** [Billing Snapshot SoT](./2026-08-03-billing-snapshot-sot.md), [Bootstrap canonical read model](./2026-08-03-bootstrap-canonical-read-model.md)

## Context

Access to Ranksmile was enforced by independent UI conditions (`onboarding.completed`, workspace count, payment-failed lock). `/plans` was a soft onboarding destination, not a domain gate — users could reach the app without billing entitlement.

## Decision

**Application access is determined by a single resolved application state** projected into an **Access Snapshot**.

- `resolveAppState` produces `{ state, reason }` from domain facts (email, onboarding, org billing, workspaces).
- `AccessPolicy` (versioned) maps state → allowed `RouteCapability` for frontend paths and API routes.
- Navigation guards, API guards, and bootstrap **must consume the same resolved Access Snapshot**.
- **No component may independently derive** onboarding / billing / workspace redirects when the snapshot already provides them.

Canonical states: `EMAIL_PENDING` → `ONBOARDING_REQUIRED` → `BILLING_REQUIRED` → `WORKSPACE_REQUIRED` → `READY`, plus `PAYMENT_FAILED` / `LOCKED`.

## Consequences

- Billing gate (`BILLING_REQUIRED` → `/plans`) is a state, not a one-off guard.
- Policy and snapshot evolve via `schemaVersion` / `policyVersion`.
- Payment-failed recovery becomes `PAYMENT_FAILED` in the same machine.
