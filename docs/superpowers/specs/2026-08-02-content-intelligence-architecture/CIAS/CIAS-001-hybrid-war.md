# CIAS-001 — Hybrid War (Gold Standard)

**Profile:** `generic` / blog-like encyclopedia  
**Primary query:** `wojna hybrydowa`  
**Source signals:** SurferSEO article ~96 SEO / AI Visibility covered; terms + 28 atomic facts from product audit (2026-08)  
**CIAS question:** Does RFC v0.4 represent this article’s full pipeline without new fields?  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Article role in suite

Gold standard: if Hybrid War cannot be modeled cleanly, stop.  
We do **not** score the Surfer article here. We ask: *can CCM hold what Surfer optimized?*

---

## 1. Lexical AST (paper)

Stable `blockId` sketch (not full text — structure fidelity):

| blockId | type | text / title |
|---------|------|----------------|
| b0 | heading:1 | Wojna hybrydowa (title) |
| b1 | paragraph | Lead / definition opener |
| b2 | heading:2 | Co to jest wojna hybrydowa? |
| b3 | paragraph | Definition body |
| b4 | list | Cechy (poniżej progu, militarne+niemilitarne, …) |
| b5 | heading:2 | Środki i metody |
| b6 | paragraph | Cyber, dezinformacja, migracja, ekonomia |
| b7 | heading:2 | Przykłady historyczne |
| b8 | paragraph | Krym 2014 |
| b9 | paragraph | Donbas / Ukraina 2022 cyber |
| b10 | paragraph | Granica PL 2021 migracja |
| b11 | paragraph | Hezbollah Liban 2006 |
| b12 | heading:2 | Konsekwencje i plausible deniability |
| b13 | paragraph | Attribution, synergic threats |
| b14 | heading:2 | Podsumowanie |
| b15 | paragraph | Summary synthesis |

**Parser stress:** lists under features — must remain `list`/`list_item`, not flattened into one paragraph.  
**Pain:** none (structure fits LexicalAst types).

---

## 2. Semantic AST (paper)

| id | blockId | role | note |
|----|---------|------|------|
| d1 | b2–b3 | definition | primary definition discourse |
| d2 | b4 | other/characteristics | feature list |
| d3 | b7–b11 | example | historical exemplars |
| d4 | b12–b13 | consequence | legal/political effects |
| d5 | b14–b15 | summary | close |
| c1…cN | various | factish claims | map 1:1 to AI Visibility statements |

**Pain:** none.

---

## 3. IR — SemanticCandidate (typed)

### IntentCandidate
| id | label | primary | priority |
|----|-------|---------|----------|
| ic_def | Definicja wojny hybrydowej | yes | 1.0 |
| ic_means | Środki hybrydowe | no | 0.8 |
| ic_ex | Przykłady | no | 0.85 |
| ic_cons | Konsekwencje / odpowiedzialność | no | 0.75 |
| ic_sum | Podsumowanie | no | 0.5 |

### QuestionCandidate
| id | question | intent |
|----|----------|--------|
| q_what | Co to jest wojna hybrydowa? | ic_def |
| q_below | Co znaczy „poniżej progu wojny”? | ic_def |
| q_cyber | Jaką rolę grają cyberataki? | ic_means |
| q_ex | Jakie są przykłady (Krym, Donbas, PL, Hezbollah)? | ic_ex |
| q_deny | Czym jest plausible deniability? | ic_cons |

### EntityCandidate (sample)
`Rosja`, `Krym`, `Donbas`, `Ukraina`, `Polska`, `Hezbollah`, `Liban`, `NATO` (optional), `cyberprzestrzeń`, `media społecznościowe`

### FactCandidate (all 28 gold statements → kind:fact)

Surface forms = Surfer AI Visibility list (canonical `statement`). RDF-lite filled on paper for a sample:

| id | statement (short) | subject | predicate | object | time |
|----|-------------------|---------|-----------|--------|------|
| f7 | Rosja anektowała Krym w 2014 | Rosja | annexed | Krym | 2014 |
| f8 | Kryzys migracyjny PL 2021 | kryzys migracyjny | occurred_at | granica PL | 2021 |
| f9 | Cyberataki UA przed 2022 | Ukraina | suffered | cyberattacks | pre-2022 |
| f11 | Hezbollah hybrydowo Liban 2006 | Hezbollah | used | hybrid methods | 2006 |
| f1 | Agresor unika walki konwencjonalnej | agresor | avoids | open conventional fight | — |
| … | *(remaining 23 statements same pattern)* | | | | |

