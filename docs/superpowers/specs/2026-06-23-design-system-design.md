# Design System & Reusable Component Library — Design Spec

> Data: 2026-06-23
> Projekt: SerpBear (Next.js 12, pages/ router, inline styles per `DESIGN.md`)
> Zakres: **wyłącznie refaktor UI** — ekstrakcja istniejących, już ładnych prymitywów do współdzielonej biblioteki. **Zero nowych funkcji.** Strony mają wyglądać identycznie jak dziś.
> Funkcjonalne ulepszenia: patrz osobny dokument `2026-06-23-functional-improvements-roadmap.md`.

---

## 1. Problem

UI jest ładny, ale **niereużywalny**. Najlepsze prymitywy (tabela, gauge, checkboxy, filtry, search, tabs) żyją wpisane inline w pojedynczych plikach — głównie w `pages/sites/[domain]/recommendations.tsx` (1368 linii). Inne strony **kopiują je gorzej**:

- `content-audit.tsx` ma własną tabelę, własny sortowalny nagłówek, własny search, **natywne checkboxy** (`accentColor`) i **natywny toggle** zamiast custom `RecCheckbox`/`Toggle`.
- `performance.tsx` ma własne filter-pille; `activity-log.tsx` własny layout wierszy.
- **Gauge istnieje w 8 kopiach** z **3 rozjechanymi systemami progów kolorów** (33/66, 40/70, 50/80) i różnymi kształtami.

Skutek: każda nowa strona = przepisywanie tego samego od zera, rosnąca niespójność wizualna, trudne utrzymanie.

## 2. Cel i kryteria sukcesu

Wyekstrahować prymitywy do `components/ui/` i podmienić użycia na wszystkich stronach — **za jednym razem** (decyzja użytkownika).

Sukces =
1. **Parytet wizualny**: każda strona wygląda identycznie jak przed refaktorem (kanon wyglądu = `recommendations.tsx`).
2. **Zero duplikacji**: jeden `Gauge` zamiast 8; jeden `Checkbox`/`Toggle`/`SearchBar`/`Table`/`Tabs` zamiast kopii.
3. Wartości wizualne (kolory, spacing, radius, shadow) pochodzą z **jednego źródła tokenów**, nie z hardkodowanych hexów.

## 3. Decyzje projektowe (zatwierdzone)

| Decyzja | Wybór |
|---|---|
| Zakres | Pełna biblioteka za jednym razem |
| Lokalizacja | `components/ui/` (oddzielnie od `components/common/` = AppShell/Sidebar) |
| Styl | Inline styles (mandat `DESIGN.md`), wartości z tokenów |
| Progi kolorów gauge | **33/66** (kanon edytora): 0–32 czerwony `#d70028`, 33–65 żółty `#efa00d`, 66–100 zielony `#1ab25e` |
| Gauge — kształt | `lg` = półokrąg + animowana igła (jak edytor); `sm` = pierścień + liczba w środku |

## 4. Architektura

```
components/ui/
  tokens.ts          — color/space/radius/shadow/font z DESIGN.md (źródło prawdy)
  icons.tsx          — wspólne inline SVG: sort, deltaUp/deltaDown, search, close, chevron
  Gauge.tsx          — bohater: score dial (sm ring / lg semicircle+needle)
  Table.tsx          — Table, SortableHeader, TableRow, TableCell
  useSortState.ts    — hook: { sortKey, sortDir, handleSort }
  Checkbox.tsx       — custom fioletowy checkbox (z indeterminate)
  Toggle.tsx         — switch on/off
  SearchBar.tsx      — input z ikoną
  Tabs.tsx           — pill-switcher z licznikami
  Badge.tsx          — warianty: status | suggestion | filter
  FilterPopover.tsx  — powłoka popovera + RangeInput + StatusPills
  Modal.tsx          — generyczna powłoka modala (growOut, overlay)
  SlidePanel.tsx     — prawy drawer szczegółów
  SelectionBar.tsx   — dolny pływający pasek akcji masowych
  Skeleton.tsx       — Skeleton, SkeletonRows
  index.ts           — re-eksport wszystkiego
```

