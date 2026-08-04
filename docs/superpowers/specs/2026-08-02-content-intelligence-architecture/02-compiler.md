# 02 — Content Compiler

**Code:** `lib/compiler/` (`compile()`, lexer/parser, PassManager skeleton, empty builders).

## Mission

```text
HTML | Markdown | TipTap JSON
        │
        ▼
 Lexer → Parser → Normalizer
        │
        ▼
 Lexical AST → Semantic AST → IR Builder (15)
        │
        ▼
 PassManager (17)  — EntityPass, FactPass, IntentPass, RelationPass, EvidencePass, + profile passes
        │
        ▼
 Constraint Engine (18)
        │
        ▼
 Index Builder → Reasoning Graph (confidence propagation) → Aggregator
        │
        ▼
 CCM Snapshot (immutable) + CompilerMetadata (capabilities, deterministicHash)
```

Analogy: Lexical/Semantic AST ≈ frontend IR; **Content IR ≈ MIR**; CCM ≈ object code + debug info.

## AST + IR

Lexical/Semantic AST contracts: remain as in v0.2 (`AstBlock`, `ClaimCandidate`, …).  
IR: **`15-ir.md`**. IR is persisted on CCM (`ccm.ir`) for incremental recompile and debugging.

## Capability Registry

```ts
export interface CompilerCapabilities {
  readonly incremental: boolean;
  readonly wikidata: boolean;
  readonly embeddings: boolean;
  readonly citations: boolean;
  readonly reasoning: boolean;
  readonly planner: boolean;          // Action Graph materialization available
  readonly ir: boolean;               // always true for non-adapter compiles
}

// On CompilerMetadata:
// capabilities: CompilerCapabilities
```

Consumers:

```ts
if (!ctx.model.compiler.capabilities.reasoning) {
  // degrade explainability UI / skip reasoning-dependent paths
}
```

## deterministicHash

See `13-compiler-metadata.md`. Hash over AST + rules + prompts + profile (+ IR version) so History/Judge/Benchmark detect **identical compiles**.

## Compile modes

| Mode | Behavior |
|------|----------|
| `full` | Full pipeline |
| `incremental` | Dirty blocks → IR patch → builders → indexes → CCM vN+1 via **dependency graph** |
| `adapter` | Lossy v1→CCM; `capabilities` mostly false; **migration/tests only** |

## Incremental + Dependency Graph

```text
Paragraph/block dirty
    → Dependency Graph (block → facts → intents → coverage/actions)
    → recompute only affected IR candidates + KG nodes
    → rebuild indexes subset
    → notify consumers
```

Runtime detail: `07-runtime.md`.

## Stage / budget contracts

Unchanged: `CompileContext` gains `dirtyBlockIds`; builders take `ContentIr`.  
Output always: `ast`, `semanticAst`, `ir`, `knowledge.graph`, `knowledge.indexes`, `reasoning`, `compiler`.
