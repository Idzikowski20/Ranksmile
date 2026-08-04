# Raport implementacji — Content Intelligence Architecture (CIA)

**Data raportu:** 2026-08-03  
**Zakres:** Ranksmile — warstwa Content Compiler → CCM Snapshot → projekcje / SoT  
**Status roadmapy:** Etapy **1–30 DONE** (FREEZE v1.0 + pełna ścieżka produktowa backend)  
**UI edytora:** **bez** nowych widgetów CCM (świadoma decyzja produktowa; Info to cover zostaje na legacy labels)

Dokumenty bazowe:

- [FREEZE.md](./FREEZE.md)
- [07-runtime.md](./07-runtime.md)
- Spec: `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/`

---

## 1. Streszczenie wykonawcze

Wprowadzono **Content Intelligence Platform** jako warstwę kompilatora treści:

1. HTML/plain → **Lexer → Parser → Semantic → IR → PassManager** → **CCM Snapshot** (Source of Truth).
2. Coverage / Visibility / Info to cover / rekomendacje AO = **projekcje** z CCM, nie osobne „silniki prawdy”.
3. Persistencja: tabele `cia_ccm_snapshots` / `cia_compile_events`.
4. Triggery produktowe: Deep Analysis, generate, AO, publish, PUT save, cron co 6h.
5. Fact Engine w trzech warstwach: heurystyka → citations DA → LLM tylko na lukach (cytaty z artykułu).
6. SoT UI: `articles.ai_info_to_cover` zasilane projekcją CCM (`judgeVersion: ccm-projection|…`), bez zmiany chrome Info to cover.

**Świadomie nie wdrożono:** paneli CCM w edytorze (revert po Etapie 21 UI).

---