`lib/scoreColor.ts` — `scoreColor(score: number): string` z kanonem 33/66. Konsoliduje istniejące rozproszone progi (m.in. `scoreToColor` z `lib/contentScore.ts`).

### Zasada izolacji
Każdy komponent: jedna odpowiedzialność, jawne propsy, da się zrozumieć i testować bez czytania innych. `tokens.ts` nie importuje niczego z `ui/`. `Gauge`/`Table`/itd. importują tylko `tokens`, `icons`, `scoreColor`.

## 5. Specyfikacja komponentów

Wartości wzorcowe pochodzą z istniejącego kodu (parytet 1:1). Odniesienia do źródła w nawiasach.

### 5.1 `tokens.ts`
Eksportuje obiekty zgodne z `DESIGN.md`:
- `color` — purple `#783AFB`, darkBtn `#2F2F34`, cardBorder `#F4F4F5`, panelBorder `#E4E4E7`, inputBorder `#D4D4D8`, text/muted (`#09090B`/`#18181B`/`#52525C`/`#9F9FA9`), success `#1AB25E`, error `#FF6F77`, score (`#d70028`/`#efa00d`/`#1ab25e`) itd.
- `space`, `radius`, `shadow`, `font` — wg sekcji 5–7, 4 `DESIGN.md`.

### 5.2 `Gauge.tsx` (bohater)
Bazuje na `components/articles/ScoreGauge.tsx`.
```ts
interface GaugeProps {
  score: number;                 // 0–100
  size?: 'sm' | 'md' | 'lg';     // domyślnie 'md'
  animated?: boolean;            // domyślnie: true dla 'lg', false dla 'sm'
  showLabel?: boolean;           // "X / 100"
}
```
- `lg` (~300px): półokrąg, 3 segmenty z progami 33/66, animowana igła (requestAnimationFrame, jak dziś w edytorze).
- `sm` (~36–44px): pierścień (stroke-dasharray) + liczba w środku, statyczny.
- Kolor zawsze z `scoreColor(score)`.
- **Zastępuje:** `ScoreGauge` (ContentScorePanel, VersionHistoryPanel), `ArticleList` gauge, `MiniGauge` (ResearchOutlinePanel), `AnimatedGauge` (AuditPanel), Dashboard gauge, `ScoreRing` (content-audit), `GaugeArc` (recommendations).
- `CircleProgress` (16px coverage w ContentScorePanel) **zostaje** — to inny wskaźnik (pokrycie NLP), nie content score.

### 5.3 `Table.tsx` + `useSortState`
- `SortableHeader` props: `{ label, sortKey, width, active, dir, onSort }` + ikona z `icons.tsx` (źródło: recommendations `TH` L944–957, `SortUpDown` L81–90).
- `useSortState(defaultKey, defaultDir='desc')` → `{ sortKey, sortDir, handleSort }` (likwiduje zduplikowaną logikę: recommendations L875, content-audit L125–128).
- Tabela flexbox: sticky header, dzielniki `#F4F4F5`, hover row `#F8F8F9`.

### 5.4 `Checkbox.tsx`
Z `RecCheckbox` (recommendations L167–185 + CSS L1329–1362): `appearance:none`, 16×16, radius 4, checked/indeterminate `#783AFB`. Props `{ checked, indeterminate?, onChange }`. Zastępuje natywne checkboxy w content-audit (L208/230/263).

### 5.5 `Toggle.tsx`
Z recommendations L701–707: 28×16 pill, knob 12×12, `#783AFB`/`#9F9FA9`, transition 250ms. Props `{ checked, onChange }`. Zastępuje natywny „Show URLs" w content-audit.

