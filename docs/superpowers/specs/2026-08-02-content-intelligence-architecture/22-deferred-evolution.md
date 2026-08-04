# 22 — Deferred platform evolution (NOT in v1 freeze)

**Do not expand the v0.4 RFC with these modules.**  
This is a **backlog of product-v2/v3 ideas** recorded so we do not lose them — and so we do not keep growing abstractions before verification.

| Idea | One-liner | When to reopen |
|------|-----------|----------------|
| Knowledge Evolution Graph | Fact created/modified/deleted/merged/split across article versions (knowledge Δ ≠ text Δ) | After multi-version History is live |
| Compiler Plugin API | Plugin registers passes + constraints + profiles + DSL + projections | When 2nd vertical needs more than a Pass |
| Central Registries | Node/Edge/Projection/Pass/Profile/Consumer registries as one catalog | With first codegen from field ownership |
| Projection Registry | Trust / EEAT / Authority / Conversion projections | After Coverage+Visibility ship on CCM |
| Consumer Scheduler | DAG orchestration Coverage→Planner→Judge→… | When sync fan-out becomes painful |
| Content DSL family | Recommendation + Planner + Prompt + Evaluation DSL | After Recommendation DSL proves out |
| Graph Morphology | Structure-of-knowledge similarity, not only missing facts | Benchmark v2 |
| Corpus Compiler / Site Graph | Multi-article Knowledge Network, internal links, cannibalization, topical authority | Explicit corpus product epic |
| Planner Policies | SEO-safe / Human-first / Medical / News policies beyond strategy enum | Enterprise AO |
| Compiler Cache Layers | AST / IR / Graph / Projection / Consumer caches | Perf epic |
| Canonical Reasoning Model | Why/Because/Therefore as first-class (beyond explainability DAG) | After Reasoning Graph + confidence used in UI |

**Rule:** reopen an item only with a verification failure or a funded epic — not because it is interesting.