## 2. Architektura (jak jest dziś)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Product triggers                                                │
│  DA · post-generate · AO · publish · PUT · cron/ccm-compile      │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  compileAfterArticleChange / compileIfStale                      │
│  (+ metryki ccmCompileMetrics)                                   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content Compiler (lib/compiler)                                 │
│  lex → parse → normalize → semantic → IR → passes                │
│  entity → fact → evidence → intent                               │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Canonical Content Model (CCM)                                   │
│  SqlCompileStore → cia_ccm_snapshots                             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Enrichment pipeline                                             │
│  1) DA citations (ai_visibility_*)     ← Etap 28                 │
│  2) contradicts heuristic              ← Etap 29                 │
│  3) LLM gap quotes (verbatim only)     ← Etap 30                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  SoT projection                                                  │
│  projectCcmToCoverageSnapshot → articles.ai_info_to_cover        │
│  (+ merge PAA / SERP / llmSources z poprzedniego snapu)          │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Consumers (API DTO, bez UI widgets)                             │
│  view.infoToCover · view.recommendations · AO extraCandidates    │
│  GET|POST /api/articles/[id]/ccm · POST …/ccm/live               │
└─────────────────────────────────────────────────────────────────┘
```

### Konwencje krytyczne

| Zasada | Opis |
|--------|------|
| CCM = SoT | Coverage/Visibility nie są niezależnym źródłem prawdy |
| GraphQuery | Konsumenci nie grzebią w `model.knowledge.indexes` na surowo |
| `compiledAt` / `builtAt` | Zawsze od callera — bez `new Date()` w fabrykach typów |
| Brak `any` | Typy z `lib/ccm`, `lib/types`, `unknown` + zawężenie |
| Lazy DB w Jest | Brak top-level importu Sequelize/uuid w ścieżkach testowych |

---

## 3. Roadmapa FREEZE — status pełny

| Etap | Zakres | Status |
|------|--------|--------|
| 1–3 | FREEZE + CIAS falsification + RFC Accepted | DONE |
| 4–5 | Arch boundaries + typy CCM | DONE |
| 6–8 | Compiler skeleton + replay + builders heurystyczne | DONE |
| 9–11 | Evidence MVP, ActionGraph, Judge/diff, CIAS-001 | DONE |
| 12–15 | GraphQuery, Visibility, Benchmark, WI + SQL store | DONE |
| 16 | API `/ccm` + gold Surfer (backend; UI later reverted) | DONE |
| 17–18 | Compile po DA/generate; publish + AO | DONE |
| 19–21 | InfoToCover DTO, live presence, recommendations DTO | DONE |
| 22–24 | Cron 6h, AO candidates, PUT → `compileIfStale` | DONE |
| **25** | Fact Engine MVP (atomic + SPO + quote evidence) | **DONE** |
| **26** | CIAS-002…008 smoke fixtures + testy | **DONE** |
| **27** | SoT: CCM → `ai_info_to_cover` | **DONE** |
| **28** | Fact Engine v2: citations DA → CCM | **DONE** |
| **29** | Hardening: metryki, await DA, contradicts | **DONE** |
| **30** | Fact Engine v3: LLM gap quotes | **DONE** |

---

## 4. Szczegóły Etapów 25–30 (ostatnia fala)

### 4.1 Etap 25 — Fact Engine MVP (heurystyka)

**Cel:** Lepsze fakty niż „cały paragraf = 1 claim”, bez LLM/NER.

| Element | Plik / miejsce |
|---------|----------------|
| Split zdań | `lib/ccm/builders/factEngine.ts` → `splitAtomicClaims` |
| SPO heurystyczne | `parseSpoHeuristic` (annexed / used / is / involves) |
| Dedupe | `normalizeFactKey` w `factBuilder` |
| Semantic | `lib/compiler/semantic.ts` — claim per zdanie w paragrafach |
| IR | `irBuilder` używa SPO przy `FactCandidate` |
| Evidence | quote na `subject` w `evidenceBuilder` |
| Pass version | `factPass` → version `'1'` |

**Testy:** `__tests__/lib/ccm/factEngine.test.ts`

---

### 4.2 Etap 26 — CIAS-002…008 smoke

**Cel:** Falsyfikacja modelu na syntetycznych outline’ach (medical → comparison).

| Artefakt | Ścieżka |
|----------|---------|
| Fixture’y | `__tests__/fixtures/cias-002-medical.md` … `cias-008-comparison.md` |
| Test smoke | `__tests__/lib/intelligence/cias002to008.test.ts` |
| Gold CIAS-001 | `__tests__/fixtures/cias-001-hybrid-war.md` + `cias001.test.ts` |

**Kryterium:** compile → intents ≥ 3, facts ≥ 3, `projectCoverage.overall > 0`.

---

### 4.3 Etap 27 — SoT: CCM → `ai_info_to_cover`

**Cel (OQ-8):** Info to cover w UI bez zmiany labeli — podmiana silnika danych.

| Element | Opis |
|---------|------|
| Projekcja | `lib/intelligence/ccmToCoverageSnapshot.ts` |
| Persist | `lib/intelligence/persistCcmCoverageProjection.ts` |
| Merge | Zachowuje PAA / SERP / competitors / `llmSources` z poprzedniego snapu |
| `judgeVersion` | `ccm-projection\|v1\|heuristic` |
| Hook | `compileAfterArticleChange` / `compileIfStale` / `POST /ccm` |

**Bug naprawiony przy smoke:** gdy `compileIfStale` przekazywał `store`, projekcja była wyłączona (`store === undefined` jako warunek).  
**Fix:** `projectCoverage` default **ON**; przy `skipped` też re-project; testy jawnie `projectCoverage: false`.

**Smoke (artykuł 167, Neon):**

| | Przed | Po (Etap 27) |
|--|-------|----------------|
| `judgeVersion` | `v1\|deepseek-chat\|0` | `ccm-projection\|v1\|heuristic` |
| items | 28 | 26 |
| overall | — | 2 (sufit czystej heurystyki) |

Skrypt: `scripts/smoke-ccm-coverage.ts`

```bash
npx tsx --env-file=.env.local scripts/smoke-ccm-coverage.ts 167
```

---

### 4.4 Etap 28 — Fact Engine v2 (citations DA)

**Cel:** Podnieść jakość checklisty faktami z Deep Analysis / AI Visibility — **bez** LLM w compile.

| Element | Plik |
|---------|------|
| Load seeds | `lib/intelligence/loadDaFactSeeds.ts` |
| Enrich graph | `lib/intelligence/enrichCcmWithDaFacts.ts` |
| Orchestracja | `lib/intelligence/applyDaFactEnrichment.ts` |

**Źródło:** ostatni `ai_visibility_runs` → `ai_visibility_citations` (prompt/answer/url).  
**Readiness:** `factReadinessScore(article, statement)` → status covered / partial / weak / missing.  
**Węzły:** Fact + opcjonalnie Question / Citation + Evidence (`supportedBy`).

**Smoke 167 po v2:**

| | Po Etap 27 | Po Etap 28 |
|--|------------|------------|
| items | 26 | **44** |
| overall | 2 | **17** |

---

### 4.5 Etap 29 — Hardening

#### Metryki compile

`lib/intelligence/ccmCompileMetrics.ts`

- Outcomes: `ok` \| `noop` \| `skipped` \| `error` \| `empty`
- Ring buffer (100) + totals + `console.info [ccm-metric]`
- Podpięte w `compileAfterArticleChange` / `compileIfStale`

#### Await projekcji w Deep Analysis

**Problem:** SSE `done` oddawało LLM snapshot, a CCM leciał fire-and-forget (race + overwrite).

**Fix w** `pages/api/articles/deep-analysis.ts`:

1. Zapis LLM coverage (jak wcześniej).
2. **Najpierw** `persistAiVisibilityRun` (żeby Etap 28 miał citations).
3. **Await** `compileAfterArticleChange` (enrich + project).
4. Jeśli wynik ma `coverageSnapshot` → użyj go w SSE `done` i do scoringu.

#### Contradicts (CIAS-006 style)

`lib/intelligence/applyContradictHeuristics.ts`

- Para absolut („zawsze muszą…”) vs wyjątek („nie zawsze…”) + wspólne tokeny.
- Edge `contradicts` (cap 48 faktów, O(n²) z komentarzem `ponytail`).

---

### 4.6 Etap 30 — Fact Engine v3 (LLM na lukach)

| Element | Plik |
|---------|------|
| LLM locate | `lib/intelligence/llmGapFacts.ts` → `locateGapEvidenceWithLlm` |
| Apply hits | `lib/intelligence/applyLlmGapEvidence.ts` |

**Kontrakt:**

- Max **6** luk (`missing` / `weak`).
- Jedno wywołanie modelu (`deepseek()` / Gemini flash wg `USE_GEMINI_FLASH`).
- Model zwraca **tylko cytaty** obecne w artykule (substring check).
- Trafienie → fact `covered` + `verification: verified` + evidence `quote`.
- Brak klucza API / błąd → no-op (non-fatal).

---

## 5. API i triggery produktowe

| Endpoint / trigger | Zachowanie |
|--------------------|------------|
| `GET /api/articles/[id]/ccm` | Odczyt CCM + view + `stale` |
| `POST /api/articles/[id]/ccm` | Compile → DA enrich → projekcja `ai_info_to_cover` |
| `POST …/ccm/live` | Live presence overlay (bez persist) |
| `POST /api/cron/ccm-compile` | Stale compile co 6h |
| Deep Analysis | Await compile + SoT w SSE |
| Generate / AO / publish / PUT | `compileAfterArticleChange` / `compileIfStale` |
| AO Precision | `loadCcmEditCandidatesForArticle` → `extraCandidates` |

---

## 6. Kluczowe pliki (mapa)

### Compiler / CCM

- `lib/compiler/` — `compile.ts`, `semantic.ts`, `irBuilder.ts`, passes
- `lib/ccm/` — types, builders (`factEngine`, `factBuilder`, `evidenceBuilder`), `graphQuery`, indexes
- `lib/projections/` — coverage / visibility
- `lib/planner/` — ActionGraph
- `lib/ensureCcmTables.ts` — DDL `cia_ccm_*`

### Intelligence (produkt)

| Plik | Rola |
|------|------|
| `compileAfterArticleChange.ts` | Główny hook + metryki + projekcja |
| `ccmToCoverageSnapshot.ts` | CCM → CoverageSnapshot |
| `persistCcmCoverageProjection.ts` | UPDATE `ai_info_to_cover` |
| `loadDaFactSeeds.ts` / `enrichCcmWithDaFacts.ts` | Etap 28 |
| `applyDaFactEnrichment.ts` | Pipeline 28→29→30 |
| `applyContradictHeuristics.ts` | Etap 29 |
| `llmGapFacts.ts` / `applyLlmGapEvidence.ts` | Etap 30 |
| `ccmCompileMetrics.ts` | Etap 29 |
| `ccmToInfoToCover.ts` | DTO accordion (API) |
| `sqlCompileStore.ts` | Persist CCM |

### Testy / smoke

- `__tests__/lib/ccm/factEngine.test.ts`
- `__tests__/lib/intelligence/cias001.test.ts`
- `__tests__/lib/intelligence/cias002to008.test.ts`
- `__tests__/lib/intelligence/ccmToCoverageSnapshot.test.ts`
- `__tests__/lib/intelligence/enrichCcmWithDaFacts.test.ts`
- `__tests__/lib/intelligence/hardening2930.test.ts`
- `__tests__/lib/intelligence/compileAfterArticleChange.test.ts`
- `scripts/smoke-ccm-coverage.ts`

---

## 7. Przepływ danych Info to cover (OQ-8)

```text
Deep Analysis
  ├─ LLM CoverageSnapshot (judge DeepSeek)     → tymczasowy zapis
  ├─ ai_visibility_citations                   → seeds Etap 28
  └─ await CCM compile + enrich + project
        └─ ai_info_to_cover =
             judgeVersion: ccm-projection|v1|heuristic
             items: intents + facts (+ merge PAA/llmSources)
             topics: z supports edges

