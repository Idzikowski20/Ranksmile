# GSAP Motion Polish — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorming) — ready for writing-plans (Phase 1)

## Goal

Add a cohesive, "premium" motion layer across the Surfy app using GSAP **where it genuinely
beats the existing stack**, without rewriting the animations that already work (Framer Motion +
CSS keyframes). One sentence: make the app *feel* polished through orchestrated entrances,
smooth layout transitions, and tasteful micro-interactions — accessibly.

## Approach (chosen: A — layered)

GSAP is added **alongside** the existing Framer Motion + CSS keyframes, with clear boundaries so
we never have three overlapping systems fighting over the same element:

| Concern | Tool | Why |
|---|---|---|
| Orchestrated entrances / staggered reveals | **GSAP ScrollTrigger** | batch + scroll-aware stagger is GSAP's strength |
| Layout / state transitions (expand, shared element) | **GSAP Flip** | records before/after layout, animates the delta |
| Component micro-interactions already built | **Framer Motion (keep)** | comments, modals, panels already use `motion.` |
| Simple hover/press, dropdowns, skeletons | **CSS / Framer (keep)** | GSAP would be redundant |

Rejected: B (GSAP-first, rewrite working Framer code → regression risk) and C (no GSAP, under-uses
the toolkit the user deliberately installed).

## Foundation (cross-cutting, single module)

`lib/motion/gsap.ts` — the **only** place that touches GSAP setup:

- **Plugin registration** in one call: `gsap.registerPlugin(useGSAP, ScrollTrigger, Flip, SplitText, DrawSVGPlugin)`
  (other installed plugins registered lazily by the surface that needs them).
- **Motion tokens** sourced from `design.md`. If a value is absent there, define and document it
  here: durations `fast 160ms / base 240ms / slow 360ms`; a project `CustomEase` ("surfer" ease)
  plus a spring for press feedback. Tokens are the single source of truth — surfaces import them,
  never hardcode.
- Re-export `useGSAP` from `@gsap/react` so React components get automatic context cleanup.
- **Reduced-motion guard (global):** a `gsap.matchMedia()` wrapper / helper so that when the OS
  reports `prefers-reduced-motion: reduce`, animations resolve **instantly to their end state**
  (no motion). Every surface routes its tweens through this helper. This is a hard requirement.

Everything else imports from this module. No `registerPlugin` scattered across components.

## Surfaces (the validated design — all four)

1. **Data & list reveals → `ScrollTrigger.batch` stagger.** Dashboard cards, audit /
   recommendations rows, article list enter element-by-element as they reach the viewport
   (replacing pop-in). Page headings may use `SplitText` for a subtle character reveal (optional).
   Plugins: `ScrollTrigger`, optionally `SplitText`.

2. **View transitions → `Flip` + timeline.** Content area cross-fades/slides on route change in
   `AppShell`; `Flip` for shared-element moves (clicking a domain/article card expands into its
   detail view). Plugins: `Flip`, core.

3. **Editor + Write & Optimize → `Flip` + small timeline.** SEO/AI section expand/collapse animates
   the height/layout delta via `Flip` (instead of a jump); Auto-Optimize sections reveal with a
   stagger. Score gauges keep their existing odometer animation (optionally unified onto a GSAP
   `to`). Surfy streaming **stays on Framer** — not touched. Plugins: `Flip`, core.

4. **Buttons & controls → spring press only.** A springy `scale(0.97)` press feedback and smoother
   state transitions, on **CSS / Framer**. **No GSAP "shine" effect** (explicitly dropped — does
   not fit the palette). Toggles/dropdowns keep their current CSS/Framer animations.

## Phasing

Four surfaces at once is too large for one PR. Each phase is its own spec→plan→implementation:

- **Phase 1 (this spec's implementation target): Foundation + Surface 1 (data reveals).**
  Build `lib/motion/gsap.ts` (registration, tokens, reduced-motion guard) and apply
  `ScrollTrigger.batch` staggered reveal to the dashboard cards and audit/recommendations rows.
  Highest "premium" payoff, lowest risk.
- **Phase 2:** Surface 2 (view transitions, Flip).
- **Phase 3:** Surface 3 (editor, Flip) + Surface 4 (spring press).

## Constraints & non-goals

- **Accessibility:** respect `prefers-reduced-motion` everywhere (see Foundation). Non-negotiable.
- **Follow `design.md`:** colors, durations, easings, radii come from the design system; no new
  palette. Run `/frontend-design` + read `design.md` before writing UI code (project rule).
- **No rewrite of working animations:** Framer Motion stays where it already lives.
- **SSR-safe:** GSAP + ScrollTrigger run client-side only (`useGSAP`/effect-guarded); no `window`
  access during SSR.
- **Bundle:** import plugins per-surface (`import { Flip } from 'gsap/Flip'`) so unused plugins
  don't bloat shared chunks. `EaselPlugin`/`PixiPlugin` are installed but unused (need easeljs/pixi
  peers) — do not import them.

## Testing

- Reduced-motion: with `prefers-reduced-motion: reduce`, elements render at end state, no tween.
- Reveal: cards/rows are visible (not stuck at opacity 0) if JS/ScrollTrigger fails — start from a
  visible base and animate *from* a hidden state via `gsap.from`, so a failure degrades to "no
  animation" rather than "invisible content".
- `tsc --noEmit` clean; production build succeeds; no SSR `window is not defined`.

## Dependencies (already installed)

`gsap@^3.14.1`, `@gsap/react@^2.1.2` — full plugin set present in `node_modules/gsap/dist/`
(ScrollTrigger, Flip, SplitText, DrawSVG, etc.). Installed via npm; **no CDN script tags**.
