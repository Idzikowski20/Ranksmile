# Coverage Engine v3 Implementation Plan

> **SUPERSEDED (2026-08-02):** Nie wdrażać. Model przesunięty z „Coverage → Snapshot → Score” na **Content Compiler → Canonical Knowledge Base**. SoT architektury: [`docs/superpowers/specs/2026-08-02-content-intelligence-architecture/`](../specs/2026-08-02-content-intelligence-architecture/README.md). Ten plik zostaje tylko jako historyczny szkic foundation (adapter/pure fn) — do ewentualnego wykorzystania *po* akceptacji RFC, po dostosowaniu typów do CKB.

> **For agentic workers:** DO NOT execute this plan. Read the Content Intelligence Architecture RFC first.

**Goal (obsolete):** Zamrozić SoT Coverage Engine v3 (design + gold fixture + public doc) i dostarczyć działający, testowalny foundation: typy CKG, adapter `CoverageSnapshot`→`KnowledgeGraph`, Aggregator Content Score — bez pełnego LLM compile i bez rewrite AO.

**Architecture:** Coverage Engine v3 to compiler budujący Canonical Knowledge Graph. Ten plan dostarcza warstwę typów + pure adapter/aggregator jako most z istniejącego `ai_info_to_cover` (schemaVersion 1). Pełny compile DAG i wire AO to osobne plany po akceptacji tego foundation.

**Tech Stack:** TypeScript (strict, no `any`), Jest, istniejące `lib/aiCoverage.ts` / `lib/coverageStore.ts`, docs w `docs/superpowers/` + `docs/`.

**Spec:** `docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md` | Design SoT (już napisany — weryfikacja) |
| `docs/fixtures/coverage-v3-wojna-hybrydowa.md` | Gold: terms + 28 AI Visibility facts + intent H2 |
| `docs/coverage-engine-v3.md` | Publiczny pointer + skrót dla zespołu |
| `lib/types/knowledgeGraph.ts` | Typy CKG + wagi Aggregatora |
| `lib/coverage/coverageSnapshotToKg.ts` | Adapter v1 → KnowledgeGraph |
| `lib/coverage/aggregateContentScore.ts` | Pure Content Score v3 |
| `lib/coverage/kgDiff.ts` | Diff dwóch grafów |
| `__tests__/lib/coverage/knowledgeGraph.test.ts` | TDD: adapter, score, diff, gold fact ids |
| `docs/architecture-content-editor-flow-report.md` | Cross-link do v3 |

**Out of scope this plan:** LLM Fact Engine, persist schemaVersion 2 w DB, AO Planner wire, Contradiction/Citation engines.

---

### Task 1: Verify design spec exists

**Files:**
- Read: `docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md`

- [ ] **Step 1: Confirm design file is present and has sections 1–11**

Run: `Test-Path docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md`

Expected: `True`

- [ ] **Step 2: Confirm required headings**

Run:

```powershell
Select-String -Path docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md -Pattern '^## '
```

Expected: headings include Problem, Non-goals, Filozofia, Model danych, Compile DAG, Aggregator, Konsumenci, Gold, Migracja.

- [ ] **Step 3: No commit required** (spec already on disk; commit only if user asks later)

---

### Task 2: Gold fixture — wojna hybrydowa

**Files:**
- Create: `docs/fixtures/coverage-v3-wojna-hybrydowa.md`

- [ ] **Step 1: Write the fixture file**

