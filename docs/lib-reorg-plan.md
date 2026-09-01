# lib/ reorganization plan

`lib/` has **238 flat `.ts` files** at its root next to 50 subdirectories. Many
families already have a subdir but keep flat siblings at the root — the same
**split-brain** we just fixed for billing (code lived in both `lib/billing/` and
15 flat `lib/billing*.ts`). This plan groups the remaining flat families into
folders so each concern lives in one place.

**Constraints (unchanged):** no App Router migration, no DI container, keep the
CIA zones (`ccm`, `compiler`, `intelligence`, `planner`, `projections`) and their
boundary test. This is pure file organization — no behavior changes.

## Proven method (per family)

The billing consolidation (commit `154c855a`) is the template. Repeat per family:

1. **Move** the flat `lib/<family>*.ts` files into `lib/<family>/` (create the
   folder or reuse the existing one).
2. **Rewrite imports by resolve→recompute**, not by hand. A codemod resolves each
   relative / `@/` specifier to its target file, recomputes the specifier from the
   file's new location, and rewrites it. This correctly handles: external
   importers (`../lib/x` → `../lib/family/x`), a moved file's imports of
   non-moved siblings (`./orgBilling` → `../orgBilling`), and moved-to-moved
   (`../x` → `./x`). See the billing codemod in the commit history.
3. **Check `jest.mock()` string paths** — `scripts/move-lib-family.mjs` already
   rewrites them alongside `from`/`import`/`require`; just verify (tsconfig excludes
   `__tests__`, so tsc won't flag a missed one).
4. **Verify green:** `npx tsc --noEmit` (app code) **and** `npx jest <family>`
   (test-file imports). Do not commit red.
5. **One family = one commit.** Small, reviewable, revertible.

> Tip: use the existing `scripts/move-lib-family.mjs` (family prefix + target dir),
> so each family is one script run + one test run.

## Done so far

- ✅ `billing` — 15 flat files → `lib/billing/` (commit `154c855a`).
- ✅ `gsc` (7) → `lib/gsc/`, `article` (12) → `lib/articles/`, `aiVisibility` (10) →
  `lib/aiVisibility/`, `ai` rest (5) → `lib/ai/` (commit `a6928646`).
- Tooling: `scripts/move-lib-family.mjs` does the move + import rewrite for any family.

## Families, ranked

Order: highest navigability payoff / lowest risk first. "Split-brain" = a subdir
already exists, so consolidating is unambiguous.

| # | Family | Flat files | Target folder | Split-brain? | Churn | Notes |
|---|--------|-----------:|---------------|:------------:|:-----:|-------|
| 1 | `gsc*` | 7 | `lib/gsc/` | ✅ yes | low | Google Search Console — subdir exists. |
| 2 | `article*` | 12 | `lib/articles/` | ✅ yes | med | subdir exists; watch `article` vs `articles` naming. |
| 3 | `ai*` | 15 | `lib/ai/` | ✅ yes | med | subdir exists; also `aiScore/`, `aiVisibility*` cluster — decide `lib/ai/visibility/`. |
| 4 | `ensure*` | 23 | `lib/schema/` (new) | ❌ new | med | DB table-bootstrap fns; `lib/db/` exists — could be `lib/db/ensure/`. Confirm target. |
| 5 | `competitor*` | 7 | `lib/competitors/` (new) | ❌ new | low | self-contained. |
| 6 | `stripe*` | 8 | `lib/billing/stripe/` | partial | med | Stripe is billing infra; fold under the now-consolidated `lib/billing/`. |
| 7 | `optimize*` | 13 | `lib/ao/` | partial | med | `ao/` = article optimization; confirm these belong there. |
| 8 | `term*` (5), `keyword*` (5), `audit*` (5) | 15 | `lib/{terms,keywords,audit}/` | mixed | low–med | `rankTracking/`, `siteAudit/` exist — map carefully, `audit` may split across `siteAudit`/`auth`. |
| 9 | `domain*` (4), `wp*` (4), `score*` (3), `content*` (3), `dataforseo*` (3), `deep*` (3), `feature*` (3), `fetch*` (3) | ~26 | per-family folders | mostly new | low | long tail; batch last. |

Everything below 3 files per prefix (~90 singletons) stays flat — grouping
one-offs adds indirection without payoff (YAGNI).

## Risks & guards

- **Import churn is the whole risk.** The codemod + `tsc` + `jest` gate removes
  it — never hand-edit imports at this scale.
- **`jest.mock` paths** are the easy miss (not covered by tsc). Grep each family's
  basenames in `__tests__` after moving.
- **CIA zone files** (`ccm`, `compiler`, `intelligence`, `planner`, `projections`)
  are already in folders — do not touch; the boundary test guards them.
- **Concurrent sessions:** this churns many files. Run it when no other agent is
  editing `lib/`, or in an isolated worktree, to avoid merge collisions.
- **`dead-exports-baseline.json` / token baselines** reference paths — regenerate
  (`npm run dead:exports:write`) after a batch if the budget check trips.

## Suggested sequence

Families 1–3 first (split-brain, clear wins), then 4–5, then 6–8, long tail (9)
last. One commit each, tests green between. No big-bang.