Full enumeration of 28 statements is the Visibility gold set (see §7). No new fact fields required beyond RFC FactNode.

**Pain:** none — `statement` + SPO + time covers Surfer atoms.

---

## 4. Knowledge Graph (edges)

```text
f7 -uses-> ent_rosja
f7 -uses-> ent_krym
f7 -statedIn-> b8
f7 -supportedBy-> ev_f7_date   (snippet "2014", kind=date, blockId=b8)

ic_def -answers-> q_what
topic_cyber -belongsTo- ent_cyber  (via entities)
topic_cyber -supports-> ic_means
f4 -uses-> ent_cyber; f4 -supports path-> ic_means
f16 -uses-> ent_plausible; supports ic_cons
```

**Constraint check (paper):**
- Each listed Fact has entity or subject ✓  
- Covered facts have evidence or would be weak ✓  
- Primary intent has questions ✓  

**Pain:** none. Entity vs Topic: `Rosja` = entity; `cyberataki` can be entity *or* topic cluster — both representable (`entity` + `topic` + `belongsTo`).

---

## 5. Reasoning Graph (sample path)

```text
f7 (conf 0.95) -supports/weight 0.9-> ic_ex (conf 0.9)
ic_ex -explains-> coverage:examples (conf 0.9)
coverage:examples -recommends-> (no action on gold; path exists)
```

Bottleneck propagation: min along path ≈ 0.9 — **not** forced to 1.0.

---

## 6. Action Graph

**On gold (all 28 covered):** high-priority ActionGraph is **empty** (or only optional polish). That is valid — Planner returns empty `selected`.

**Gap scenario (validation of Planner):** pretend f7, f11, f16 missing →

| action | DSL | dependsOn | rationalePath |
|--------|-----|-----------|---------------|
| a1 | `COVER_INTENT` ic_ex | — | ic_ex |
| a2 | `ADD_FACT` f7 shape → ic_ex | a1 | ic_ex←missing f7 |
| a3 | `STRENGTHEN_EVIDENCE` after add | a2 | f7 |
| a4 | `ADD_FACT` Hezbollah 2006 | a1 | ic_ex |
| a5 | `ADD_FACT` plausible deniability | — | ic_cons |

**Pain:** none — DSL ops suffice; no string-only recommendations required.

---

## 7. Coverage Projection (effect, not input)

Derived from graph statuses:

- Intents ic_* mostly `covered` on gold  
- Facts f1–f28 `covered`  
- Coverage overall high — **projection output**, not something we fed the compiler  

---

## 8. Visibility Projection

| cluster | facts | completeness |
|---------|-------|--------------|
| Definition / nature | f1–f6, f15, f25–f28 | 1.0 |
| Russia / Ukraine timeline | f7–f10, f12, f21, f24 | 1.0 |
| Cyber / info | f4, f13, f20, f22–f23 | 1.0 |
| Migration / deniability | f8, f14, f16–f19 | 1.0 |
| Hezbollah exemplar | f11 | 1.0 |

Atomic statements = 28 Fact.statement values. Clustering needs no new field (`VisibilityCluster` in RFC).

---

## 9. Planner (stateless)

Gold: `strategy=balanced`, `budget.maxActions=5` → `selected=[]`, `deferred=[]`.  
Gap scenario: selects a1–a5 under budget — Input→Plan→Done, no planner memory.

---

## 10. Judge (paper)

Would check ModelDiff on AO applying a2–a5: status flips missing→covered, scoreDelta > 0, no new conflicts. No HTML fact extraction.

---

## 11. Structural criteria checklist

| Criterion | OK? |
|-----------|-----|
| Fact → entity/subject + evidence/weak + section | YES |
| Primary intent → ≥1 question | YES |
| Covered question → fact | YES |
| Recommendation → reasoning path + DSL | YES (gap scenario) |
| Coverage is projection | YES |

---

## 12. MODEL_SUFFICIENT

```text
MODEL_SUFFICIENT: YES
```

**No new RFC fields.** Surfer terms map to Entity/Topic signals; AI Visibility maps to FactNode.statement (+ SPO).  

**Extraction difficulty** (LLM/NER later) is out of scope for CIAS — representation succeeded.

---

## Follow-ups (do not block YES)

- Optional: persist full 28× SPO table in fixture file for compiler tests later  
- Optional: attach real HTML dump when available under `docs/fixtures/cias/hybrid-war/`  
