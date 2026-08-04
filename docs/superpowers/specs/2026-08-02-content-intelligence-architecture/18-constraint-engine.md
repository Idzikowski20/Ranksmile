# 18 — Constraint Engine (Graph Validation)

Validator is not a single catch-all. **Graph constraints** are a dedicated module.

## Constraint

```ts
export interface GraphConstraint {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  readonly description: string;
  check(q: GraphQuery, model: CanonicalContentModel): readonly ConstraintViolation[];
}

export interface ConstraintViolation {
  readonly constraintId: string;
  readonly nodeIds: readonly string[];
  readonly message: string;
  readonly severity: 'error' | 'warning';
}
```

## v1 constraint set (examples)

| id | Rule |
|----|------|
| `fact_has_anchor` | Fact MUST have Entity (`uses`) OR non-empty `subject` |
| `question_has_intent` | Question MUST link to Intent (`answers`/`answeredBy` path) |
| `fact_not_orphan` | Covered/partial Fact MUST have `statedIn` or `supportedBy` |
| `evidence_has_fact` | EvidenceSpan MUST be target of `supportedBy` |
| `intent_tree_acyclic` | `parentOf` Intent edges form a DAG |
| `no_dangling_edge` | Edge endpoints exist in indexes |
| `duplicate_cluster` | `duplicates` edges resolve to one primary |

## Placement

```text
PassManager → Constraint Engine → (errors → partial / strip) → Index finalize → CCM Snapshot
```

Constraints use **GraphQuery** (`19-graph-query.md`), never raw index maps.

**Code:** `lib/ccm/constraintEngine.ts` — `runConstraints` / `applyConstraintStrip` (wired after assemble in `compile()`).