```markdown
# Gold fixture — wojna hybrydowa (Surfer ~96 SEO / AI Visibility covered)

Źródło: artykuł SurferSEO + lista Terms + AI Visibility (covered).  
Użycie: acceptance adaptera/Fact Engine; kalibracja wag Content Score.

## Primary intent

`wojna hybrydowa` — definicja, cechy, przykłady, konsekwencje, podsumowanie.

## Expected intent / H2 map

1. Co to jest wojna hybrydowa? (definition)
2. Cechy / poniżej progu wojny (characteristics)
3. Środki: cyber, dezinformacja, migracja, ekonomia (means)
4. Przykłady: Krym 2014, Donbas, Ukraina 2022, PL granica 2021, Hezbollah 2006 (examples)
5. Konsekwencje / plausible deniability (consequences)
6. Podsumowanie (summary)

## Terms (Surfer signal — Entity/Topic)

wojna hybrydowa
pojęcie wojny hybrydowej
działania federacji rosyjskiej
działania militarne
ramach wojny hybrydowej
siły zbrojne
siły wojskowej
kampanie informacyjne
operacje militarne
podsumowanie wojna hybrydowa
filozofią wojny
konflikt zbrojny
działań zbrojnych
prowadzenia wojny
działań hybrydowych
presją ekonomiczną
użycie siły
częściowe uniknięcie
działania nieregularne
środków militarnych
działania wojenne
media społecznościowe
stany zjednoczone
jednej strony
celów politycznych
nowych wyzwań
większe znaczenie
tradycyjne modele
polu walki
współczesnych form
współczesnym świecie
innymi słowy
ścisłym związku
opinię publiczną
wojna
odpowiedzialności
dezinformacji
prowadzone
zagrożenia
militarne
różnych form
konflikt
bezpieczeństwa
przeciwnika
trudności
gospodarczej
cyberataki
wojsko
koncepcja
konsekwencji
informacyjnej
użycie
politycznej
szczególności
xxi wieku
kontekście
wykorzystywane
walki
neutralizację
strategii
różnych środków
ochrony
siły
terroryzmem
strony
współcześnie
zapewnienia
interpretacji
osiągnięcie
działania
ukrainie
ograniczenie
zjawiska
kontrolę
drugiej
popularności
nieregularnych
określenie
cyberatakami
zdolności

## AI Visibility facts (expected FactNode.statement, status=covered on gold)

1. Agresor w wojnie hybrydowej unika otwartej walki konwencjonalnej.
2. Wojna hybrydowa łączy działania militarne i niemilitarne.
3. Działania hybrydowe są prowadzone poniżej progu otwartej wojny.
4. Wojna hybrydowa wykorzystuje cyberataki i dezinformację.
5. Wojna hybrydowa może trwać bez formalnego wypowiedzenia wojny.
6. Wojna hybrydowa ma na celu destabilizację przeciwnika.
7. Rosja anektowała Krym w 2014 roku.
8. Kryzys migracyjny na granicy z Polską miał miejsce w 2021 roku.
9. Ukraina doświadczyła cyberataków przed inwazją w 2022 roku.
10. Działania Rosji w Donbasie łączyły militarną i informacyjną agresję.
11. Hezbollah stosował hybrydowe metody walki w Libanie w 2006 roku.
12. Rosja stosuje kampanie dezinformacyjne w wojnie hybrydowej.
13. Ataki cybernetyczne są formą agresji w wojnie hybrydowej.
14. Migranci mogą być używani jako narzędzie destabilizacji.
15. Wojna hybrydowa operuje poniżej progu otwartej wojny.
16. Zasada plausible deniability umożliwia agresorowi uniknięcie odpowiedzialności.
17. Trudności w przypisaniu odpowiedzialności utrudniają reakcję państw na ataki hybrydowe.
18. Działania hybrydowe mogą tworzyć efekty synergii między różnymi zagrożeniami.
19. Działania hybrydowe mogą destabilizować bezpieczeństwo międzynarodowe.
20. Cyberataki są kluczowym elementem wojny hybrydowej.
21. Rosja stosuje wojny hybrydowe do osłabiania przeciwników.
22. Cyberprzestrzeń stała się polem walki wprowadzając ataki na infrastrukturę krytyczną.
23. Działania hybrydowe obejmują cyberataki i kampanie dezinformacyjne.
24. Rosja wykorzystała media społecznościowe w wojnie hybrydowej.
25. Wojna hybrydowa odbywa się poniżej progu otwartej wojny.
26. Działania hybrydowe mogą destabilizować społeczeństwa bez użycia siły.
27. Długotrwałość i elastyczność działań hybrydowych są ich podstawowymi cechami.
28. Zatarcie granic między wojną a pokojem jest charakterystyczne dla wojny hybrydowej.

## Acceptance (foundation slice)

- Fixture contains exactly 28 numbered AI Visibility facts.
- Adapter tests can load statements as expected `FactNode.statement` list.
- Full compile against gold HTML is **out of scope** for this plan.
```

