# Coverage Engine v3 — Design Spec

> **SUPERSEDED (2026-08-02):** Ten dokument był foundation pod Coverage-as-SoT. Zastąpiony przez **Content Intelligence Architecture** (Content Compiler + Canonical Knowledge Base). Coverage jest konsumentem CKB, nie centrum. → [`2026-08-02-content-intelligence-architecture/`](./2026-08-02-content-intelligence-architecture/README.md)

**Status:** Superseded  
**Date:** 2026-08-02  
**Goal question (legacy):** *Czy ten artykuł kompletnie odpowiada na intencję użytkownika?*

## 1. Problem

Ranksmile dziś ma trzy tory analizy artykułu, które częściowo się dublują:

| Tor | Persist / entry | Problem |
| --- | --- | --- |
| Graded AI Search | `articles.ai_info_to_cover` (`CoverageSnapshot` v1) | Flat checklist; `parentId` / `relatedIds` nieużywane |
| Pipeline Coverage Engine | `lib/engines/coverageEngine.ts` | Osobna materializacja TERM/CONCEPT — nie SoT |
| WIE / Editorial Judge | `competitor_synthesis` + LLM re-read | String brief; osobna ekstrakcja |

Surfer (artykuł gold „wojna hybrydowa”, SEO ~96, AI Visibility covered) nie optymalizuje keyword stuffing — optymalizuje **facts + entities + intent + structure**. Keywordi są warstwą wejściową.

## 2. Non-goals

- Kopiowanie GraphQL / Apollo / Phoenix Surfera
- Kopiowanie wag `AioScoreWeights` 1:1
- Big-bang rewrite AO / WIE w jednym PR
- Keyword density jako główny score

## 3. Filozofia: compiler, nie analyzer

```text
Article HTML/plain
      │
      ▼
Coverage Engine v3  (compile — raz na snapshot)
      │
      ▼
Canonical Knowledge Graph  (SoT)
      ├── Auto Optimize Planner
      ├── Judge / Regression (KgDiff)
      ├── AI Visibility UI (FactNode.status)
      ├── Writing Intelligence
      ├── Benchmark / History
      └── live presence (tanie, bez LLM)
```

- **Compile** = pełna ekstrakcja + grading → CKG.
- **Query** = konsumenci czytają graf.
- **Invalidate** = `contentHash` / `compileVersion` / ręczny recompile.
- Score **nie** jest liczony „w środku” silników jako produkt końcowy — Aggregator na końcu.

## 4. Założenia zamknięte

1. CKG = jedyne źródło prawdy dla faktów/encji/intencji po compile.
2. Ewolucja z `CoverageSnapshot` `schemaVersion: 1` → envelope `schemaVersion: 2` (jeden JSON w `ai_info_to_cover` albo później osobna kolumna — preferencja v3.0: **jeden envelope, gate na schemaVersion**).
3. MVP silników v3.0: Structure, Intent, Topic, Entity, Fact, Question, Evidence, Aggregator.
4. v3.1: Relation, Citation, Freshness, Contradiction, Redundancy (typy edge zarezerwowane już w v3.0).
5. SEO (`scoreArticleHtml`) zostaje osobnym scorerm; Content Score v3 ≠ SEO.
6. Gold acceptance: fixture `docs/fixtures/coverage-v3-wojna-hybrydowa.md`.

## 5. Model danych (kanon TypeScript)

```ts
export type KgSchemaVersion = 2;

export type CoverageStatus = 'covered' | 'partial' | 'missing' | 'hallucinated';
export type Importance = 'critical' | 'recommended' | 'optional';

export type KgEdgeType =
  | 'covers'
  | 'contains'
  | 'mentions'
  | 'supports'
  | 'answers'
  | 'related'
  | 'contradicts'
  | 'same_as';

export type KgNodeKind =
  | 'intent'
  | 'topic'
  | 'entity'
  | 'fact'
  | 'question'
  | 'evidence'
  | 'section'
  | 'citation';

export interface KgRecommendation {
  readonly nodeId: string;
  readonly action: string;
  readonly sectionHint?: string;
  readonly expectedImpact: number; // 0..1
  readonly severity: 'low' | 'medium' | 'high';
}

export interface EngineTrace {
  readonly engine: string;
  readonly version: string;
  readonly costClass: 'heuristic' | 'llm' | 'hybrid';
  readonly durationMs?: number;
  readonly notes?: readonly string[];
}

export interface EngineResult<T> {
  readonly score: number;          // 0..100
  readonly confidence: number;     // 0..1
  readonly covered: readonly string[];
  readonly missing: readonly string[];
  readonly recommendations: readonly KgRecommendation[];
  readonly trace: EngineTrace;
  readonly data: T;
}

export interface KgNodeBase {
  readonly id: string;
  readonly kind: KgNodeKind;
  readonly label: string;
  readonly importance: Importance;
  readonly status: CoverageStatus;
  readonly confidence: number;
  readonly sectionId?: string;
}

export interface IntentNode extends KgNodeBase {
  readonly kind: 'intent';
  readonly primary: boolean;
}

export interface TopicNode extends KgNodeBase {
  readonly kind: 'topic';
  readonly cluster?: string;
}

export interface EntityNode extends KgNodeBase {
  readonly kind: 'entity';
  readonly aliases: readonly string[];
  readonly entityType?: string;
  readonly mentionCount: number;
}

export interface FactNode extends KgNodeBase {
  readonly kind: 'fact';
  readonly statement: string;
  readonly entityIds: readonly string[];
  readonly predicate?: string;
  readonly timeAnchor?: string;
  readonly verified: boolean;
}

export interface QuestionNode extends KgNodeBase {
  readonly kind: 'question';
  readonly question: string;
}

export interface EvidenceNode extends KgNodeBase {
  readonly kind: 'evidence';
  readonly factId: string;
  readonly evidenceKind: 'example' | 'date' | 'number' | 'source' | 'context';
  readonly snippet: string;
}

export interface SectionNode extends KgNodeBase {
  readonly kind: 'section';
  readonly headingLevel: 1 | 2 | 3 | 4;
  readonly order: number;
}

export interface CitationNode extends KgNodeBase {
  readonly kind: 'citation';
  readonly url?: string;
  readonly authority?: number;
}

export type KgNode =
  | IntentNode
  | TopicNode
  | EntityNode
  | FactNode
  | QuestionNode
  | EvidenceNode
  | SectionNode
  | CitationNode;

export interface KgEdge {
  readonly id: string;
  readonly type: KgEdgeType;
  readonly from: string;
  readonly to: string;
  readonly predicate?: string;
  readonly confidence: number;
}

export interface ComponentScore {
  readonly key: string;
  readonly weight: number;
  readonly score: number;
  readonly explain: readonly string[];
  readonly missing: readonly string[];
  readonly fixHints: readonly KgRecommendation[];
}

export interface ContentScoreV3 {
  readonly overall: number;
  readonly components: readonly ComponentScore[];
}

export interface KnowledgeGraph {
  readonly schemaVersion: KgSchemaVersion;
  readonly contentHash: string;
  readonly compileVersion: string;
  readonly compiledAt: string;
  readonly nodes: readonly KgNode[];
  readonly edges: readonly KgEdge[];
  readonly metrics: ContentScoreV3;
  /** Legacy bridge for UI that still reads buckets/items */
  readonly legacySnapshot?: {
    readonly schemaVersion: 1;
    readonly overall: number;
    readonly items: readonly unknown[];
    readonly buckets: readonly unknown[];
  };
}

export interface KgDiff {
  readonly addedNodeIds: readonly string[];
  readonly removedNodeIds: readonly string[];
  readonly statusFlips: readonly { id: string; from: CoverageStatus; to: CoverageStatus }[];
  readonly scoreDelta: number;
}
```

