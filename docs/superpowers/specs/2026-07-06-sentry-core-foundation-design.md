# Sentry Core Foundation — Stage A Design

## Context

SerpBear has already vendored Sentry's shell (sidebar, topbar, icons, fonts) 1:1
using Emotion CSS-in-JS, per [[sentry-shell-1to1]]. The user now wants to redesign
all SerpBear pages to run on Sentry's `core` component library
(`static/app/components/core/*` in the Sentry checkout at
`C:\Users\patry\Desktop\sentry\`), plus Sentry's `GridEditable` table component,
replacing SerpBear's own UI primitives wherever a Sentry equivalent exists.

An inventory of `components/ui/` and `components/common/` (42 files) classified
each file as: REPLACE 1:1, REPLACE + adapt, KEEP UNIQUE, or DEDUPE FIRST. The
full redesign is too large for one spec, so it's split into two stages:

- **Stage A (this spec):** swap the 20 files that are pure 1:1 replacements —
  no prop-API change, no cross-file restructuring.
- **Stage B (future spec):** Modal dedupe + `core/modal`, `SelectField` →
  `core/select`, `SlidePanel`/`SidePanel` → `core/slideOverPanel`, and
  `GridEditable` rollout across SerpBear's own tables (Keywords, Competitors,
  Audit, etc.).

Sentry's repo is FSL-1.1-Apache-2.0 licensed — vendoring its UI code into an
unrelated SEO SaaS product is a Permitted Purpose (not a Competing Use), so
there's no licensing blocker for this work.

## Scope — Stage A

Files to swap (`components/ui/` and `components/common/`), in dependency
order:

1. `ui/Skeleton.tsx` → backed by Sentry's loader/skeleton pattern (`core/loader`)
2. `common/HoverTooltip.tsx` → `core/tooltip`
3. `ui/Badge.tsx` → `core/badge`
4. `ui/Checkbox.tsx` → `core/checkbox`
5. `ui/Toggle.tsx` / `common/ToggleField.tsx` → `core/switch` (+ `core/form` for the field wrapper)
6. `ui/Tabs.tsx` → `core/tabs`
7. `ui/Button.tsx` → `core/button` (depends on Tooltip + Loader landing first)
8. `common/AppToaster.tsx` → **not a literal port** — Sentry's Toast is tightly
   coupled to its own `IndicatorStore`/`addMessage` domain model (see prior
   research). Instead, build a standalone toast visually modeled on Sentry's
   Toast (Emotion + framer-motion, same animation/shape/icon treatment) but
   with SerpBear's own trigger API (keep whatever `AppToaster` currently
   exposes to callers).
9. `common/InputField.tsx`, `common/SecretField.tsx`, `ui/SearchBar.tsx` →
   `core/input` + `core/form`

Out of scope for Stage A: everything flagged KEEP UNIQUE (Gauge, custom icons,
Chart/ChartSlim, ClientTimeAgo, EmptyEyes, GlobalSmoothCaret, TopProgressBar,
SelectionBar, SortableHeader) and everything flagged shell/already-ported.

## Approach

**In-place swap**, not a parallel library. Each file keeps its existing path
and exported name/props. Internals get rewritten to render through the
corresponding Sentry `core` component. Because the public API doesn't change,
none of the ~200 call sites across SerpBear's pages/components need edits in
this stage.

Rejected alternative: a parallel `components/core/*` mirroring Sentry with a
page-by-page opt-in migration. Safer in theory, but means carrying two
component sets simultaneously and manually rewriting every import at every
call site — unnecessary cost here since Stage A's swaps don't change behavior
or props.

## Infrastructure prerequisites (once, before the file-by-file swap)

- Confirm the already-ported Emotion theme object contains every token key the
  core components touch (`theme.tokens.*`, `theme.radius`, `theme.space`,
  `theme.font.*`, `theme.form`); add any missing keys.
- Stub Sentry-infra hooks these components pull in: `t()` from `sentry/locale`
  → identity passthrough; `useButtonTracking()` / `trackAnalytics()` → no-op.
- Wrap the app once in Sentry's `IconDefaultsProvider` (in `_app.tsx`) since
  several core components read icon-size defaults from it.

## Verification

Per file, not batched at the end:
- Reload the affected page(s) in the browser preview.
- `preview_screenshot` before/after and `preview_inspect` on the swapped
  element's key CSS (color, padding, radius, font) to catch visual drift
  immediately rather than after the whole stage lands.
- One git commit per file swap, so a single regression can be reverted without
  touching the others.

## Explicitly not changing in Stage A

- No prop/API changes on any of the 20 files.
- No changes to Modal (either copy), SelectField, SlidePanel, SidePanel, or any
  table component — these are Stage B.
- No changes to KEEP UNIQUE components.
