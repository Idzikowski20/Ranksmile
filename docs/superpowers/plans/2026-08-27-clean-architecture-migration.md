# Clean Architecture Migration — Implementation Plan (rev. 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Ranksmile to feature-based Clean Architecture incrementally, feature-by-feature, keeping the app green — Phase 1 establishes the boundary-enforcing architecture test + `src/` skeleton + composition root and migrates the billing-invoices vertical as the reference implementation, with the domain fully vendor-free (zero Stripe).

**Architecture:** The value is the **dependency rule**, not the folders. Layers:

```
        pages/api  (Presentation — thin controllers)
             │ knows only ↓
        src/composition  (Composition Root — factories, manual DI)
             │ ↓
        src/core/application  (Use-cases + DTOs)
             │ ↓
        src/core/domain  (Entities, value objects, ports/interfaces, pure logic)
             ↑ implements ports
        src/infrastructure  (Stripe / DB / APIs / Redis — off to the side)
```
Composition is **not** a domain layer — it is the wiring edge. Infrastructure implements domain ports; domain never imports it.

**Tech Stack:** Next.js 15 (Pages Router — unchanged), TypeScript strict, Jest, Stripe SDK, Sequelize/Postgres. Path alias `@/*` → `./*` in `tsconfig.json`.

## Global Constraints

