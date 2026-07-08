---
description: Design system SerpBear — DESIGN.md, Sentry shell, Surfer editor
globs: "**/*.{tsx,jsx}"
alwaysApply: false
---

# Frontend design

**Przed każdą zmianą UI** przeczytaj `@DESIGN.md` (źródło prawdy). Użyj skill `/frontend-design` przy większych zmianach.

## Strefy (DESIGN.md §1.1)

| Strefa | Gdzie | Styl |
|--------|-------|------|
| Sentry shell | Sidebar, topbar, settings | `components/core/*`, CSS vars, ciemny `#09090b` |
| Sentry app | Dashboard, domains, AI vis | `components/sentry-pages/*`, `@components/core/theme.tsx` |
| Surfer editor | `pages/articles/[id]/*`, scoring | KEEP layout; purple `#783AFB`, `lib/scoreColor.ts` |

## Reguły

- **Nowy kod poza edytorem** → `components/core` + Emotion/CSS vars; **bez** inline styles (wyjątek: runtime pozycje popoverów)
- **Edytor artykułu** — nie przebudowuj struktury Surfer; podmieniaj tylko primitives (`Button`, `Modal`, `Input`)
- Font: `var(--font-family-primary)` — nigdy hardcode Inter/Arial
- Ikony: inline SVG — bez zewnętrznych bibliotek ikon
- Tokeny: brand `#783AFB`, card border `#F4F4F5`, content text `#18181B`, muted `#52525C`

Szczegóły komponentów, tabele, spacing → `@DESIGN.md` §1.2+
