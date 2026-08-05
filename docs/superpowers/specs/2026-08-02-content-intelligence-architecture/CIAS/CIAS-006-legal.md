# CIAS-006 — Legal (synthetic outline)

**Profile:** `legal`  
**Primary query:** `prawo do bycia zapomnianym RODO`  
**Source:** synthetic explainer (not legal advice)  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** Prawo do bycia zapomnianym (RODO) — czym jest i kiedy nie przysługuje  

1. Lead — art. 17 RODO w skrócie + disclaimer  
2. Definicja — prawo żądania usunięcia danych osobowych  
3. Kiedy przysługuje (lista przesłanek)  
4. Wyjątki — wolność wypowiedzi, obowiązki prawne, cele archiwalne, …  
5. Jak złożyć wniosek (process)  
6. Termin odpowiedzi administratora (Fact z „co do zasady 30 dni” — weak/citation)  
7. Czego nie obejmuje (np. pełne „wymazanie internetu”)  
8. FAQ  
9. Podsumowanie + „to nie porada prawna”

---

## IR / Graph

**Intents:** ic_def (primary), ic_when, ic_exceptions, ic_howto_request  

**Facts:** definicja art. 17; przykładowe przesłanki; wyjątki jako Facts `subject=right, predicate=does_not_apply_when, object=…`; disclaimer Fact.  

**Conflict stress:** popular myth „zawsze muszą usunąć” vs wyjątki → `contradicts` between myth Fact (`hallucinated`/`outdated` if stated as absolute) and exception Facts.

**Citations:** `references` → Regulation (EU) 2016/679 placeholder.

---

## Actions

`ADD_FACT` for each major exception if missing; `RESOLVE_CONFLICT` myth vs law; `STRENGTHEN_EVIDENCE` with citation; `FIX_PRESENTATION` disclaimer early.

---

## Result

```text
MODEL_SUFFICIENT: YES
```

Rejected: ExceptionNode, LegalConditionNode — exceptions are Facts + Intent `ic_exceptions` + contradicts edges.
