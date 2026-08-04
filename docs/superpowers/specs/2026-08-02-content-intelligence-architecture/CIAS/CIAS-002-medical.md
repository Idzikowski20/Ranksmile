# CIAS-002 — Medical (synthetic outline)

**Profile:** `medical`  
**Primary query:** `objawy cukrzycy typu 2`  
**Source:** **synthetic outline** (not scraped YMYL page) — invented for falsification only  
**RFC:** v1.0 FROZEN — try to break the model  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic article outline (source text for paper compile)

> Cel: realistyczna struktura poradnika medycznego PL, bez kopiowania konkretnej witryny.

**Title:** Objawy cukrzycy typu 2 — jak je rozpoznać i kiedy iść do lekarza  

**H2 / body outline:**

1. **Wprowadzenie (problem-first)**  
   Cukrzyca typu 2 długo bywa bezobjawowa; wczesne sygnały łatwo zbagatelizować. Artykuł wyjaśnia typowe objawy, co je odróżnia od typu 1 oraz kiedy szukać pomocy.

2. **Czym jest cukrzyca typu 2?**  
   Definicja: zaburzenie metaboliczne z insulinoodpornością i względnym niedoborem insuliny; hiperglikemia przewlekła.  
   Różnica skrótowa vs typ 1 (autoimmuno / brak produkcji).

3. **Najczęstsze objawy** (lista)  
   - wzmożone pragnienie (polydipsja)  
   - częste oddawanie moczu (poliuria)  
   - zmęczenie  
   - niewyraźne widzenie  
   - wolniejsze gojenie ran  
   - nawracające infekcje  
   - mrowienie stóp / neuropatia (często późniejsza)

4. **Objawy mniej oczywiste**  
   Świąd, suchość skóry, ciemniejsze przebarwienia skóry (acanthosis nigricans), spadek libido, nawracające drożdżyce.

5. **Kiedy iść do lekarza / red flags**  
   Silne pragnienie + nagła utrata masy, wymioty, zaburzenia świadomości → pilna pomoc.  
   Rutynowo: objawy + czynniki ryzyka (nadwaga, rodzinnie, >45 lat) → glikemia na czczo / HbA1c (u lekarza).

6. **Jak diagnozuje się cukrzycę typu 2?** (krótko)  
   Kryteria laboratoryjne (orientacyjnie): glikemia na czczo, OGTT, HbA1c — **bez podawania konkretnych progów jako „porady medycznej”**; odesłanie do konsultacji.

7. **Czego artykuł nie robi**  
   Nie zastępuje diagnozy; nie dawkuje leków; źródła ogólne (np. towarzystwa diabetologiczne — placeholder citation).

8. **Podsumowanie + FAQ**  
   - Czy cukrzyca typu 2 zawsze boli? Nie.  
   - Czy pragnienie zawsze oznacza cukrzycę? Nie.  
   - Czy da się odwrócić wczesne zmiany? Częściowo stylem życia — pod kontrolą lekarza.

---

## 1. Lexical AST (paper)

| blockId | type | content |
|---------|------|---------|
| b0 | heading:1 | Objawy cukrzycy typu 2 — … |
| b1 | paragraph | Lead problem-first |
| b2 | heading:2 | Czym jest cukrzyca typu 2? |
| b3 | paragraph | Definicja + insulinoodporność |
| b4 | paragraph | Kontrast typ 1 vs typ 2 |
| b5 | heading:2 | Najczęstsze objawy |
| b6 | list | 7 bullet symptoms |
| b7 | heading:2 | Objawy mniej oczywiste |
| b8 | paragraph | Acanthosis, drożdżyce, … |
| b9 | heading:2 | Kiedy do lekarza |
| b10 | paragraph | Red flags |
| b11 | paragraph | Ryzyko → badania (bez dawek leków) |
| b12 | heading:2 | Diagnostyka (orientacyjnie) |
| b13 | paragraph | Glikemia / OGTT / HbA1c + disclaimer |
| b14 | heading:2 | Ograniczenia artykułu |
| b15 | paragraph | Not medical advice + citation placeholder |
| b16 | heading:2 | Podsumowanie |
| b17 | paragraph | Summary |
| b18 | heading:2 | FAQ |
| b19 | paragraph | Q: Czy zawsze boli? |
| b20 | paragraph | Q: Czy pragnienie = cukrzyca? |
| b21 | paragraph | Q: Czy da się odwrócić? |

**Parser stress:** long symptom `list`; FAQ as H2+paragraphs (not special FAQ node).  
**Pain:** none — no need for `FaqNode` or `DoseNode`.

---

## 2. Semantic AST

| id | blocks | role |
|----|--------|------|
| d_def | b2–b4 | definition |
| d_ex | b5–b8 | example / symptom inventory |
| d_cons | b9–b11 | consequence / action thresholds |
| d_proc | b12–b13 | process (diagnostics overview) |
| d_warn | b14–b15 | warning / disclaimer |
| d_sum | b16–b17 | summary |
| d_faq | b18–b21 | faq |

---

## 3. IR — SemanticCandidate

### IntentCandidate
| id | label | primary |
|----|-------|---------|
| ic_sym | Jakie są objawy cukrzycy typu 2? | yes |
| ic_def | Czym jest cukrzyca typu 2? | no |
| ic_when | Kiedy do lekarza? | no |
| ic_dx | Jak się diagnozuje? | no |
| ic_faq | FAQ / mity | no |

### QuestionCandidate
| id | question | intent |
|----|----------|--------|
| q_sym | Jakie są najczęstsze objawy? | ic_sym |
| q_subtle | Jakie są mniej oczywiste objawy? | ic_sym |
| q_urgent | Kiedy szukać pilnej pomocy? | ic_when |
| q_pain | Czy cukrzyca typu 2 zawsze boli? | ic_faq |
| q_thirst | Czy pragnienie zawsze oznacza cukrzycę? | ic_faq |

