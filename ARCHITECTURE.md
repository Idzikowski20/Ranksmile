# Architecture — light layering

Goal: make the codebase easier to navigate and unit-test **without** a full
clean-architecture rewrite. No DI container, no App Router migration. We keep the
Pages Router and the existing **CIA zones** (`lib/ccm`, `lib/compiler`,
`lib/intelligence`, `lib/planner`, `lib/projections` — boundaries enforced by
`__tests__/architecture/cia-boundaries.test.ts`). This document adds a thin,
optional layering *convention* on top of that, applied to new/feature code.

## Layers (dependency direction points inward)

```
controller  →  use-case  →  repository (interface)      entity / domain
(pages/api)     (rules)      (data access impl)          (pure types + mappers)
```

- **Entity / domain** — pure types and pure functions. No Stripe, no DB, no
  `fetch`. Depends on nothing in the other layers.
  _Example:_ `lib/billingInvoiceModel.ts` (the `BillingInvoice` type + `mapStripeInvoice`).

- **Repository** — the *only* place that talks to an external system (Stripe,
  Postgres, an HTTP API) for a given concern. Exposes an **interface** plus a
  concrete `create…Repository()` factory. Lives in `lib/repositories/<domain>/`.
  _Example:_ `lib/repositories/billing/invoiceRepository.ts`.

- **Use-case** — business rules / orchestration for one operation. Receives a
  repository **by argument** (poor-man's DI — no container). Never imports Stripe
  or the DB directly, so it is unit-testable with an in-memory fake. Lives in
  `lib/use-cases/<domain>/`.
  _Example:_ `lib/use-cases/billing/listOrgBillingInvoices.ts`.

- **Controller** — the Pages Router API route (or a `services/*` facade). Thin:
  auth/tenancy, call the use-case with the real repository, serialize.
  _Example:_ `pages/api/billing/invoices.ts`.

## Rules

1. Dependencies point inward only: controller → use-case → repository-interface;
   entities depend on nothing. A use-case importing `lib/stripe` directly is a
   layering violation.
2. All I/O lives in a repository. If a use-case needs new data, add a method to
   the repository interface, not a `fetch`/`getStripe()` call.
3. Inject repositories as arguments; do not `new` them inside a use-case. No DI
   framework — a `create…Repository()` factory wired at the controller/facade
   edge is enough.
4. Keep a public facade stable. When you split existing code (as with
   `lib/billingInvoices.ts`), keep the old exported function + signature so
   callers and test mocks don't break.
5. This convention is **opt-in for new work**. Do not mass-migrate the 600+
   existing `lib/*` files — migrate a slice when you're already changing it.

## Worked example — billing invoices

`listOrgBillingInvoices` used to mix Stripe I/O with business rules in one
function. It now splits across the layers, and the public facade is unchanged:

| Layer      | File |
|------------|------|
| entity     | `lib/billingInvoiceModel.ts` |
| repository | `lib/repositories/billing/invoiceRepository.ts` |
| use-case   | `lib/use-cases/billing/listOrgBillingInvoices.ts` |
| facade     | `lib/billingInvoices.ts` (`listOrgBillingInvoices`, signature kept) |
| controller | `pages/api/billing/invoices.ts` |
| test       | `__tests__/lib/use-cases/listOrgBillingInvoices.test.ts` (fake repo, no mocks) |

The test needs **zero `jest.mock`** — it passes a plain fake repository. That
testability is the whole reason for the split.
