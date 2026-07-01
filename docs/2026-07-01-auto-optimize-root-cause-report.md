# Root-Cause Report — Auto-Optimize przepisuje cały artykuł zamiast robić minimalne edycje

**Data:** 2026-07-01
**Zakres:** analiza root-cause zachowania Auto-Optimize (sub-projekt D), bez zmian w kodzie.
**Źródła (zmergowany kod na `main`):** `pages/api/articles/optimize-sections.ts`, `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, `lib/recommendationEngine.ts`, `lib/aiCoverage.ts`.
**Legenda:** *(verified)* = potwierdzone w kodzie; *(hipoteza)* = ocena inżynierska.

---

## Zweryfikowany łańcuch decyzyjny (endpoint → LLM)

```
optimize-sections.ts:126  ctx = buildArticleContext(articleId)
              :127  snapshot = ctx.coverage
              :128  guidelines = buildGuidelines(snapshot, ctx)          ← ILE guidelinów
              :133  plan = buildOptimizationPlan({sections, guidelines, context, budgetRemaining})
                         (UWAGA: brak `breakdown` — usunięty w fixie C1/C2)
   optimizationPlanner.ts:83  routed = assignGuidelinesToSections(guidelines, sections)  ← przypisanie
                        :85-104  per sekcja: rgs + secTerms → SKIP? → focus → prompt
              :142  for step of plan.steps → fetch DeepSeek
              :164  system = step.systemPrompt
              :165  user   = "Improve this section:\n\n" + CAŁY section.html
