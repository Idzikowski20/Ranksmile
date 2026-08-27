# Clean Architecture Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Ranksmile to a feature-based Clean Architecture (cubic's proposal) incrementally, feature-by-feature, keeping the app green — Phase 1 establishes the `src/` skeleton + composition root and migrates the billing-invoices vertical as the reference implementation.

**Architecture:** Four layers with the dependency rule (deps point inward): `src/core/domain` (entities + repository interfaces/ports) ← `src/core/application` (use-cases + DTOs) ← `src/infrastructure` (repository impls, external clients). Presentation stays in `pages/api/**` (Pages Router requires it) as thin controllers that resolve wired use-cases from `src/composition` (the composition root). No DI library — the composition root is a typed factory module (manual injection), which satisfies cubic's "manual injection at the composition root".

**Tech Stack:** Next.js 15 (Pages Router — unchanged), TypeScript strict, Jest, Stripe SDK, Sequelize/Postgres. Path alias `@/*` → `./*` already configured in `tsconfig.json`.

## Global Constraints

- **No `any`** — `unknown` + narrowing, concrete types (project CLAUDE.md §7). Exceptions only in `__tests__`.
- **Pages Router stays.** API routes remain physically in `pages/api/**` — do NOT move them into `src/`; Next.js resolves routes only from `pages/`. No App Router migration in this plan.
- **No DI library.** Composition root = plain typed factory functions. Do not add inversify/tsyringe.
- **CIA zones untouched** — `lib/{ccm,compiler,intelligence,planner,projections}` keep their own architecture + boundary test (`__tests__/architecture/cia-boundaries.test.ts`). Out of scope.
- **Green gate every task:** `npx tsc --noEmit` clean AND relevant `npx jest` suites pass before commit. Full suite (`npx jest --ci`) = 407 suites / 2486 tests must stay green (2 known flaky timeouts — `emitObservations.q2`, `ccmStaleCron` — pass in isolation).
- **tsconfig excludes `__tests__`** — tsc will NOT catch broken test imports; run Jest to catch them.
- **Directory casing:** lowercase (`src/core/domain`), matching TS/Next ecosystem norm, not cubic's PascalCase.
- **Reuse existing work:** the billing-invoices repository/use-case already exist in `lib/repositories/billing/` + `lib/use-cases/billing/` (commit `f2bcd405`). Phase 1 relocates them into `src/`, it does not rewrite them.

---

## Target structure (reference)

```text
src/
├── core/
│   ├── domain/
│   │   └── billing/
│   │       ├── invoice.ts            # BillingInvoice entity + pure mappers
│   │       └── invoiceRepository.ts  # IInvoiceRepository port (interface only)
│   └── application/
│       └── billing/
│           └── listOrgBillingInvoices.ts  # use-case (imports port, not impl)
├── infrastructure/
│   └── billing/
│       └── stripeInvoiceRepository.ts     # implements IInvoiceRepository via Stripe
└── composition/
    └── billing.ts                    # wires impl -> use-case; exported factory
```
`pages/api/billing/invoices.ts` (Presentation) imports only from `src/composition/billing`.

---

## Task 1: Domain layer — billing invoice entity + port

**Files:**
- Create: `src/core/domain/billing/invoice.ts`
- Create: `src/core/domain/billing/invoiceRepository.ts`
- Test: `__tests__/src/core/domain/billing/invoice.test.ts`

**Interfaces:**
- Produces: `BillingInvoice`, `BillingInvoiceLine`, `BillingInvoiceStatus`, `InvoiceDateGroup` types; `mapStripeInvoice(inv, opts?)`, `formatPaymentMethodLabel(pm)`, `mapInvoiceStatus(s)`, `groupInvoicesByDate(list, now?)` functions (moved verbatim from `lib/billingInvoiceModel.ts`). Interface `IInvoiceRepository` with `isConfigured(): boolean`, `getStripeCustomerId(orgId: number): Promise<string | null>`, `listInvoices(customerId: string, limit: number): Promise<Stripe.Invoice[]>`, `getDefaultPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod | string | null>`.

