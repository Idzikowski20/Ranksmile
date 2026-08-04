# SurferSEO Reverse Engineering — Krytyczny przegląd v1.0

**Cel:** zweryfikować twierdzenia raportu RE v1.0 względem artefaktów (HAR / Coverage / Lighthouse / stringi w bundlach), oddzielić fakty od hipotez i zaproponować architekturę Ranksmile opartą najpierw na potwierdzonych ustaleniach.

**Źródła użyte w tej weryfikacji**

| Artefakt | Plik |
| --- | --- |
| HAR AI Visibility | `Downloads/aivisibilityoverview.har` (354 entries) |
| HAR Import Content / Editor | `Downloads/importcontent.har` (573 entries) |
| HAR Content Optimize | `Downloads/content-optimize.har` (23 entries) |
| HAR Dashboard (słaby pod GraphQL) | `Downloads/app.surferseo.com.har` (487 entries, **0** GraphQL) |
| Coverage | `Downloads/Coverage-20260802T194254.json` (332 scripts) |
| Lighthouse | `Downloads/app.surferseo.com-20260802T194800.json` |

**Brak w dostępnych artefaktach:** dumpy LocalStorage / SessionStorage / IndexedDB / Cookies → twierdzenia o cache klienckim poza Apollo/stringami w bundlu = nieudowodnione.

---

## Werdykt ogólny

Raport RE jest wartościową **mapą powierzchni klienta**, ale:

1. **Zawyża kategorię „Potwierdzone”** (EventSource, Segment, jeden długi pipeline Content Engine).
2. **Zaniża to, co widać w GraphQL** — wagi AIO (`AioScoreWeights`) są publiczne dla draftu.
3. Miesza ** twarde ślady HAR/Coverage** z **rekonstrukcją backendu** (workers, bounded contexts, aggregatory).

---

## Poziomy pewności (legenda)

| Symbol | Znaczenie |
| --- | --- |
| **POTWIERDZONE** | Bezpośredni ślad w HAR / Coverage / odpowiedzi GraphQL |
| **PRAWDOPODOBNE** | Silna hipoteza z spójnych śladów, bez pełnego dowodu |
| **NIEUDOWODNIONE** | Brak artefaktu / brak śladu |
| **NADINTERPRETACJA** | Raport idzie dalej niż pozwalają dane |

---

## 1. Weryfikacja twierdzeń raportu

| Twierdzenie raportu | Werdykt | Dowód / korekta |
| --- | --- | --- |
| SPA + code splitting / modularny frontend | **POTWIERDZONE** | Coverage: 332 skrypty (321× `app.surferseo.com/static/*`); wiele hashowanych chunków w HAR |
| GraphQL gateway | **POTWIERDZONE** | `POST https://app.surferseo.com/graphql` — AI Vis 44×, Import 92×, Optimize 4× |
| Apollo Client | **POTWIERDZONE** | Coverage: `ApolloClient` (2), `apollo-client` (1) w `CFEMNMge2.js` |
| TipTap + ProseMirror | **POTWIERDZONE** | Coverage: `@tiptap`, `ProseMirror`; collab: `yjs` + `Collaboration` |
| WebSocket | **POTWIERDZONE** | `wss://…/socket/websocket?vsn=2.0.0` (Phoenix), `/graphql/websocket`, `/collaboration` |
| EventSource (SSE) | **NADINTERPRETACJA** | String `EventSource` w bundlu; obserwowany stream faktów = `POST …/fact-detection/stream` → `application/jsonl`, nie `text/event-stream` |
| Stripe | **POTWIERDZONE** | `js.stripe.com`, `m.stripe.com` |
| Sentry | **POTWIERDZONE** | `sentry.io/api/…/envelope/` |
| Mixpanel | **POTWIERDZONE** | hit w `main.*.js` + requesty w HAR |
| Facebook / GA4 / GTM | **POTWIERDZONE** | `fbevents.js`, `googletagmanager` |
| Segment | **PRAWDOPODOBNE** | String „Segment” w 16 skryptach; brak `cdn.segment.com`; first-party `t.surferseo.com/v1/{t,i,p}` wygląda Segment-compatible |
| Operacje AiTracker* / ContentEditor* z raportu | **POTWIERDZONE** | Prawie wszystkie obecne; rename: `AiTrackerModelStatusesPerDay` → **`AiTrackerProjectModelStatusesPerDay`** |
| `AioScoreWeights` + multi-factor scoring | **POTWIERDZONE** | Odpowiedź GraphQL z wagami (patrz §4) |
| Pipeline Content = Init→Load→Editor→Topics→Intro→Update→Review | **NADINTERPRETACJA** | `content-optimize.har`: tylko Init → ContentOptimizer → Review → UpdateScores (~26 s). Topics/Intro/Editor to **osobne** operacje w sesji Import, nie jedna linia optimize |
| AI Visibility = wiele niezależnych widget-query | **POTWIERDZONE** | Równoległe `*Summaries`, TimeSeries, Canonicalization, FanoutQueries… |
| Modularny backend / workers / queues | **PRAWDOPODOBNE** | `ActiveTopicsAnalysis` status `SCHEDULED`→`COMPLETED` + `factDetectionUrl`; Phoenix WS sugeruje Elixir/BEAM — nie udowodnione formalnie |
| Apollo Cache + LS + IDB + memory | **NIEUDOWODNIONE** | Brak dumpów storage |
| „Nie można poznać wag AI Score” | **NADINTERPRETACJA** | Prompty/modele nadal nieznane, ale **wagi AIO są w GraphQL** |
| Brak `calculateEverything()` | **POTWIERDZONE** | Wiele wyspecjalizowanych `operationName`; brak jednego mega-endpointu |
| „>200 bundle” | **POTWIERDZONE** (niedoszacowane) | Coverage: **332** skrypty; ~15.1 MB tekstu; ~**40.4%** unused w snapshotcie |
| LocalStorage / SessionStorage / IndexedDB / Cookies analiza | **NIEUDOWODNIONE** | Brak plików |

