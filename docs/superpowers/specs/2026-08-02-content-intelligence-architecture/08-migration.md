# 08 — Migration from CoverageSnapshot v1

## Current state

- SoT (de facto): `articles.ai_info_to_cover` = `CoverageSnapshot` schemaVersion 1
- Parallel: `lib/engines/coverageEngine.ts`
- AO: `buildArticleContext` + `liveCoverageItems`
- WIE: string synthesis + separate judges

## Target state

- SoT: `articles.ccm` JSONB (preferred name; `ckb` acceptable interim) = **Canonical Content Model**
- Coverage UI ← `CoverageView` projection
- Pipeline coverage engine → compiler **priors**, not second SoT
- History ← full compile records (`14-diff-and-history.md`)

## Phases

### Phase 0 — RFC freeze

No production CCM/compiler code until accept. Foundation plan **superseded**.

### Phase 1 — Types + lossy adapter (migration / compliance tests ONLY)

`CoverageSnapshot` → approximate CCM (`mode=adapter`).

**Forbidden:** new modules (Planner, Judge, Visibility, Benchmark, WIE) importing or calling adapter helpers (e.g. historical `coverageSnapshotToKg`) at runtime. Adapter is a one-way bridge + golden compatibility tests — not a platform API.

| v1 | CCM approx |
|----|------------|
| — | empty/minimal Lexical AST from HTML parse |
| fact label | Fact.statement; SPO fill later |
| entity/term/concept | Entity.canonicalName |
| intent/paa/question | Intent / Question (flat) |
| topics[] | Topic + edges |
| covered+quality | status (quality < 3 → partial) |

Lossy: weak evidence, thin presentation slice, `compiler.partial=true`.

### Phase 2 — Compiler MVP

Lexer/Parser → AST on CCM → Entity/Fact/Evidence → Validator → Aggregator. Persist CCM. `legacy.coverageSnapshotV1` for old UI.

### Phase 3 — Consumer cutover

CoverageView → ActionGraph/Planner → Judge ModelDiff → AIV facts → Benchmark graph match → WIE meta.

### Phase 4 — Retire dual SoT

Deprecate `ai_info_to_cover` as SoT; eval asserts on CCM versions.

## Compatibility

- Editor load: CCM missing → fall back v1 snapshot  
- Adapter never publish-quality  
- Gold hybrid-war fixtures after accept  

## Fixtures (later)

`docs/fixtures/{hybrid-war,seo,medical,finance,legal,travel,saas}/`