- [ ] **Step 1: Move the entity file.** `git mv lib/billingInvoiceModel.ts src/core/domain/billing/invoice.ts`. It is already pure (types + mappers, only `Stripe` types + `./subscriptionFormat`). Fix its one relative import: `./subscriptionFormat` → `../../../../lib/subscriptionFormat` (subscriptionFormat stays in lib for now).

- [ ] **Step 2: Create the port** `src/core/domain/billing/invoiceRepository.ts`:

```ts
import type Stripe from 'stripe';

export interface IInvoiceRepository {
  isConfigured(): boolean;
  getStripeCustomerId(orgId: number): Promise<string | null>;
  listInvoices(customerId: string, limit: number): Promise<Stripe.Invoice[]>;
  getDefaultPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod | string | null>;
}
```

- [ ] **Step 3: Move the entity test.** `git mv __tests__/lib/billingInvoiceModel.test.ts __tests__/src/core/domain/billing/invoice.test.ts` (if it exists; else write minimal mapper test asserting `mapStripeInvoice` on a fake invoice returns `status:'paid'` + a `totalLabel` string). Update its import path to `../../../../../src/core/domain/billing/invoice`.

- [ ] **Step 4: Rewrite all importers of the old model path** across the repo using the family codemod pattern (`scripts/move-lib-family.mjs` handles `lib/<base>` moves; for a cross-tree move, do a targeted grep + sed: `lib/billingInvoiceModel` → `src/core/domain/billing/invoice`, and `lib/billing/billingInvoiceModel` if referenced). Grep first: `grep -rn "billingInvoiceModel" --include=*.ts --include=*.tsx lib pages components services __tests__`.

- [ ] **Step 5: Verify.** Run: `npx tsc --noEmit` (Expected: exit 0) and `npx jest __tests__/src/core/domain/billing __tests__/lib/billingInvoices.test.ts` (Expected: PASS).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(arch): billing invoice entity + port -> src/core/domain"
```

---

## Task 2: Application layer — listOrgBillingInvoices use-case

**Files:**
- Create: `src/core/application/billing/listOrgBillingInvoices.ts` (moved from `lib/use-cases/billing/listOrgBillingInvoices.ts`)
- Test: `__tests__/src/core/application/billing/listOrgBillingInvoices.test.ts` (moved from `__tests__/lib/use-cases/listOrgBillingInvoices.test.ts`)

**Interfaces:**
- Consumes: `IInvoiceRepository` (Task 1), entity mappers from `src/core/domain/billing/invoice`.
- Produces: `listOrgBillingInvoices(repo: IInvoiceRepository, orgId: number, limit?: number): Promise<BillingInvoice[]>`.

- [ ] **Step 1: Move the use-case.** `git mv lib/use-cases/billing/listOrgBillingInvoices.ts src/core/application/billing/listOrgBillingInvoices.ts`.

- [ ] **Step 2: Fix its imports** to the new domain paths:

```ts
import { formatPaymentMethodLabel, mapStripeInvoice, type BillingInvoice } from '../../domain/billing/invoice';
import type { IInvoiceRepository } from '../../domain/billing/invoiceRepository';
```
Change the `repo` parameter type from `InvoiceRepository` to `IInvoiceRepository`. Body unchanged.

- [ ] **Step 3: Move + fix the test.** `git mv __tests__/lib/use-cases/listOrgBillingInvoices.test.ts __tests__/src/core/application/billing/listOrgBillingInvoices.test.ts`; update imports to `../../../../../src/core/application/billing/listOrgBillingInvoices` and `../../../../../src/core/domain/billing/invoiceRepository` (type `IInvoiceRepository`).

- [ ] **Step 4: Verify.** Run: `npx jest __tests__/src/core/application/billing` (Expected: 4 tests PASS) and `npx tsc --noEmit` (Expected: exit 0).

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "refactor(arch): listOrgBillingInvoices use-case -> src/core/application"
```

---