### EntityCandidate
`cukrzyca typu 2`, `insulina`, `insulinoodporność`, `hiperglikemia`, `HbA1c`, `OGTT`, `polydipsja`, `poliuria`, `neuropatia`, `acanthosis nigricans`, `lekarz`

### FactCandidate (sample — synthetic atoms)

| id | statement | subject | predicate | object | status (outline “covered”) |
|----|-----------|---------|-----------|--------|------------------------------|
| f1 | Cukrzyca typu 2 wiąże się z insulinoodpornością | cukrzyca typu 2 | associated_with | insulinoodporność | covered |
| f2 | Typowe objawy obejmują polydipsję i poliurię | cukrzyca typu 2 | presents_with | polydipsja+poliuria | covered |
| f3 | Cukrzyca typu 2 może długo przebiegać bezobjawowo | cukrzyca typu 2 | may_be | asymptomatic | covered |
| f4 | Niewyraźne widzenie może być objawem hiperglikemii | hiperglikemia | can_cause | blurred vision | covered |
| f5 | Acanthosis nigricans może towarzyszyć insulinoodporności | acanthosis | associated_with | insulinoodporność | covered |
| f6 | Red-flag: silne pragnienie + zaburzenia świadomości wymaga pilnej pomocy | patient | should_seek | emergency care | covered |
| f7 | Diagnostyka opiera się m.in. na glikemii na czczo, OGTT, HbA1c | diagnosis | uses | lab tests | covered |
| f8 | Artykuł nie zastępuje konsultacji lekarskiej | article | does_not_replace | medical advice | covered |
| f9 | Cukrzyca typu 2 nie zawsze powoduje ból | cukrzyca typu 2 | not_always | painful | covered |
| f10 | Pragnienie nie jest patognomoniczne dla cukrzycy | polydipsja | not_pathognomonic_for | cukrzyca | covered |

**YMYL note:** numeric diagnostic cutoffs intentionally **omitted** from facts (avoid inventing clinical thresholds). Representable as `missing` Fact “HbA1c threshold per guidelines” if SERP required it — still a Fact, not a new type.

---

## 4. Knowledge Graph (edges)

```text
f1 -uses-> ent_dm2
f1 -uses-> ent_insulin_resist
f1 -statedIn-> b3
f1 -supportedBy-> ev_f1 (context snippet in b3)

f2 -uses-> ent_polydipsia
f2 -statedIn-> b6
f2 -supportedBy-> ev_f2_list (list bullets)

ic_sym -answers-> q_sym
f2 -supports-> ic_sym
topic_symptoms -supports-> ic_sym
ent_dm2 -belongsTo-> topic_symptoms

f6 -supports-> ic_when
f8 -references-> cit_disclaimer (placeholder authority)
f7 -uses-> ent_hba1c
```

**Constraint paper-check:** facts have entity/subject + evidence or would be weak; primary intent has questions.  
**Citation:** `references` / CitationRecord — already in CCM; no new node kind.

---

## 5. Reasoning (confidence)

```text
f2 (0.85) -supports/0.9-> ic_sym (≈0.85)
ic_sym -explains-> coverage:symptoms
coverage:symptoms -recommends-> (optional ADD_FACT for less-common symptoms if thin)
```

Bottleneck ≠ 1.0.

---

## 6. Action Graph

Assume outline is “good but thin” on less-obvious symptoms + missing guideline citation:

| id | DSL | path |
|----|-----|------|
| a1 | `STRENGTHEN_EVIDENCE` f5 (acanthosis) | f5→ic_sym |
| a2 | `ADD_FACT` statement about family-history risk factor → ic_when | ic_when |
| a3 | `COVER_INTENT` ic_dx if diagnostics paragraph too vague | ic_dx |
| a4 | op stays within DSL — citation via `references` on fact / STRENGTHEN | f7 |

No `ADD_DOSE` / `ADD_CONTRAINDICATION` ops needed for this outline.

---

## 7. Coverage Projection

Derived from statuses of ic_* / f* / q* — output only. Primary `ic_sym` covered if f2–f5 present.

---

## 8. Visibility Projection

Clusters: Definition · Core symptoms · Subtle symptoms · Urgency · Diagnostics disclaimer · FAQ myths.  
Atoms = Fact.statement list above (+ expandable).

---

## 9. Planner

`strategy=balanced`, `maxActions=3` → select a1, a2, a3. Stateless.

---

## 10. Judge

After AO: expect status flips on f5 evidence, new risk-factor fact, no hallucinated drug doses (presentation/policy allowlist can still scan HTML for “mg” patterns — orthogonal to CCM).

---

## 11. Criteria checklist

| Criterion | OK? |
|-----------|-----|
| Fact → entity/subject + evidence/weak + section | YES |
| Primary intent → ≥1 question | YES |
| Covered question → fact | YES |
| Recommendation → reasoning + DSL | YES |
| Coverage is projection | YES |
| YMYL without DoseNode / ConditionNode | YES (Fact + warning discourse + citation) |

---

## 12. Falsification result

```text
MODEL_SUFFICIENT: YES
```

**Temptations rejected (would have been bad unfreeze):**
- `SymptomNode` — symptoms are Facts + Entities  
- `DisclaimerNode` — presentation/warning discourse + Fact f8  
- `LabThresholdNode` — optional Fact with `time`/source or status `missing`  
- FAQ-specific schema — Questions + paragraphs  

**Pain (extraction only):** medical NER / guideline freshness — not a model gap.

---

## Synthetic outline file (compact)

Same content as §0 — kept in this CIAS file as the sole source. No external URL.