---

## 2. Nadinterpretacje do wycięcia / złagodzenia

1. **EventSource** nie powinien być w „Potwierdzone” bez `text/event-stream` w HAR.
2. **Jeden linearny Content Engine pipeline** — HAR optimize jest krótszy; Topics/Intro żyją obok, nie w tej samej sekwencji.
3. **Segment** — vendor niepotwierdzony; first-party collector tak.
4. **„Nie można potwierdzić wag”** — za mocne wobec `AioScoreWeights`.
5. **Dashboard HAR** (`app.surferseo.com.har`) ma **0 GraphQL** — słabe źródło do twierdzeń GraphQL (używać AI Visibility + Import).
6. **Bounded contexts** — użyteczna hipoteza DDD, nie discovery z plików.
7. **Backend scoring algorithms / prompts / models / workers** — nadal w większości nieudowodnione; wyjątek: wagi AIO + async Topics.

---

## 3. Rekonstrukcja GraphQL (z HAR)

### 3.1 Transport

| Kanał | URL / wzorzec | Status |
| --- | --- | --- |
| Queries / Mutations | `POST https://app.surferseo.com/graphql` | POTWIERDZONE |
| GraphQL WS | `wss://app.surferseo.com/graphql/websocket?token=…` | POTWIERDZONE |
| Phoenix socket | `wss://app.surferseo.com/socket/websocket?vsn=2.0.0` | POTWIERDZONE |
| Collaboration | `wss://app.surferseo.com/collaboration` | POTWIERDZONE |
| Fact stream | `POST https://app.surferseo.com/fact-detection/stream/{token}` → `application/jsonl` | POTWIERDZONE |
| Auth refresh | `https://connect.surferseo.com/tokens/refresh` | POTWIERDZONE |

### 3.2 Domeny operacji (obserwowane)

| Domena | Operacje (przykłady) |
| --- | --- |
| Auth / Org | `Organizations`, `UserProfile`, `FeatureFlags`, `PrivacyConsent`, `OrganizationMembers`, `OrganizationPreferences` |
| Billing | `BillingStatus`, `PlanLimits`, `PaymentIssues`, `Trial`, `BillingUsages`, `UsedCoupons` |
| Dashboard / Workspace | `DashboardItems`, `DashboardFolders`, `DashboardTags`, `DashboardDraftCreate`, `SitesProject` |
| Content Editor | `ContentEditorById`, `FetchContentEditorWizardState`, `UpdateContentEditorWizard`, `ContentEditorThreads`, `ContentEditorUsage` |
| Content Optimizer | `InitContentOptimizer`, `ContentOptimizer`, `ReviewContentOptimization`, `ContentOptimizerCredits` |
| Scoring / AIO | `UpdateContentEditorScores`, `ScoreIntroduction`, `AioScoreWeights`, `ActiveTopicsAnalysis`, `SeoGuidelinesCompetitorsDomainScoresById` |
| AI Visibility | `AiTrackerProject`, `AiTrackerProjectSummaries`, `AiTrackerProjectBrandSummaries`, `AiTrackerProjectSourceSummaries`, `AiTrackerProjectPromptTopicSummaries`, `AiTrackerTimeSeries`, `AiTrackerProjectCanonicalization`, `AiTrackerSupportedLocations`, `AiTrackerProjectModelStatusesPerDay`, `AiTrackerFanoutQueriesPage`, `AiTrackerPromptsUsage` |
| Keywords / Maps | `SearchKeywordByPrefix`, `TopicalMap`, `TopicalMapInsights`, `TopicalMapCompetitors` |
| Audit / Site | `ContentAuditProject`, `SiteOptimizeRecommendations`, `GscAccountsList` |

