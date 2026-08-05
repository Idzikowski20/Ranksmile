# 03 — Graph Model

## Principle

**Graph, not collection.** If you cannot traverse Fact → Entity → Topic → Intent → Question, the compile is incomplete.

## Coverage status (rich)

```ts
export type CoverageStatus =
  | 'covered'
  | 'partial'
  | 'missing'
  | 'conflicting'
  | 'hallucinated'
  | 'outdated'
  | 'duplicate'
  | 'weak';
```

| Status | Meaning |
|--------|---------|
| covered | Present with adequate evidence/quality |
| partial | Present but thin / incomplete evidence |
| missing | Required by intent/serp but absent |
| conflicting | Contradicts another fact in-graph |
| hallucinated | Asserted without support; fails verification |
| outdated | Time-sensitive fact past freshness policy |
| duplicate | Same knowledge as another fact (merge candidate) |
| weak | Present but low confidence / soft evidence |

## Edge types (v1 required)

```ts
export type KgEdgeType =
  | 'uses'          // Fact → Entity
  | 'belongsTo'     // Entity → Topic
  | 'supports'      // Topic|Fact → Intent
  | 'answers'       // Intent|Fact|Section → Question
  | 'supportedBy'   // Fact → EvidenceSpan
  | 'statedIn'      // Fact → Section
  | 'references'    // Fact|Section → Citation
  | 'causes'        // Fact → Fact
  | 'mentions'      // Section → Entity
  | 'contradicts'   // Fact → Fact
  | 'duplicates'    // Fact → Fact
  | 'derivedFrom'   // Fact → Fact|Source
  | 'relatedTo'     // Node → Node (weak)
  | 'sameAs'        // Entity → Entity
  | 'parentOf'      // Intent → Intent (tree)
  | 'answeredBy';   // Question → Fact|Section (inverse convenience)
```

Prefer storing one direction + optional inverse index at query time. `answeredBy` may be materialized for Planner speed.

## Node kinds

### FactNode (RDF-lite)

```ts
export interface FactNode {
  readonly id: string;
  readonly kind: 'fact';
  readonly statement: string;       // surface form (AI Visibility style)
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly entityIds: readonly string[];
  readonly time?: string;           // ISO or year/month textual anchor
  readonly location?: string;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
  readonly verification: FactVerification;
  readonly sectionId?: string;
}

export type FactVerification =
  | 'verified'                 // evidence + cross-check ok
  | 'asserted'                 // in text, evidence weak/absent
  | 'inferred'                 // compiler inference
  | 'rejected';                // hallucinated / invalid
```

### EntityNode

```ts
export interface EntityNode {
  readonly id: string;
  readonly kind: 'entity';
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly wikidataId?: string;
  readonly entityType?: string;     // person|org|place|concept|event|…
  readonly mentionCount: number;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}
```

### IntentNode (tree)

```ts
export interface IntentNode {
  readonly id: string;
  readonly kind: 'intent';
  readonly label: string;
  readonly userGoal: string;
  readonly queryVariants: readonly string[];
  readonly priority: number;        // 0..1
  readonly parentId?: string;
  readonly childIds: readonly string[];
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
  readonly primary: boolean;
}
```

### QuestionNode

```ts
export interface QuestionNode {
  readonly id: string;
  readonly kind: 'question';
  readonly question: string;
  readonly answeredByFactIds: readonly string[];
  readonly answeredBySectionIds: readonly string[];
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}
```

### TopicNode / SectionNode / CitationNode

Unchanged in role from foundation design; Topic clusters entities; Section is structural anchor with `blockId` from Lexical AST; Citation is external reference record (may mirror `references` index).

### EvidenceSpan (not a scoring peer)

```ts
export interface EvidenceSpanNode {
  readonly id: string;
  readonly kind: 'evidence_span';
  readonly blockId: string;         // Lexical AST anchor
  readonly startOffset: number;
  readonly endOffset: number;
  readonly snippet: string;
  readonly evidenceKind: 'example' | 'date' | 'number' | 'quote' | 'context';
  readonly confidence: number;
  readonly status: CoverageStatus;  // usually covered if span exists
}
```

Evidence participates via **`supportedBy`**, not via Aggregator “evidence bucket of orphan nodes”.

## Canonical traversal examples

**Why is Intent I uncovered?**

```text
Intent(I) <-supports- Topic(T) <-belongsTo- Entity(E) <-uses- Fact(F) -supportedBy-> Evidence
```

If path breaks at Fact missing → recommendation: add Fact with SPO; if Fact exists without Evidence → strengthen section.

**AI Visibility projection**

```text
Fact[] where status in (covered, partial) → atomic statements list
```

## Id stability

- Entity: `ent:` + slug(canonicalName) or wikidata id  
- Fact: `fact:` + hash(normalize(subject|predicate|object|time?))  
- Intent: `intent:` + slug(label)  
- Question: `q:` + hash(normalize(question))

## Anti-patterns

- Storing evidence text only on Fact without span edges  
- `contains` as the only edge type  
- Status `covered` without verification policy  
- Intent as flat list with no `parentOf` / priority  
