# CIAS-007 — Travel (synthetic outline)

**Profile:** `travel`  
**Primary query:** `co zobaczyć w Lizbonie 3 dni`  
**Source:** synthetic itinerary guide  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** Lizbona w 3 dni — plan zwiedzania  

1. Lead — dla kogo, kiedy jechać  
2. Dzień 1 — Alfama, Miradouro, tramwaj 28 (lista POI)  
3. Dzień 2 — Belém, pastéis, Mosteiro  
4. Dzień 3 — LX Factory, ocean  
5. Jedzenie — 5 rekomendacji (lista)  
6. Transport — metro/card  
7. Budżet orientacyjny  
8. FAQ — czy warto Sintra jako day trip?  
9. Podsumowanie  

---

## IR / Graph

**Entities:** Lizbona, Alfama, Belém, tramwaj 28, Sintra (location type)  
**Intents:** ic_itinerary (primary), ic_food, ic_transport, ic_daytrip  
**Facts:** „Alfama jest najstarszą dzielnicą…”; „Belém warto rano”; „Sintra = popularny day trip”  
**Lists:** heavy `list` AST — StructureSlice + readingOrder  

Recommendations = Facts with importance optional + Intent supports — not RecNode.

---

## Actions

`ADD_FACT` best season; `ANSWER_QUESTION` Sintra; `COVER_INTENT` ic_transport if thin; `FIX_STRUCTURE` if days not headed.

---

## Result

```text
MODEL_SUFFICIENT: YES
```

Rejected: ItineraryDayNode, POINode — Day = Section/Intent child; POI = Entity + Fact.
