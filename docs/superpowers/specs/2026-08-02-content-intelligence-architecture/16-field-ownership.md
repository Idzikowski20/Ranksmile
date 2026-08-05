# 16 — Field Ownership (freeze rule)

## Rule (freeze gate)

**No field without owner, producer, and consumer.**

Every field on CCM, IR, Action Graph, ConsumerResult, and CompilerMetadata must be listed in a registry (spreadsheet or `docs/.../field-registry.md` generated later) with:

| Column | Meaning |
|--------|---------|
| `path` | e.g. `ccm.knowledge.indexes.factsByEntityId` |
| `owner` | Team/module accountable for meaning |
| `producer` | Compiler stage or builder that writes it |
| `consumers` | Who reads it (Coverage Projection, Judge, …) |
| `invariant` | One-line validity rule |
| `nullable` | When null/absent allowed |

## Why

Prevents “martwe pola” that rot for a year and block refactors.

## Freeze checklist addendum

- [ ] Field registry exists for CCM v1 envelope  
- [ ] No orphan experimental fields in persisted CCM  
- [ ] `legacy.*` marked consumers = migration UI only  

## Example rows

| path | owner | producer | consumers | invariant |
|------|-------|----------|-----------|-----------|
| `ccm.ir` | compiler | IR Builder | all knowledge builders | present iff not adapter-or-documented |
| `ccm.knowledge.indexes` | compiler | Graph Builder | Planner, Bench, Judge | consistent with graph |
| `ccm.reasoning` | compiler | Reasoning Builder | UI explain, WIE | DAG acyclic |
| `ccm.compiler.deterministicHash` | compiler | Metadata | History, Judge, Bench | stable for identical inputs |
| `ccm.legacy` | migration | adapter | old Coverage UI only | null after cutover |
