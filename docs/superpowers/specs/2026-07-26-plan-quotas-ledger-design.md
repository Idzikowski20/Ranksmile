# Plan quotas ledger v2.2 — design

## Goal

Hard-enforce plan meters with atomic Postgres allocation (no accepted race), audit ledger, and hide Getting Started when onboarding is 100%.

## Decisions

- True hard stop via conditional `UPDATE` on balances
- Grandfather over-limit orgs: keep resources; block new allocations
- `aiPrompts` = org-wide selected AI Visibility prompts (not Smily/AO)
- Limits always from current plan / `PLAN_LIMITS` — never persist `limit` on balances
- No Redis quota microservice / Stripe metered overage
- Ledger is audit only
- No `consume` event type

## Meter kinds

| Meter | Kind | Enforcement |
|-------|------|-------------|
| documents, brandSpaces, aiPrompts | `active_resource` | used-only `adjustActiveUsage` in same txn as mutate |
| keywordResearch | `period_usage` | reserve → commit/release; balances keyed by `period_key` (`YYYY-MM` UTC) |
| siteAuditPages | `per_run_cap` | run-scoped reservation; finish → `close`; never bump org lifetime `used` |

## Tables

- `org_quota_balances (org_id, meter, period_key, used, reserved)` — PK `(org_id, meter, period_key)`; active meters use `period_key = '_'`
- `quota_reservations` — statuses `reserved|committed|released|expired|closed`; `UNIQUE(org_id, idempotency_key)`
- `usage_events` — `reserve|commit|release|close|adjustment_increase|adjustment_decrease`; `UNIQUE(org_id, idempotency_key, event_type)`; quantity > 0

## QuotaService API

- `adjustActiveUsage` — active_resource only
- `reserveQuota` — period_usage + per_run_cap only (rejects active_resource)
- `commitReservation` / `releaseReservation` — period
- `closePerRunReservation` — per_run finish + audit `close`
- `ensureOrgQuotaBalances` — proactive on org create / plan change
- `sweepExpiredReservations` — cron

## Invariants

1. used >= 0, reserved >= 0
2. Reserve/commit quantities > 0
3. used + reserved <= plan limit (bounded meters)
4. active_resource never increments reserved
5. One logical async op ≤ one active reservation
6. BullMQ retry never creates a new reservation
7. commit / release / close idempotent
8. No reopen of terminal states → reserved
9. Sync active mutate + balance + audit share one DB txn
10. Plan limit always from current plan
11. per_run_cap never increments org lifetime used; finish emits close
12. Grandfathered over-limit cannot allocate more
13. usage_events uniqueness includes event_type
14. Allowed event types only: reserve, commit, release, close, adjustment_increase, adjustment_decrease

## HTTP

402 `plan_limit` with `{ plan, meter, used, reserved, requested, limit, remaining, upgradePath }`

## Reconciliation (per meter)

- active: COUNT vs balances.used
- keywordResearch: SUM(commit) for period vs balances.used
- siteAudit: actualCrawled <= pageLimit + reservation closed + close event
