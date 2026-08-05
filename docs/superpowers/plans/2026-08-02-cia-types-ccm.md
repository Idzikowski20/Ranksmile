# CIA Types CCM Implementation Plan (rev. Chief Architect)

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development** (preferred). Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Do not** ship as one mega-PR — see PR split below.

**Goal:** Ship frozen RFC v1.0 TypeScript contracts for CCM / IR / KG / ActionGraph / Recommendation DSL, plus empty factory, validated indexes, canonical deterministicHash, zod parse, golden snapshot — zero extraction/LLM/HTML.

**Architecture:** Types under `lib/ccm/types/**` contain **no business logic** (ADR-040) — only types, type guards, and branded aliases. Factories/validators/hash/indexes live outside `types/`. Empty builders stub the future compiler layout.

**Tech Stack:** TypeScript (no `any`), Jest, Node `crypto`, **zod** (already in package.json), `lib/cia` arch tests must stay green.

**Spec:** RFC `01`–`03`, `11`, `13`, `15`, `20`, ADR-040, `FREEZE.md` Etap 5.

**Execution preference:** Subagent-Driven Development.

---

## PR split (mandatory)

| PR | Contents | Why |
|----|----------|-----|
| **PR1** | `status` + `ast` (+ tests) | Stable surface |
| **PR2** | `ir` (+ tests) | Most volatile — isolate churn |
| **PR3** | graph/reasoning/slices/compilerMeta/ccm envelope | Core snapshot |
| **PR4** | ActionGraph + Recommendation DSL (VOs) | End-shape before factory |
| **PR5** | `buildIndexes` (ReadonlyMap + validate) + `deterministicHash` (canonical JSON) + `emptyCcm` (required `compiledAt`) | Runtime helpers |
| **PR6** | `serialize`/`parseCcm` (zod) + golden snapshot + empty `builders/*` + docs | Close the loop |

Do **not** merge PR5+PR6 before PR4 (ActionGraph visible early).

---

## Task order (revised)