Editor UI
  └─ czyta ai_info_to_cover (bez zmian chrome / labeli)
```

DTO API (równolegle): `view.infoToCover` z `buildInfoToCoverFromCcm` — ten sam kształt accordion.

---

## 8. Świadome ograniczenia i non-goals

| Temat | Decyzja |
|-------|---------|
| Widgety CCM w edytorze | **Nie** — revert po eksperymentach UI |
| Fact Engine jako NER product | **Nie** — heurystyka + citations + LLM quotes |
| Nowe pola RFC / unfreeze | **Nie** — CIAS 001–008 = YES |
| `SqlCompileStore` w `lib/intelligence/index.ts` | **Nie** re-export top-level (łamie Jest/uuid ESM) |
| Overall coverage | Heurystyka ma sufit; citations + LLM quotes podnoszą score, nie zastępują pełnego judge jakościowego |

---

## 9. Wyniki weryfikacji (smoke)

| Check | Wynik |
|-------|-------|
| Unit: Fact Engine / CIAS / projekcja / enrich / hardening | PASS |
| Neon: tabele `cia_ccm_*` | Obecne |
| Artykuł 167: CCM snapshot | Istnieje (od ~2026-08-03) |
| Artykuł 167: projekcja SoT | `ccm-projection\|v1\|heuristic` |
| Artykuł 167: po citations (v2) | 44 items, overall 17 |
| Graphify AST update | Wykonany po zmianach kodu |

---

## 10. Co zostało opcjonalnie (poza FREEZE 1–30)

1. **UI opt-in** — przywrócenie / zaprojektowanie paneli CCM w edytorze (wymaga świadomej decyzji produktowej).
2. **Smoke full DA** — jeden kompletny Deep Analysis na stagingu po restarcie `npm run dev` (ścieżka await + SSE).
3. **Commit / PR** — zmiany nie są jeszcze zacommitowane w tym raporcie jako osobny krok.
4. **Dalsza jakość** — pełny NER, embeddings conflicts, metryki w DB (dziś ring in-process), gold Surfer parity poza smoke.

---

## 11. Jak szybko sprawdzić lokalnie

```bash
# Unit (wybrane)
npx jest __tests__/lib/ccm/factEngine.test.ts \
  __tests__/lib/intelligence/cias002to008.test.ts \
  __tests__/lib/intelligence/ccmToCoverageSnapshot.test.ts \
  __tests__/lib/intelligence/enrichCcmWithDaFacts.test.ts \
  __tests__/lib/intelligence/hardening2930.test.ts \
  --no-coverage

# Smoke SoT na artykule
npx tsx --env-file=.env.local scripts/smoke-ccm-coverage.ts <articleId>

# SQL (Neon)
# SELECT ai_info_to_cover->>'judgeVersion', jsonb_array_length(ai_info_to_cover->'items')
# FROM articles WHERE id = <id>;
```

Oczekiwane po ścieżce produktowej: `judgeVersion` zawiera `ccm-projection`.

---

## 12. Werdykt

CIA v1.0 jest **zaimplementowana end-to-end po stronie backendu**: kompilator, persistencja, triggery, Fact Engine (heurystyka → DA → LLM quotes), SoT dla Info to cover, hardening DA/metryki/contradicts.  
Produktowo edytor **nie** dostał nowych paneli CCM — checklista Info to cover jest zasilana z CCM przez istniejącą kolumnę `ai_info_to_cover`.

**FREEZE roadmap 1–30: COMPLETE.**
