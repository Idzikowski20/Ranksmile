# CIAS-008 — Comparison (synthetic outline) — hard case

**Profile:** `product`  
**Primary query:** `RTX 5070 vs RTX 5080`  
**Source:** synthetic GPU comparison (fictional SKU details OK for CIAS)  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** RTX 5070 vs RTX 5080 — która karta do 1440p / 4K?  

1. Lead — werdykt w 2 zdaniach (dla kogo która)  
2. Specyfikacja porównawcza (lista lub tabela 2 kolumn): CUDA cores, VRAM, TDP, MSRP  
3. Wydajność raster 1440p / 4K (synthetic %)  
4. Ray tracing / DLSS  
5. Zużycie energii i kultura pracy  
6. Cena / wartość (performance per dollar)  
7. Werdykt — Intent summary  
8. FAQ — czy 5070 wystarczy do 4K?; czy warto dopłacać do 5080?  

---

## AST stress

`table` with two product columns — allowed. If only lists: still OK.

---

## IR — comparison without ComparisonNode

**Entities:** RTX 5070, RTX 5080, DLSS, 1440p, 4K  

**Intents:**  
- ic_compare (primary) — „która lepsza / dla kogo”  
- ic_specs, ic_perf, ic_value  

**Questions:** Która do 1440p?; Ile VRAM?; Czy dopłata do 5080 ma sens?  

**Facts (pairwise SPO):**
| id | subject | predicate | object | statement |
|----|---------|-----------|--------|-----------|
| f1 | RTX 5080 | has_vram_gb | 16 | 5080 ma 16 GB VRAM |
| f2 | RTX 5070 | has_vram_gb | 12 | 5070 ma 12 GB VRAM |
| f3 | RTX 5080 | faster_raster_1440p_than | RTX 5070 | 5080 jest szybsza w raster 1440p o ~X% |
| f4 | RTX 5070 | better_value_than | RTX 5080 | 5070 lepszy stosunek cena/wydajność (synthetic) |
| f5 | RTX 5080 | recommended_for | 4K | 5080 sensowniejsza do 4K |

Subgraph motif for Benchmark:  
`Intent(ic_compare) ←supports— Fact* —uses→ Entity(5070|5080)`  
`findSubgraph` — no new type.

Discourse role `comparison` on sections b2–b6 — Semantic AST already has flexible roles (use `other` or extend role union only if CIAS forced NO — **not forced**: `other` + Intent label enough).  
Check RFC SemanticAst roles: `'definition' | 'example' | 'consequence' | 'summary' | 'faq' | 'other'` — comparison sections = `other`. **OK.**

---

## Actions

`ADD_FACT` power draw both SKUs; `ANSWER_QUESTION` 4K on 5070; `COVER_INTENT` ic_value; `STRENGTHEN_EVIDENCE` on % claims.

---

## Hard-case temptations (rejected)

| Temptation | Why unnecessary |
|------------|-----------------|
| ComparisonNode | Pairwise Facts + dual Entity |
| WinnerField on CCM | Projection / Intent summary Fact |
| SpecMatrix type | table AST + Facts |

---

## Result

```text
MODEL_SUFFICIENT: YES
```

Hard case passed on frozen RFC v1.0 without unfreeze.