```

---

## 1. Dlaczego prawie wszystkie sekcje są optymalizowane? *(verified)*

**Jedyny warunek skip** (`optimizationPlanner.ts:92`):
```ts
if (rgs.length === 0 && secTerms.length === 0) → focus:'skip'
```
Sekcja jest pomijana **wyłącznie** gdy ma **zero** przypisanych guidelinów **i** **zero** under-target termów. Nie ma tu żadnego progu score/lift/quality. Dwa powody, dla których to prawie nigdy nie zachodzi:

- **`rgs` prawie zawsze niepuste** *(verified)*: `assignGuidelinesToSections` (`optimizeGuidelineRouting.ts:94-115`) przypisuje **każdy** guideline do jakiejś sekcji — jedyny `continue` to brak sekcji (`:108`). Nic nie odpada za niską wartość; nawet fallback z `confidence:0.1` ląduje w sekcji.
- **`secTerms` prawie zawsze niepuste** *(verified)*: `sectionMissingTerms` (`:66-71`) flaguje każdy NLP-term artykułu, który w **tej** sekcji występuje `< round(target_count*0.7)`. Termy artykułu naturalnie nie występują w każdej sekcji → prawie każda sekcja ma ≥1 „missing term" → `focus:'seo-terms'` → nie-skip.

**`buildOptimizationPlan` de facto wymusza optymalizację** dla każdej sekcji, która ma choć jeden przypisany guideline **albo** jeden brakujący term — a to niemal każda.

## 2. Dlaczego H1 / pierwsza sekcja jest ciągle rozbudowywana? *(verified — główny, konkretny bug)*

Precyzyjna ścieżka: **fallback routingu wysyła WSZYSTKIE nie-dopasowane intent-guidelines do intro**.

- `fallbackSection` (`optimizeGuidelineRouting.ts:74-76`): `if (g.group === 'intent') → sections[index===0]` (= H1 / pierwsza sekcja).
- Kiedy guideline trafia do fallbacku? Gdy `best.score < MATCH_THRESHOLD (0.15)` (`:102`). Scoring (`scoreSection:53-59`) wymaga token-overlapu tytułu guideline'a z **headingiem H2**. Tytuły intent są generyczne: „Answer the main question early", „Set expectations for the content", „Identify who it's for", „Explain why it matters to the reader" (`recommendationEngine.ts:54-58`) — **prawie nigdy nie pokrywają się z konkretnym H2** → wszystkie spadają do fallbacku → **intro**.
- Jest do 5 itemów intent (`aiCoverage` `INTENT_ITEMS`); każdy nie-fully-covered → guideline. Intro zbiera ich komplet.
- Ich instrukcje **wprost** każą dopisywać treść do początku: `intent-answer-early` → „**Rewrite the first paragraph** to directly answer…" (`recommendationEngine.ts:55`), `intent-expectations` → „**In the introduction**, set expectations: tell the reader what the article covers and what they will take away." (`:56`), `intent-who` → „**State early** who this content is for…" (`:57`).
- Focus dla intro: `focusFor` (`optimizationPlanner.ts:75`) `top.group==='intent' → 'ai-coverage'` (albo `expand`, jeśli top-item ma `needsExpansion`).

**Wniosek:** H1 rośnie, bo intent-guidelines są magnesem na intro (fallback), a ich copy dosłownie zleca dopisanie akapitów wprowadzających. To NIE bias modelu — to deterministyczny code-path.

## 3. Dlaczego LLM przepisuje zamiast minimalnie edytować? *(verified — prompt na to pozwala/zachęca)*

`buildStepPrompt` (`optimizationPlanner.ts:170-175`) skleja `SHARED_RULES + focusBlock + brand + NEGATIVE_CONSTRAINTS + OUTPUT`. Problemy:

- **Sprzeczność w SHARED_RULES** (`:138-146`): linia 141 „MINIMAL surgical edits — refine, **do not rewrite**", ale linia **145** „Do NOT remove or shorten existing sentences — **only refine or expand**" i linia **146** „Keep each paragraph between ~40 and ~80 words". Dwie ostatnie to zapadki wymuszające WZROST: nie wolno skracać, wolno „expand", a krótkie akapity trzeba dociągnąć do 40-80 słów. Model rozwiązuje sprzeczność na korzyść rozbudowy.
- **User-message** (`optimize-sections.ts:165`): `"Improve this section:\n\n" + section.html` — wysyła **cały** HTML sekcji i słowo „Improve". Ramuje zadanie jako „ulepsz całość", nie „załataj konkretny brak".
- **NEGATIVE_CONSTRAINTS** (`optimizationPlanner.ts:148`) chronią INNE sekcje/linki/tabele/nagłówki — ale **NIE zabraniają** przepisywania prozy bieżącej sekcji ani dodawania akapitów. Brak twardego limitu „zmień ≤N słów / zachowaj oryginalne brzmienie".
- **focus 'expand'** (`:161-162`): „FOCUS — **deepen this section; it is currently shallow**" — wprost każe pogłębiać.

DeepSeek wybiera duże edycje, bo prompt na to pozwala (expand dozwolony, 40-80 słów/akapit wymuszone) i prosi o „Improve" całej sekcji, bez ograniczenia zakresu zmian.

## 4. Porównanie z SurferSEO „Less" — czego brakuje *(verified przez nieobecność)*

| Surfer „Less" | Obecna implementacja |
|---|---|
| wykryj tylko brakujące sygnały | wykrywa braki, ale **każdy** quality<4 item i **każdy** under-target term (Q6) |
| oszacuj korzyść, mały zysk → skip | `expectedLift` liczone (`:96`), ale **nieużywane jako próg** — tylko do rankingu ROI-trim (Q5) |
| zachowaj brzmienie | brak „preserve wording"; prompt zabrania skracania, pozwala expand (Q3) |
| nie ruszaj wysokiej jakości tekstu | brak progu jakości na poziomie sekcji (Q5) |
| edytuj tylko lokalne fragmenty | user-message wysyła **całą** sekcję (`:165`) |

**Brakujący element:** warstwa „benefit/threshold" — planner nie ma pojęcia „ta sekcja jest wystarczająco dobra".

## 5. Czy planner ma pojęcie „good enough"? *(verified — NIE)*

- `expectedLift = diminishingLift(...)` (`optimizationPlanner.ts:96`) — liczony, ale użyty **tylko** w `trimToBudget` (`:121-122`) do rankingu ROI **i tylko gdy** `total > budgetRemaining` (`:119`). Przy budżecie w normie nic nie trimuje.
- `MATCH_THRESHOLD 0.15` (`optimizeGuidelineRouting.ts:18`) — próg **dopasowania sekcji**, nie „czy w ogóle optymalizować" (poniżej progu → fallback, nie drop).
- **Brak**: progu expectedLift, progu confidence do wykonania, cutoffu diminishing-returns, minimum ROI, min-missing-score.

**Planner NIGDY nie stwierdzi „ta sekcja jest już wystarczająco dobra."** Dodatkowo fix C1/C2 usunął per-section `missingPoints` (`buildOptimizationPlan` woła 2-arg `assignGuidelinesToSections`, `:83`) — jedyny sygnał deficytu-sekcji, który mógłby dać skip, nie istnieje. Tę lukę ma domknąć **E (`sectionMissingPoints`)**.

## 6. Czy routed guidelines są zbyt szerokie? *(verified)*

- **Ile guidelinów:** `buildGuidelines` (`recommendationEngine.ts:154-157`) filtruje `!isFullyCovered`, a `isFullyCovered = covered && quality>=4` (`:150`). Quality to skala 0-5. Więc **każdy** item o quality 0-3 (nawet „covered", nawet przyzwoity quality-3) → guideline. Plus zawsze ~5 intent + knowledge (paa/fact) + entity (termy) + readability → typowo **kilkanaście**.
- **Czy każda sekcja dostaje ≥1:** nie z definicji, ale w praktyce tak (force-assign + intent→intro + thinnest-section fallback).
- **Confidence ignorowane po przypisaniu:** *verified* — `confidence` (nawet 0.1) wpływa **tylko** na `priority` = sort bulletów (`optimizeGuidelineRouting.ts:113,117`). Nie usuwa guideline'a, nie bramkuje wykonania.

**Routing sam w sobie napędza zbędną optymalizację**: force-assign + brak progu jakości guideline'a.

## 7. Hierarchia promptu — co dominuje *(verified)*

Skład (`optimizationPlanner.ts:174`): `SHARED_RULES` → `focusBlock` → `brand` → `NEGATIVE_CONSTRAINTS` → `OUTPUT`.

- **Dominują SHARED_RULES** (najdłuższe, pierwsze, imperatywne) — a w nich zapadki wzrostu (`:145-146`).
- `focusBlock` dla `ai-coverage`/`expand` (`:160-162`) dokłada „improve answer readiness / deepen this shallow section" + listę bulletów-guidelinów.
- `NEGATIVE_CONSTRAINTS` (`:148`) są krótkie i celują w INNE sekcje/linki — słabsze niż imperatyw „only refine or expand".

Model interpretuje to jako **„rewrite/improve this section"**, nie „zmień jak najmniej" — bo (a) user-msg mówi „Improve" + cała sekcja, (b) reguły zabraniają skracać i wymuszają 40-80 słów, (c) brak twardego „minimal diff".

## 8. Wszystkie ścieżki do `focus = "expand"` *(verified)*

Jedyne źródło: `focusFor` (`optimizationPlanner.ts:76`): `if (top?.effort === 'Large') → 'expand'`, gdzie `top = rgs[0].guideline` (guideline o najwyższym `priority`). `effort === 'Large'` z `effortOf` (`recommendationEngine.ts:35-40`): **`item.needsExpansion === true` LUB `item.missing.length > 5`**. (Pośrednio `knowledgeTemplate` robi też tytuł „Expand: …" dla `needsExpansion` — `:79` — ale focus decyduje wyłącznie `effortOf`.)

## 9. Dlaczego świetne artykuły i tak się zmieniają? *(verified)*

Root cause: **brak bramki „good enough"** (Q5) + **niski próg guideline'a** (Q6). Konkretnie:
- Dowolny item o quality **3** (dobry, nie 4+) → guideline (`isFullyCovered` wymaga ≥4, `recommendationEngine.ts:150`).
- Dowolny NLP-term poniżej **70%** target w danej sekcji → „missing term" (`optimizationPlanner.ts:69`), nawet gdy globalnie „mostly satisfied".
- Authority: obecnie **pusty bucket** (produkcja w E) → nie chroni ani nie generuje.
- Nawet gdyby sekcja miała 0 guidelinów i 0 missing-terms → skip; ale te dwa niskie progi czynią to rzadkością.

Nie ma warunku „score sekcji ≥ X → nie ruszaj".

## 10. Root-Cause Report

### A. Diagram łańcucha decyzji
```
snapshot.items ──filter !(covered&&quality>=4)──> guidelines (kilkanaście, w tym ~5 intent)
      │
      ▼ assignGuidelinesToSections (force-assign, nic nie odpada)
   match H2? ──no──> fallback: intent→INTRO,  reszta→thinnest section   (confidence 0.1, ale i tak aplikowane)
      │
      ▼ per sekcja
   SKIP  ⟺  rgs==0 && secTerms==0        ← JEDYNY warunek, brak progu score/lift/quality
   else  focus = intent→ai-coverage | effort Large→expand | know/auth→ai-coverage | terms→seo-terms | readability
      │
      ▼ buildStepPrompt: SHARED_RULES(minimal…ale „only refine or expand" + „40-80 słów") + focus(„deepen/improve") + weak NEGATIVE
      ▼ user = „Improve this section:" + CAŁY HTML
      ▼ DeepSeek → duża edycja
```

### B. Warunki powodujące optymalizację
`rgs.length>0` (prawie zawsze — force-assign) **LUB** `secTerms.length>0` (prawie zawsze — per-section 70% próg). `optimizationPlanner.ts:92`.

### C. Warunki powodujące skip
Tylko dwa: (1) `rgs==0 && secTerms==0` (`:92`); (2) `trimToBudget` demota do skip **gdy** `total estimatedTokens > budgetRemaining` (`:119,130-132`). Poza budżetem — nic nie skipuje z powodu jakości.

### D. Warunki powodujące expand
`top.effort==='Large'` (`:76`) ⟸ `item.needsExpansion || item.missing.length>5` (`recommendationEngine.ts:37`).

### E. Dlaczego H1 rośnie
Intent-guidelines nie matchują H2 → fallback do intro (`optimizeGuidelineRouting.ts:74-76`); ich copy każe „Rewrite the first paragraph" / „In the introduction…" (`recommendationEngine.ts:55-56`). *(verified)*

### F. Dlaczego prawie każda sekcja się zmienia
Niski próg guideline'a (quality<4, `recommendationEngine.ts:150`) + force-assign routingu (`optimizeGuidelineRouting.ts:94-115`) + per-section missing-terms na 70% (`optimizationPlanner.ts:69`) + brak bramki „good enough" (`:92`). *(verified)*

### G. Czyj to problem + szacunek udziału
*(przyczyny verified; procenty = ocena inżynierska, nie pomiar)*

**Kombinacja, zdominowana przez planner + prompt:**

| Warstwa | Udział | Dlaczego |
|---|---:|---|
| **Planner** (brak progu „good enough"; skip tylko przy 0/0; expectedLift nieużywany jako bramka; missingPoints usunięty w C1/C2) | **~40%** | Bez tego świetne sekcje i tak przechodzą |
| **Prompt** (SHARED_RULES: „only refine or expand" + „40-80 słów"; „deepen/improve"; user „Improve"+cały HTML; słabe negative constraints) | **~30%** | Zamienia „załataj brak" w „przepisz sekcję" |
| **Recommendation Engine** (guideline dla quality<4; zawsze ~5 intent) | **~15%** | Za dużo guidelinów, za niski próg |
| **Routing** (force-assign; intent→intro magnes; confidence nie bramkuje) | **~10%** | Napędza H1 + zapełnia sekcje |
| **DeepSeek** (intrinsic) | **~5%** | Posłusznie wykonuje permisywny prompt — nie jest głównym winowajcą |

**To NIE jest głównie problem DeepSeeka.** To brak warstwy „benefit/threshold" w plannerze (świadomie odłożonej — `sectionMissingPoints` do **E**), wzmocniony przez prompt, który dosłownie pozwala/wymusza rozbudowę, i przez routing, który wpycha generyczne intent-guidelines do H1.

---

*Raport oparty w 100% na zmergowanym kodzie. Bez zmian w kodzie, bez propozycji fixów — zgodnie z poleceniem.*
