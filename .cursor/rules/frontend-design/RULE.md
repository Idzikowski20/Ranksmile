---
description: Design system SerpBear — DESIGN.md, Sentry-first, editor exception
globs: "**/*.{tsx,jsx}"
alwaysApply: false
---

# Frontend design

**Przed każdą zmianą UI** przeczytaj `@DESIGN.md` (źródło prawdy). Przy większych zmianach użyj skill `/frontend-design`.

## Strefy (DESIGN.md §1.1)

| Strefa | Gdzie | Styl |
|--------|-------|------|
| Sentry shell | Nav, topbar, mobile | `components/core/*`, dark `#252525` / `#09090b` |
| Sentry app | Dashboard, domains, AI vis, settings | `sentry-pages/*`, `@components/core/theme.tsx` |
| Editor zone | `pages/articles/[id]/*`, scoring, Surfy | KEEP layout TipTap/scoring; primitives z `core` |

## Reguły

- **Nowy kod poza edytorem** → `components/core` + Emotion/CSS vars; **bez** nowych Tailwind klas (wyjątek: runtime pozycje popoverów)
- **Edytor** — nie przebudowuj struktury; podmieniaj `Button` / `Modal` / `Input`
- Font: `var(--font-family-primary)` / Rubik w shell — nigdy hardcode Inter jako brand
- Ikony: wyłącznie inline SVG
- **Accent:** `#F29964` (Surfy/Sentry) — **nie** Surfer purple `#783AFB` w nowym UI
- Karty Sentry: border `#DAD9DE`, radius `8px`
- Anti-slop: DESIGN.md §12 przed shipem

Szczegóły → `@DESIGN.md`
