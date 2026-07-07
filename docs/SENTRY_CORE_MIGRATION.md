# Sentry Core Component Migration

> Hybryda Surfer/Sentry: generyczne UI → `components/core`; unikalny produkt Surfer → KEEP w `components/surfer/`.

## Fundamenty
- `_app.tsx`: `ThemeProvider` + `IconDefaultsProvider`
- Tokeny primary: `components/core/theme.tsx`
- Barrel: `components/core/index.ts`
- Design zones: `design.md` §1.1 Hybrid zones

## Status

- [x] fundamenty: `_app.tsx` + theme
- [x] `design.md` hybrid zones + `--zone-editor-bg`
- [x] core ports: separator, menuListItem, statusIndicator, pagination, segmentedControl, form, link, drawer, searchBar
- [x] `SentryNav` w `AppShell` (docking, org switcher, help L2, business→billing, beyond basics, collapse)
- [x] usunięto `Sidebar`, `WorkspaceSwitcher`, `TopBar`
- [x] `common/Modal`, `ConfirmModal`, `InputField`, `ToggleField`, `SecretField` → core
- [x] `SelectField` single-select → core `Select`
- [x] `SidePanel` → `SlideOverPanel`
- [x] `components/surfer/` — Gauge, SelectionBar, SortableHeader, SlidePanel
- [x] usunięto `components/ui/` wrappery (barrel deprecated → core)
- [x] editor primitives (modale, OptimizeReviewBar, CommentComposer)
- [x] TrafficAlerts → `StatusIndicator`
- [ ] pełna migracja keywords/domains (Icon → inline SVG) — opcjonalnie iteracyjnie
- [ ] `SettingsLayout` → Sentry secondary nav pattern — przyszła iteracja

## KEEP (`components/surfer/`)

Scoring, TipTap, Surfy, AO, AuditFactorChart, TermsTable, AuthSplitLayout branding.

## Importy

| Stary | Nowy |
|-------|------|
| `components/ui/*` | `components/core` |
| `common/HoverTooltip` | `core` → `HoverTooltip` alias |
| `common/Modal` | `core/Modal` (wrapper zachowany dla API) |