- [ ] **Step 2: Verify fact count = 28**

Run:

```powershell
(Select-String -Path docs/fixtures/coverage-v3-wojna-hybrydowa.md -Pattern '^\d+\. ').Count
```

Expected: `28`

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add docs/fixtures/coverage-v3-wojna-hybrydowa.md
git commit -m "docs: add Coverage Engine v3 gold fixture (wojna hybrydowa)"
```

---

### Task 3: Public doc pointer

**Files:**
- Create: `docs/coverage-engine-v3.md`
- Modify: `docs/architecture-content-editor-flow-report.md` (add short link near Coverage section)

- [ ] **Step 1: Write public pointer**

```markdown
# Coverage Engine v3

Canonical design: [`docs/superpowers/specs/2026-08-02-coverage-engine-v3-design.md`](superpowers/specs/2026-08-02-coverage-engine-v3-design.md)

Implementation plan: [`docs/superpowers/plans/2026-08-02-coverage-engine-v3.md`](superpowers/plans/2026-08-02-coverage-engine-v3.md)

Gold fixture: [`docs/fixtures/coverage-v3-wojna-hybrydowa.md`](fixtures/coverage-v3-wojna-hybrydowa.md)

Surfer RE critique: [`docs/surferseo-re-critique.md`](surferseo-re-critique.md)

## One-liner

Coverage Engine v3 **nie liczy score jako produktu** — buduje **Canonical Knowledge Graph** artykułu. SEO, AI Visibility, Judge, AO i WIE czytają ten graf.

## Foundation code (this plan)

- `lib/types/knowledgeGraph.ts`
- `lib/coverage/coverageSnapshotToKg.ts`
- `lib/coverage/aggregateContentScore.ts`
- `lib/coverage/kgDiff.ts`
```

- [ ] **Step 2: Add cross-link in architecture report**

Find the section that describes `ai_info_to_cover` / graded coverage and insert:

```markdown
> **SoT roadmap:** Coverage Engine v3 — see [`docs/coverage-engine-v3.md`](coverage-engine-v3.md).
```

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add docs/coverage-engine-v3.md docs/architecture-content-editor-flow-report.md
git commit -m "docs: link Coverage Engine v3 as coverage SoT roadmap"
```

---

### Task 4: Types — `knowledgeGraph.ts`

**Files:**
- Create: `lib/types/knowledgeGraph.ts`
- Test: `__tests__/lib/coverage/knowledgeGraph.test.ts`

- [ ] **Step 1: Write failing test — weights sum to 1**

```ts
/** @jest-environment node */
import { CONTENT_SCORE_WEIGHTS_V3 } from '../../../lib/types/knowledgeGraph';

describe('knowledgeGraph types/constants', () => {
  it('CONTENT_SCORE_WEIGHTS_V3 sums to 1', () => {
    const sum = Object.values(CONTENT_SCORE_WEIGHTS_V3).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: FAIL — cannot find module `lib/types/knowledgeGraph`

- [ ] **Step 3: Implement types + weights**

Create `lib/types/knowledgeGraph.ts` with the exact interfaces from the design spec §5, plus:

```ts
export const CONTENT_SCORE_WEIGHTS_V3 = {
  fact: 0.3,
  intent: 0.2,
  entity: 0.15,
  question: 0.1,
  evidence: 0.1,
  structure: 0.1,
  topic: 0.05,
} as const;

