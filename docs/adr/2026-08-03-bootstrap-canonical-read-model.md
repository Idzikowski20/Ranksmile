# ADR: Bootstrap is the canonical application read model

- **Status:** Accepted
- **Date:** 2026-08-03
- **Related:** [Application Access State](./2026-08-03-application-access-state.md), [Billing Snapshot SoT](./2026-08-03-billing-snapshot-sot.md)

## Context

Session bootstrap historically exposed onboarding/email/workspaces and a hand-rolled `redirectTo`. UI layers re-derived access (`if (!completed)`, subscription status) and drifted from server truth.

## Decision

**Bootstrap (`GET /api/session/bootstrap` / `getBootstrap`) is the canonical application read model** for access and cold-start navigation.

- Bootstrap **must** expose a complete **Access Snapshot** (`schemaVersion`, `appState`, `reason`, `billing`, `workspace`, `redirect`, `policyVersion`, `generatedAt`).
- **UI must consume bootstrap** (and Access Snapshot fields) for gates and redirects.
- **UI must never independently derive application state** if bootstrap already provides it.
- Local overrides after email confirm / onboarding finish invalidate or patch bootstrap via refetch — they are not a second resolver.

Billing money views remain on Billing Snapshot; access/navigation remains on Access Snapshot via bootstrap.

## Consequences

- `_app` ApplicationShell switches on `bootstrap.access.appState` (or equivalent), not nested `if`s.
- API 402 bodies can mirror the same `redirect` / `reason` from the snapshot.
- Product screens stop inventing parallel entitlement checks for navigation.
