# RFC Freeze Review — Content Intelligence Architecture v1.0

**Date:** 2026-08-02  
**Status:** **FROZEN** + **CIAS gate PASSED** (001–008 all YES, zero unfreeze)  
**Basis:** CIAS-001 gold + synthetic 002–008 falsification without new fields

## Freeze ≠ end of validation

| | Meaning |
|---|---------|
| **Frozen** | Domain model + infra contracts (modules 00–21) are locked. No ideation, no new modules, no “nice to have” fields. |
| **Validation continues** | CIAS-002…008 try to **falsify** the frozen model. |
| **Unfreeze** | Only if a CIAS case is `MODEL_SUFFICIENT: NO` with a **named** missing field/edge/op → controlled RFC patch → re-freeze. |
| **Accepted for impl** | After CIAS gate (ADR-037): ≥4 additional YES + zero model changes → then code. |

## Freeze checklist (signed)

| Area | Frozen |
|------|--------|
| CCM Snapshot | ✓ |
| IR / SemanticCandidate | ✓ |
| Compiler pipeline | ✓ |
| Pass Manager / Stage Registry | ✓ |
| Constraint Engine | ✓ |
| GraphQuery | ✓ |
| Reasoning Graph + confidence | ✓ |
| Action Graph + Recommendation DSL | ✓ |
| Stateless Planner | ✓ |
| Consumer Contracts / Context | ✓ |
| Architecture Tests (spec) | ✓ |
| Migration (adapter non-API) | ✓ |
| CIAS process + ADR-037 | ✓ |
| RFC-000 onboarding | ✓ |
| Deferred evolution (22) | backlog only — not in freeze surface |

## Explicit non-goals of freeze period

- No Fact Engine design/implementation  
- No Planner/AO product work  
- No new RFC modules (Corpus, Plugin marketplace, …)  
- No expanding Coverage Engine v3 foundation plan  

## Roadmap after this freeze

```text
Etap 1  FREEZE v1.0                         ← DONE
Etap 2  CIAS-002 … CIAS-008  (falsify model) ← DONE (all YES)
Etap 3  RFC Accepted for implementation     ← DONE (gate)
Etap 4  cia-arch-boundaries                 ← DONE (lib/cia + test:arch)
        plan: docs/superpowers/plans/2026-08-02-cia-arch-boundaries.md
Etap 5  cia-types-ccm                       ← DONE (lib/ccm types + emptyCcm + serialize)
        plan: docs/superpowers/plans/2026-08-02-cia-types-ccm.md

Etap 6  Compiler skeleton: Lexer→Parser→Semantic→IR→empty CCM
        ← DONE (lib/compiler compile())
Etap 7  Compiler Replay (serialize/deserialize/same deterministicHash)
        ← DONE (lib/compiler/replay.ts)
Etap 8  Fill builders one-by-one (heuristic entity/fact/intent)
        ← DONE — not Fact Engine product (LLM/NER/evidence MVP later)

Etap 9  cia-fact-evidence-mvp (supportedBy + weak)     ← DONE
Etap 10 cia-action-graph builder (Recommendation DSL) ← DONE
Etap 11 cia-judge-modeldiff + coverage projection + CIAS-001 fixture
        ← DONE
Etap 12 GraphQuery + incremental runtime (dep/invalidation + noop)
        ← DONE
Etap 13 Visibility + Constraint Engine + indexes arch-lint
        ← DONE
Etap 14 Benchmark + ConsumerContext + in-memory persistence
        ← DONE
Etap 15 Writing Intelligence + CompileStore (SQL cia_ccm_*) 
        ← DONE
Etap 16 API routes / UI wire / gold Surfer parity ← DONE
Etap 17 Product triggers (compile after DA/generate) — backend
        ← DONE (no editor widgets)
Etap 18 Publish gate + after AO (compileIfStale / compile after optimize)
        ← DONE
Etap 19 Info to cover ← CCM facts (API DTO / OQ-8 engine) — backend
        ← DONE (editor still legacy labels + ai_info_to_cover)
Etap 20 Live presence (ccm/live) — backend
        ← DONE
Etap 21 ActionGraph recommendations on API view DTO — backend
        ← DONE
Etap 22 Cron stale CCM compile (`/api/cron/ccm-compile`, co 6h)
        ← DONE
Etap 23 AO ← CCM ActionGraph candidates (backend, no UI)
        ← DONE
Etap 24 Article PUT save → compileIfStale (backend, no UI)
        ← DONE
Etap 25 Fact Engine MVP (atomic claims + SPO + evidence quote)
        ← DONE (heuristic; not LLM/NER product)
Etap 26 CIAS-002…008 smoke fixtures + compile tests
        ← DONE
Etap 27 SoT: CCM → ai_info_to_cover projection (UI labels unchanged)
        ← DONE (backend; no new editor widgets)
Etap 28 Fact Engine v2 — DA / AI-visibility citations → CCM facts
        ← DONE (no LLM in compile; enrich + re-project)
Etap 29 Hardening — compile metrics + await DA projection + contradicts
        ← DONE
Etap 30 Fact Engine v3 — LLM gap quotes (verbatim from article only)
        ← DONE
```

## Product framing (locked)

Ranksmile is building a **Content Intelligence Platform** (compiler layer).  
Surfer / Clearscope / MarketMuse-class tools are **consumers** of such a model — not the architecture we copy.
