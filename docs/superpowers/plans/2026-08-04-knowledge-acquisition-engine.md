# Knowledge Acquisition Engine (Surfer Research) — Plan Stub

> **Status:** Stub / bounded context boundary. **Not** executed as part of Section Writer plan.  
> **Sibling:** [`2026-08-04-section-writer.md`](./2026-08-04-section-writer.md)  
> **When ready:** Expand with writing-plans → SDD.

**Goal:** Upstream ingestion only. Nie mieszać z Write Engine / Runtime.

**Contract (locked for future expansion):**

Acquisition **nie** zwraca ad-hoc „wyników research”.  
Publikuje **wersjonowany** `KnowledgeGraphSnapshot` (`version`, `createdAt`, `plannerVersion`, `researchVersion`, sources/entities/claims/facts/questions).

```
SERP / AI Search / Competitors / Official Docs
        ↓
Knowledge Acquisition Engine
  crawl → extract → dedupe → normalize → score → allocate
        ↓
KnowledgeGraphSnapshot (versioned, immutable after publish)
        ↓
Planner / CIE / WritePlanCompiler consume that snapshot pin
```

Planner i Compiler zawsze wiedzą **który** snapshot był użyty (AO: stary snapshot → odśwież).

**Why separate:** Inny bounded context niż Planner→Compiler→Runtime.

## Out of this stub

Owned by Section Writer plan: CompiledWritePlan, validators, Writer, Judge, MdAst, UI.

## In scope when expanded

Source fill, Entity/Fact engines, Citation, Outline reasoning, Coverage allocation, Image Planner, Research cache.

## Relation to CIE

CIE = Benchmark + knowledge **inside** planner path.  
Acquisition = **upstream** publisher of durable snapshots CIE/Planner pin to.

## Next step

writing-plans na ten stub po shipie Section Writer PR-A/B (gdy typy Source/Claim/Fact + snapshot już istnieją).