### Mapowanie z `CoverageItem` (v1 → v2)

| CoverageType | KgNode |
| --- | --- |
| `fact` / `statistic` / `example` | `FactNode` (+ opcjonalnie `EvidenceNode`) |
| `entity` / `term` / `concept` | `EntityNode` / `TopicNode` |
| `question` / `paa` | `QuestionNode` |
| `intent` / `definition` / `process` | `IntentNode` (+ Topic) |
| `structure` / `readability` | sygnał Structure Engine → `SectionNode` gaps |

Status: `covered && quality >= 3` → `covered`; `covered && quality < 3` → `partial`; `!covered` → `missing`.

## 6. Compile DAG (v3.0)

```text
Structure → Intent → Topic → Entity → Fact → Question → Evidence → Aggregator
```

Każdy silnik: pure względem side-effectów DB; input = plain + brief + dotychczasowe nodes/edges; output = `EngineResult`.

| Engine | Cost | Input extras | Output nodes |
| --- | --- | --- | --- |
| Structure | heuristic | HTML headings | SectionNode |
| Intent | hybrid | SERP / synthesis | IntentNode |
| Topic | hybrid | harvest topics | TopicNode |
| Entity | hybrid | NER + terms | EntityNode |
| Fact | llm/hybrid | AI Visibility shape | FactNode |
| Question | hybrid | PAA | QuestionNode |
| Evidence | heuristic | fact sections | EvidenceNode |
| Aggregator | heuristic | all | ContentScoreV3 |

## 7. Aggregator — Content Score v3.0

| Component | Weight |
| --- | --- |
| Fact Coverage | 0.30 |
| Intent Coverage | 0.20 |
| Entity Coverage | 0.15 |
| Question Coverage | 0.10 |
| Evidence Coverage | 0.10 |
| Structure | 0.10 |
| Topic Coverage | 0.05 |

`overall = round(sum(weight_i * score_i))` capped 0..100.

Component score = importance-weighted fraction of nodes with `status === 'covered'` (partial = 0.5).

## 8. Konsumenci

| Konsument | Czyta | Zakaz |
| --- | --- | --- |
| AO Planner | missing Facts/Intents/Questions + Structure | pełny re-harvest per pass |
| Judge | Kg before/after + KgDiff | własna ekstrakcja faktów z HTML |
| AI Visibility UI | FactNode.status | osobna lista LLM bez grafu |
| WIE Writer | Intent + critical Facts + Entity | tylko luźny string synthesis bez mapowania |
| Eval suite | Content Score + Fact coverage | editorial bez reconciliacji do CKG |

AO już ma wzorzec: `buildArticleContext` + `liveCoverageItems` — rozszerzyć na CKG presence.

## 9. Gold acceptance

Fixture: `docs/fixtures/coverage-v3-wojna-hybrydowa.md`

- ≥ 28 AI Visibility statements mapowalnych 1:1 na `FactNode`
- Surfer terms → Entity/Topic signals
- Po pełnym compile (późniejsza faza): Fact coverage ≥ 95%, Intent ≥ 90%, Content Score ≥ 90 na gold HTML

## 10. Migracja (roadmap)

1. Spec + fixture + public doc freeze  
2. Types + `coverageSnapshotToKg` + Aggregator (pure) + tests  
3. Compile MVP (Fact/Intent/Entity) + persist schemaVersion 2  
4. Wire AO Planner do missing nodes  
5. Pipeline `runCoverageEngine` → materializer wejściowy, nie osobny SoT  
6. v3.1 Contradiction / Redundancy / Citation / Freshness  

## 11. Surfer

Zob. `docs/surferseo-re-critique.md`. Bierzemy zasadę facts-first + explainable weights, nie stack Surfera.
