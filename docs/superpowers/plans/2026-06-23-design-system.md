# Design System & Reusable Component Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wyekstrahować istniejące, już ładne prymitywy UI (gauge, tabela, checkbox, toggle, search, tabs, badge, modal, popover) do współdzielonej biblioteki `components/ui/` i podmienić wszystkie zduplikowane użycia — przy zachowaniu identycznego wyglądu (parytet pikselowy).

**Architecture:** Nowy katalog `components/ui/` z jednym plikiem na komponent, zasilany centralnym `tokens.ts` (wartości z `DESIGN.md`) i `lib/scoreColor.ts` (kanon progów 33/66). Styl pozostaje inline (mandat `DESIGN.md`). Kanon wyglądu = `pages/sites/[domain]/recommendations.tsx` — z niego ekstrahujemy verbatim. Logika (scoreColor, useSortState, Gauge sm) jest testowana jednostkowo; komponenty czysto wizualne weryfikowane render-smoke + parytetem zrzutów ekranu.

**Tech Stack:** Next.js 12 (pages router), React 18, TypeScript, inline styles, Jest + next/jest + @testing-library/react (jsdom). Brak zewnętrznej biblioteki ikon — inline SVG.

---

## Konwencje dla wykonawcy

- **Parytet pikselowy jest święty.** Gdy task mówi „ekstrahuj verbatim z `X.tsx:A-B`" — skopiuj kod **dokładnie**, zmieniając tylko to, co task wymienia (np. zamiana hardkodowanego hexa na token). Nie „poprawiaj", nie zmieniaj wartości.
- **Test wizualny = zrzut przed/po.** Dla tasków oznaczonych _[visual parity]_ uruchom `npm run dev`, otwórz stronę, zrób zrzut PRZED zmianą (jeśli jeszcze nie istnieje) i PO — muszą być identyczne. Jeśli nie masz narzędzia do zrzutów, użyj skilla `webapp-testing`.
- **Commity:** kroki pokazują commit po każdym tasku (dobre dla pracy agentowej, łatwy rollback per-task). **Dla pracy człowieka** grupuj commity per faza, żeby było ich ~5 zamiast ~30:
  - Grupa A = Faza 0 (scoreColor, useSortState, tokens, icons)
  - Grupa B = Faza 1 (Gauge + podmiana gauge)
  - Grupa C = Faza 2 (prymitywy kontrolne)
  - Grupa D = Task 3.1 (recommendations — kanon, osobno dla łatwego rollbacku)
  - Grupa E = Task 3.2–3.3 + Faza 4 (reszta stron + sprzątanie)
- **Nie uruchamiaj `git commit` bez zgody użytkownika**, jeśli środowisko tego wymaga; w przeciwnym razie commituj jak w krokach.
- **Tokeny vs parytet:** `tokens.ts` jest na teraz **plikiem referencyjnym** — NIE zamieniaj literałów hex na tokeny podczas ekstrakcji verbatim (React mógłby wygenerować inny string CSS, co zaburza diffy/snapshoty). Komponenty ekstrahujemy 1:1 z literałami. Podmiana `'#783AFB'` → `tokens.color.purple` to **osobny refaktor po całej migracji** (poza zakresem tego planu — patrz sekcja „Poza zakresem").
- Po zakończonej sesji edycji: `graphify update .` (zgodnie z `CLAUDE.md`).
- Komenda testów pojedynczego pliku: `npx jest <ścieżka> -t '<nazwa>'` (projekt ma `test:ci` = `jest --ci`).

## Mapa plików

**Tworzone (`components/ui/`):**
| Plik | Odpowiedzialność |
|---|---|
| `tokens.ts` | color/space/radius/shadow/font — wartości z `DESIGN.md` |
| `icons.tsx` | wspólne inline SVG: `SortUpDown`, `DeltaDown`, `SearchIcon`, `XIcon`, `ChevronDown` |
| `Gauge.tsx` | score dial: `sm` pierścień (static) / `md`,`lg` półokrąg+igła (animowany) |
| `Checkbox.tsx` | custom fioletowy checkbox + indeterminate |
| `Toggle.tsx` | switch on/off |
| `SearchBar.tsx` | input z ikoną |
| `Tabs.tsx` | pill-switcher z licznikami |
| `Badge.tsx` | warianty status/suggestion/filter |
| `SortableHeader.tsx` | sortowalny nagłówek kolumny (Table/Row/Cell świadomie odłożone) |
| `Modal.tsx` | generyczna powłoka modala (overlay + growOut) |
| `SlidePanel.tsx` | prawy drawer szczegółów |
| `SelectionBar.tsx` | dolny pływający pasek akcji masowych |
| `Skeleton.tsx` | `Skeleton`, `SkeletonRows` |
| `index.ts` | re-eksport wszystkiego |

**Tworzone (`lib/`):** `lib/scoreColor.ts`, `lib/useSortState.ts`
**Tworzone (testy):** `__tests__/ui/scoreColor.test.ts`, `__tests__/ui/useSortState.test.tsx`, `__tests__/ui/Gauge.test.tsx`, `__tests__/ui/Checkbox.test.tsx`, `__tests__/ui/Toggle.test.tsx`, `__tests__/ui/Tabs.test.tsx`, `__tests__/ui/barrel.test.ts`

**Modyfikowane (migracja):** `components/articles/ScoreGauge.tsx`, `pages/sites/[domain]/recommendations.tsx`, `content-audit.tsx`, `audit.tsx`, `performance.tsx`, `activity-log.tsx`, `pages/dashboard/index.tsx`, `components/articles/ArticleList.tsx`, `AuditPanel.tsx`, `ResearchOutlinePanel.tsx`.

---

# FAZA 0 — Fundament

### Task 0.1: `lib/scoreColor.ts` (kanon progów 33/66)

**Files:**
- Create: `lib/scoreColor.ts`
- Test: `__tests__/ui/scoreColor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/ui/scoreColor.test.ts
import { scoreColor, scoreBand } from '../../lib/scoreColor';

describe('scoreColor (kanon 33/66)', () => {
  it('zwraca czerwony dla < 33', () => {
    expect(scoreColor(0)).toBe('#d70028');
    expect(scoreColor(32)).toBe('#d70028');
  });
  it('zwraca żółty dla 33–65', () => {
    expect(scoreColor(33)).toBe('#efa00d');
    expect(scoreColor(65)).toBe('#efa00d');
  });
  it('zwraca zielony dla >= 66', () => {
    expect(scoreColor(66)).toBe('#1ab25e');
    expect(scoreColor(100)).toBe('#1ab25e');
  });
  it('klampuje wartości poza 0–100', () => {
    expect(scoreColor(-5)).toBe('#d70028');
    expect(scoreColor(150)).toBe('#1ab25e');
  });
  it('scoreBand zwraca low/mid/high', () => {
    expect(scoreBand(10)).toBe('low');
    expect(scoreBand(50)).toBe('mid');
    expect(scoreBand(80)).toBe('high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/ui/scoreColor.test.ts`
Expected: FAIL — `Cannot find module '../../lib/scoreColor'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scoreColor.ts
export type ScoreBand = 'low' | 'mid' | 'high';

const clamp = (n: number) => Math.max(0, Math.min(n, 100));

export function scoreBand(score: number): ScoreBand {
  const s = clamp(score);
  if (s >= 66) return 'high';
  if (s >= 33) return 'mid';
  return 'low';
}

export function scoreColor(score: number): string {
  const band = scoreBand(score);
  return band === 'high' ? '#1ab25e' : band === 'mid' ? '#efa00d' : '#d70028';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/ui/scoreColor.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoreColor.ts __tests__/ui/scoreColor.test.ts
git commit -m "feat(ui): add scoreColor with canonical 33/66 thresholds"
```

---

### Task 0.2: `lib/useSortState.ts` (hook sortowania)

**Files:**
- Create: `lib/useSortState.ts`
- Test: `__tests__/ui/useSortState.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ui/useSortState.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useSortState } from '../../lib/useSortState';

describe('useSortState', () => {
  it('startuje z domyślnym kluczem i kierunkiem desc', () => {
    const { result } = renderHook(() => useSortState('clicks'));
    expect(result.current.sortKey).toBe('clicks');
    expect(result.current.sortDir).toBe('desc');
  });
  it('ten sam klucz przełącza kierunek', () => {
    const { result } = renderHook(() => useSortState('clicks'));
    act(() => result.current.handleSort('clicks'));
    expect(result.current.sortDir).toBe('asc');
    act(() => result.current.handleSort('clicks'));
    expect(result.current.sortDir).toBe('desc');
  });
  it('nowy klucz ustawia desc', () => {
    const { result } = renderHook(() => useSortState('clicks'));
    act(() => result.current.handleSort('clicks')); // -> asc
    act(() => result.current.handleSort('position'));
    expect(result.current.sortKey).toBe('position');
    expect(result.current.sortDir).toBe('desc');
  });
});
```

> Zweryfikowano: projekt ma `@testing-library/react ^14.0.0`, które eksportuje `renderHook` natywnie (od v13.1). Nie potrzeba `@testing-library/react-hooks`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/ui/useSortState.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/useSortState.ts
import { useState } from 'react';

export type SortDir = 'asc' | 'desc';

export function useSortState<K extends string>(defaultKey: K, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);
  const handleSort = (key: K) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };
  return { sortKey, sortDir, handleSort };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/ui/useSortState.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/useSortState.ts __tests__/ui/useSortState.test.tsx
