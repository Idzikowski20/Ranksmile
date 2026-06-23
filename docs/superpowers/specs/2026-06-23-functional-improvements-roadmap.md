# Funkcjonalne ulepszenia — Roadmap (B)

> Data: 2026-06-23
> Projekt: SerpBear
> Status: **backlog / plan na później.** To NIE jest spec implementacyjny. Każda pozycja wymaga własnego cyklu brainstorm → spec → plan.
> Zależność: powstaje **po** design systemie (`2026-06-23-design-system-design.md`) — każda funkcja buduje się na `components/ui/`.

---

## Zasada

Najpierw biblioteka komponentów (A), potem funkcje (B). Wtedy każda nowa funkcja korzysta z gotowych `Gauge`, `Table`, `Tabs`, `Modal`, `FilterPopover` — zamiast pisać UI od zera. Każda pozycja poniżej dostanie osobny mały brainstorm (jak ma działać? skąd dane?).

## Priorytetyzacja (sugerowana)

Kryterium: wartość dla użytkownika ÷ wysiłek. „Wysiłek" liczony PO zbudowaniu design systemu.

### P1 — Duża wartość, średni wysiłek (najpierw)

1. **Topical Map — z stub do działającej funkcji**
   Dziś: pusty ekran „coming soon" (`pages/sites/[domain]/topical-map.tsx`).
   Cel: auto-klastrowanie keywordów/artykułów w tematy + wizualizacja grafu/treemap + wykrywanie luk treści.
   Pytania do brainstormu: źródło klastrów (embeddingi? Google Ads? sidecar?), forma wizualizacji, akcja „utwórz artykuł z luki".

2. **Alerty i świeżość w Rank/Keyword Trackerze**
   Dziś: historia pozycji bez wskaźnika „kiedy ostatnio sprawdzono" i bez alertów.
   Cel: znacznik świeżości danych, sparkline trendu w wierszu, powiadomienia o dużych spadkach (>5 pozycji) i skokach. (Mechanizm email już istnieje — `pages/api/notify.ts`.)

3. **Content Audit — dokończyć bulk actions + filtry statusu**
   Dziś: select-all jest, ale akcje masowe niezaimplementowane; brak filtra po statusie.
   Cel: bulk delete / re-optimize / publish, filtr statusu, szybka ścieżka „nigdy nie optymalizowane".

### P2 — Duża wartość, większy wysiłek

4. **SERP Analyzer (nie istnieje — zbudować)**
   Cel: analiza TOP10 dla keyworda na żywo (średnia liczba słów, nagłówków, obrazów, terminów NLP konkurencji) + porównanie draftu do tej średniej — rdzeń doświadczenia „Surfer".
   Baza częściowo jest: `python-sidecar` + `competitor-outlines`. Pytania: SERP API vs scraper, gdzie wpiąć w edytor (obok Content Score), cache.

5. **Recommendations → Technical SEO: kroki naprawcze + priorytet wg ruchu**
   Dziś: lista issues bez „jak naprawić" i bez priorytetu.
   Cel: konkretne remediacje (które obrazy bez alt, który URL bez canonical), sortowanie wg wpływu na ruch, historia rozwiązanych problemów.

6. **AI Visibility — historia trendu + actionability**
   Dziś: jednorazowy score (`lib/aiSearchScore.ts`, `ai-visibility.ts`), runy zapisywane w `ai_visibility_runs`, ale bez wizualizacji trendu.
   Cel: wykres zmian w czasie (jak rank tracking), rozbicie cytowań per konkurent, wskazówki jak poprawić (FAQ, struktura, źródła).

### P3 — Usprawnienia / dług

7. **Keyword Research — intencja + difficulty**
   Tagowanie intencji (info/komerc/transakcyjna), SERP difficulty, CPC, realistyczny target pozycji.

8. **Activity Log — filtry + atrybucja**
   Filtr po typie zdarzenia/dacie, bogatsze zdarzenia (zmiana meta, przekroczenie progu rankingu), atrybucja użytkownika (wymaga powiązania user↔artykuł).

9. **Humanizer — UI + metryki czytelności**
   Dziś: tylko API (`auto-optimize.ts`), bez interfejsu.
   Cel: dedykowane UI, metryki przed/po (Flesch, % strony biernej), kontrola tonu, undo.

10. **Performance — porównanie okresów + eksport**
    Porównanie dwóch zakresów dat side-by-side, wykrywanie anomalii, eksport CSV/PDF.

### Dług techniczny / konsolidacja (przy okazji odpowiednich funkcji)

- **`audit.tsx` (legacy Tailwind) vs `content-audit.tsx`** — niemal duplikaty; wybrać kanon, usunąć drugi.
- **`pages/domains/index.tsx` vs `pages/sites/index.tsx`** — prawdopodobnie redundantne.
- **`pages/login` vs `pages/auth/*`** — stary vs nowy flow logowania.

## Poza zakresem tego roadmapu
- Komercjalizacja/SaaS (multi-tenant, billing, role) — osobny temat strategiczny.
- Migracja Next.js / ujednolicenie data-fetching — osobny temat techniczny.
