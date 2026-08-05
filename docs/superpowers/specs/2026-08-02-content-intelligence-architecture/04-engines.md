# 04 — Engines (Extractors / Builders)

Knowledge “engines” are implemented as **`CompilerPass`** instances registered in the Pass Manager (`17-pass-manager.md`), not as a hard-coded call list in the compiler core.

**Input rule:** passes consume **`ContentIr`** / `SemanticCandidate`s (`15-ir.md`). Evidence may resolve offsets via AST anchors from IR.

## Shared output

```ts
export interface EnginePatch {
  readonly nodesUpsert: readonly KgNode[];
  readonly edgesUpsert: readonly KgEdge[];
  readonly nodesRemove?: readonly string[];
  readonly edgesRemove?: readonly string[];
  readonly recommendations?: readonly ActionSeed[]; // early seeds for Action Graph
}
```

## Entity Extractor

**Hybrid:** lexicon/terms (SEO NLP) → NER → alias clustering → optional Wikidata → LLM disambiguation (budgeted).

Outputs: `EntityNode` + `mentions` / `sameAs` / `belongsTo` (topic assign may wait for Topic pass).

## Fact Extractor (critical)

**Not LLM-only.**

```text
1. Rules: date/number/pattern claim spans from Semantic AST
2. NER-linked SPO candidates
3. Embedding near-duplicate collapse
4. LLM: normalize to RDF-lite + statement surface form
5. Cross-validation: require evidence span overlap OR mark weak/hallucinated
```

Acceptance shape (Surfer): atomic statements in gold fixtures must round-trip to `FactNode.statement` + SPO.

## Relation Builder

Infers `uses`, `causes`, `contradicts`, `duplicates`, `derivedFrom`, `relatedTo` from co-occurrence + LLM verify on uncertain pairs.

## Intent Builder

Builds Intent **tree** from:

- primary query / title  
- H2 discourse map  
- SERP/PAA clusters  
- competitor synthesis (WIE) as prior, not truth  

Fields: `userGoal`, `queryVariants`, `priority`, `parentOf`.

## Question Builder

PAA + FAQ + implicit questions from intents. Links `answers` / `answeredBy` to facts and sections when present; else `status=missing`.

## Evidence Builder

For each Fact:

1. Locate supporting spans in Lexical AST (`blockId` + offsets)  
2. Classify evidenceKind  
3. Emit `supportedBy`  
4. If none → downgrade Fact status to `weak` / `partial` / `hallucinated` per policy  

## Topic Builder

Cluster entities + facts into Topic nodes; `belongsTo` / `supports` intents.

## Coverage Projection (consumer — not an extractor)

Helpers that **project** CCM → checklist UI live under `coverage_projection` (`06`). Not a compiler engine.

## Cost classes & budgets

| Engine | Default cost | LLM allowed |
|--------|--------------|-------------|
| Entity | ner/hybrid | disambiguation only |
| Fact | hybrid | normalize + hard cases |
| Relation | hybrid | uncertain edges |
| Intent | hybrid | tree refine |
| Question | heuristic→hybrid | paraphrase merge |
| Evidence | heuristic | rare |

CompileBudget enforces max LLM calls; overflow → `compiler.partial` + lower confidence, not silent skip of Validator.
