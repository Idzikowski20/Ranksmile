# Content Intelligence Engine (CIE)

**Date:** 2026-08-04  
**Implementation plan:** [`docs/superpowers/plans/2026-08-04-knowledge-engine.md`](../../plans/2026-08-04-knowledge-engine.md)

## One-liner

Two pillars before writing: **Benchmark Intelligence** (*how much / structure*) and **Knowledge Intelligence** (*what to say*). Immutable Knowledge Graph → Planner (Narrative Optimizer + Improve Loop) → Execution Plan → Writer. AO revises the **plan**, never the graph.

## Flow

```
TOP-N
  → Benchmark Intelligence → PlannerTargets (median, p25, p75, min, max)
  → Knowledge Intelligence (6 stages) → Verifier → immutable knowledge_graph
  → Planner + Narrative Optimizer + Planner Validator/Improve
  → Execution Plan (section claims + reason)
  → Writer → Coverage overlay → AO → new Execution Plan
  → UI Knowledge Coverage + Source Explorer
```

## Locked decisions (latest)

| Topic | Decision |
|-------|----------|
| Naming | Content Intelligence Engine (CIE) |
| Benchmark ≠ Knowledge | Separate modules |
| KG | Immutable after build |
| AO | Patch Execution Plan only |
| Stats | Median + percentiles, not mean-primary |
| Narrative | Optimizer (not raw H2 frequency) |
| Planner | Own Validator + Improve Loop |
| Similarity | Shared EmbeddingProvider match |
| MVP embed | Hash via provider |
| Source weight | Tiers |
| dependsOn | Later PR |
| Fallback | claims&lt;30 / verifier fail → legacy |
| Flag | USE_KNOWLEDGE_ENGINE |
| Importance | label + importanceScore 0–100 |
| Diversity | sourceDiversity on claims |
| Explainability | section.reason |

## Non-goals

LLM model swap; DFS On-Page primary; real embeds in PR-A; dependsOn; DB table (JSON first).