export type ContentScoreComponentKey = keyof typeof CONTENT_SCORE_WEIGHTS_V3;
```

Export all types listed in the design spec (`KgNode`, `KnowledgeGraph`, `EngineResult`, `KgDiff`, `CoverageStatus`, etc.). Do **not** use `any`.

- [ ] **Step 4: Run test — expect PASS**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add lib/types/knowledgeGraph.ts __tests__/lib/coverage/knowledgeGraph.test.ts
git commit -m "feat(coverage): add KnowledgeGraph types and Content Score weights"
```

---

### Task 5: Aggregator — pure Content Score

**Files:**
- Create: `lib/coverage/aggregateContentScore.ts`
- Modify: `__tests__/lib/coverage/knowledgeGraph.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { aggregateContentScore } from '../../../lib/coverage/aggregateContentScore';
import type { KgNode } from '../../../lib/types/knowledgeGraph';

function fact(id: string, status: KgNode['status'], importance: KgNode['importance'] = 'critical'): KgNode {
  return {
    id,
    kind: 'fact',
    label: id,
    statement: id,
    entityIds: [],
    verified: status === 'covered',
    importance,
    status,
    confidence: 1,
  };
}

describe('aggregateContentScore', () => {
  it('returns 100 when all weighted components fully covered', () => {
    const nodes: KgNode[] = [
      fact('f1', 'covered'),
      {
        id: 'i1', kind: 'intent', label: 'def', primary: true,
        importance: 'critical', status: 'covered', confidence: 1,
      },
      {
        id: 'e1', kind: 'entity', label: 'Rosja', aliases: [], mentionCount: 1,
        importance: 'critical', status: 'covered', confidence: 1,
      },
      {
        id: 'q1', kind: 'question', label: 'q', question: 'Co to?',
        importance: 'critical', status: 'covered', confidence: 1,
      },
      {
        id: 'ev1', kind: 'evidence', label: 'ev', factId: 'f1',
        evidenceKind: 'date', snippet: '2014',
        importance: 'critical', status: 'covered', confidence: 1,
      },
      {
        id: 's1', kind: 'section', label: 'H2', headingLevel: 2, order: 0,
        importance: 'critical', status: 'covered', confidence: 1,
      },
      {
        id: 't1', kind: 'topic', label: 'cyber',
        importance: 'critical', status: 'covered', confidence: 1,
      },
    ];
    const score = aggregateContentScore(nodes);
    expect(score.overall).toBe(100);
  });

  it('counts partial as 0.5', () => {
    const nodes: KgNode[] = [fact('f1', 'partial')];
    const score = aggregateContentScore(nodes);
    const factComp = score.components.find((c) => c.key === 'fact');
    expect(factComp?.score).toBe(50);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: FAIL — `aggregateContentScore` missing

- [ ] **Step 3: Implement aggregator**

```ts
// lib/coverage/aggregateContentScore.ts
import {
  CONTENT_SCORE_WEIGHTS_V3,
  type ContentScoreComponentKey,
  type ContentScoreV3,
  type ComponentScore,
  type Importance,
  type KgNode,
  type KgRecommendation,
} from '../types/knowledgeGraph';

const IMPORTANCE_W: Record<Importance, number> = {
  critical: 3,
  recommended: 2,
  optional: 1,
};

function statusCredit(status: KgNode['status']): number {
  if (status === 'covered') return 1;
  if (status === 'partial') return 0.5;
  return 0;
}

function kindToComponent(kind: KgNode['kind']): ContentScoreComponentKey | null {
  switch (kind) {
    case 'fact': return 'fact';
    case 'intent': return 'intent';
    case 'entity': return 'entity';
    case 'question': return 'question';
    case 'evidence': return 'evidence';
    case 'section': return 'structure';
    case 'topic': return 'topic';
    case 'citation': return null;
    default: return null;
  }
}