### 3.3 Zależności potwierdzone (nie spekulacja)

```text
ActiveTopicsAnalysis
  status: SCHEDULED → COMPLETED
  └─ factDetectionUrl → POST /fact-detection/stream/… (JSONL)

content-optimize.har (jedna sesja ~26s):
  InitContentOptimizer
    → ContentOptimizer
      → ReviewContentOptimization
        → UpdateContentEditorScores

Intro / AIO (sesja editor):
  AioScoreWeights  ←→  ScoreIntroduction (factors + textSpan)
                   └→  UpdateContentEditorScores

AI Visibility dashboard:
  AiTrackerProject
    ├─ *Summaries (brand / source / prompt topics)
    ├─ TimeSeries
    ├─ Canonicalization
    ├─ ProjectModelStatusesPerDay
    └─ FanoutQueriesPage
```

**Uwaga:** raportowa sekwencja  
`Init → Load → ContentEditorById → ActiveTopics → ScoreIntroduction → Update → Review`  
**nie jest** jedną sekwencją z `content-optimize.har`. Elementy występują w Import/Editor HAR jako **osobne** wywołania w szerszej sesji UI.

---

## 4. Twarde wagi AIO (z odpowiedzi GraphQL)

Operacja: `query AioScoreWeights($draftPermalinkHash: String!)`

| name | weight |
| --- | ---: |
| `FACTS_COVERAGE` | **0.80** |
| `INTRODUCTION_COVERED_TOPICS` | 0.05 |
| `INTRODUCTION_TARGET_AUDIENCE` | 0.05 |
| `INTRODUCTION_TOPIC_RELEVANCE` | 0.05 |
| `INTRODUCTION_EARLY_QUERY_ANSWER` | 0.05 |

`ScoreIntroduction` zwraca per-factor: `name`, `score`, `found`, opcjonalnie `textSpan`.

To **nie** jest pełny „SEO Content Score” Surfera — tylko warstwa AIO widoczna dla draftu. Prompty LLM i modele nadal **nieznane**.

---

## 5. Editor / AI / Event — korekta architektury klienta

### Potwierdzone

```text
React SPA
  → code-split chunks (Coverage 332)
  → Apollo Client → GraphQL
  → TipTap (+ ProseMirror) + Yjs collaboration
  → WebSocket (Phoenix + GraphQL WS + /collaboration)
  → Stripe / Sentry / Mixpanel / GTM / FB
```

### Korekta względem raportu

| Raport | Po HAR |
| --- | --- |
| EventSource jako główny push | JSONL stream (POST) + WebSocket; EventSource najwyżej fallback / dead string |
| Segment confirmed | First-party `t.surferseo.com` + możliwe Segment API w bundlu |
| Jeden AI Score = jeden model | Raczej **agregacja wag** (FACTS 80% + intro 20%) — nadal bez dowodu na liczbę LLM |

---

## 6. Coverage / Lighthouse (kontekst, nie ocena SEO produktu)

| Metryka | Wartość |
| --- | --- |
| Skrypty w Coverage | 332 |
| Host `app.surferseo.com` | 321 |
| Szacunkowy unused | ~40.4% bajtów tekstu w snapshotcie |
| Lighthouse Performance | 0.35 |
| Accessibility | 0.75 |
| Best Practices | 0.92 |
| SEO (Lighthouse) | 0.58 |

Lighthouse na URL draft editora **nie** mierzy jakości Content Score Surfera.

---

## 7. Architektura Ranksmile — najpierw tylko potwierdzone wzorce

### 7.1 Must-have (wynika ze śladów Surfer, nie z mitologii)

