# CIAS-003 — News (synthetic outline)

**Profile:** `news`  
**Primary query:** `Apple kupuje PixelForge` (synthetic brand)  
**Source:** synthetic wire-style article  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** Apple kupuje startup PixelForge za 2,1 mld USD  

1. **Lead** — Apple ogłosiło przejęcie PixelForge (AI imaging); transakcja ~2,1 mld USD; zamknięcie w Q4 (synthetic year Y).  
2. **Co wiadomo o dealu** — gotówka; zgody antymonopolowe w toku; PixelForge zostaje w Cupertino.  
3. **Kim jest PixelForge** — 2019, 180 osób, modele upscalingu wideo; ostatnia runda Series C.  
4. **Dlaczego Apple** — lukа w generatywnym wideo vs konkurencja; cytat CEO (synthetic).  
5. **Timeline** — rozmowy od marca Y; wyciek w maju; oficjalnie 12 czerwca Y.  
6. **Konflikty relacji** — źródło A: 2,1 mld; źródło B wcześniej spekulowało 1,5 mld → later corrected.  
7. **Co dalej** — integracja z Final Cut / Vision; brak planów zwolnień (deklaracja).  
8. **Podsumowanie**

---

## 1–2. AST

| blockId | type | note |
|---------|------|------|
| b0 | h1 | title |
| b1 | p | lead w/ money + date |
| b2 | h2 | Deal |
| b3 | p | cash, regulators |
| b4 | h2 | PixelForge |
| b5 | p | founding 2019 |
| b6 | h2 | Motyw Apple |
| b7 | p | competitive gap |
| b8 | h2 | Timeline |
| b9 | list | Mar → May leak → 12 Jun announce |
| b10 | h2 | Rozbieżności kwot |
| b11 | p | 2.1 vs earlier 1.5 rumor |
| b12 | h2 | Next |
| b13 | p | product integration |
| b14 | h2 | Summary |
| b15 | p | wrap |

Discourse: definition-ish (company), example N/A, consequence (market), process (timeline).

---

## 3. IR (sample)

**Intents:** ic_deal (primary), ic_who, ic_why, ic_timeline, ic_next  

**Questions:** Ile zapłacono?; Kiedy ogłoszono?; Co robi PixelForge?; Czy są zgody antymonopolowe?  

**Entities:** Apple, PixelForge, Cupertino, Final Cut, CEO_*  

**Facts:**
| id | statement | time | status |
|----|-----------|------|--------|
| f1 | Apple ogłosiło przejęcie PixelForge | 12 Jun Y | covered |
| f2 | Kwota transakcji to ok. 2,1 mld USD | Y | covered |
| f3 | PixelForge założono w 2019 | 2019 | covered |
| f4 | Rozmowy trwały od marca Y | Mar Y | covered |
| f5 | Wcześniejsze spekulacje mówiły o 1,5 mld USD | May Y | covered (+ `contradicts` soft vs f2 → status path: rumor outdated) |
| f6 | Zamknięcie planowane na Q4 Y | Q4 Y | partial (forward-looking) |

`f5` vs `f2`: edge `contradicts` or f5 `outdated` — **existing statuses/edges**, no ConflictNode.

---

## 4–6. Graph / Reasoning / Actions

```text
f1 -uses-> ent_apple; f1 -uses-> ent_pixelforge; f1 -supportedBy-> date in b1
f5 -contradicts-> f2  OR  f5 status=outdated
ic_deal -answers-> q_price
```

**Actions (thin article gap):** `ADD_FACT` antitrust jurisdiction; `REFRESH_OUTDATED` if only 1.5 figure remains; `STRENGTHEN_EVIDENCE` f2 with source citation.

---

## 7–10. Projections / Planner / Judge

Visibility clusters: Deal · Company · Timeline · Rumor correction.  
Planner: pick antitrust + citation. Judge: rumor flip outdated; no HTML re-parse.

---

## Criteria / result

FAQ/timeline/list fit LexicalAst. Freshness via Fact.time + `outdated`.  

```text
MODEL_SUFFICIENT: YES
```
