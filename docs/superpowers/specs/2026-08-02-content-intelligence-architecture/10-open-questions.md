# 10 — Open Questions

Defaults suggested. Reply e.g. `defaults` or `1a 2a …`.

## OQ-1: Persist column

- **A) `articles.ccm` JSONB (default)**  
- B) `articles.ckb` interim name  
- C) reuse `ai_info_to_cover` with schema gate  

## OQ-2: Embeddings in v1

- **A) Async-only / null in sync (default)**  
- B) Required for fact dedupe day one  
- C) Defer to v1.1  

## OQ-3: Wikidata

- **A) Optional best-effort (default)**  
- B) Required for entity covered  
- C) Manual-only  

## OQ-4: Profile selection

- **A) Domain default + article override (default)**  
- B) Infer from SERP  
- C) Always `generic` until UX  

## OQ-5: Competitor CCM cost

- **A) Async/cached competitor compile (default)**  
- B) Lightweight competitor CCM  
- C) HTML benchmark until Phase 4  

## OQ-6: Presentation policies vs CCM

- **A) Orthogonal HTML allowlist gates for now (default)**  
- B) Encode fully in presentation slice day one  
- C) Hybrid  

## OQ-7: First plans after accept (suggested)

1. `cia-types-ccm` — CCM + AST types + invariants (no LLM)  
2. `cia-compiler-lexical` — Lexer/Parser/Normalizer + blockIds  
3. `cia-fact-evidence-mvp` — hybrid Fact+Evidence  
4. `cia-action-graph` — Builder + Planner wire  
5. `cia-judge-modeldiff` — multi-layer diff  
6. `cia-incremental-runtime` — subtree recompile  
7. `cia-fixtures-hybrid-war` — gold acceptance  

## OQ-8: UI naming during migration

- **A) Keep “Info to cover” labels, swap engine (default)** ← **DONE Etap 19** (`ccmToInfoToCover` on API DTO; editor UI still legacy until opt-in)  
- B) Rebrand to Content Score immediately  

## OQ-9: Incremental v1 scope

- **A) Ship incremental in first runtime plan (default)**  
- B) Full-only first; incremental immediately after  
- C) Defer incremental 2+ quarters  

## OQ-10: Persist IR on CCM always?

- **A) Yes — full IR on every non-adapter CCM (default)**  
- B) IR ephemeral in full compile; persist only for incremental  
- C) Persist IR compressed / external blob  

---

## Acceptance

RFC **Accepted** when README freeze checklist is checked (incl. infra 17–21), OQ-1..4 + OQ-9..10 recorded, and field-ownership registry for CCM envelope is started (`16-field-ownership.md`).

Until then: **no CCM/compiler product implementation PRs.** First post-freeze plan may include arch-test skeleton only.
