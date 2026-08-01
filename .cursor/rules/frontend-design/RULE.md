---
description: Design system Ranksmile — DESIGN.md, Koala UI v11, editor exception
globs: "**/*.{tsx,jsx}"
alwaysApply: false
---

# Frontend design

**Przed każdą zmianą UI** przeczytaj `@DESIGN.md` (źródło prawdy). Przy większych zmianach użyj skill `/frontend-design`. Sprawdź `components/koala/REGISTRY.md` zanim zaimportujesz coś z Figmy.

## Strefy (DESIGN.md)

| Strefa | Gdzie | Styl |
|--------|-------|------|
| App shell | Nav, topbar, mobile | Koala Light, `components/koala` |
| App content | Dashboard, domains, AI vis, settings | `koala/layout`, `sentry-pages` + Koala tokens |
| Editor zone | `pages/articles/[id]/*`, scoring | KEEP TipTap/scoring; primitives z koala/core |

## Reguły

- **Nowy kod poza edytorem** → `components/koala` + Emotion/CSS vars; **bez** nowych Tailwind klas
- **Edytor** — nie przebudowuj struktury; podmieniaj `Button` / `Modal` / `Input`
- Font: DM Sans — `var(--font-family-primary)`
- Ikony: `components/koala/icons` (Phosphor Bold)
- **Accent:** `#F84416` — **nie** `#F29964` / purple `#783AFB` w nowym UI
- Karty: border `#e5e5e5`, radius `16px`
- Ponytail: nie duplikuj komponentów — REGISTRY najpierw

Szczegóły → `@DESIGN.md`