## Task 3: Infrastructure layer — Stripe invoice repository

**Files:**
- Create: `src/infrastructure/billing/stripeInvoiceRepository.ts` (moved from `lib/repositories/billing/invoiceRepository.ts`)
- Delete: `lib/repositories/billing/invoiceRepository.ts`, and `lib/repositories/index.ts` if now empty
- Test: `__tests__/src/infrastructure/billing/stripeInvoiceRepository.test.ts` (new — integration-style with `getStripe`/`getOrgBillingState` mocked)

**Interfaces:**
- Consumes: `IInvoiceRepository` port (Task 1), `lib/stripe` (`getStripe`, `isStripeConfigured`), `lib/orgBilling` (`getOrgBillingState`).
- Produces: `createStripeInvoiceRepository(): IInvoiceRepository`.

- [ ] **Step 1: Move + retype.** `git mv lib/repositories/billing/invoiceRepository.ts src/infrastructure/billing/stripeInvoiceRepository.ts`. Change its declared return type to the port and fix imports:

```ts
import type { IInvoiceRepository } from '../../core/domain/billing/invoiceRepository';
import { getOrgBillingState } from '../../../lib/orgBilling';
import { getStripe, isStripeConfigured } from '../../../lib/stripe';

export function createStripeInvoiceRepository(): IInvoiceRepository { /* body unchanged */ }
```
Remove the old `InvoiceRepository` interface export (now the port lives in domain).

- [ ] **Step 2: Write the failing test** `__tests__/src/infrastructure/billing/stripeInvoiceRepository.test.ts`:

```ts
jest.mock('../../../../lib/stripe', () => ({ getStripe: jest.fn(), isStripeConfigured: jest.fn(() => true) }));
jest.mock('../../../../lib/orgBilling', () => ({ getOrgBillingState: jest.fn(async () => ({ stripeCustomerId: 'cus_1' })) }));
import { createStripeInvoiceRepository } from '../../../../src/infrastructure/billing/stripeInvoiceRepository';

it('reads the org stripe customer id', async () => {
  const repo = createStripeInvoiceRepository();
  expect(await repo.getStripeCustomerId(1)).toBe('cus_1');
});
```

- [ ] **Step 3: Run test to verify it passes.** Run: `npx jest __tests__/src/infrastructure/billing/stripeInvoiceRepository.test.ts` (Expected: PASS).

- [ ] **Step 4: Delete the empty repositories barrel** if `lib/repositories/` now only held billing: `git rm lib/repositories/index.ts` (and remove the dir). Update `lib/use-cases/index.ts` — it will be deleted in Task 4.

- [ ] **Step 5: Verify.** `npx tsc --noEmit` (Expected: exit 0 — but Task 4 rewires callers, so expect ONE unresolved import in `lib/billingInvoices.ts` here; that is fixed in Task 4. If tsc must be green now, do Steps of Task 4 before committing — combine Task 3+4 commit).

- [ ] **Step 6: Commit** (may be combined with Task 4).

```bash
git add -A
git commit -m "refactor(arch): stripe invoice repository -> src/infrastructure"
```

---

## Task 4: Composition root + Presentation wiring

**Files:**
- Create: `src/composition/billing.ts`
- Modify: `lib/billingInvoices.ts` (facade delegates to composition root) — or delete it and point `pages/api/billing/invoices.ts` directly at the composition root
- Delete: `lib/use-cases/billing/`, `lib/use-cases/index.ts` (now relocated)
- Test: existing `__tests__/lib/billingInvoices.test.ts`, `__tests__/lib/billing/buildBillingSnapshot.test.ts`, `__tests__/lib/billing/billingSnapshotDomain.test.ts`

**Interfaces:**
- Consumes: `createStripeInvoiceRepository` (Task 3), `listOrgBillingInvoices` use-case (Task 2).
- Produces: `listOrgBillingInvoices(orgId: number, limit?: number): Promise<BillingInvoice[]>` — the wired, ready-to-call facade.

- [ ] **Step 1: Create the composition root** `src/composition/billing.ts`:

