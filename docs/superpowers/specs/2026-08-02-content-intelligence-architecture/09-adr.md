# 09 — Architecture Decision Records (frozen intent)

These decisions should **not** change every sprint. Amend only via explicit ADR revision.

---

## ADR-001 — No HTML semantic consumers

**Status:** Accepted (product direction 2026-08-02)  

**Decision:** Consumers **MUST NEVER** analyze article HTML for semantics if a fresh **Canonical Content Model** is available.

**Allowlist exceptions:** renderer, export, editor UI, and narrowly scoped presentation-policy checks (e.g. placeholder regex) that cannot yet be expressed in CCM — must be listed in code allowlist.

**Applies to:** Planner, Judge, Coverage, Visibility, Benchmark, History, Writing Intelligence, Action Graph Builder.

**Consequences:** Prevents “shortcut” re-analysis that forks logic across modules.

---

## ADR-002 — CCM is the only SoT

**Status:** Accepted  

**Decision:** Source of Truth is `CanonicalContentModel`. Knowledge Graph is `ccm.knowledge.graph`, not a parallel SoT. Scores and Coverage views are projections.

**Consequences:** Persist CCM (and history), not “score JSON” as truth.

---

## ADR-003 — Compiler outputs immutable snapshots

**Status:** Accepted  

**Decision:** Each compile produces an immutable CCM (`version` monotonic). Edits create a new version; in-place mutation of persisted CCM is forbidden.

**Consequences:** Safe Judge/History/diff; slightly higher storage.

---

## ADR-004 — All optimization operates on Action Graph

**Status:** Accepted  

**Decision:** Auto Optimize / Writer planning consumes **Action Graph** derived from CCM. Not a bag of `missing[]` labels. Not ad-hoc HTML heuristics as the plan source.

**Consequences:** Action Graph Builder is a required domain module (`11-action-graph.md`).

---

## ADR-005 — Scores are projections, never stored as truth

**Status:** Accepted  

**Decision:** Content Score / Coverage % / WI numbers are recomputable projections. Authoritative state is CCM (+ Action Graph + Judge verdict records in history).

**Consequences:** UI may cache scores for display; recompile/profile change recalculates.

---

## ADR-006 — Evidence is relation/span, not peer score node

**Status:** Accepted  

**Decision:** `Fact -supportedBy-> EvidenceSpan`; Aggregator uses `evidence_link`.

---

## ADR-007 — Profile-weighted Aggregator

**Status:** Accepted  

**Decision:** Weights live in `ContentScoreProfile`; blog vector is one profile, not global law.

---

## ADR-008 — Hybrid Fact Extractor

**Status:** Accepted  

**Decision:** Rules + NER + embeddings + LLM + cross-validation — not LLM-only.

---

## ADR-009 — Full compile history

**Status:** Accepted  

**Decision:** History stores AST + CCM + scores + Action Graph + Judge + ModelDiff — not CCM-only and not score-only snapshots.

---

## ADR-010 — WIE is a meta-consumer

**Status:** Accepted  

**Decision:** Writing Intelligence reads CCM + peer consumer results; it does not re-extract knowledge.

---

## ADR-011 — Benchmark uses subgraph matching

**Status:** Accepted  

**Decision:** Benchmark matches intentional motifs (Intent→Facts→Evidence→Question) via indexes — not bag-of-nodes graph compare. HTML-only benchmark is legacy fallback.

---

## ADR-012 — Incremental subtree compile

**Status:** Accepted (target runtime)  

**Decision:** Runtime supports recompile of changed AST subtree + graph patch + consumer notify — not only full-article compile.

---

## ADR-013 — No implementation until RFC accept

**Status:** Accepted  

**Decision:** No CCM/compiler production PRs until checklist + OQs resolved. Foundation Coverage-v3 plan remains superseded.

---

## ADR-014 — Lossy v1 adapter is migration-only

**Status:** Accepted  

**Decision:** `mode=adapter` never satisfies publish-quality compile.

---

## ADR-015 — TipTap/Lexical AST preferred over HTML

**Status:** Accepted  

**Decision:** Lexer prefers TipTap JSON when present for stable `blockId` evidence anchors.

---

## ADR-016 — IR between Semantic AST and CCM

**Status:** Accepted  

**Decision:** Content IR (meaning candidates) is a required compile stage; builders discover from IR, not from AST/HTML.

---

## ADR-017 — Readonly graph + indexes in CCM

**Status:** Accepted  

**Decision:** `knowledge.graph` and `knowledge.indexes` are part of the immutable model so consumers do not build ad-hoc O(n²) scans.

---

## ADR-018 — Reasoning is a DAG

**Status:** Accepted  

**Decision:** Explainability uses Reasoning Graph edges, not only flat explanation strings.

---

## ADR-019 — Capability Registry + deterministicHash

**Status:** Accepted  

**Decision:** `compiler.capabilities` and `compiler.deterministicHash` are mandatory metadata for feature detection and identical-compile detection.

---

## ADR-020 — Immutable ActionGraph version-locked to CCM

**Status:** Accepted  

