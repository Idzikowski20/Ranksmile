# Surfy AI — Feature Gaps vs Surfer AI

**Date:** 2026-05-22
**Status:** Spec (not yet planned)

---

## Current State

"Ask Surfy" to prosty chat w panelu bocznym — użytkownik wpisuje pytanie, AI odpowiada. Brak komend, brak specjalizowanych narzędzi.

---

## Gaps

### 1. Slash Commands (`/optimize`, `/write`, `/rewrite`, etc.)

Surfer AI ma system komend które wykonują konkretne akcje na tekście:
- `/optimize` — optymalizuje zaznaczony tekst pod kątem SEO
- `/write` — generuje nową sekcję na podstawie promptu
- `/rewrite` — przepisuje zaznaczony tekst

**Potrzebne:** Rozszerzyć chat "Ask Surfy" o system komend, które operują na aktualnym artykule. Backend już częściowo istnieje (`auto-optimize.ts`).

### 2. Humanizer ("Un-AI" text)

Narzędzie do przekształcania tekstu AI tak, aby był niewykrywalny przez detektory AI. Zachowuje znaczenie, zmienia styl na bardziej ludzki.

**Potrzebne:** Nowy endpoint API + UI w panelu.

### 3. AI Article Generation (Surfer AI equivalent)

Generowanie całego artykułu od zera na podstawie briefu (keyword, outline, tone, length). Obecnie mamy `deep-analysis.ts` które analizuje istniejący artykuł, ale nie generujemy od zera.

**Potrzebne:** Pipeline generowania artykułu: keyword → research → outline → write → score.

### 4. Plagiarism Checker

Sprawdzanie duplikacji treści względem istniejących stron w indeksie.

**Potrzebne:** Integracja z zewnętrznym API plagiarism check lub własna implementacja na podstawie SERP.

---

## Recommendation

Zacząć od **#1 (Slash Commands)** — największy impact UX przy najmniejszym wysiłku. Backend `auto-optimize.ts` już istnieje, wystarczy dorobić system komend w chat UI i podpiąć akcje.

Kolejność priorytetu: 1 → 2 → 3 → 4.