git commit -m "feat(ui): add useSortState hook (extracted from recommendations/content-audit)"
```

---

### Task 0.3: `components/ui/tokens.ts`

**Files:**
- Create: `components/ui/tokens.ts`

> Brak testu — to stała tabela wartości. Weryfikacja: import kompiluje się w TS.

- [ ] **Step 1: Write the tokens file**

```ts
// components/ui/tokens.ts
// Źródło prawdy: DESIGN.md. Nie wymyślaj nowych wartości — dodaj je najpierw do DESIGN.md.
export const color = {
  // brand / accent
  purple: '#783AFB',
  purpleFocus: '#AA93FD',
  darkBtn: '#2F2F34',
  // borders
  cardBorder: '#F4F4F5',
  panelBorder: '#E4E4E7',
  inputBorder: '#D4D4D8',
  // text
  textHeading: '#09090B',
  textPrimary: '#18181B',
  textSecondary: '#3F3F47',
  textMuted: '#52525C',
  textFaint: '#9F9FA9',
  // surfaces
  white: '#FFFFFF',
  surfaceSubtle: '#F8F8F9',
  surfaceLight: '#F4F4F5',
  // semantic
  success: '#1AB25E',
  error: '#FF6F77',
  // score (kanon gauge — patrz lib/scoreColor.ts)
  scoreLow: '#d70028',
  scoreMid: '#efa00d',
  scoreHigh: '#1ab25e',
} as const;

export const radius = { xs: 4, sm: 6, md: 8, card: 12, lg: 16, pill: 9999 } as const;

export const shadow = {
  input: '0px 1px 2px 0px rgba(26,29,40,0.06)',
  card: '0px 1px 2px 0px #1A1D280F',
  dropdown: '0px 18px 40px rgba(17,24,39,0.14), 0px 8px 18px rgba(17,24,39,0.09), 0px 2px 6px rgba(17,24,39,0.06)',
} as const;

export const font = { family: 'var(--font-family-primary)' } as const;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: brak nowych błędów dot. `components/ui/tokens.ts`

- [ ] **Step 3: Commit**

```bash
git add components/ui/tokens.ts
git commit -m "feat(ui): add design tokens module from DESIGN.md"
```

---

### Task 0.4: `components/ui/icons.tsx`

**Files:**
- Create: `components/ui/icons.tsx`