1. **Osobne operacje / read-modele** zamiast jednego `calculateEverything()`.
2. **Async job + stream/poll** dla ciężkiej analizy (wzór: Topics `SCHEDULED` + stream).
3. **Osobne scorery + jawne wagi** (wzór: `AioScoreWeights` + factor scores).
4. **Editor TipTap** (już jest) + opcjonalny kanał realtime/collab.
5. **Dashboard AI Visibility** jako kompozycja niezależnych zapytań/widgetów.
6. **Code-split** feature bundles.

### 7.2 Nie kopiować ślepo

| Surfer | Ranksmile |
| --- | --- |
| GraphQL + Apollo | Nie obowiązkowe — REST/Next API OK, jeśli kontrakty modularne |
| Phoenix WS | Nie jest targetem stacku |
| Wagi AIO Surfera | ≠ Writing Intelligence scorecard Ranksmile |
| Apollo cache hierarchy | Wymaga własnego modelu invalidacji, nie 1:1 |

### 7.3 Docelowy przepływ Ranksmile (potwierdzone wzorce + istniejący WIE)

```text
Editor (TipTap)
  → Planner (edit plan)
  → Execution (AO / WIE Writer)
  → Judge (RX + Policy Compliance + Publish Gate)
  → Aggregator (SEO live + WI scorecard + Root Intent + Benchmark)
  → Diff / Snapshot
  → History (wie-eval history.jsonl)

Równoległe read-modele (widgety):
  Coverage | EEAT | Benchmark Top5 | Policy Compliance | AI Visibility metrics
```

**Stan obecny Ranksmile:** duża część już istnieje (WIE eval suite, `enforceOpeningPolicy`, `scoreArticleHtml`, publish gate, scorecard).  
**Luka vs Surfer:** jawny kontrakt wag AIO-like + async Topics/facts job ze streamem nie są 1:1.

---

## 8. Rekomendacje projektowe (po twardej bazie)

| Priorytet | Akcja | Dlaczego |
| --- | --- | --- |
| **P0** | Udokumentować mapę API Ranksmile jak Surfer `operationName` (nazwa → input → async? → artefakty) | Audytowalność WIE/AO |
| **P0** | Domknąć higienę publish (placeholder, Last Updated) jako hard gate przed persist | Gate jest; egzekucja incomplete |
| **P1** | Async job „topics/facts” + poll/stream zamiast synchronicznego LLM w UI | Wzór `ActiveTopicsAnalysis` + JSONL |
| **P1** | Jawny `weights` dla WI / AIO-like (facts vs intro vs SEO) | Surfer eksponuje wagi klientowi |
| **P2** | Widgetized AI Visibility reads (osobne query per panel) | Wzór `AiTracker*Summaries` |

---

## 9. Zaktualizowana ocena pewności (po audycie)

| Obszar | Ocena raportu RE | Po weryfikacji |
| --- | --- | --- |
| Frontend modularny / splitting | 9.5–10 | **POTWIERDZONE** (nawet więcej chunków niż „200+”) |
| GraphQL powierzchnia | 10 | **POTWIERDZONE** |
| EventSource | „Potwierdzone” | **NADINTERPRETACJA** → JSONL + WS |
| Segment | „Potwierdzone” | **PRAWDOPODOBNE** |
| Wagi scoringu | „Nie można” | **Częściowo POTWIERDZONE** (AIO weights) |
| Pipeline Content Engine | „Bardzo prawdopodobne” jako jedna linia | **NADINTERPRETACJA** kolejności |
| Workers / queues | „Nie można” / hipoteza | **PRAWDOPODOBNE** (SCHEDULED + stream) |
| LS/IDB cache mapa | w raporcie | **NIEUDOWODNIONE** (brak dumpów) |

---

## 10. Następne kroki (dowody, nie implementacja)

1. Dodać dumpy **Application → Storage** (LSStorage / SessionStorage / IndexedDB / Cookies) i powtórzyć sekcję cache.
2. Z HAR Import wyciągnąć **pełne query documents** (fragmenty) do mini-schematu GraphQL (SDL draft).
3. Zmapować **timeline** Import HAR (kolejność `startedDateTime`) dla Editor vs Optimize vs Topics — osobne diagramy sekwencji.
4. Dopiero potem decyzja implementacyjna Ranksmile (P0/P1 z §8).

---

*Wygenerowano na podstawie lokalnych HAR/Coverage/Lighthouse z 2026-08-02. Nie używa source map ani kodu backendu SurferSEO.*