```ts
import { listOrgBillingInvoices as useCase } from '../core/application/billing/listOrgBillingInvoices';
import { createStripeInvoiceRepository } from '../infrastructure/billing/stripeInvoiceRepository';
import type { BillingInvoice } from '../core/domain/billing/invoice';

export function listOrgBillingInvoices(orgId: number, limit = 40): Promise<BillingInvoice[]> {
  return useCase(createStripeInvoiceRepository(), orgId, limit);
}
```

- [ ] **Step 2: Repoint the facade.** In `lib/billingInvoices.ts`, replace the body to re-export from the composition root, keeping its public surface (existing callers/mocks depend on it):

```ts
export type { BillingInvoice, BillingInvoiceLine, BillingInvoiceStatus, InvoiceDateGroup } from '../src/core/domain/billing/invoice';
export { groupInvoicesByDate, mapInvoiceStatus, mapStripeInvoice } from '../src/core/domain/billing/invoice';
export { listOrgBillingInvoices } from '../src/composition/billing';
```
(`lib/billingInvoices.ts` currently lives in `lib/billing/` after commit `154c855a` — adjust the relative depth: from `lib/billing/`, `../../src/...`.)

- [ ] **Step 3: Delete relocated use-case dir.** `git rm -r lib/use-cases`.

- [ ] **Step 4: Verify full.** Run: `npx tsc --noEmit` (Expected: exit 0). Run: `npx jest __tests__/lib/billing __tests__/src/core __tests__/src/infrastructure` (Expected: all PASS). Then `npx jest --ci` (Expected: 407 suites / 2486 tests, ≤2 flaky-timeout retries).

- [ ] **Step 5: Update `ARCHITECTURE.md`** — replace the "light layering" framing with the four-layer clean-architecture description + the `src/` map above; update the worked-example table paths to the `src/` locations.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(arch): billing composition root + presentation wiring; billing vertical now full clean-architecture"
```

---

## Roadmap — subsequent phases (each its own plan)

Phase 1 (above) proves the pattern end-to-end for one vertical. Each following feature is a **separate plan** using the identical 4-task shape (domain → application → infrastructure → composition + wiring). Suggested order (highest cohesion / clearest boundaries first), reusing the already-consolidated `lib/` domain folders as migration sources:

1. **billing (rest)** — activate-trial, upgrade, confirmation, entitlement, plans verticals (~14 files in `lib/billing/`).
2. **gsc** — `lib/gsc/` (7) → `src/core/domain/gsc` + application + `src/infrastructure/gsc` (Google API client).
3. **aiVisibility** — `lib/aiVisibility/` (10) → domain/application/infrastructure (LLM + store).
4. **articles** — `lib/articles/` (12) + `lib/ao/` optimization use-cases.
5. **keywords / rankTracking / siteAudit / competitors** — one plan each.
6. **stripe / ensure(schema) / shared infra** — fold `stripe*` into `src/infrastructure/billing` or `src/infrastructure/stripe`; `ensure*` DB bootstrap → `src/infrastructure/persistence/schema`.

**Per-feature checklist (repeat):**
- domain: move pure types/entities + define port interface (`I<Thing>Repository`, `I<Thing>Service`).
- application: move/author use-cases depending only on ports; DTOs for request/response shapes.
- infrastructure: implement ports (DB via Sequelize, external via SDK clients); mock only the port in tests.
- composition: wire impl→use-case; `pages/api/**` controller consumes the composition root only.
- gate: `tsc` + `jest` green; keep old `lib/<feature>` facade re-exporting until all callers move, then delete.

**Out of scope (explicit):** App Router migration; moving `pages/api` into `src`; a DI-container library; touching CIA zones. Revisit only if the team decides to also migrate the router.

**Risk controls:** one feature per branch/worktree; run the family/move codemod for import rewrites (never hand-edit at scale); `jest.mock` paths need manual grep after each move (tsc can't see them); regenerate `scripts/dead-exports-baseline.json` if the budget check trips.