```text
Task 1a  status + ast          → PR1
Task 1b  IR                    → PR2
Task 2   CCM envelope + graph  → PR3
Task 5   ActionGraph + DSL VOs → PR4
Task 3   indexes + hash + emptyCcm → PR5
Task 4   serialize/zod + golden + builders stubs → PR6
Task 6   docs / FREEZE pointer
```

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/ccm/types/**` | Types / branded IDs / type guards only (ADR-040) |
| `lib/ccm/canonicalJson.ts` | Sorted-key JSON stringify |
| `lib/ccm/deterministicHash.ts` | sha256(canonicalJson(inputs)) |
| `lib/ccm/buildIndexes.ts` | ReadonlyMap indexes + integrity throws |
| `lib/ccm/emptyCcm.ts` | Factory; **`compiledAt` required** (no `new Date()`) |
| `lib/ccm/serialize.ts` | serialize + zod `parseCcm` |
| `lib/ccm/builders/entityBuilder.ts` | `buildEntityNodes(ir) => []` |
| `lib/ccm/builders/factBuilder.ts` | `buildFactNodes(ir) => []` |
| `lib/ccm/builders/intentBuilder.ts` | `buildIntentNodes(ir) => []` |
| `lib/ccm/ccmSchema.ts` | zod schema(s) for parse |
| `__tests__/lib/ccm/*.test.ts` | unit + golden |
| `__tests__/lib/ccm/__snapshots__/` | golden empty CCM |

**Out of scope:** PassManager, real extractors, GraphQuery, DB, adapter, AO.

---

### ADR-040 (add to RFC before coding)

**No business logic inside `lib/ccm/types`.**  
Allowed: type aliases, interfaces, unions, branded types, type guards (`isFactNode`).  
Forbidden: hash, index build, validation throws, factories, zod schemas (schemas live in `lib/ccm/ccmSchema.ts`).

---

### Task 1a: status + ast (PR1)

**Files:**
- Create: `lib/ccm/types/status.ts`
- Create: `lib/ccm/types/ast.ts`
- Create: `__tests__/lib/ccm/astStatus.test.ts`

- [ ] **Step 1: Failing test** — minimal `LexicalAst` / `SemanticAst` / `CoverageStatus` assignability (same as prior plan Task 1, without IR).

- [ ] **Step 2: Implement status.ts + ast.ts** — fields per RFC (no functions).

- [ ] **Step 3:** `npx jest __tests__/lib/ccm/astStatus.test.ts --ci` → PASS

- [ ] **Step 4: Commit** (if user asked) — `feat(ccm): status and AST types (PR1)`

---

### Task 1b: IR (PR2)

**Files:**
- Create: `lib/ccm/types/ir.ts`
- Create: `__tests__/lib/ccm/ir.test.ts`

- [ ] **Step 1: Failing test** — empty `ContentIr` + one `FactCandidate` discriminant.

- [ ] **Step 2: Implement ir.ts** — `SemanticCandidate` union per RFC 15 (no functions).

- [ ] **Step 3:** jest PASS

- [ ] **Step 4: Commit** — `feat(ccm): IR SemanticCandidate types (PR2)`

---

### Task 2: Graph + envelope (PR3)

**Files:**
- Create: `lib/ccm/types/graph.ts` — **GraphIndexes uses `ReadonlyMap`**, not `Record`:

```ts
export interface GraphIndexes {
  readonly byId: ReadonlyMap<string, KgNode>;
  readonly entityByCanonical: ReadonlyMap<string, string>;
  readonly factsByEntityId: ReadonlyMap<string, readonly string[]>;
  readonly factsByIntentId: ReadonlyMap<string, readonly string[]>;
  readonly questionsByIntentId: ReadonlyMap<string, readonly string[]>;
  readonly intentsByParentId: ReadonlyMap<string, readonly string[]>;
  readonly evidenceByFactId: ReadonlyMap<string, readonly string[]>;
  readonly edgesByFrom: ReadonlyMap<string, readonly string[]>;
  readonly edgesByTo: ReadonlyMap<string, readonly string[]>;
  readonly edgesByType: ReadonlyMap<string, readonly string[]>;
}
```

Note: JSON serialize will convert Maps via replacer in Task 4 (see serialize).

- Create: `reasoning.ts`, `slices.ts`, `compilerMeta.ts` (**include `compilerId: string`**, e.g. `"cia-v1"`), `ccm.ts`, `types/index.ts`
- Test: envelope `schemaVersion` / `immutable` / `compilerId`

- [ ] **Steps:** TDD as before → PASS → commit `feat(ccm): CCM envelope and ReadonlyMap GraphIndexes (PR3)`

**compilerMeta must include:**

```ts
readonly compilerId: string; // e.g. 'cia-v1'
```

---

### Task 5: ActionGraph + Recommendation DSL with Value Objects (PR4)

**Files:**
- Create: `lib/ccm/types/ids.ts` — branded IDs
- Create: `lib/ccm/types/recommendationDsl.ts`
- Create: `lib/ccm/types/actionGraph.ts`

```ts
// ids.ts — types only + constructors as type-guard style factories MAY live in lib/ccm/ids.ts (outside types/)
export type SubjectId = string & { readonly __brand: 'SubjectId' };
export type PredicateId = string & { readonly __brand: 'PredicateId' };
export type ObjectId = string & { readonly __brand: 'ObjectId' };
```

Branded constructors (`asSubjectId`) live in **`lib/ccm/ids.ts`** (not under `types/`) per ADR-040.

```ts
// recommendationDsl — ADD_FACT uses SubjectId / PredicateId / ObjectId
readonly fact: {
  readonly subject: SubjectId;
  readonly predicate: PredicateId;
  readonly object: ObjectId;
  readonly statement: string;
};
```

```ts
export interface ActionGraph {
  readonly schemaVersion: 1;
  readonly immutable: true;
  readonly fromCcmVersion: number;
  readonly contentHash: string;
  /** Hash of knowledge.graph identity (nodes+edges canonical) at build time */
  readonly fromKnowledgeGraphHash: string;
  readonly builtAt: string;
  readonly actions: readonly EditAction[];
  readonly roots: readonly string[];
}
```

- [ ] **Tests:** branded fact op + ActionGraph with `fromKnowledgeGraphHash`
- [ ] **Commit:** `feat(ccm): ActionGraph + branded Recommendation DSL (PR4)`

---

### Task 3: indexes + canonical hash + emptyCcm (PR5)

**Files:**
- Create: `lib/ccm/canonicalJson.ts`
- Create: `lib/ccm/deterministicHash.ts`
- Create: `lib/ccm/buildIndexes.ts`
- Create: `lib/ccm/emptyCcm.ts`
- Create: `__tests__/lib/ccm/emptyCcm.test.ts`

#### Canonical JSON (mandatory)

```ts
/** Deterministic JSON: sorted object keys recursively. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    // Map → sorted entries object for hashing only
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const k of [...value.keys()].sort()) {
        obj[String(k)] = sortKeys(value.get(k));
      }
      return obj;
    }
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return value;
}
```

```ts
export function computeDeterministicHash(input: DeterministicHashInput): string {
  return createHash('sha256').update(canonicalJsonStringify(input)).digest('hex');
}
```

**Test:** `{a:1,b:2}` and `{b:2,a:1}` → **same** hash.

#### buildGraphIndexes — ReadonlyMap + validate

```ts
export function buildGraphIndexes(
  nodes: readonly KgNode[],
  edges: readonly KgEdge[],
): GraphIndexes {
  // build Maps…
  // THEN validate or throw:
  // - duplicate entity canonicalName
  // - edge.from / edge.to missing from byId
  // - evidence_span not targeted by any supportedBy → throw ('orphan evidence')
  return freezeMaps(...);
}
```

Empty graph: validation passes (no orphans).

**Test:** edge to missing node throws; duplicate canonical throws; orphan evidence_span throws.

#### createEmptyCcm — no wall clock

```ts
export type EmptyCcmOpts = {
  readonly articleId: string;
  readonly contentHash: string;
  readonly compiledAt: string; // REQUIRED ISO — caller/clock supplies
  readonly profile?: ContentProfileId;
  readonly ccmId?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly compilerId?: string; // default 'cia-v1'
};
```

**Forbidden:** `new Date()` inside `emptyCcm.ts`.

- [ ] **Commit:** `feat(ccm): validated indexes, canonical hash, emptyCcm (PR5)`

---

### Task 4: serialize + zod + golden + builders (PR6)

**Files:**
- Create: `lib/ccm/ccmSchema.ts` — zod schema for CCM v1 (Maps: represent as arrays of entries in wire format OR custom preprocess)
- Create: `lib/ccm/serialize.ts`
- Create: `lib/ccm/builders/entityBuilder.ts`, `factBuilder.ts`, `intentBuilder.ts`
- Create: `__tests__/lib/ccm/serialize.test.ts`
- Golden: `__tests__/lib/ccm/__snapshots__/empty-ccm.snap.md` or jest snapshot

#### Wire format for Maps

On serialize, convert each `ReadonlyMap` to `ReadonlyArray<readonly [string, V]>` sorted by key (or object). On parse, rebuild `ReadonlyMap`. Document in serialize.ts header.

#### zod

Use existing `zod` — `ccmSchema.safeParse` in `parseCcm`; return `null` on failure (or `Result` — prefer null to match plan simplicity).

#### Golden snapshot

```ts
it('empty CCM golden snapshot', () => {
  const ccm = createEmptyCcm({
    articleId: '0',
    contentHash: '0'.repeat(64),
    compiledAt: '2026-08-02T00:00:00.000Z',
    ccmId: 'ccm_golden',
    version: 1,
    profile: 'generic',
  });
  expect(serializeCcm(ccm)).toMatchSnapshot();
});
```

Any model shape change → intentional snapshot update.

#### Empty builders

```ts
// lib/ccm/builders/factBuilder.ts
import type { ContentIr } from '../types/ir';
import type { FactNode } from '../types/graph';

export function buildFactNodes(_ir: ContentIr): readonly FactNode[] {
  return [];
}
```

Same for entity/intent. Export from `lib/ccm/builders/index.ts`.

- [ ] **Also:** `npm run test:arch` PASS
- [ ] **Commit:** `feat(ccm): zod parse, golden snapshot, empty builders (PR6)`

---

### Task 6: Docs

- [ ] Update RFC `01` GraphIndexes to `ReadonlyMap` + note wire format
- [ ] Update RFC `13` / compilerMeta: `compilerId`
- [ ] Append **ADR-040** to `09-adr.md`
- [ ] Update RFC `11` ActionGraph: `fromKnowledgeGraphHash`
- [ ] FREEZE Etap 5 DONE after PR6 merges
- [ ] Point `01` code path → `lib/ccm/`

---

## Self-review (Chief Architect checklist)

| Feedback | Plan response |
|----------|----------------|
| Split PRs / IR separate | PR1–PR2 split |
| Canonical hash | `canonicalJsonStringify` |
| ReadonlyMap indexes | GraphIndexes Maps |
| Index validation throws | `buildGraphIndexes` |
| No `new Date()` | required `compiledAt` |
| Stronger parse | zod `ccmSchema` |
| DSL value objects | branded SubjectId/… |
| ActionGraph knowledge hash | `fromKnowledgeGraphHash` |
| Empty builders | `lib/ccm/builders/*` |
| compilerId | in CompilerMetadata |
| Golden snapshot | jest snapshot |
| No logic in types | ADR-040 |
| Task order 1→2→5→3→4 | revised order |
| Subagent-Driven | required in header |

---

## Execution handoff

Plan ready after ADR-040 is written into RFC (Task 6 can land ADR first in a docs-only commit).

**Recommended:** Subagent-Driven, **PR1 → PR6** as above.

Reply `go` / `1` to start Subagent-Driven implementation, or `2` for inline.