export function aggregateContentScore(nodes: readonly KgNode[]): ContentScoreV3 {
  const keys = Object.keys(CONTENT_SCORE_WEIGHTS_V3) as ContentScoreComponentKey[];
  const buckets: Record<ContentScoreComponentKey, { earned: number; max: number; missing: string[] }> = {
    fact: { earned: 0, max: 0, missing: [] },
    intent: { earned: 0, max: 0, missing: [] },
    entity: { earned: 0, max: 0, missing: [] },
    question: { earned: 0, max: 0, missing: [] },
    evidence: { earned: 0, max: 0, missing: [] },
    structure: { earned: 0, max: 0, missing: [] },
    topic: { earned: 0, max: 0, missing: [] },
  };

  for (const n of nodes) {
    const key = kindToComponent(n.kind);
    if (!key) continue;
    const w = IMPORTANCE_W[n.importance];
    buckets[key].max += w;
    buckets[key].earned += w * statusCredit(n.status);
    if (n.status === 'missing' || n.status === 'hallucinated') {
      buckets[key].missing.push(n.id);
    }
  }

  const components: ComponentScore[] = keys.map((key) => {
    const b = buckets[key];
    const score = b.max > 0 ? Math.round((b.earned / b.max) * 100) : 100;
    const fixHints: KgRecommendation[] = b.missing.slice(0, 5).map((nodeId) => ({
      nodeId,
      action: `cover_${key}`,
      expectedImpact: CONTENT_SCORE_WEIGHTS_V3[key],
      severity: key === 'fact' || key === 'intent' ? 'high' : 'medium',
    }));
    return {
      key,
      weight: CONTENT_SCORE_WEIGHTS_V3[key],
      score,
      explain: b.max === 0
        ? [`No ${key} nodes — component treated as complete`]
        : [`${key}: ${score}/100 from importance-weighted coverage`],
      missing: b.missing,
      fixHints,
    };
  });

  const overall = Math.round(
    components.reduce((acc, c) => acc + c.weight * c.score, 0),
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    components,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add lib/coverage/aggregateContentScore.ts __tests__/lib/coverage/knowledgeGraph.test.ts
git commit -m "feat(coverage): add Content Score v3 aggregator"
```

---

### Task 6: Adapter — `coverageSnapshotToKg`

**Files:**
- Create: `lib/coverage/coverageSnapshotToKg.ts`
- Modify: `__tests__/lib/coverage/knowledgeGraph.test.ts`

- [ ] **Step 1: Write failing adapter tests**

```ts
import { coverageSnapshotToKg } from '../../../lib/coverage/coverageSnapshotToKg';
import type { CoverageSnapshot, CoverageItem } from '../../../lib/aiCoverage';

function item(partial: Partial<CoverageItem> & Pick<CoverageItem, 'id' | 'label' | 'type'>): CoverageItem {
  return {
    category: 'knowledge',
    importance: 'critical',
    source: 'llm',
    covered: true,
    quality: 4,
    ...partial,
  };
}

describe('coverageSnapshotToKg', () => {
  it('maps fact items to FactNode with covered status', () => {
    const snap: CoverageSnapshot = {
      schemaVersion: 1,
      judgeVersion: 'v1|test|0',
      promptVersion: 'v1',
      model: 'test',
      createdAt: '2026-08-02T00:00:00.000Z',
      items: [
        item({
          id: 'fact_krym',
          label: 'Rosja anektowała Krym w 2014 roku.',
          type: 'fact',
          covered: true,
          quality: 5,
        }),
      ],
      buckets: [],
      answersMainQuestionEarly: true,
      overall: 80,
      topics: [{ title: 'Historia', itemIds: ['fact_krym'] }],
    };

    const kg = coverageSnapshotToKg(snap, { contentHash: 'abc' });
    expect(kg.schemaVersion).toBe(2);
    expect(kg.contentHash).toBe('abc');
    const facts = kg.nodes.filter((n) => n.kind === 'fact');
    expect(facts).toHaveLength(1);
    if (facts[0]?.kind !== 'fact') throw new Error('expected fact');
    expect(facts[0].statement).toBe('Rosja anektowała Krym w 2014 roku.');
    expect(facts[0].status).toBe('covered');
    expect(kg.edges.some((e) => e.type === 'contains')).toBe(true);
    expect(kg.metrics.overall).toBeGreaterThanOrEqual(0);
  });

  it('maps quality < 3 covered to partial', () => {
    const snap: CoverageSnapshot = {
      schemaVersion: 1,
      judgeVersion: 'v1|test|0',
      promptVersion: 'v1',
      model: 'test',
      createdAt: '2026-08-02T00:00:00.000Z',
      items: [item({ id: 'f1', label: 'shallow', type: 'fact', covered: true, quality: 2 })],
      buckets: [],
      answersMainQuestionEarly: false,
      overall: 10,
    };
    const kg = coverageSnapshotToKg(snap, { contentHash: 'x' });
    expect(kg.nodes[0]?.status).toBe('partial');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: FAIL — adapter missing

- [ ] **Step 3: Implement adapter**

```ts
// lib/coverage/coverageSnapshotToKg.ts
import type { CoverageItem, CoverageSnapshot, CoverageType } from '../aiCoverage';
import { aggregateContentScore } from './aggregateContentScore';
import type {
  CoverageStatus,
  EntityNode,
  FactNode,
  IntentNode,
  KgEdge,
  KgNode,
  KnowledgeGraph,
  QuestionNode,
  TopicNode,
} from '../types/knowledgeGraph';

function toStatus(it: CoverageItem): CoverageStatus {
  if (!it.covered) return 'missing';
  if (it.quality < 3) return 'partial';
  return 'covered';
}

function mapItem(it: CoverageItem): KgNode | null {
  const base = {
    id: it.id,
    label: it.label,
    importance: it.importance,
    status: toStatus(it),
    confidence: it.confidence ?? 0,
    sectionId: it.sectionId,
  };

  const t: CoverageType = it.type;
  if (t === 'fact' || t === 'statistic' || t === 'example') {
    const node: FactNode = {
      ...base,
      kind: 'fact',
      statement: it.label,
      entityIds: [],
      verified: it.covered && it.quality >= 3,
    };
    return node;
  }
  if (t === 'entity' || t === 'term' || t === 'concept') {
    const node: EntityNode = {
      ...base,
      kind: 'entity',
      aliases: [],
      entityType: t,
      mentionCount: it.covered ? 1 : 0,
    };
    return node;
  }
  if (t === 'question' || t === 'paa') {
    const node: QuestionNode = {
      ...base,
      kind: 'question',
      question: it.label,
    };
    return node;
  }
  if (t === 'intent' || t === 'definition' || t === 'process' || t === 'comparison') {
    const node: IntentNode = {
      ...base,
      kind: 'intent',
      primary: t === 'intent' || t === 'definition',
    };
    return node;
  }
  if (t === 'structure' || t === 'readability') {
    return {
      ...base,
      kind: 'section',
      headingLevel: 2,
      order: 0,
    };
  }
  return null;
}

export function coverageSnapshotToKg(
  snap: CoverageSnapshot,
  opts: { contentHash: string; compileVersion?: string },
): KnowledgeGraph {
  const nodes: KgNode[] = [];
  for (const it of snap.items) {
    const n = mapItem(it);
    if (n) nodes.push(n);
  }

  const edges: KgEdge[] = [];
  for (const topic of snap.topics ?? []) {
    const topicId = `topic:${topic.title}`;
    const topicNode: TopicNode = {
      id: topicId,
      kind: 'topic',
      label: topic.title,
      importance: 'recommended',
      status: topic.itemIds.some((id) => nodes.find((n) => n.id === id)?.status === 'covered')
        ? 'covered'
        : 'missing',
      confidence: 0.7,
    };
    nodes.push(topicNode);
    for (const itemId of topic.itemIds) {
      edges.push({
        id: `contains:${topicId}:${itemId}`,
        type: 'contains',
        from: topicId,
        to: itemId,
        confidence: 1,
      });
    }
  }

  return {
    schemaVersion: 2,
    contentHash: opts.contentHash,
    compileVersion: opts.compileVersion ?? 'adapter-v1',
    compiledAt: snap.createdAt,
    nodes,
    edges,
    metrics: aggregateContentScore(nodes),
    legacySnapshot: {
      schemaVersion: 1,
      overall: snap.overall,
      items: snap.items,
      buckets: snap.buckets,
    },
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: PASS

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add lib/coverage/coverageSnapshotToKg.ts __tests__/lib/coverage/knowledgeGraph.test.ts
git commit -m "feat(coverage): adapter CoverageSnapshot v1 to KnowledgeGraph v2"
```

---

### Task 7: `kgDiff` + gold fact list helper

**Files:**
- Create: `lib/coverage/kgDiff.ts`
- Create: `lib/coverage/goldHybridWarFacts.ts` (statements array parsed for tests — keep tiny)
- Modify: `__tests__/lib/coverage/knowledgeGraph.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { diffKnowledgeGraphs } from '../../../lib/coverage/kgDiff';
import { GOLD_HYBRID_WAR_FACTS } from '../../../lib/coverage/goldHybridWarFacts';
import { coverageSnapshotToKg } from '../../../lib/coverage/coverageSnapshotToKg';
import type { CoverageSnapshot } from '../../../lib/aiCoverage';
import type { CoverageItem } from '../../../lib/aiCoverage';

describe('GOLD_HYBRID_WAR_FACTS', () => {
  it('has 28 statements', () => {
    expect(GOLD_HYBRID_WAR_FACTS).toHaveLength(28);
    expect(GOLD_HYBRID_WAR_FACTS[6]).toBe('Rosja anektowała Krym w 2014 roku.');
  });
});

describe('diffKnowledgeGraphs', () => {
  it('detects status flip and score delta', () => {
    const mk = (covered: boolean, quality: number): CoverageSnapshot => {
      const items: CoverageItem[] = [{
        id: 'f1',
        label: 'Rosja anektowała Krym w 2014 roku.',
        type: 'fact',
        category: 'knowledge',
        importance: 'critical',
        source: 'llm',
        covered,
        quality,
      }];
      return {
        schemaVersion: 1,
        judgeVersion: 't',
        promptVersion: 'v1',
        model: 't',
        createdAt: '2026-08-02T00:00:00.000Z',
        items,
        buckets: [],
        answersMainQuestionEarly: false,
        overall: 0,
      };
    };
    const before = coverageSnapshotToKg(mk(false, 0), { contentHash: 'a' });
    const after = coverageSnapshotToKg(mk(true, 5), { contentHash: 'a' });
    const d = diffKnowledgeGraphs(before, after);
    expect(d.statusFlips).toEqual([{ id: 'f1', from: 'missing', to: 'covered' }]);
    expect(d.scoreDelta).toBeGreaterThan(0);
  });
});

describe('gold facts → FactNodes via adapter', () => {
  it('maps all 28 gold statements into covered FactNodes', () => {
    const items: CoverageItem[] = GOLD_HYBRID_WAR_FACTS.map((statement, i) => ({
      id: `gold_fact_${i + 1}`,
      label: statement,
      type: 'fact',
      category: 'knowledge',
      importance: 'critical',
      source: 'manual',
      covered: true,
      quality: 5,
    }));
    const snap: CoverageSnapshot = {
      schemaVersion: 1,
      judgeVersion: 'gold',
      promptVersion: 'v1',
      model: 'manual',
      createdAt: '2026-08-02T00:00:00.000Z',
      items,
      buckets: [],
      answersMainQuestionEarly: true,
      overall: 90,
    };
    const kg = coverageSnapshotToKg(snap, { contentHash: 'gold' });
    const facts = kg.nodes.filter((n) => n.kind === 'fact');
    expect(facts).toHaveLength(28);
    expect(facts.every((f) => f.status === 'covered')).toBe(true);
    const factComp = kg.metrics.components.find((c) => c.key === 'fact');
    expect(factComp?.score).toBe(100);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: FAIL — missing modules

- [ ] **Step 3: Implement `goldHybridWarFacts.ts`**

Export `GOLD_HYBRID_WAR_FACTS: readonly string[]` with the exact 28 statements from the fixture (copy literals — no file IO in unit test).

- [ ] **Step 4: Implement `kgDiff.ts`**

```ts
// lib/coverage/kgDiff.ts
import type { CoverageStatus, KgDiff, KnowledgeGraph } from '../types/knowledgeGraph';

export function diffKnowledgeGraphs(before: KnowledgeGraph, after: KnowledgeGraph): KgDiff {
  const beforeIds = new Set(before.nodes.map((n) => n.id));
  const afterIds = new Set(after.nodes.map((n) => n.id));
  const beforeStatus = new Map(before.nodes.map((n) => [n.id, n.status]));

  const addedNodeIds = after.nodes.filter((n) => !beforeIds.has(n.id)).map((n) => n.id);
  const removedNodeIds = before.nodes.filter((n) => !afterIds.has(n.id)).map((n) => n.id);

  const statusFlips: { id: string; from: CoverageStatus; to: CoverageStatus }[] = [];
  for (const n of after.nodes) {
    const prev = beforeStatus.get(n.id);
    if (prev && prev !== n.status) {
      statusFlips.push({ id: n.id, from: prev, to: n.status });
    }
  }

  return {
    addedNodeIds,
    removedNodeIds,
    statusFlips,
    scoreDelta: after.metrics.overall - before.metrics.overall,
  };
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: PASS

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add lib/coverage/kgDiff.ts lib/coverage/goldHybridWarFacts.ts __tests__/lib/coverage/knowledgeGraph.test.ts
git commit -m "feat(coverage): kgDiff + gold hybrid-war fact fixtures for CKG tests"
```

---

### Task 8: Self-check + graphify note

**Files:**
- None new (verification only)

- [ ] **Step 1: Run full foundation test file**

Run: `npx jest __tests__/lib/coverage/knowledgeGraph.test.ts --ci`

Expected: all PASS

- [ ] **Step 2: Lint touched TS (no `any`)**

Run:

```powershell
Select-String -Path lib/types/knowledgeGraph.ts,lib/coverage/*.ts -Pattern '\bany\b' -SimpleMatch
```

Expected: no matches (or only in comments)

- [ ] **Step 3: After code lands, run** `graphify update .` (AST-only) per project rules

- [ ] **Step 4: Stop — do not start LLM Fact Engine or AO wire in this plan**

---

## Self-review (writing-plans checklist)

| Spec requirement | Task |
| --- | --- |
| Design / philosophy compiler + CKG SoT | Task 1 (spec) + Task 3 (public doc) |
| Gold Surfer facts + terms | Task 2 + Task 7 |
| TypeScript model §5 | Task 4 |
| Aggregator weights | Task 5 |
| Adapter v1→v2 | Task 6 |
| KgDiff for Judge/History | Task 7 |
| Cross-link architecture report | Task 3 |
| No full LLM compile / AO rewrite | Explicit out of scope |

**Placeholder scan:** none intentional — gold statements inlined in Task 2 and Task 7.  
**Type consistency:** `CoverageStatus`, `FactNode.statement`, `CONTENT_SCORE_WEIGHTS_V3`, `aggregateContentScore`, `coverageSnapshotToKg`, `diffKnowledgeGraphs` used consistently across tasks.

---

## Next plans (not this file)

1. `coverage-engine-v3-compile-mvp` — Structure/Intent/Entity/Fact LLM compile → persist schemaVersion 2  
2. `coverage-engine-v3-ao-wire` — Planner reads missing CKG nodes  
3. `coverage-engine-v3.1-quality` — Contradiction / Redundancy / Citation / Freshness
