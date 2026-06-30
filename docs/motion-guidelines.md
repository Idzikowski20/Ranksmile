# Motion Guidelines

The rules that keep Surfy's animation layer consistent and fast over time. Read before adding any
new animation. The motion layer is **calm** — animations should be barely noticeable; that restraint
is what makes them feel professional. When in doubt, animate less.

## Animate only these properties

- ✅ `transform` (`x`/`y`/`scale`/`rotation`) and `opacity` — GPU-composited, no layout/paint.
- ❌ Never animate layout/paint props: `width`, `height`*, `top`, `left`, `right`, `bottom`, `margin`,
  `padding`. They trigger reflow and stutter.
- ❌ Never animate `box-shadow` (expensive paint). Animate a pseudo-element's `opacity` instead.

\* Exception: a deliberate accordion height reveal may animate `height` via GSAP on a single, small
panel where transform can't express the change — keep it to one element and short. Do not make it a
habit.

## Limits

- **Duration:** never exceed `DURATION.slower` (500ms). Most UI motion is `DURATION.normal` (250ms).
- **Properties:** animate at most ~2 properties per tween (e.g. `opacity` + `y`). More reads busy.
- **Easing:** use the shared `EASE` tokens (`surfer-out` for enter). Never hardcode cubic-beziers.
- **Durations/eases come from `lib/motion/gsap.ts` tokens** — never inline `0.3`, `0.31`, `0.44`.

## `will-change`

GSAP automatically applies `will-change` for the duration of a tween and removes it on completion.
Do **not** set `will-change` permanently in CSS — a permanent `will-change` forces a compositor
layer for the element's whole life and *hurts* performance. Let GSAP manage it.

## Accessibility & progressive enhancement

- Every animation honors `prefersReducedMotion()` — reduced → snap to final state, no tween.
- Base DOM state is the **final/visible** state; animate *from* hidden with `gsap.from(...)`. A JS
  failure then degrades to "no animation", never "invisible content".

## React / lifecycle

- Use `useGSAP()` (`@gsap/react`) with a `scope` ref — it auto-reverts tweens and ScrollTriggers on
  unmount. Create GSAP objects **synchronously** inside the callback so they're captured by the
  context (async creation in a `.then()` escapes cleanup → leak).
- Wrap tweens created inside event handlers in `contextSafe()` so they're cleaned up too.
- Register plugins **once** at app start (`pages/_app.tsx`); `registerMotionPlugins()` is idempotent.

## Race & layout hygiene

- Before re-running a tween on an element that can be re-triggered rapidly (route changes, toggles),
  call `gsap.killTweensOf(el)` to avoid overlapping tweens.
- After inserting/removing content or resizing a panel that affects scroll positions, call
  `ScrollTrigger.refresh()` so triggers don't keep stale coordinates.

## Don't

- ❌ Replace Framer Motion / CSS that already works with GSAP. GSAP only where it adds real value
  (stagger reveals, scroll, deliberate sequences).
- ❌ "Animate every icon / every hover." Surfer-calm beats busy.
