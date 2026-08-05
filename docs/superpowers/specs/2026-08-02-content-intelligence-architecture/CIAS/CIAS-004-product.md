# CIAS-004 — Product (synthetic outline)

**Profile:** `product`  
**Primary query:** `iPhone 17 Pro`  
**Source:** synthetic product explainer (not Apple copy)  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** iPhone 17 Pro — specyfikacja, aparat i dla kogo  

1. Lead — dla kogo Pro vs zwykły 17  
2. Specyfikacja (lista/tabela-as-list): chip A19 Pro, RAM, storage tiers, display 6.3", IP68  
3. Aparat — 48MP main, tetraprism zoom (synthetic claims), video  
4. Bateria i ładowanie — hours video, USB-C  
5. Porównanie krótko vs iPhone 16 Pro (delta facts)  
6. Ceny (synthetic regions)  
7. FAQ — czy warto upgrade z 15 Pro?  
8. Podsumowanie  

---

## AST stress

`list` for specs; optional `table` block if present — LexicalAst has `table`. No SpecSheetNode.

---

## IR / Facts (sample)

| id | statement | status |
|----|-----------|--------|
| f1 | iPhone 17 Pro ma chip A19 Pro | covered |
| f2 | Ekran ma przekątną 6,3 cala | covered |
| f3 | Główny aparat to 48 MP | covered |
| f4 | Port to USB-C | covered |
| f5 | Względem 16 Pro poprawiono zoom optyczny | partial (marketing vague) |
| f6 | Cena startowa w PL to X zł | weak / missing evidence |

**Intents:** ic_specs (primary), ic_camera, ic_vs16, ic_price, ic_who  

**Entities:** iPhone 17 Pro, A19 Pro, USB-C, iPhone 16 Pro  

Comparison to 16 Pro = Facts with subject/object both product entities — **not** ComparisonNode.

---

## Actions

`STRENGTHEN_EVIDENCE` f5; `ADD_FACT` battery hours with number; `ANSWER_QUESTION` upgrade-from-15.

---

## Result

```text
MODEL_SUFFICIENT: YES
```

Rejected unfreeze: SkuNode, PriceNode (price = Fact + time/location optional).
