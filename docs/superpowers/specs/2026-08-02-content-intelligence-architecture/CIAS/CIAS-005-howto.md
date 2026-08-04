# CIAS-005 — How-to (synthetic outline)

**Profile:** `blog`  
**Primary query:** `jak wymienić tarcze hamulcowe`  
**Source:** synthetic DIY tutorial (car, front axle)  
**MODEL_SUFFICIENT:** **YES**

---

## 0. Synthetic outline

**Title:** Jak wymienić tarcze hamulcowe z przodu — krok po kroku  

1. Lead — bezpieczeństwo, kiedy wymiana  
2. Narzędzia i części (lista)  
3. Przygotowanie auta — podnośnik, kliny  
4. Kroki 1–8 (ordered list): koło → zacisk → tarcza → montaż → pompowanie pedału  
5. Momenty dokręcania (orientacyjne synthetic Nm — Fact w/ weak if no source)  
6. Częste błędy  
7. FAQ — czy wymieniać klocki razem? czy trzeba odpowietrzać?  
8. Kiedy do mechanika / disclaimer  
9. Podsumowanie  

---

## AST stress

Ordered steps as `list` / list_item with process discourse — **no StepNode**. FAQ = questions + paragraphs.

---

## IR

**Intents:** ic_howto (primary), ic_tools, ic_safety, ic_faq  

**Questions:** Jakie narzędzia?; Czy wymieniać klocki?; Czy odpowietrzać układ?; Ile Nm?  

**Facts:**
- Bezpieczeństwo: auto na klinach przed podnoszeniem  
- Kolejność: najpierw klocki/zacisk zanim tarcza (process facts)  
- Zalecenie: wymieniać klocki razem z tarczami (common practice — weak without citation)  
- Disclaimer: nie zastępuje instrukcji producenta  

**Entities:** tarcza hamulcowa, zacisk, klocki, podnośnik, płyn hamulcowy  

Process intent supported by ordered facts `statedIn` step blocks — edge `supports` / section order in StructureSlice.readingOrder.

---

## Actions

`ADD_FACT` torque with source; `ANSWER_QUESTION` bleed procedure; `FIX_STRUCTURE` if steps not ordered list; `STRENGTHEN_EVIDENCE` on safety.

---

## Result

```text
MODEL_SUFFICIENT: YES
```

Rejected: StepNode, TorqueNode — use Fact + list AST + Intent process.
