# Architecture — Clean Architecture (incremental)

Ranksmile is migrating to a feature-based Clean Architecture, feature-by-feature,
keeping the app green. The value is the **dependency rule**, not the folders. See
`docs/superpowers/plans/2026-08-27-clean-architecture-migration.md` for the plan and
roadmap. The billing-invoices vertical is the reference implementation.

## Status (Phase N complete)

The migration is essentially complete: **all domain, application, shared and
infrastructure code now lives under `src/`**. `lib/` retains only:
- **CIA zones** (`ccm`, `cia`, `compiler`, `intelligence`, `planner`, `projections`)
  + the `primitives` intelligence kernel — their own architecture, out of scope.
- **`types`** — the shared type carve-out (core may import type-only).
- **`arch`** — the boundary-test tooling itself.
- **`editor` / `motion`** — presentation utilities (belong with `components/`, not a
  clean-arch layer).

`src/core/{domain,application,shared}` + `src/composition` + `src/infrastructure`
hold the whole business + infrastructure surface; `pages/api/**` are the thin
controllers.

## Layers

```
        pages/api        Presentation — thin controllers (Pages Router; stays here)
            │ knows only ↓
        src/composition  Composition Root — factories, manual DI (no container)
            │ ↓
        src/core/application   Use-cases + DTOs (business rules / orchestration)
            │ ↓
        src/core/domain        Entities, value objects, ports, pure logic
            ↑ implements ports
        src/infrastructure     Stripe / DB / APIs / Redis (off to the side)
```

Composition is **not** a domain layer — it is the wiring edge. Infrastructure
implements domain ports; domain never imports it.

## The dependency rule (enforced)

`__tests__/architecture/clean-arch-boundaries.test.ts` (AST-based, via
`ts.preProcessFile`) fails the build if:

- **`src/core/domain`** imports anything but `src/core/domain` + `src/core/shared` —
  **zero** Stripe, Sequelize, Next.js, Redis, HTTP, `env`, `lib/*`.
- **`src/core/application`** imports anything but domain + shared — **zero**
  infrastructure, `pages`, Stripe, Sequelize, Next.js, Redis.
- Infrastructure may import domain/application/shared/lib + any SDK, but must not be
  imported by domain or application.
- **Transitional carve-out:** core may import **type-only** declarations from
  `lib/types/**` (a pure, runtime-free type barrel). Everything else in `lib/` stays
  forbidden. These types fold into `src/core` during the lib-extraction phase.

Run it via `npm run test:arch` (alongside the CIA-zone boundary test).

## Rules

1. **Dependencies point inward.** A use-case importing `lib/stripe` is a violation.
2. **Repositories return domain types, not SDK types.** All vendor mapping
   (`Stripe.Invoice → BillingInvoice`) lives in infrastructure. Domain/application
   never see a `Stripe.*` type.
3. **DTO rule.** Vendor types (`Stripe.*`, Sequelize models, `NextApiRequest/Response`)
   never appear in `src/core/**`.
4. **Inject at the composition root.** No DI library — a `create…Repository()` factory
   wired in `src/composition/<feature>.ts`, consumed only by `pages/api/**`.
5. **`src/core/shared`** holds only pure, vendor-free primitives used by 2+ domains
   (e.g. `money.ts`). Single-domain → `domain/<feature>`; anything touching an SDK/DB →
   infrastructure. It must not become a second `lib/`.
6. **Use-case = a real business operation** (`ListOrgBillingInvoices`), not one-line
   `get/format/validate` wrappers.
7. **Transitional facades.** When splitting existing code, keep the old `lib/<feature>`
   module re-exporting from `src/` until all callers move, then delete it.

## Worked example — billing invoices

| Layer | File |
|-------|------|
| shared | `src/core/shared/money.ts` (`formatMoney`, pure) |
| domain (entity) | `src/core/domain/billing/invoice.ts` (`BillingInvoice`, pure helpers — no Stripe) |
| domain (port) | `src/core/domain/billing/invoiceRepository.ts` (`IInvoiceRepository`, returns domain types) |
| application | `src/core/application/billing/listOrgBillingInvoices.ts` (use-case, port injected) |
| infrastructure | `src/infrastructure/billing/stripe/{stripeBillingClient,stripeInvoiceMapper,stripeInvoiceRepository}.ts` |
| composition | `src/composition/billing.ts` (wires repo → use-case) |
| presentation | `pages/api/billing/invoices.ts` (thin controller) |
| facade (transitional) | `lib/billing/billingInvoices.ts` (re-exports from `src/`) |
| tests | `__tests__/src/core/**` (fake repo, zero mocks) + `__tests__/src/infrastructure/**` |

The domain is **Stripe-free**; the use-case test needs **zero `jest.mock`** (plain fake
repository). That testability is the whole point of the split.
