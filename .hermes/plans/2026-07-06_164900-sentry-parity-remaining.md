# Sentry 1:1 Migration — Remaining Work Plan

> **For Hermes:** Realizuj task-by-task. Zero inline styles (reguła projektu) — styling przez `components/core` + klasy CSS w `globals.css`. Weryfikacja: `npx tsc --noEmit -p tsconfig.json` + `npx eslint <plik>` (NIE `npm run build` — za wolny).

**Goal:** Uzupełnić migrację powłoki nawigacji i biblioteki komponentów core serpbear do parytetu 1:1 z Sentry.

**Architektura:** Rail nawigacji w `components/common/nav/SentryNav.tsx` (+ `sentryIcons.tsx`), style w `styles/globals.css` (sekcja "Sentry-style Primary Navigation rail"). Komponenty core w `components/core/<nazwa>/`, portowane z `sentry/static/app/components/core/` z użyciem lokalnego `theme.tsx` zamiast `@sentry/scraps`.

**Tech Stack:** Next.js 12, React, Emotion (`@emotion/styled`), TypeScript, Tailwind (edge-cases).

---

## CZĘŚĆ A — Nawigacja (SentryNav)

### Task A1: Docking secondary nav (przypięcie flyoutu na stałe)
**Objective:** Chevron w headerze secondary flyout przełącza tryb "przypięty" — flyout rozpycha panel (`.sentry-secondary--docked`) zamiast nakładać się; stan w localStorage.
**Files:**
- Modify: `components/common/nav/SentryNav.tsx` (header secondary — dodać przycisk `.sentry-secondary-expand` z `IconChevron`, stan `docked`, `useEffect` persystencja `localStorage['serpbear_nav_docked']`)
- Modify: `styles/globals.css` (`.sentry-secondary--docked` już istnieje — zweryfikować że rozpycha `.app-content`)
**Verify:** tsc 0 błędów; klik chevron → flyout przypięty, panel się przesuwa; reload zachowuje stan.

### Task A2: Collapse całego railu (`<<` w topbarze)
**Objective:** Przycisk w `GlobalTopbar` zwija rail do węższej formy (tylko ikony bez etykiet) lub całkowicie.
**Files:**
- Modify: `components/common/GlobalTopbar.tsx` (przycisk collapse `<<`)
- Modify: `components/common/nav/SentryNav.tsx` (prop/context `collapsed`)
- Modify: `styles/globals.css` (`.sentry-nav--collapsed`)
**Verify:** tsc 0; klik zwija/rozwija rail.

### Task A3: Org switcher dropdown (klik w avatar org u góry)
**Objective:** Klik w `.sentry-nav-org` otwiera dropdown z listą organizacji/workspace (dane z `useWorkspaces`), aktywny zaznaczony checkmarkiem.
**Files:**
- Modify: `components/common/nav/SentryNav.tsx` (nowy popover `OrgMenu`, reuse `useDismiss`, pozycja od góry `top: anchor.bottom`)
- Modify: `styles/globals.css` (reuse `.sentry-nav-popover` / `.sentry-menu-item`)
**Verify:** tsc 0; klik avatar org → lista workspace; wybór przełącza aktywny.

### Task A4: Help submenu drugiego poziomu
**Objective:** Resources/Community/Legal (mają chevron) rozwijają zagnieżdżone pod-menu (Welcome Page, Documentation, API Docs, Help Center, Contact Support).
**Files:**
- Modify: `components/common/nav/SentryNav.tsx` (stan `helpSubmenu`, render zagnieżdżonej listy obok — pozycja `left: anchor.right`)
- Reuse ikony: `IconSentryLogo`, `IconDocs`, `IconSupport` (obecnie usunięte z importu — przywrócić)
**Verify:** tsc 0; hover/klik Resources → pod-menu z linkami.

### Task A5: Business icon → pricing/upgrade akcja
**Objective:** Klik ikony Business otwiera modal/redirect do `/settings/billing_subscription` zamiast martwego przycisku.
**Files:**
- Modify: `components/common/nav/SentryNav.tsx` (onClick → `router.push('/settings/billing_subscription')`)
**Verify:** tsc 0; klik → nawigacja do subskrypcji.