> Ekstrahujemy **verbatim** ze `recommendations.tsx`: `SortUpDown` (L81–90), `DeltaDown` (L74–78), `XIcon` (L160–164).
>
> **`SearchIcon` i `ChevronDown` — NIE odtwarzaj z opisu (to złamałoby zasadę verbatim).** Najpierw znajdź istniejące:
> ```bash
> grep -rn "circle cx" "pages/sites/[domain]/recommendations.tsx"   # ikona search w search barze (~L1033–1057)
> grep -rn "M6 9l6 6" pages components                               # istniejące chevrony
> ```
> Skopiuj znalezione SVG **1:1**. Jeśli dany ikon nie istnieje jeszcze nigdzie jako współdzielony — zostaw go lokalnie w pliku, który go używa, i NIE dodawaj do `icons.tsx` w tej iteracji. Poniższy kod `SearchIcon`/`ChevronDown` jest tylko fallbackiem, jeśli grep nic nie znajdzie; wtedy i tak zweryfikuj wizualnie parytet.

- [ ] **Step 1: Write the icons file**

```tsx
// components/ui/icons.tsx
import React from 'react';

export const SortUpDown = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
    <path d="M8 3.5v9" stroke={active ? '#09090B' : '#9F9FA9'} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 6l3-3 3 3" stroke={active && dir === 'asc' ? '#09090B' : '#9F9FA9'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 10l3 3 3-3" stroke={active && dir === 'desc' ? '#09090B' : '#9F9FA9'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DeltaDown = () => (
  <svg viewBox="0 0 8 6" width="8" height="6" aria-hidden="true">
    <path d="M4 6L0 0h8z" fill="#FF6F77" />
  </svg>
);

export const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

export const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ChevronDown = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
```

> **UWAGA parytet:** `SortUpDown`, `DeltaDown`, `XIcon` muszą być IDENTYCZNE z oryginałami w `recommendations.tsx`. Przed commitem porównaj z L74–90 i L160–164 i nadpisz powyższe, jeśli oryginał różni się w jakimkolwiek atrybucie.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: brak błędów

- [ ] **Step 3: Commit**

```bash
git add components/ui/icons.tsx
git commit -m "feat(ui): add shared inline SVG icons"
```

---

# FAZA 1 — Gauge (bohater)

### Task 1.1: `components/ui/Gauge.tsx` — wariant `sm` (pierścień, testowalny)

**Files:**
- Create: `components/ui/Gauge.tsx`
- Test: `__tests__/ui/Gauge.test.tsx`

> `sm` jest statyczny (renderuje score natychmiast) → testowalny. `md`/`lg` (animowany półokrąg) dodajemy w Task 1.2.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ui/Gauge.test.tsx
import { render } from '@testing-library/react';
import Gauge from '../../components/ui/Gauge';

