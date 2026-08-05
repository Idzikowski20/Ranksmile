# ADR: Billing Domain Events (Timeline is a projection)

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

A human-readable “Billing Activity” feed is useful for support, but string labels are not a durable event model. Ranksmile already treats CCM as SoT with projections elsewhere.

## Decision

- **Source of truth for “what happened”** = typed **Domain Events** (`TRIAL_STARTED`, `CARD_ADDED`, …) plus `SOURCE` (`manual` | `webhook` | `checkout` | `portal` | `reconcile`).
- **Timeline** in the Billing Snapshot is a **projection** over those events for UI — not the event store itself.
- UI maps event type enums to localized labels; emitters never write display strings as the event identity.

## Consequences

- Support/debug can filter by `SOURCE` and type.
- Future consumers (alerts, analytics) subscribe to events, not timeline rows.
- Snapshot `timeline[]` stays thin and stable.