**Decision:** ActionGraph vN is immutable and tied to CCM vN; no mutable global action queue.

---

## ADR-021 — accept(ConsumerContext)

**Status:** Accepted  

**Decision:** Consumers implement `accept(context)` with model/diff/history/cache/runtime/budget — not bare `accept(model)`.

---

## ADR-022 — History is CompileEvent stream

**Status:** Accepted  

**Decision:** Event sourcing (`CompileStarted`, `JudgeRun`, `Publish`, …); ModelDiff is derived when needed.

---

## ADR-023 — Naming: Projections not Engines

**Status:** Accepted  

**Decision:** Product modules that only view CCM are named *Projection* (Coverage Projection, Visibility Projection).

---

## ADR-024 — Field ownership gate

**Status:** Accepted  

**Decision:** No persisted field without owner, producer, consumer, and invariant (`16-field-ownership.md`).

---

## ADR-025 — Adapter is not a platform API

**Status:** Accepted  

**Decision:** Snapshot→CCM helpers must not be imported by new runtime modules; migration and compliance tests only.

---

## ADR-026 — Pass Manager + Stage Registry

**Status:** Accepted  

**Decision:** Extensible `CompilerPass` registry with dependsOn/invalidates; profile/domain passes plug in without editing compiler core (`17-pass-manager.md`).

---

## ADR-027 — Constraint Engine

**Status:** Accepted  

**Decision:** Graph constraints are a dedicated module with declarative rules (`18-constraint-engine.md`), not ad-hoc ifs in Aggregator.

---

## ADR-028 — GraphQuery API

**Status:** Accepted  

**Decision:** Consumers access the graph only via `GraphQuery` (`19-graph-query.md`); raw indexes are compiler-internal.

---

## ADR-029 — Reasoning confidence propagation

**Status:** Accepted  

**Decision:** Reasoning nodes/edges carry confidence/weight; paths propagate bottleneck confidence (never default to 1).

---

## ADR-030 — Stateless Planner

**Status:** Accepted  

**Decision:** Planner is pure per invocation: Input → Plan → History event → Done.

---

## ADR-031 — Invalidation Graph ≠ Dependency Graph

**Status:** Accepted  

**Decision:** Incremental compile uses a narrower Invalidation Graph; dirty block does not automatically dirty all related intents.

---

## ADR-032 — CCM is always a Snapshot

**Status:** Accepted  

**Decision:** No mutable current CCM; storage may point to latest version id only.

---

## ADR-033 — Recommendation DSL

**Status:** Accepted  

**Decision:** Structured ops (`ADD_FACT`, …) shared by Planner/Judge/AO/Intelligence (`20-recommendation-dsl.md`).

---

## ADR-034 — Intelligence triad

**Status:** Accepted  

**Decision:** Split Writing / Editorial / Optimization Intelligence as separate consumers that may compose in UI.

---

## ADR-035 — Architecture tests

**Status:** Accepted  

**Decision:** CI dependency firewalls prevent HTML/adapter shortcuts (`21-architecture-tests.md`).

---

## ADR-036 — History Replay

**Status:** Accepted  

**Decision:** Replay compile/planner/benchmark/judge from events + snapshot refs for debugging.

---

## ADR-037 — No implementation before CIAS passes

**Status:** Accepted  

**Context:** Diagrams look fine; models die on real articles. Unit/integration tests do not validate domain fit.

**Decision:** No product compiler/CCM implementation PRs until the **Content Intelligence Acceptance Suite (CIAS)** gate passes:

1. CIAS-001 Hybrid War = `MODEL_SUFFICIENT: YES`  
2. ≥4 additional CIAS cases = YES (target: full 002–008)  
3. Zero new RFC fields introduced to “make it fit”  

CIAS papers must walk AST → IR → KG → ActionGraph → Coverage/Visibility → Planner → Judge.

**Consequences:** Paper CIAS before `cia-arch-boundaries` / `cia-types-ccm`. Suite lives under `CIAS/`.

---

## ADR-038 — Freeze locks model; CIAS falsifies

**Status:** Accepted (2026-08-02)

**Decision:** RFC v1.0 is **frozen** after CIAS-001 YES ([FREEZE.md](./FREEZE.md)). Freeze means the domain model and infra contracts stop evolving by ideation. CIAS-002…008 continue as **falsification**. Unfreeze only on `MODEL_SUFFICIENT: NO` with an explicit missing field/edge/op; then patch and re-freeze.

**Consequences:** No infinite RFC growth. Clear end of design phase when CIAS gate passes with zero model changes.

---

## ADR-040 — No business logic inside `lib/ccm/types`

**Status:** Accepted (pre–cia-types-ccm)

**Decision:** `lib/ccm/types/**` may contain only TypeScript types, interfaces, unions, branded aliases, and type guards. Hashing, index construction, integrity throws, factories, and zod schemas live **outside** `types/` (`canonicalJson.ts`, `buildIndexes.ts`, `emptyCcm.ts`, `ccmSchema.ts`, `ids.ts`, `builders/`).

**Consequences:** Keeps contracts pure; logic stays testable and swappable without rewriting the type surface.