// Celujemy w data-testid="gauge-score" (nie w querySelector('text')) — w wariancie lg pojawi się
// wiele <text>/<tspan>, więc selektor po tagu byłby kruchy.
describe('Gauge sm (pierścień)', () => {
  it('renderuje zaokrąglony score jako tekst', () => {
    const { getByTestId } = render(<Gauge score={61} size="sm" />);
    expect(getByTestId('gauge-score')).toHaveTextContent('61');
  });
  it('koloruje wg kanonu 33/66 — zielony dla 80', () => {
    const { getByTestId } = render(<Gauge score={80} size="sm" />);
    expect(getByTestId('gauge-score').getAttribute('fill')).toBe('#1ab25e');
  });
  it('koloruje na czerwono dla 20', () => {
    const { getByTestId } = render(<Gauge score={20} size="sm" />);
    expect(getByTestId('gauge-score').getAttribute('fill')).toBe('#d70028');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/ui/Gauge.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation (tylko sm)**

```tsx
// components/ui/Gauge.tsx
import React from 'react';
import { scoreColor } from '../../lib/scoreColor';

export type GaugeSize = 'sm' | 'md' | 'lg';

interface GaugeProps {
  score: number;
  size?: GaugeSize;
  animated?: boolean;
  showLabel?: boolean;
}

const Ring = ({ score }: { score: number }) => {
  const s = Math.max(0, Math.min(score, 100));
  const r = 16, sw = 3.5, c = 2 * Math.PI * r;
  const offset = c * (1 - s / 100);
  const col = scoreColor(s);
  return (
    <svg width={40} height={40} viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={r} fill="none" stroke="#E4E4E7" strokeWidth={sw} />
      <circle cx={20} cy={20} r={r} fill="none" stroke={col} strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 20 20)" />
      <text data-testid="gauge-score" x={20} y={20} textAnchor="middle" dominantBaseline="central"
        fontFamily="var(--font-family-primary)" fontSize={12} fontWeight={700} fill={col}>
        {Math.round(s)}
      </text>
    </svg>
  );
};

const Gauge = ({ score, size = 'md' }: GaugeProps) => {
  if (size === 'sm') return <Ring score={score} />;
  return <Ring score={score} />; // placeholder — zastąpiony w Task 1.2
};

export default Gauge;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/ui/Gauge.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/Gauge.tsx __tests__/ui/Gauge.test.tsx
git commit -m "feat(ui): add Gauge sm (ring) variant"
```

---

### Task 1.2: `components/ui/Gauge.tsx` — warianty `md`/`lg` (półokrąg+igła, z `ScoreGauge`)

**Files:**
- Modify: `components/ui/Gauge.tsx`

> Przenosimy implementację półokręgu **verbatim** z `components/articles/ScoreGauge.tsx:9-117` (animacja rAF, segmenty 33/66, igła). `lg` = pełny rozmiar (compact=false), `md` = compact=true.

- [ ] **Step 1: Add the Semicircle subcomponent (verbatim z ScoreGauge)**

W `components/ui/Gauge.tsx` dodaj komponent `Semicircle` z ciałem identycznym jak `ScoreGauge` (`components/articles/ScoreGauge.tsx` L9–117), z dwiema zmianami:
1. Sygnatura: `const Semicircle = ({ score, compact }: { score: number; compact: boolean }) => {`
2. Usuń lokalny `const scoreColor = ...` (L71) i zamiast tego `import { scoreColor } from '../../lib/scoreColor';` — wywołuj `scoreColor(ds)`.

Reszta (cx/cy/r/sw, segmenty, animacja `useEffect`, ścieżki path, igła, tekst) **bez zmian**.

- [ ] **Step 2: Wire size → variant w głównym `Gauge`**

```tsx
const Gauge = ({ score, size = 'md' }: GaugeProps) => {
  if (size === 'sm') return <Ring score={score} />;
  return <Semicircle score={score} compact={size === 'md'} />;
};
```

- [ ] **Step 3: Verify existing Gauge tests still pass + smoke render lg**

Dodaj do `__tests__/ui/Gauge.test.tsx`:

```tsx
describe('Gauge lg/md (półokrąg)', () => {
  it('renderuje svg bez błędu dla lg', () => {
    const { container } = render(<Gauge score={61} size="lg" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

Run: `npx jest __tests__/ui/Gauge.test.tsx`
Expected: PASS (4 tests). (Uwaga: animowany `displayScore` startuje od 0 — nie asertujemy liczby dla lg.)

- [ ] **Step 4: Commit**

```bash
git add components/ui/Gauge.tsx __tests__/ui/Gauge.test.tsx
git commit -m "feat(ui): add Gauge md/lg semicircle variant from ScoreGauge"
```

---

### Task 1.3: `ScoreGauge.tsx` → cienki wrapper na `Gauge` _[visual parity]_

**Files:**
- Modify: `components/articles/ScoreGauge.tsx`

> Konsolidacja: jedyną implementacją staje się `Gauge`. `ScoreGauge` zostaje jako alias, żeby nie ruszać teraz `ContentScorePanel`/`VersionHistoryPanel`.

- [ ] **Step 1: Replace file content**

```tsx
// components/articles/ScoreGauge.tsx
import React from 'react';
import Gauge from '../ui/Gauge';

interface Props { score: number; compact?: boolean; }

const ScoreGauge = ({ score, compact }: Props) => (
  <Gauge score={score} size={compact ? 'md' : 'lg'} />
);

export default ScoreGauge;
```

- [ ] **Step 2: Visual parity check**

Run: `npm run dev`, otwórz edytor artykułu (`/articles/[id]`) z widocznym Content Score Panel oraz Version History.
Expected: gauge wygląda i animuje się **identycznie** jak przed zmianą. Porównaj zrzut przed/po.

- [ ] **Step 3: Run full test suite**

Run: `npx jest --ci`
Expected: PASS (brak regresji)

- [ ] **Step 4: Commit**

```bash
git add components/articles/ScoreGauge.tsx
git commit -m "refactor(ui): ScoreGauge delegates to shared Gauge"
```

---

### Task 1.4: Podmiana pozostałych gauge na `Gauge` _[visual parity]_

**Files (po jednym commicie na plik):**
- Modify: `components/articles/ArticleList.tsx` (gauge L48–91, użycie L334) → `<Gauge score={s} size="lg" />` (lub `md` jeśli mniejszy kontekst — dobierz wg obecnego rozmiaru)
- Modify: `components/articles/ResearchOutlinePanel.tsx` (MiniGauge L55–134, użycie L577) → `<Gauge score={s} size="sm" />`
- Modify: `components/articles/AuditPanel.tsx` (AnimatedGauge L20–88, użycie L143) → `<Gauge score={s} size="md" />`
- Modify: `pages/dashboard/index.tsx` (gauge L68–96, użycie L490) → `<Gauge score={s} size="sm" />`

> `recommendations.tsx` (GaugeArc) i `content-audit.tsx` (ScoreRing) podmieniamy w fazie ich migracji (Task 3.x), nie tutaj.

Dla KAŻDEGO pliku powyżej powtórz:

- [ ] **Step 1:** Dodaj `import Gauge from '../ui/Gauge';` (dostosuj ścieżkę: z `pages/dashboard` to `../../components/ui/Gauge`).
- [ ] **Step 2:** Usuń lokalną definicję gauge (podane linie) i podmień użycie na `<Gauge .../>` z odpowiednim `size`.
- [ ] **Step 3:** Usuń osierocone importy/helpery (np. lokalny `scoreToColor`, jeśli był tylko dla tego gauge).
- [ ] **Step 4: Visual parity** — `npm run dev`, otwórz stronę, porównaj zrzut przed/po. Rozmiar `size` dobierz tak, by wizualnie odpowiadał oryginałowi (jeśli `sm` 40px za duży/mały względem oryginału — to jedyne miejsce, gdzie wolno dostroić rozmiar wariantu w `Gauge.tsx`, ale wtedy przejrzyj wszystkie użycia `sm`).
- [ ] **Step 5: Commit** — `git commit -m "refactor(ui): <plik> uses shared Gauge"`

- [ ] **Step 6 (po wszystkich): pełne testy**

Run: `npx jest --ci`
Expected: PASS

---

# FAZA 2 — Prymitywy kontrolne (logika testowalna + wizualne)

### Task 2.1: `components/ui/Checkbox.tsx` (z `RecCheckbox`)

**Files:**
- Create: `components/ui/Checkbox.tsx`
- Test: `__tests__/ui/Checkbox.test.tsx`

> Ciało komponentu **verbatim** z `recommendations.tsx:167-185`. Klasy CSS `.rec-cb-*` (recommendations L1329–1362) trzeba przenieść do `styles/globals.css`, żeby działały globalnie (Step 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ui/Checkbox.test.tsx
import { render, fireEvent } from '@testing-library/react';
import Checkbox from '../../components/ui/Checkbox';

describe('Checkbox', () => {
  it('woła onChange po kliknięciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Checkbox checked={false} onChange={onChange} />);
    fireEvent.click(container.querySelector('.rec-cb-wrap')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('odzwierciedla stan checked', () => {
    const { container } = render(<Checkbox checked onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
  });
  it('ustawia natywny stan indeterminate (najłatwiej zepsuć przy refaktorze)', () => {
    const { container } = render(<Checkbox checked={false} indeterminate onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).indeterminate).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL** (`npx jest __tests__/ui/Checkbox.test.tsx`)

- [ ] **Step 3: Implement (verbatim z recommendations L167–185)**

```tsx
// components/ui/Checkbox.tsx
import React from 'react';

const Checkbox = ({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) => (
  <span className="rec-cb-wrap" onClick={(e) => { e.stopPropagation(); onChange(); }}>
    <input
      type="checkbox"
      className="rec-cb-input"
      checked={checked}
      readOnly
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
    />
    <svg viewBox="0 0 20 20" width="12" height="12" className="rec-cb-icon" fill="currentColor">
      {indeterminate && !checked
        ? <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        : <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
      }
    </svg>
  </span>
);

export default Checkbox;
```

- [ ] **Step 4: Move `.rec-cb-*` CSS to globals**

Jeśli klasy `.rec-cb-wrap`, `.rec-cb-input`, `.rec-cb-icon` są zdefiniowane inline w `recommendations.tsx` (styled-jsx/`<style>` ok. L1329–1362), przenieś je do `styles/globals.css` verbatim (żeby `Checkbox` działał na każdej stronie). Usuń je z `recommendations.tsx` dopiero w Task 3.1.

- [ ] **Step 5: Run — PASS** (`npx jest __tests__/ui/Checkbox.test.tsx`)

- [ ] **Step 6: Commit**

```bash
git add components/ui/Checkbox.tsx __tests__/ui/Checkbox.test.tsx styles/globals.css
git commit -m "feat(ui): add Checkbox (from RecCheckbox) + global checkbox styles"
```

---

### Task 2.2: `components/ui/Toggle.tsx` (z `Toggle` L701–707)

**Files:**
- Create: `components/ui/Toggle.tsx`
- Test: `__tests__/ui/Toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ui/Toggle.test.tsx
import { render, fireEvent } from '@testing-library/react';
import Toggle from '../../components/ui/Toggle';

describe('Toggle', () => {
  it('woła onChange po kliknięciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(container.firstChild as Element);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement (verbatim z recommendations L701–707)**

```tsx
// components/ui/Toggle.tsx
import React from 'react';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div onClick={onChange} style={{ width: 28, height: 16, borderRadius: 9999, background: checked ? '#783AFB' : '#9F9FA9', position: 'relative', cursor: 'pointer', transition: 'background 250ms', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 2, left: checked ? 14 : 2, width: 12, height: 12, borderRadius: 9999, background: '#fff', transition: 'left 250ms', boxShadow: '0px 2px 8px rgba(24,26,34,0.04), 0px 1px 2px rgba(24,26,34,0.06)' }} />
  </div>
);

export default Toggle;
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add components/ui/Toggle.tsx __tests__/ui/Toggle.test.tsx
git commit -m "feat(ui): add Toggle switch"
```

---

### Task 2.3: `components/ui/SearchBar.tsx`

**Files:**
- Create: `components/ui/SearchBar.tsx`

> Z `recommendations.tsx:1033-1057`. Parametryzujemy `width`/`placeholder`. Test render-smoke (czysto wizualne).

- [ ] **Step 1: Implement**

```tsx
// components/ui/SearchBar.tsx
import React from 'react';
import { SearchIcon } from './icons';

const SearchBar = ({ value, onChange, placeholder = 'Search', width = 250 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number;
}) => (
  <div style={{ position: 'relative', width }}>
    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#3F3F47', display: 'inline-flex' }}>
      <SearchIcon size={16} />
    </span>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', height: 32, paddingLeft: 30, paddingRight: 10, border: '1px solid #E4E4E7', borderRadius: 6, boxShadow: '0px 1px 2px rgba(26,29,40,0.06)', fontFamily: 'var(--font-family-primary)', fontSize: 13, color: '#09090B', outline: 'none' }}
    />
  </div>
);

export default SearchBar;
```

> **Parytet:** porównaj inline-style z oryginałem `recommendations.tsx:1033-1057`; jeśli oryginał ma dodatkowy atrybut (np. focus handler) — odwzoruj.

- [ ] **Step 2: Visual parity** — porównanie wizualne po podmianie na recommendations (Task 3.1).
- [ ] **Step 3: Commit**

```bash
git add components/ui/SearchBar.tsx
git commit -m "feat(ui): add SearchBar"
```

---

### Task 2.4: `components/ui/Tabs.tsx` (z tab switcher L968–1001)

**Files:**
- Create: `components/ui/Tabs.tsx`
- Test: `__tests__/ui/Tabs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ui/Tabs.test.tsx
import { render, fireEvent } from '@testing-library/react';
import Tabs from '../../components/ui/Tabs';

const items = [
  { value: 'a', label: 'Alpha', count: 2 },
  { value: 'b', label: 'Beta', count: 5 },
];

describe('Tabs', () => {
  it('renderuje etykiety i liczniki', () => {
    const { getByText } = render(<Tabs items={items} value="a" onChange={() => {}} />);
    expect(getByText('Alpha')).toBeInTheDocument();
    expect(getByText('5')).toBeInTheDocument();
  });
  it('woła onChange z wartością taba', () => {
    const onChange = jest.fn();
    const { getByText } = render(<Tabs items={items} value="a" onChange={onChange} />);
    fireEvent.click(getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement (verbatim struktura z recommendations L968–1001)**

```tsx
// components/ui/Tabs.tsx
import React from 'react';

export interface TabItem { value: string; label: string; count?: number; }

const Tabs = ({ items, value, onChange }: {
  items: TabItem[]; value: string; onChange: (v: string) => void;
}) => (
  <div style={{ display: 'inline-flex', position: 'relative', background: '#F4F4F5', borderRadius: 8, padding: 3 }}>
    {items.map((t) => {
      const active = value === t.value;
      return (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          style={{
            position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', border: 'none', cursor: 'pointer', borderRadius: 6,
            fontFamily: 'var(--font-family-primary)', fontSize: 14, fontWeight: 500,
            background: active ? '#fff' : 'transparent',
            color: active ? '#09090B' : '#3F3F47',
            boxShadow: active ? '0px 4px 4px rgba(24,26,34,0.02), 0px 1px 2px rgba(24,26,34,0.08), 0px -1px 1px rgba(0,0,0,0.02)' : 'none',
            transition: 'background 200ms, box-shadow 200ms, color 200ms',
          }}
        >
          <span style={{ fontWeight: 600 }}>{t.label}</span>
          {t.count !== undefined && (
            <span style={{ fontWeight: 400, color: active ? '#52525C' : '#9F9FA9', fontSize: 13 }}>{t.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

export default Tabs;
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add components/ui/Tabs.tsx __tests__/ui/Tabs.test.tsx
git commit -m "feat(ui): add Tabs pill switcher"
```

---

### Task 2.5: `components/ui/Badge.tsx`

**Files:**
- Create: `components/ui/Badge.tsx`

> Konsoliduje `StatusBadge` (content-audit L29–44) i pille statusów. Kolory wg `DESIGN.md §3.4`.

- [ ] **Step 1: Implement**

```tsx
// components/ui/Badge.tsx
import React from 'react';

type Status = 'published' | 'draft' | 'updated' | 'created';
const STATUS: Record<Status, { bg: string; color: string }> = {
  published: { bg: '#F0FDF4', color: '#15803D' },
  draft: { bg: '#F9FAFB', color: '#6B7280' },
  updated: { bg: '#EFF6FF', color: '#1D4ED8' },
  created: { bg: '#FAF5FF', color: '#6D28D9' },
};

const Badge = ({ variant = 'status', status, children }: {
  variant?: 'status' | 'suggestion' | 'filter';
  status?: Status;
  children: React.ReactNode;
}) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', borderRadius: 20,
    padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-family-primary)',
  };
  let skin: React.CSSProperties = {};
  if (variant === 'status' && status) skin = { background: STATUS[status].bg, color: STATUS[status].color };
  if (variant === 'suggestion') skin = { background: 'rgba(120,58,251,0.08)', color: '#783AFB', borderRadius: 9999 };
  if (variant === 'filter') skin = { background: '#F4F4F5', color: '#3F3F47', borderRadius: 9999 };
  return <span style={{ ...base, ...skin }}>{children}</span>;
};

export default Badge;
```

- [ ] **Step 2: Compile** — `npx tsc --noEmit`
- [ ] **Step 3: Commit**

```bash
git add components/ui/Badge.tsx
git commit -m "feat(ui): add Badge (status/suggestion/filter)"
```

---

### Task 2.6: `components/ui/SortableHeader.tsx` (tylko nagłówek — bez Table/Row/Cell)

**Files:**
- Create: `components/ui/SortableHeader.tsx`

> **Świadoma decyzja (z code review):** ekstrahujemy TYLKO `SortableHeader` (verbatim z `recommendations.tsx:944-957`, `TH`). `Table`/`TableRow`/`TableCell` **NIE powstają teraz** — to byłaby przedwczesna abstrakcja. Każda strona ma inną szerokość kolumn, inne komórki i inny hover; wymuszanie wspólnego `Table` prowadzi do „dopasowywania stron do biblioteki". Strony zachowują własną flexbox-ową strukturę tabeli; współdzielimy tylko nagłówek (bo to on ma logikę sortowania + ikonę).
>
> Po migracji (Faza 4) oceniamy, czy realny, powtarzalny kształt `Table/Row/Cell` istnieje — jeśli tak, ekstrakcja trafia do roadmapu jako osobny task. Patrz „Poza zakresem".

- [ ] **Step 1: Implement (verbatim z recommendations L944–957)**

```tsx
// components/ui/SortableHeader.tsx
import React from 'react';
import { SortUpDown } from './icons';
import type { SortDir } from '../../lib/useSortState';

const SortableHeader = ({ label, sortKey, activeKey, dir, width, onSort }: {
  label: string; sortKey: string; activeKey: string; dir: SortDir; width: number; onSort: (k: string) => void;
}) => {
  const active = activeKey === sortKey;
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => e.key === 'Enter' && onSort(sortKey)}
      style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width, flexShrink: 0, cursor: 'pointer', userSelect: 'none', gap: 4 }}
    >
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#09090B' : '#52525C', textDecoration: 'underline dotted', textDecorationColor: '#9F9FA9', textUnderlineOffset: 4 }}>
        {label}
      </span>
      <SortUpDown active={active} dir={active ? dir : null} />
    </div>
  );
};

export default SortableHeader;
```

- [ ] **Step 2: Compile** — `npx tsc --noEmit`
- [ ] **Step 3: Commit**

```bash
git add components/ui/SortableHeader.tsx
git commit -m "feat(ui): add SortableHeader (Table/Row/Cell intentionally deferred)"
```

---

### Task 2.7: `components/ui/Skeleton.tsx`, `Modal.tsx`, `SlidePanel.tsx`, `SelectionBar.tsx` (ekstrakcja verbatim)

**Files:**
- Create: `components/ui/Skeleton.tsx` — z `recommendations.tsx:95-132` (`SkeletonRows`)
- Create: `components/ui/SlidePanel.tsx` — z `recommendations.tsx:477-686` (`SlidePanel`)
- Create: `components/ui/SelectionBar.tsx` — z `recommendations.tsx:689-698` (`SelectionBar`)
- Create: `components/ui/Modal.tsx` — generyczna powłoka (overlay `rgba(0,0,0,0.5)` + biały panel `borderRadius:16`, `animation: growOut 0.2s cubic-bezier(0.16,1,0.3,1)`, przycisk close), wydzielona ze struktury `ChangeKeywordModal` (`recommendations.tsx:190-370`) — tylko powłoka, bez logiki keywordów.

Dla każdego pliku:

- [ ] **Step 1:** Skopiuj definicję komponentu **verbatim** z podanego zakresu do nowego pliku; dodaj `import React from 'react'`; jeśli używa `XIcon`/innej ikony — `import { XIcon } from './icons'`. Wyeksportuj `default`.
- [ ] **Step 2:** `npx tsc --noEmit` — brak błędów.
- [ ] **Step 3:** Commit — `git commit -m "feat(ui): add <Component> (extracted verbatim)"`.

> **`Modal` — jawne API + zachowanie 1:1 ze źródłem.** Zweryfikowano: `ChangeKeywordModal` zamyka się **kliknięciem overlaya**, ma `animation: growOut`, overlay `rgba(0,0,0,0.5)`, panel `borderRadius:16`. NIE ma focus-trap / scroll-lock / zamykania ESC.
>
> Sygnatura:
> ```tsx
> interface ModalProps {
>   title: string;
>   onClose: () => void;
>   children: React.ReactNode;
>   width?: number;                    // domyślnie 680
>   closeOnOverlayClick?: boolean;     // domyślnie true (zgodne ze źródłem)
> }
> ```
> Zachowanie: overlay click → `onClose()` (gdy `closeOnOverlayClick`), klik w panel → `stopPropagation`. **Poza zakresem (YAGNI — nie ma tego w źródle):** ESC-to-close, focus-trap, scroll-lock. Nie dodawaj ich „na zapas". Wyciągnij z `ChangeKeywordModal` (`recommendations.tsx:190-370`) wyłącznie powłokę: overlay + panel + nagłówek (`title` + przycisk close z `XIcon`). Cała logika wyboru keywordu zostaje w `recommendations.tsx` i owija się nowym `<Modal>` w Task 3.1.

---

### Task 2.8: `components/ui/index.ts` (barrel) + smoke test

**Files:**
- Create: `components/ui/index.ts`
- Test: `__tests__/ui/barrel.test.ts`

- [ ] **Step 1: Write the failing smoke test (częsty punkt awarii)**

```ts
// __tests__/ui/barrel.test.ts
import * as ui from '../../components/ui';

it('barrel eksportuje wszystkie publiczne komponenty', () => {
  ['Gauge', 'Checkbox', 'Toggle', 'SearchBar', 'Tabs', 'Badge',
   'Modal', 'SlidePanel', 'SelectionBar', 'Skeleton', 'SortableHeader'
  ].forEach((name) => {
    expect((ui as Record<string, unknown>)[name]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL** (`npx jest __tests__/ui/barrel.test.ts`) — module not found

- [ ] **Step 3: Implement**

```ts
// components/ui/index.ts
export { default as Gauge } from './Gauge';
export { default as Checkbox } from './Checkbox';
export { default as Toggle } from './Toggle';
export { default as SearchBar } from './SearchBar';
export { default as Tabs } from './Tabs';
export { default as Badge } from './Badge';
export { default as Modal } from './Modal';
export { default as SlidePanel } from './SlidePanel';
export { default as SelectionBar } from './SelectionBar';
export { default as Skeleton } from './Skeleton';
export { default as SortableHeader } from './SortableHeader';
export * as tokens from './tokens';
export * from './icons';
```

- [ ] **Step 4: Run — PASS** + `npx tsc --noEmit && npx jest --ci` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add barrel export + smoke test"`

---

# FAZA 3 — Migracja stron (parytet pikselowy)

> Zasada: jeden plik = jeden commit. Każdy task kończy się **wizualnym porównaniem przed/po** + `npx jest --ci`. Usuwaj osierocone inline-definicje i importy, których Twoja zmiana pozbawiła użytkowników (zgodnie z `CLAUDE.md §3`).

### Task 3.1: `recommendations.tsx` → importy z `ui/` (KANON) _[visual parity]_

**Files:**
- Modify: `pages/sites/[domain]/recommendations.tsx`

To jest najważniejsza migracja — `recommendations.tsx` był źródłem, więc po podmianie musi wyglądać **identycznie**.

- [ ] **Step 1:** Dodaj `import { Gauge, Checkbox, Toggle, SearchBar, Tabs, SlidePanel, SelectionBar, Modal, SortableHeader } from '../../../components/ui';` oraz `import { useSortState } from '../../../lib/useSortState';` (zweryfikuj liczbę `../` względem `pages/sites/[domain]/`). **Uwaga:** strona zachowuje własną flexbox-ową strukturę tabeli (kontener + wiersze + komórki) — podmieniamy tylko nagłówek na `SortableHeader`, nie ma `Table/Row/Cell`.
- [ ] **Step 2:** Usuń lokalne definicje: `RecCheckbox` (L167–185), `Toggle` (L701–707), `SlidePanel` (L477–686), `SelectionBar` (L689–698), `TH` (L944–957), `SortUpDown`/`DeltaDown`/`XIcon` (L74–90, 160–164), `GaugeArc` (L54–71), `SkeletonRows` (L95–132). Podmień użycia:
  - `<RecCheckbox .../>` → `<Checkbox .../>`
  - `<Toggle .../>` (lokalny) → `<Toggle .../>` (z ui — identyczne propsy)
  - `<GaugeArc score={s} />` → `<Gauge score={s} size="sm" />`
  - `<TH label k width />` → `<SortableHeader label sortKey={k} activeKey={sortKey} dir={sortDir} width onSort={handleSort} />`
  - search input (L1033–1057) → `<SearchBar value onChange placeholder width={250} />`
  - tab switcher (L968–1001) → `<Tabs items={[...]} value={tab} onChange={setTab} />`
- [ ] **Step 3:** Zamień lokalny `handleSort`/stan sortowania na `const { sortKey, sortDir, handleSort } = useSortState<SortKey>('content_score');` (dobierz domyślny klucz wg obecnego stanu początkowego).
- [ ] **Step 4:** Przenieś `ChangeKeywordModal` na powłokę `<Modal title onClose width={680}>` (zachowując wewnętrzną logikę keywordów). Jeśli klasy `.rec-cb-*`/`.rec-row:hover` były tu zdefiniowane — usuń je stąd (są już w `globals.css`).
- [ ] **Step 5: Visual parity** — `npm run dev`, otwórz `/sites/<domena>/recommendations`, sprawdź wszystkie 3 taby, hover wierszy, zaznaczanie, slide panel, modal zmiany keywordu, filtry. Zrzut przed/po identyczny.
- [ ] **Step 6:** `npx jest --ci` → PASS.
- [ ] **Step 7: Commit** — `git commit -m "refactor(ui): recommendations uses shared ui library"`.

### Task 3.2: `content-audit.tsx` _[visual parity]_

**Files:**
- Modify: `pages/sites/[domain]/content-audit.tsx`

- [ ] **Step 1:** Import z `ui` + `useSortState`.
- [ ] **Step 2:** Podmień: natywne checkboxy (L208/230/263) → `<Checkbox>`; natywny „Show URLs" (L207–210) → `<Toggle>`; własny search (L217–220) → `<SearchBar width={200}>`; własny `TH` (L154–166) → `<SortableHeader>`; `ScoreRing` (L12–27) → `<Gauge size="sm">`; `StatusBadge` (L29–44) → `<Badge variant="status" status={...}>`; lokalny sort (L125–128) → `useSortState`.
- [ ] **Step 3:** Usuń osierocone definicje (`ScoreRing`, `StatusBadge`, `TH`, sort handler).
- [ ] **Step 4: Visual parity** + `npx jest --ci`.
- [ ] **Step 5: Commit** — `"refactor(ui): content-audit uses shared ui library"`.

### Task 3.3: Pozostałe strony _[visual parity]_ (po jednym commicie na plik)

Dla każdej: zaimportuj odpowiednie prymitywy z `ui`, podmień lokalne re-implementacje, usuń osierocony kod, zweryfikuj wizualnie + `npx jest --ci`, commit.

- [ ] **`audit.tsx`** (legacy Tailwind) — podmień gauge w `AuditPanel` (już zrobione w 1.4) i, jeśli ma własny search/checkbox, na prymitywy `ui`. (Pełna konsolidacja `audit` vs `content-audit` jest w roadmap B — tu tylko prymitywy.)
- [ ] **`performance.tsx`** — `SearchBar`, ewentualnie `Toggle`/`Badge`; filter-pille zostają lokalne, jeśli różnią się od `FilterPopover` (nie wymuszaj — patrz `CLAUDE.md §3`).
- [ ] **`activity-log.tsx`** — `Badge` dla statusów zdarzeń; reszta layoutu (timeline) zostaje.

- [ ] **Step końcowy:** `npx jest --ci` → PASS dla całości.

---

# FAZA 4 — Sprzątanie i weryfikacja końcowa

### Task 4.1: Usunięcie martwego kodu i build

**Files:** różne (tylko osierocone fragmenty z poprzednich tasków)

- [ ] **Step 1:** Przeszukaj zmienione pliki pod kątem nieużywanych importów/definicji powstałych z migracji: `npx eslint pages/sites components/articles pages/dashboard --ext .ts,.tsx`.
- [ ] **Step 2:** Usuń to, co osierociły Twoje zmiany (nie ruszaj wcześniej istniejącego martwego kodu).
- [ ] **Step 3:** `npm run lint` → bez błędów.
- [ ] **Step 4:** `npm run build` → sukces, brak nowych ostrzeżeń TS.
- [ ] **Step 5: Commit** — `"chore(ui): remove orphaned inline component definitions"`.

### Task 4.2: QA wg DESIGN.md i parytet końcowy

- [ ] **Step 1:** Dla każdej zmienionej strony przejdź checklistę `DESIGN.md §27` (font, kolory, hover, focus, radius, shadow, mobile).
- [ ] **Step 2:** Finalne porównanie zrzutów przed/po dla: recommendations (3 taby), content-audit, performance, activity-log, dashboard, edytor artykułu (Content Score + Version History), research panel (MiniGauge), audit panel.
- [ ] **Step 3:** `graphify update .` (aktualizacja grafu po zmianach).
- [ ] **Step 4: Commit** — `"chore(ui): refresh graphify graph after design-system migration"`.

---

## Poza zakresem tego planu (świadome odłożenia)

- **Podmiana literałów hex → tokeny** w komponentach. `tokens.ts` powstaje jako referencja, ale ekstrakcja jest verbatim z literałami (parytet diffów). Zamiana `'#783AFB'` → `tokens.color.purple` to osobny refaktor po migracji.
- **`Table` / `TableRow` / `TableCell`** jako współdzielone komponenty. Współdzielimy tylko `SortableHeader`. Po Fazie 4 oceniamy, czy realny wspólny kształt tabeli istnieje; jeśli tak → osobny task.
- **Modal: ESC-to-close / focus-trap / scroll-lock** — nie ma tego w źródle; nie dodajemy spekulatywnie.
- Funkcje produktowe (B) — patrz `2026-06-23-functional-improvements-roadmap.md`.

## Self-review (autorski — po code review)

Zmiany wprowadzone po recenzji: tokeny reference-only (#1), `data-testid` w Gauge (#2), `renderHook` zweryfikowany dla RTL 14 — bez zmian (#3, odrzucone z uzasadnieniem), test indeterminate (#4), ikony grep+copy verbatim (#5), Modal z jawnym API (#6), tylko `SortableHeader` zamiast `Table/Row/Cell` (#7), smoke test barrel (#8), grupowanie commitów per faza.


- **Pokrycie spec:** tokeny (0.3), scoreColor (0.1), `components/ui/` pełna lista (Fazy 0–2), Gauge sm/lg z progami 33/66 (1.1–1.2), konsolidacja 8 gauge (1.3–1.4, 3.1–3.2), rodzina tabeli + useSortState (0.2, 2.6), Checkbox/Toggle/SearchBar/Tabs/Badge (2.1–2.5), Modal/SlidePanel/SelectionBar/Skeleton (2.7), migracja wszystkich stron z spec §6 (Faza 3), weryfikacja parytetem + testy + DESIGN.md §27 (Faza 4). `CircleProgress` jawnie nietknięty (nie występuje w żadnym tasku). ✔
- **Brak placeholderów:** każdy krok logiczny ma pełny kod; kroki „verbatim" wskazują dokładny zakres źródła + wymagane zmiany. ✔
- **Spójność typów:** `useSortState`/`SortDir` użyte spójnie w `SortableHeader.tsx` i Fazie 3; `Gauge` API (`score`,`size`) spójne we wszystkich użyciach; `scoreColor` importowany jednolicie. ✔
- **Ryzyko:** największe = parytet pikselowy przy ekstrakcji verbatim — mitygowane zrzutami przed/po w każdym tasku migracji i regułą „kopiuj dokładnie".