- **No `any`** (CLAUDE.md §7). `unknown` + narrowing. Exceptions only in `__tests__`.
- **The Dependency Rule (enforced by Task 0's test):**
  - `src/core/domain` imports: nothing outside `src/core/domain` and `src/core/shared`. **Zero** Stripe, Sequelize, Next.js, Redis, HTTP, `env`, `lib/*`.
  - `src/core/application` imports: only `src/core/domain` + `src/core/shared`. **Zero** infrastructure, `pages`, Stripe, Sequelize, Next.js, Redis.
  - `src/infrastructure` may import domain/application/shared/lib and any SDK, but **must not** be imported by domain or application.
  - `src/composition` imports application + infrastructure + domain. Imported only by `pages/api/**` (+ the transitional `lib/*` facades).
  - `pages/api/**` (Presentation) imports only `src/composition` (+ Next types).
- **DTO rule:** request/response shapes crossing the Presentation↔Application boundary are DTOs (plain domain-owned types). Vendor types (`Stripe.*`, Sequelize models, `NextApiRequest/Response`) never appear in `src/core/**`. Repositories return **domain types**, not SDK types — mapping happens inside infrastructure.
- **Use-case granularity:** a use-case is a real business operation (`ListOrgBillingInvoices`, `UpgradeSubscription`, `CancelSubscription`), not a one-line wrapper. Do not create `getX`/`formatX`/`validateX` use-cases; those are domain helpers or repository methods.
- **Pages Router stays.** API routes remain in `pages/api/**` — never moved into `src/`. No App Router migration.
- **No DI library.** Composition root = plain typed factory functions. Do not add inversify/tsyringe.
- **CIA zones untouched** — `lib/{ccm,compiler,intelligence,planner,projections}` keep their own architecture + boundary test. Out of scope.
- **Green gate every task:** `npx tsc --noEmit` clean AND relevant `npx jest` suites pass before commit. Full suite = 407 suites / 2486 tests green (2 known flaky timeouts: `emitObservations.q2`, `ccmStaleCron` — pass in isolation).
- **tsconfig excludes `__tests__`** — run Jest to catch broken test imports; tsc won't.
- **Directory casing:** lowercase (`src/core/domain`).
- **`src/core/shared` discipline (guard against a second `lib/`):** `src/core/shared` holds ONLY pure, vendor-free primitives shared across **multiple** domains (e.g. `money.ts`, `date.ts`). If something is used by one domain only → it belongs in `src/core/domain/<that-domain>/`, not shared. If something touches an SDK/DB/fs/env → it is infrastructure, never shared. No `logger/api/env/db/stripe/http/utils` grab-bag files in `shared`. A file entering `shared` must be justified by 2+ domain consumers.
- **Per-feature dependency inventory BEFORE moving anything** (see Task 0.5) — for each file destined for `domain`, confirm it has no transitive SDK/DB/fs/env dependency. If it does, it belongs in infrastructure, not domain.

---

## Target structure (reference — billing)

```text
src/
├── core/
│   ├── shared/
│   │   └── money.ts                  # formatMoney (pure, vendor-free)
│   ├── domain/
│   │   └── billing/
│   │       ├── invoice.ts            # BillingInvoice entity + PURE helpers (status, grouping). NO Stripe.
│   │       └── invoiceRepository.ts  # IInvoiceRepository port — domain-typed, NO Stripe
│   └── application/
│       └── billing/
│           └── listOrgBillingInvoices.ts  # use-case: gating + clamp; returns domain type
├── infrastructure/
│   └── billing/
│       └── stripe/
│           ├── stripeBillingClient.ts     # thin Stripe access wrapper
│           ├── stripeInvoiceMapper.ts      # Stripe.Invoice -> BillingInvoice (all Stripe knowledge)
│           └── stripeInvoiceRepository.ts  # implements IInvoiceRepository, returns BillingInvoice[]
└── composition/
    └── billing.ts                    # wires repo -> use-case; exported factory
```
`pages/api/billing/invoices.ts` imports only `src/composition/billing`.

---

## Task 0: Architecture boundary test (enforce the dependency rule first)

**Files:**
- Create: `lib/arch/layerRules.ts` (layer definitions + forbidden-import predicate)
- Create: `lib/arch/scanLayerImports.ts` (reuse `lib/cia/scanImports` extractor if present, else a small regex extractor)
- Test: `__tests__/architecture/clean-arch-boundaries.test.ts`

**Interfaces:**
- Produces: `LAYER_RULES` (array of `{ root: string; forbid: RegExp[] }`), `findLayerViolations(rootDir: string): Array<{ file: string; specifier: string; layer: string }>`.

- [ ] **Step 1: Write the failing test** `__tests__/architecture/clean-arch-boundaries.test.ts`:

```ts
/** @jest-environment node */
import { findLayerViolations } from '../../lib/arch/scanLayerImports';

it('src/core/domain and application never import forbidden layers', () => {
  const violations = findLayerViolations(process.cwd());
  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Implement `lib/arch/layerRules.ts`** — forbid patterns per layer root:

```ts
export const LAYER_RULES = [
  { root: 'src/core/domain', forbid: [/stripe/i, /sequelize/, /next(\/|$)/, /ioredis|bullmq/, /^\.\.\/\.\.\/\.\.\/lib\//, /src[\\/]infrastructure/, /src[\\/]composition/, /pages[\\/]/] },
  { root: 'src/core/application', forbid: [/stripe/i, /sequelize/, /ioredis|bullmq/, /src[\\/]infrastructure/, /src[\\/]composition/, /pages[\\/]/] },
] as const;
```

- [ ] **Step 3: Implement `lib/arch/scanLayerImports.ts`** — walk files under each `root`, extract import specifiers using the **TypeScript compiler API**, not regex. Use `ts.preProcessFile(source, true, true).importedFiles` (from the already-installed `typescript` package) — it uses the TS scanner and correctly handles every import/export/`require`/dynamic-`import()` form, type-only imports, and multi-line statements that a regex mishandles. (Do **not** reuse `lib/cia/scanImports.extractImportSpecifiers` — it is regex-based; the architecture guard must be AST-accurate.) Flag any specifier matching that layer's `forbid`. Return `{file, specifier, layer}[]`.

```ts
import ts from 'typescript';
import fs from 'node:fs';
export function extractSpecifiers(source: string): string[] {
  return ts.preProcessFile(source, /*readImportFiles*/ true, /*detectJavaScriptImports*/ true)
    .importedFiles.map((f) => f.fileName);
}
```

- [ ] **Step 4: Run test.** Run: `npx jest __tests__/architecture/clean-arch-boundaries.test.ts` (Expected: PASS — `src/` is empty so zero violations; the guard is now armed for all later tasks).

- [ ] **Step 5: Wire into the arch script.** Add to `package.json` `test:arch`: `jest __tests__/architecture/cia-boundaries.test.ts __tests__/architecture/clean-arch-boundaries.test.ts --ci`.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "test(arch): clean-architecture layer boundary test (dependency rule)"
```

### Task 0.5: Billing dependency inventory (do before Task 1, no code)

- [ ] For each candidate domain file (`lib/billing/billingInvoiceModel.ts`, `lib/subscriptionFormat.ts`), list: external SDK imports, DB access, fs, `env`, internal deps. Confirm `billingInvoiceModel` is pure-except-Stripe-types (it is: `Stripe` types + `formatMoney`) and `subscriptionFormat.formatMoney` is fully pure (it is: 23 lines, no imports). Record the finding in the commit message of Task 1. This gate prevents mislabelling infrastructure as domain.

---

## Task 1: Domain layer — vendor-free entity + port + shared money

**Files:**
- Create: `src/core/shared/money.ts` (moved `formatMoney` from `lib/subscriptionFormat.ts`)
- Create: `src/core/domain/billing/invoice.ts`
- Create: `src/core/domain/billing/invoiceRepository.ts`
- Test: `__tests__/src/core/domain/billing/invoice.test.ts`

**Interfaces:**
- Produces: `formatMoney(cents: number, currency: string): string` (shared). Entity `BillingInvoice`, `BillingInvoiceLine`, `BillingInvoiceStatus`, `InvoiceDateGroup`; pure helpers `mapInvoiceStatus(s: string | null): BillingInvoiceStatus`, `groupInvoicesByDate(list: BillingInvoice[], now?: Date): InvoiceDateGroup[]`. Port `IInvoiceRepository { isConfigured(): boolean; getCustomerId(orgId: number): Promise<string | null>; listInvoices(customerId: string, limit: number): Promise<BillingInvoice[]> }`.

- [ ] **Step 1: Move shared money.** `git mv lib/subscriptionFormat.ts src/core/shared/money.ts`. Grep + rewrite all importers of `subscriptionFormat` (`grep -rn "subscriptionFormat" --include=*.ts --include=*.tsx`); most are in `lib/**` and `components/**` — point them at `@/src/core/shared/money`.

- [ ] **Step 2: Create the entity** `src/core/domain/billing/invoice.ts` — copy the type declarations (`BillingInvoice*`, `InvoiceDateGroup`) and the **pure, Stripe-free** helpers `mapInvoiceStatus`, `groupInvoicesByDate` from `lib/billing/billingInvoiceModel.ts`. Do **not** copy `mapStripeInvoice` or `formatPaymentMethodLabel` (those know Stripe → Task 3). No imports except (if needed) `formatMoney` from `../../shared/money`. Note: `mapInvoiceStatus` takes a plain `string | null`, not `Stripe.Invoice.Status`.

- [ ] **Step 3: Create the port** `src/core/domain/billing/invoiceRepository.ts`:

```ts
import type { BillingInvoice } from './invoice';

export interface IInvoiceRepository {
  isConfigured(): boolean;
  getCustomerId(orgId: number): Promise<string | null>;
  listInvoices(customerId: string, limit: number): Promise<BillingInvoice[]>;
}
```

- [ ] **Step 4: Write the entity test** `__tests__/src/core/domain/billing/invoice.test.ts`:

```ts
import { mapInvoiceStatus, groupInvoicesByDate, type BillingInvoice } from '../../../../../src/core/domain/billing/invoice';

it('maps unknown status to "unknown"', () => {
  expect(mapInvoiceStatus('weird')).toBe('unknown');
  expect(mapInvoiceStatus('paid')).toBe('paid');
});
it('groups invoices into date buckets', () => {
  const inv = { id: 'a', createdAt: new Date().toISOString() } as BillingInvoice;
  expect(groupInvoicesByDate([inv]).length).toBe(1);
});
```

- [ ] **Step 5: Verify.** Run: `npx jest __tests__/src/core/domain/billing __tests__/architecture/clean-arch-boundaries.test.ts` (Expected: PASS, zero boundary violations) and `npx tsc --noEmit` (Expected: exit 0). If tsc flags `lib/billing/billingInvoiceModel.ts` still referencing moved helpers, leave that file for Task 3 (it still holds `mapStripeInvoice`); ensure its imports of `mapInvoiceStatus`/`formatMoney` now point at the new locations.

- [ ] **Step 6: Commit** (include the Task 0.5 inventory finding in the message).

```bash
git add -A
git commit -m "refactor(arch): billing domain (vendor-free entity + port) + shared money -> src/core"
```

---

## Task 2: Application layer — ListOrgBillingInvoices use-case

**Files:**
- Create: `src/core/application/billing/listOrgBillingInvoices.ts`
- Delete: `lib/use-cases/billing/listOrgBillingInvoices.ts` (relocated)
- Test: `__tests__/src/core/application/billing/listOrgBillingInvoices.test.ts`

**Interfaces:**
- Consumes: `IInvoiceRepository`, `BillingInvoice` (Task 1).
- Produces: `listOrgBillingInvoices(repo: IInvoiceRepository, orgId: number, limit?: number): Promise<BillingInvoice[]>`.

- [ ] **Step 1: Author the use-case** (thinner now — repo returns domain types, so no mapping here):

```ts
import type { BillingInvoice } from '../../domain/billing/invoice';
import type { IInvoiceRepository } from '../../domain/billing/invoiceRepository';

export async function listOrgBillingInvoices(
  repo: IInvoiceRepository,
  orgId: number,
  limit = 40,
): Promise<BillingInvoice[]> {
  if (!repo.isConfigured()) return [];
  const customerId = await repo.getCustomerId(orgId);
  if (!customerId) return [];
  return repo.listInvoices(customerId, Math.min(100, Math.max(1, limit)));
}
```

- [ ] **Step 2: Move + rewrite the test** `__tests__/src/core/application/billing/listOrgBillingInvoices.test.ts` — reuse the existing fake-repo test (commit `f2bcd405`) but the fake now returns `BillingInvoice[]` directly from `listInvoices` and drops `getDefaultPaymentMethod`. Keep the 4 cases: not-configured → [], no-customer → [], returns invoices, clamps limit to [1,100].

- [ ] **Step 3: Delete the old use-case** `git rm lib/use-cases/billing/listOrgBillingInvoices.ts`.

- [ ] **Step 4: Verify.** Run: `npx jest __tests__/src/core/application/billing __tests__/architecture/clean-arch-boundaries.test.ts` (Expected: PASS) and `npx tsc --noEmit` (Expected: exit 0 except the transitional `lib/billingInvoices.ts` facade, fixed in Task 4 — combine commits if a green tsc is required at each step).

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "refactor(arch): ListOrgBillingInvoices use-case -> src/core/application"
```

---

## Task 3: Infrastructure — Stripe client + mapper + repository (isolated)

**Files:**
- Create: `src/infrastructure/billing/stripe/stripeBillingClient.ts`
- Create: `src/infrastructure/billing/stripe/stripeInvoiceMapper.ts`
- Create: `src/infrastructure/billing/stripe/stripeInvoiceRepository.ts`
- Delete: `lib/repositories/billing/invoiceRepository.ts` (+ `lib/repositories/index.ts` if empty), `lib/billing/billingInvoiceModel.ts` (its pure parts moved in Task 1; Stripe mapper moves here)
- Test: `__tests__/src/infrastructure/billing/stripeInvoiceMapper.test.ts`, `__tests__/src/infrastructure/billing/stripeInvoiceRepository.test.ts`

**Interfaces:**
- Consumes: `IInvoiceRepository`, `BillingInvoice` (domain), `formatMoney` (shared), `lib/stripe`, `lib/orgBilling`.
- Produces: `getStripeClient()` (client), `mapStripeInvoice(inv, opts?)` (mapper), `createStripeInvoiceRepository(): IInvoiceRepository`.

- [ ] **Step 1: Client** `stripeBillingClient.ts` — re-export thin access over `lib/stripe`:

```ts
export { getStripe as getStripeClient, isStripeConfigured } from '../../../../lib/stripe';
```

- [ ] **Step 2: Mapper** `stripeInvoiceMapper.ts` — move `mapStripeInvoice` + `formatPaymentMethodLabel` verbatim from `lib/billing/billingInvoiceModel.ts` here. Imports: `type Stripe`, `formatMoney` from `../../../core/shared/money`, entity types from `../../../core/domain/billing/invoice`, `mapInvoiceStatus` from the same. This file is the ONLY place `Stripe.Invoice` is read.

- [ ] **Step 3: Write the mapper test** `stripeInvoiceMapper.test.ts` — move the old `billingInvoiceModel` mapper test here (assert `mapStripeInvoice(fakeInvoice)` yields `status:'paid'`, correct `taxCents`, `totalLabel`).

- [ ] **Step 4: Repository** `stripeInvoiceRepository.ts` implementing the port, returning **domain** invoices (mapping + fallback PM inside):

```ts
import type Stripe from 'stripe';
import type { IInvoiceRepository } from '../../../core/domain/billing/invoiceRepository';
import type { BillingInvoice } from '../../../core/domain/billing/invoice';
import { getStripeClient, isStripeConfigured } from './stripeBillingClient';
import { getOrgBillingState } from '../../../../lib/orgBilling';
import { mapStripeInvoice, formatPaymentMethodLabel } from './stripeInvoiceMapper';

export function createStripeInvoiceRepository(): IInvoiceRepository {
  return {
    isConfigured: () => isStripeConfigured(),
    async getCustomerId(orgId) {
      const billing = await getOrgBillingState(orgId);
      return billing?.stripeCustomerId ?? null;
    },
    async listInvoices(customerId, limit) {
      const [result, customer] = await Promise.all([
        getStripeClient().invoices.list({ customer: customerId, limit, expand: ['data.default_payment_method'] }),
        getStripeClient().customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }),
      ]);
      let fallback: string | null = null;
      if (!customer.deleted) {
        fallback = formatPaymentMethodLabel(
          customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | string | null | undefined,
        );
      }
      return result.data.map((inv) => mapStripeInvoice(inv, { fallbackPaymentMethodLabel: fallback }));
    },
  };
}
```

- [ ] **Step 5: Write the repository test** `stripeInvoiceRepository.test.ts` — mock `../../../../lib/stripe` + `../../../../lib/orgBilling`; assert `getCustomerId(1)` returns the mocked `stripeCustomerId`, and `isConfigured()` reflects the mock.

- [ ] **Step 6: Delete old files** `git rm lib/repositories/billing/invoiceRepository.ts lib/billing/billingInvoiceModel.ts` (and `lib/repositories/index.ts` if now empty). Rewrite any remaining importers of `billingInvoiceModel` (grep) to the new domain (`mapInvoiceStatus`, types, `groupInvoicesByDate`) or mapper (`mapStripeInvoice`) locations.

- [ ] **Step 7: Verify.** Run: `npx jest __tests__/src/infrastructure/billing __tests__/architecture/clean-arch-boundaries.test.ts` (Expected: PASS) and `npx tsc --noEmit` (Expected: only the `lib/billingInvoices.ts` facade unresolved until Task 4).

- [ ] **Step 8: Commit** (may combine with Task 4).

```bash
git add -A
git commit -m "refactor(arch): stripe billing client/mapper/repository -> src/infrastructure (domain now Stripe-free)"
```

---

## Task 4: Composition root + Presentation wiring + docs

**Files:**
- Create: `src/composition/billing.ts`
- Modify: `lib/billing/billingInvoices.ts` (facade delegates to composition root, public surface kept)
- Delete: `lib/use-cases/` (empty), `lib/repositories/` (empty)
- Modify: `ARCHITECTURE.md`
- Test: `__tests__/lib/billing/*`, `__tests__/lib/billingInvoices.test.ts`, full suite

**Interfaces:**
- Consumes: `createStripeInvoiceRepository` (Task 3), `listOrgBillingInvoices` use-case (Task 2).
- Produces: `listOrgBillingInvoices(orgId: number, limit?: number): Promise<BillingInvoice[]>` (wired facade).

- [ ] **Step 1: Composition root** `src/composition/billing.ts`:

```ts
import { listOrgBillingInvoices as useCase } from '../core/application/billing/listOrgBillingInvoices';
import { createStripeInvoiceRepository } from '../infrastructure/billing/stripe/stripeInvoiceRepository';
import type { BillingInvoice } from '../core/domain/billing/invoice';

export function listOrgBillingInvoices(orgId: number, limit = 40): Promise<BillingInvoice[]> {
  return useCase(createStripeInvoiceRepository(), orgId, limit);
}
```

- [ ] **Step 2: Repoint the facade** `lib/billing/billingInvoices.ts` (keep public surface for existing callers/mocks):

```ts
export type { BillingInvoice, BillingInvoiceLine, BillingInvoiceStatus, InvoiceDateGroup } from '../../src/core/domain/billing/invoice';
export { groupInvoicesByDate, mapInvoiceStatus } from '../../src/core/domain/billing/invoice';
export { mapStripeInvoice } from '../../src/infrastructure/billing/stripe/stripeInvoiceMapper';
export { listOrgBillingInvoices } from '../../src/composition/billing';
```
(Note: `mapStripeInvoice` re-export keeps back-compat for any caller that imported it from `billingInvoices`; new code should import from the mapper directly.)

- [ ] **Step 3: Delete emptied dirs.** `git rm -r lib/use-cases lib/repositories` (only if empty).

- [ ] **Step 4: Verify full.** Run: `npx tsc --noEmit` (Expected: exit 0). Run: `npx jest __tests__/lib/billing __tests__/src __tests__/architecture` (Expected: all PASS). Then `npx jest --ci` (Expected: 407 suites / 2486 tests, ≤2 flaky retries).

- [ ] **Step 5: Rewrite `ARCHITECTURE.md`** — four-layer clean-architecture description, the mental-model diagram from this plan's header, the dependency-rule bullets, and the billing worked-example table pointing at the `src/` paths. State that the domain is vendor-free and mapping lives in infrastructure.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(arch): billing composition root + presentation wiring; billing vertical fully clean (domain Stripe-free)"
```

---

## Roadmap — subsequent phases (each its own plan)

Same 4-task shape (+ per-feature dependency inventory + boundary test stays green). Order by cohesion and **decoupling from the entangled core** — stabilise the model on simple domains before touching AO/pipeline:

1. **billing (rest)** — activate-trial, upgrade, confirmation, entitlement, plans (`lib/billing/`, ~14 files). Real use-cases: `UpgradeSubscription`, `CancelSubscription`, `ActivateTrial`, `GetBillingEntitlements`.
2. **gsc** — `lib/gsc/` (7); infra = Google Search Console client. Clean, CRUD-ish.
3. **simple domains** — competitors, rankTracking, keywords, siteAudit (one plan each). CRUD-ish, clear boundaries.
4. **articles** — `lib/articles/` (12); more moving parts.
5. **aiVisibility** — `lib/aiVisibility/` (10); LLM + store infra.
6. **AO / pipeline — LAST.** `lib/ao/` is entangled with scoring, coverage, planner, intelligence, compiler, pipeline, workers, Redis/BullMQ. Migrate only after the pattern is proven and the simpler domains are stable; likely needs its own multi-plan decomposition and may stay partly inside the CIA zones.

**Phase N (after feature migration stabilises): `lib/` infrastructure extraction.**
During feature migration, `src/infrastructure` is allowed to import `lib/*`
(`lib/stripe`, `lib/orgBilling`, `lib/db`, external-API helpers) as a **transitional**
bridge — otherwise every feature would stall on shared plumbing. This is NOT the
target state: left unchecked, `src/infrastructure` becomes a thin wrapper around a
permanent legacy `lib/` backend. Once the features are migrated, run a dedicated
phase that relocates the shared infrastructure primitives into `src/infrastructure/`
(e.g. `lib/stripe` → `src/infrastructure/stripe/`, `lib/db`/Sequelize access →
`src/infrastructure/persistence/`, external clients → `src/infrastructure/external/`),
then tighten the boundary test to also forbid `src/infrastructure → lib/` (except the
CIA zones). Do this last, not now.

**Per-feature checklist (repeat):**
- **inventory** first: for each candidate domain file, confirm zero transitive SDK/DB/fs/env deps; anything impure → infrastructure.
- **domain**: entity/value-objects + port interfaces; vendor-free; pure logic only.
- **application**: real-operation use-cases depending only on ports; DTOs for request/response; no vendor types.
- **infrastructure**: split client / mapper / repository per external system; repositories return domain types.
- **composition**: wire impl→use-case; `pages/api/**` consumes composition only.
- **gate**: `tsc` + `jest` + the clean-arch boundary test green; keep the old `lib/<feature>` facade re-exporting until all callers move, then delete.

**Out of scope (explicit):** App Router migration; moving `pages/api` into `src`; a DI-container library; rewriting CIA zones. Revisit only on a team decision.

**Risk controls:** one feature per branch/worktree; codemod (`scripts/move-lib-family.mjs` pattern) for import rewrites — never hand-edit at scale; `jest.mock` paths need manual grep after each move; regenerate `scripts/dead-exports-baseline.json` if the budget check trips.
