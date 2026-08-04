# Content Intelligence Acceptance Suite (CIAS)

**CIAS is not documentation. It is domain-model validation / falsification.**

RFC v1.0 is **FROZEN** ([../FREEZE.md](../FREEZE.md)).  
CIAS-002…008 are attempts to **break** the frozen model — not invitations to redesign.

```text
Real article
    → Can we represent the full pipeline in the frozen RFC?
    → YES / NO
```

| Result | Action |
|--------|--------|
| YES | Record; no RFC edits |
| NO + named missing field | Controlled **unfreeze** → patch RFC → re-freeze → re-run case |
| “Hard to extract” only | Still YES — extraction ≠ model gap |

## ADR-037 / ADR-038

- **037:** No product implementation before CIAS gate passes.  
- **038:** Freeze locks the model; remaining CIAS falsifies it.

See `../09-adr.md`.

## Required pipeline (every case)

Paper (markdown) must walk:

```text
Article
  → Lexical AST
  → Semantic AST
  → IR (SemanticCandidate*)
  → Knowledge Graph (+ key indexes mentally)
  → Reasoning paths (with confidence)
  → Action Graph (+ Recommendation DSL)
  → Coverage Projection  (effect, not input)
  → Visibility Projection
  → Planner (stateless subset)
  → Judge (what would be checked on before/after)
```

Final line of every case:

```text
MODEL_SUFFICIENT: YES | NO
```

`YES` only if **no new CCM/IR/DSL fields** were required.

## Suite v1 (reference articles)

| ID | Profile | Topic (reference) | Stress |
|----|---------|-------------------|--------|
| [CIAS-001](./CIAS-001-hybrid-war.md) | generic/blog | Wojna hybrydowa (Surfer gold) | Facts + Visibility + entities |
| [CIAS-002](./CIAS-002-medical.md) | medical | Objawy cukrzycy typu 2 | Evidence, YMYL, recommendations |
| [CIAS-003](./CIAS-003-news.md) | news | Apple kupuje firmę X | Freshness, timeline, conflict |
| [CIAS-004](./CIAS-004-product.md) | product | iPhone 17 Pro | Specs, features, comparisons |
| [CIAS-005](./CIAS-005-howto.md) | blog | Jak wymienić tarcze hamulcowe | Question graph, process |
| [CIAS-006](./CIAS-006-legal.md) | legal | (TBD statute / RODO fragment) | Definitions, exceptions |
| [CIAS-007](./CIAS-007-travel.md) | travel | (TBD destination) | Lists, locations |
| [CIAS-008](./CIAS-008-comparison.md) | product | RTX 5070 vs RTX 5080 | Comparison graph (hard) |

**Gold standard:** CIAS-001 (already has Surfer terms + 28 AI Visibility facts).

## Acceptance criteria (structural)

### Fact
Every Fact in the paper graph MUST have:
- ≥1 Entity (`uses`) **or** non-empty RDF `subject`
- Evidence (`supportedBy`) **or** status `weak` / `partial` explicitly
- Section / block anchor (`statedIn` or evidence `blockId`)

### Intent
Every **primary** Intent MUST have ≥1 linked Question (via `answers` / question↔intent).

### Question
Every Question marked `covered` MUST be answered by ≥1 Fact (and preferably a Section).

### Evidence
Fact with `covered` SHOULD have Evidence; else must be `weak`/`partial` — never silent.

### Recommendation
Every Action Graph item MUST cite a **reasoning path** (node ids) and a **Recommendation DSL** op.

### Coverage
Coverage Projection is computed **from** the graph — never treated as compiler input.

## Pass gate for “RFC ready to implement”

| Gate | Requirement |
|------|-------------|
| G1 | CIAS-001 `MODEL_SUFFICIENT: YES` |
| G2 | ≥4 additional cases YES (recommend all 002–008) |
| G3 | Zero new fields added to RFC during the suite |
| G4 | Then → `cia-arch-boundaries` / `cia-types-ccm` |

## Status board

| ID | MODEL_SUFFICIENT | Notes |
|----|------------------|-------|
| CIAS-001 | YES | Gold — Surfer hybrid war |
| CIAS-002 | YES | Synthetic — medical DM2 symptoms |
| CIAS-003 | YES | Synthetic — news acquisition |
| CIAS-004 | YES | Synthetic — iPhone 17 Pro |
| CIAS-005 | YES | Synthetic — brake discs how-to |
| CIAS-006 | YES | Synthetic — RODO right to erasure |
| CIAS-007 | YES | Synthetic — Lisbon 3 days |
| CIAS-008 | YES | Synthetic — RTX 5070 vs 5080 (hard) |

**CIAS gate (ADR-037):** PASSED — 001 + seven additional YES, zero new RFC fields, no unfreeze.