### 5.6 `SearchBar.tsx`
Z recommendations L1033–1057: ikona left 8px, height 32, radius 6, border `#E4E4E7`, shadow. Props `{ value, onChange, placeholder?, width? }` (domyślnie 250px).

### 5.7 `Tabs.tsx`
Z recommendations L968–1001: sliding pill, tło `#F4F4F5`, aktywny biały z shadow. Props `{ items: {value,label,count}[], value, onChange }`.

### 5.8 `Badge.tsx`
Props `{ variant: 'status'|'suggestion'|'filter', children }`. Konsoliduje `StatusBadge` (content-audit L29–44) + pille statusu/suggestii w recommendations. Kolory statusów wg `DESIGN.md` §3.4.

### 5.9 `FilterPopover.tsx`
Powłoka popovera (growOut, z-index 200, shadow) + `RangeInput` (min/max) + `StatusPills`. Z recommendations `FiltersPopover` L426–474. Generyczna, konfigurowana dziećmi/propsami.

### 5.10 `Modal.tsx`, `SlidePanel.tsx`, `SelectionBar.tsx`, `Skeleton.tsx`
- `Modal`: overlay + biały panel radius 16, growOut, przycisk close (zastępuje legacy Tailwind `Modal` i strukturę `ChangeKeywordModal` L190–370).
- `SlidePanel`: prawy drawer (recommendations L477–686).
- `SelectionBar`: dolny pasek (recommendations L689–698).
- `Skeleton`/`SkeletonRows`: recommendations L95–132.

## 6. Plan migracji (kolejność = malejące ryzyko)

1. **Fundament**: `tokens.ts`, `icons.tsx`, `lib/scoreColor.ts`.
2. **`Gauge.tsx`** + testy progów. Podmiana wszystkich 8 użyć gauge.
3. **Rodzina tabeli** + `Checkbox`/`Toggle`/`SearchBar`/`Tabs`/`Badge`.
4. **Refaktor `recommendations.tsx`** na importy z `ui/` (kanon — weryfikuje parytet 1:1).
5. Podmiana na: `content-audit.tsx`, `audit.tsx` (legacy), `performance.tsx`, `activity-log.tsx`, `dashboard/index.tsx`, `ArticleList.tsx`, `ContentScorePanel.tsx`, `AuditPanel.tsx`, `ResearchOutlinePanel.tsx`, `VersionHistoryPanel.tsx`.
6. **Reszta prymitywów**: `Modal`, `SlidePanel`, `SelectionBar`, `Skeleton`.
7. Usunięcie martwego kodu po podmianie (osierocone definicje inline).

## 7. Weryfikacja

To refaktor czysto wizualny → główne ryzyko = regresja wyglądu.
- **Parytet pikselowy**: zrzut ekranu każdej strony **przed** → po każdej podmianie zrzut **po** i porównanie.
- **Testy renderu `Gauge`**: dla score {10, 50, 90} → poprawny kolor (czerwony/żółty/zielony) i wariant (sm ring / lg needle).
- **Istniejący jest** przechodzi (`npm run test:ci`).
- **Checklista `DESIGN.md` §27** dla każdej zmienionej strony.
- `npm run lint` + `npm run build` bez błędów; brak nowych ostrzeżeń TS.

## 8. Jawnie poza zakresem (YAGNI)
- Żadnych nowych funkcji (to jest w roadmap B).
- Brak migracji Next.js 12 → 14/15.
- Brak ujednolicania `react-query@3` vs `@tanstack/react-query@5`.
- `CircleProgress` (pokrycie NLP) zostaje bez zmian.
- Nie przepisujemy legacy Tailwind tam, gdzie strona nie jest dotykana w tej migracji.

## 9. Backlog — funkcjonalne ulepszenia (B)
Pełny plan w `2026-06-23-functional-improvements-roadmap.md`. Każda pozycja = osobny cykl brainstorm → spec → plan, budowany **na tej bibliotece**.
