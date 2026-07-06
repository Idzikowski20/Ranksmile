# Sentry Core Component Migration

> Cel: zastąpić ręczne inline-style komponenty oraz fragmenty `components/ui` przeniesionymi/core komponentami Sentry, zgodnie z DESIGN.md.

## Instalacja / fundamenty
- `_app.tsx` już otwarty w `ThemeProvider` + `IconDefaultsProvider`.
- Tokeny lives w `components/core/theme.tsx`.
- Unia nowych i starych komponentów: `components/core/index.ts`.

## Mapowanie importów
- Stary: `components/ui/Button` → Nowy: `components/core/button/button` lub bezpośrednio `components/core`
- Stary: `components/ui/Badge` → Nowy: `components/core/badge/badge`
- Stary: `components/ui/Input` → Nowy: `components/core/input/input`
- Stary: `components/ui/Checkbox` → Nowy: `components/core/checkbox/checkbox`
- Stary: `components/ui/Toggle` → Nowy: `components/core/switch/switch` (alias `Toggle` istnieje)
- Stary: `components/ui/SearchBar` → Nowy: `components/core/input/input` + ikona
- Stary: `components/ui/Tabs` → Nowy: `components/core/tabs/tabs`
- Stary: `components/ui/Skeleton` → Nowy: `components/core/loader/indeterminateLoader`
- Stary: `components/ui/Modal` → Nowy: `components/core/modal/modal` z `ModalHeader / ModalBody / ModalFooter`
- Stary: `components/ui/SlidePanel` → Nowy: `components/core/slideOverPanel/slideOverPanel`
- Stary: `components/ui/SelectionBar` / `SortableHeader` / `SearchBar` / `SlidePanel` → left w `components/ui/` jako unikalne wrappery

## Zasady redesignu
- Preferuj flex/grid z DESIGN.md + tokeny, nie inline-style dla powtarzających się wzorców.
- Wszystkie kolory z DESIGN.md w formie tokenów: `components/ui/tokens.ts` + mapuj na temat Sentry jeśli zachodzi zgodność.
- Zachowuj istniejące zachowanie: `AppShell`, `Sidebar`, routing.
- Modyfikuj pliki po jednym komponencie/stronie, commit często.

## Status
- [x] fundamenty: `_app.tsx` + theme
- [x] unifikacja `ui/*.tsx` → delegują do `components/core/...`
- [ ] przepisanie `pages/sites/[domain]/performance.tsx` na core-e
- [ ] przepisanie mniejszych stron: `content-audit`, `ideas`, `recommendations`, `topical-map`, `activity-log`
- [ ] agregacja `components/common/*` do `components/core/*` tam gdzie pasuje
