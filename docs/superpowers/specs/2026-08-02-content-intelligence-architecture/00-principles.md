# 00 — Principles

## Manifest

> **Coverage is a side effect of a good compile — not the product.**

```text
Content → Compiler (PassManager) → IR → CCM Snapshot
        → GraphQuery / Projections / ActionGraph → Planner → History(+Replay)
```

## Core rules (v0.4)

1. **Compiler-first** — Coverage/Visibility are Projections.  
2. **IR** — builders/passes discover meaning from IR (`SemanticCandidate` hierarchy).  
3. **Pass Manager** — extensible passes; no hard-wired forever pipeline core.  
4. **CCM = Snapshot** — immutable; no mutable “current model”.  
5. **Readonly graph + indexes** — accessed only via **GraphQuery**.  
6. **Constraint Engine** — declarative graph rules.  
7. **Reasoning DAG** — with **confidence propagation**.  
8. **Immutable ActionGraph vN** + **Recommendation DSL**.  
9. **Stateless Planner** — Input → Plan → Event → Done.  
10. **Dependency ≠ Invalidation** graphs for incremental compile.  
11. **ConsumerContext** + Capability Registry + deterministicHash.  
12. **CompileEvents + Replay**.  
13. **Intelligence triad** — Writing / Editorial / Optimization.  
14. **Field ownership** — no field without owner/producer/consumer.  
15. **Architecture tests** — block HTML/adapter shortcuts.  
16. **Adapter** — migration/tests only, never platform API.

## Non-goals

Surfer clone · TipTap rewrite · Product code before freeze · Permanent snapshot→CCM runtime bridge
