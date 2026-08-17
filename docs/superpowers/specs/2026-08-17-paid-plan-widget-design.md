# Paid-plan sidebar widget — plan end date, no upgrade CTA on Agency

## Problem

The sidebar plan widget (`components/koala/shell/SidebarPlanItem.tsx`) only ever
frames the account as something to upgrade: an active paying customer sees
"Upgrade to Scale / Cancel anytime in settings". It shows neither when the plan
renews nor when it ends if cancelled, and on the top tier (Agency) it still
offers a CTA that has nowhere to go.

## Scope

One component (`SidebarPlanItem.tsx`) plus CSS, and one field threaded through
the plan-summary endpoint. No progress bar and no usage percentage in the widget
— all per-metric usage stays where it already is, in the "See limits" popover.

## Behaviour

The widget's copy is keyed on subscription state and plan tier:

| State | Title | Sub-line | Upgrade CTA | See limits |
|-------|-------|----------|-------------|------------|
| `active`, non-top (growth/scale) | `{Plan} plan` | `Renews {date}` / `Ends {date}` | shown → /plans | shown |
| `active`, top tier (agency) | `Agency plan` | `Renews {date}` / `Ends {date}` | **hidden, nothing replaces it** | shown |
| `trialing` | unchanged | unchanged (`Trial · Nd` countdown) | shown | shown |
| anything else (no plan, etc.) | unchanged | unchanged | unchanged | unchanged |

- **Date line:** built from `currentPeriodEnd`. `Ends {date}` when the
  subscription is set to lapse (`cancelAtPeriodEnd === true`), `Renews {date}`
  otherwise. `{date}` is `Mon D, YYYY` (e.g. `Sep 15, 2026`), matching the
  invoice date format already used elsewhere.
- **Agency:** the top tier has no plan to upgrade to, so the CTA is removed
  entirely — not replaced by a "Manage" button. Subscription management stays in
  Settings → Billing. Only the date line and "See limits" remain.
- **Trial:** untouched. The trial countdown ("Trial · Nd") and its refetch
  behaviour ship as-is.

## Data

`PlanSummaryData` and `/api/billing/plan-summary` gain one field,
`cancelAtPeriodEnd: boolean`, read straight from `getOrgBillingState` (which
already carries it). `currentPeriodEnd`, `planSlug`, and `planName` are already
in the payload. No new endpoint, no new query, no server computation beyond
copying one boolean.

## Component shape

`planCardAction(planSlug, planName)` is reused as-is, not extended: it already
returns `manage` for the top tier (Agency) and `upgrade` (href `/plans`, cta
`Upgrade now`) for the rest. Under an active paid plan the widget drops the CTA
when that result is `manage` and otherwise reuses its href/cta, rather than
re-deciding those values. "Active paid" is gated on `hasActiveBillingEntitlement`
— the same pure check the server uses — not the raw status, so a cancel whose
period has passed but whose webhook is late does not render as a live plan. The
date/label derivation (`Renews`/`Ends` + a UTC-pinned formatted date) is a small
pure helper (`planEndLine`) so the one piece of real logic is unit tested without
rendering.

## Testing

- Pure helper: `Renews {date}` for active auto-renewing, `Ends {date}` for
  `cancelAtPeriodEnd`, given `currentPeriodEnd`.
- Component: agency active renders no upgrade CTA but keeps "See limits";
  growth active renders the upgrade CTA and the "Renews" line; a cancelled
  subscription renders "Ends"; trialing still renders the countdown.

## Non-goals

- No progress bar, no usage % in the widget (explicit user decision).
- No "Manage" button on agency.
- No change to the "See limits" popover.