### Task A6: Getting Started — druga grupa "Beyond the Basics" + skip/collapse
**Objective:** OnboardingMenu dostaje drugą grupę zadań (collapsed domyślnie) + przycisk skip per task.
**Files:**
- Modify: `components/common/nav/SentryNav.tsx` (`OnboardingMenu` — sekcje z chevronem, `IconNot` skip)
- Modify: `lib/useOnboardingChecklist.ts` (opcjonalnie: druga grupa kroków)
**Verify:** tsc 0; druga grupa zwijalna, skip działa.

### Task A7: Mobile responsywność railu
**Objective:** Rail chowa się na mobile (<1024px), `MobileBottomNav` przejmuje; secondary flyout jako pełnoekranowy drawer.
**Files:**
- Modify: `styles/globals.css` (`@media (max-width: 1023px) { .sentry-nav { display: none } }`)
- Modify: `components/common/MobileBottomNav.tsx` (sync tras z SentryNav)
**Verify:** tsc 0; DevTools mobile → rail ukryty, bottom nav widoczny.

---

## CZĘŚĆ B — Komponenty core (parytet z Sentry)

Sentry `components/core` ma 44 podkatalogi; serpbear ma 16. **Brakujące** (posortowane wg wartości użytkowej):

### Task B1: separator (najprostszy, używany w menu/sekcjach)
**Files:** Create `components/core/separator/separator.tsx` + export w `components/core/index.ts`
**Port z:** `sentry/static/app/components/core/separator/`

### Task B2: radio (formularze)
**Files:** Create `components/core/radio/radio.tsx`
**Port z:** `sentry/static/app/components/core/radio/` (analogicznie do istniejącego `checkbox`)

### Task B3: textarea (formularze — brakujący partner input)
**Files:** Create `components/core/textarea/textarea.tsx`
**Port z:** `sentry/static/app/components/core/textarea/`

### Task B4: alert (komunikaty info/warning/error/success)
**Files:** Create `components/core/alert/alert.tsx`
**Port z:** `sentry/static/app/components/core/alert/` (użyć tokenów `theme.tokens`)

### Task B5: avatar + avatarButton (używane w nav/topbar — obecnie inline)
**Files:** Create `components/core/avatar/avatar.tsx`, `components/core/avatarButton/`
**Korzyść:** zastąpi inline avatary w `SentryNav` i `TopbarAccountMenu`.

### Task B6: statusIndicator (kropki statusu — używane w traffic alerts/timeline)
**Files:** Create `components/core/statusIndicator/`
**Port z:** `sentry/static/app/components/core/statusIndicator/`

### Task B7: segmentedControl (przełączniki widoku)
**Files:** Create `components/core/segmentedControl/`

### Task B8: pagination (tabele/listy)
**Files:** Create `components/core/pagination/`

### Task B9: menuListItem (współdzielony element dropdownów — refactor SentryNav popoverów)
**Files:** Create `components/core/menuListItem/`; refactor `SentryNav` menu na ten komponent.

### Task B10 (niższy priorytet): slider, disclosure, drawer, compactSelect, code, markdown, quote, hotkey, splitPanel, interactionStateLayer, revealOnHover
**Uwaga:** wiele z nich zależy od `@sentry/scraps` — port wymaga uproszczenia. Robić tylko na żądanie / gdy potrzebne przez konkretną stronę.

---

## Kolejność rekomendowana
1. **A1 (docking) + A3 (org switcher)** — codzienne interakcje, największa wartość.
2. **A4, A5, A6** — dopełnienie dropdownów (usuwa dead-buttony).
3. **B1–B4** — proste, samodzielne komponenty formularzy/UI.
4. **B5 (avatar)** — pozwala usunąć inline avatary z nav/topbar (zgodność z regułą zero-inline-styles).
5. **A2, A7** — collapse + mobile (większa zmiana layoutu).
6. **B6–B9, B10** — wg potrzeb konkretnych stron.

## Ryzyka / otwarte kwestie
- **A2/A7** dotykają `app-shell` layout — ryzyko regresji szerokości content. Testować na `/dashboard` i `/settings`.
- **B10** komponenty z `@sentry/scraps` — decyzja: uprościć czy pominąć? (analogicznie jak layout/text).
- Reguła zero-inline-styles: jedyny dozwolony wyjątek to runtime-computed pozycje popoverów (`getBoundingClientRect`).
- `npm run build` pominięty — weryfikacja tsc+eslint (preferencja użytkownika).
