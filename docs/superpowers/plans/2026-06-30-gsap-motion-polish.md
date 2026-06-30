# GSAP Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cohesive, accessible GSAP motion layer (staggered reveals, route transitions, Flip-based editor expand/collapse, spring press) on top of the existing Framer Motion + CSS system, without rewriting what already works.

**Architecture:** One foundation module (`lib/motion/gsap.ts`) owns all GSAP plugin registration, motion tokens (mirroring the existing CSS `--motion-*` vars), the "surfer" eases, and a `prefers-reduced-motion` guard. Reusable hooks (`useStaggerReveal`, `useRouteTransition`, `useFlipResize`) wrap GSAP and are applied per-surface. Framer Motion and CSS keyframes stay where they are.

**Tech Stack:** `gsap@^3.14.1` + `@gsap/react@^2.1.2` (already installed — do NOT reinstall), Next.js (pages router), TypeScript, Jest 29 + jsdom + @testing-library/react.

**Prerequisites / cautions:**
- On branch `feature/tenancy-foundation`. A second session has committed here concurrently this day — before starting, run `git status` and confirm a clean tree; coordinate so only one session writes at a time.
- Spec: `docs/superpowers/specs/2026-06-30-gsap-motion-polish-design.md`.
- Project rule (CLAUDE.md): read `design.md` before any UI code; new code uses inline styles; never invent colors/tokens.
- Tests run with `npx jest <path> --ci` (the `npm test` script is `--watch`). After code commits, run `graphify update .`.
- GSAP touches the DOM, so the real animations are verified by **build + manual browser check**, not jsdom. Unit tests target the pure helpers only. Every animation uses `gsap.from(...)` (base state = final/visible) so a JS failure degrades to "no animation", never "invisible content".
- **Use the installed GSAP skills** (invoke via the Skill tool) for best-practice patterns before/while implementing each phase — do not animate from memory:
  - `gsap-core` + `gsap-timeline` — tweens/timelines (Phase 0, 2, 5)
  - `gsap-react` — `useGSAP`, cleanup, React integration (Phase 0–5, every hook)
  - `gsap-scrolltrigger` — batch/scroll reveals (Phase 1, 5)
  - `gsap-plugins` — Flip and other plugins (Phase 3, 5)
  - `gsap-performance` — will-change, batching, avoiding layout thrash (cross-cutting)
  - `gsap-frameworks` + `gsap-utils` — framework patterns + `gsap.utils` helpers (as needed)

---

## Motion guidelines (read first)

Follow `docs/motion-guidelines.md` for every animation in this plan. Summary: animate only
`transform`/`opacity` (height only for the one accordion panel); ≤2 props; ≤500ms; tokens from
`lib/motion/gsap.ts`; let GSAP manage `will-change` (never permanent); reduced-motion always; calm
over busy.

## Cross-cutting GSAP practices (from plan review)

These apply to every task below — bake them in, don't bolt on later:

1. **Register once.** Plugins are registered a single time at app start (`pages/_app.tsx`, Task 0.2).
   `registerMotionPlugins()` stays idempotent so hook-level calls are safe no-ops.
2. **Cleanup is explicit.** Every hook uses `useGSAP({ scope })` and creates GSAP objects
   **synchronously** inside the callback (no `import().then()` that creates tweens/ScrollTriggers —
   async creation escapes the context and leaks). `useGSAP` then auto-reverts on unmount.
3. **Kill before re-tween.** In rapidly re-triggerable spots (route changes, toggles), call
   `gsap.killTweensOf(el)` before starting a new tween to avoid overlap.
4. **Refresh after layout shifts.** After inserting/removing content or resizing a panel that moves
   scroll positions (Auto-Optimize sections, accordion), call `ScrollTrigger.refresh()`.
5. **contextSafe for handlers.** Tweens created inside event handlers use `contextSafe()` (from
   `useGSAP`) so they're cleaned up.
6. **No Flip.** Plan review: Flip is overkill for the two W&O accordions — use a height tween
   (Task 3.x). `Flip` is therefore NOT registered/imported in the foundation.

## File Structure

- `lib/motion/gsap.ts` — **Create.** Plugin registration (lazy), `DURATION`/`EASE` tokens, surfer eases, `prefersReducedMotion()`, re-exports `gsap` + `useGSAP`. Single source of truth.
- `lib/motion/useStaggerReveal.ts` — **Create.** Hook: stagger-reveal a container's children via `ScrollTrigger.batch`.
- `lib/motion/useRouteTransition.ts` — **Create.** Hook: fade/slide `.app-content` on Next route change.
- `lib/motion/useFlipResize.ts` — **Create.** Hook: animate a layout change with `Flip`.
- `__tests__/lib/motionGsap.test.ts` — **Create.** Pure-helper tests for the foundation + reveal config.
- `pages/dashboard/index.tsx` — **Modify.** Wire `useStaggerReveal` to the card column (~line 230).
- `pages/sites/[domain]/recommendations.tsx` — **Modify.** Wire `useStaggerReveal` to `.rec-row` rows.
- `pages/sites/[domain]/content-audit.tsx` — **Modify.** Wire `useStaggerReveal` to its rows.
- `components/common/AppShell.tsx` — **Modify.** Mount `useRouteTransition` (replaces the CSS-only `motion-page-enter`).
- `styles/globals.css` — **Modify.** Drop the CSS `animation` from `.motion-page-enter` (GSAP drives it now); add `.press-spring` utility (Phase 4).
- `components/articles/WriteOptimizePanel.tsx` — **Modify.** Wire `useFlipResize` to SEO/AI section expand/collapse.

---

## Phase 0 — Foundation

### Task 0.1: Motion foundation module

**Files:**
- Create: `lib/motion/gsap.ts`
- Test: `__tests__/lib/motionGsap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/motionGsap.test.ts
import { DURATION, EASE, prefersReducedMotion, registerMotionPlugins } from '../../lib/motion/gsap';

describe('motion foundation', () => {
  it('mirrors the CSS --motion-* durations (in seconds)', () => {
    expect(DURATION).toEqual({ instant: 0.1, fast: 0.15, normal: 0.25, slow: 0.35, slower: 0.5 });
  });

  it('names the surfer eases', () => {
    expect(EASE).toEqual({ out: 'surfer-out', in: 'surfer-in', inOut: 'surfer-in-out' });
  });

  it('registerMotionPlugins is idempotent (no throw on repeat)', () => {
    expect(() => { registerMotionPlugins(); registerMotionPlugins(); }).not.toThrow();
  });

  it('prefersReducedMotion reflects matchMedia', () => {
    const orig = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q,
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      addListener: jest.fn(), removeListener: jest.fn(), onchange: null, dispatchEvent: jest.fn(),
    })) as any;
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = orig;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/motionGsap.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/motion/gsap'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/motion/gsap.ts
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Durations in SECONDS — mirror styles/globals.css `--motion-*` (ms ÷ 1000). */
export const DURATION = { instant: 0.1, fast: 0.15, normal: 0.25, slow: 0.35, slower: 0.5 } as const;

/** Named CustomEases — same cubic-bezier control points as the CSS --motion-ease-* tokens. */
export const EASE = { out: 'surfer-out', in: 'surfer-in', inOut: 'surfer-in-out' } as const;

let easesReady = false;
function ensureEases(): void {
  if (easesReady) return;
  gsap.registerPlugin(CustomEase);
  CustomEase.create('surfer-out', '0.117,0.517,0.23,0.998');
  CustomEase.create('surfer-in', '0.755,0.05,0.855,0.06');
  CustomEase.create('surfer-in-out', '0.86,0,0.07,1');
  easesReady = true;
}

let pluginsReady = false;
/** Register every plugin we use. Call from a client effect (never at SSR import time). */
export function registerMotionPlugins(): void {
  if (pluginsReady) return;
  ensureEases();
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  pluginsReady = true;
}

/** True when the OS requests reduced motion. SSR-safe (false on the server). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, useGSAP, ScrollTrigger };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/motionGsap.test.ts --ci`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/motion/gsap.ts __tests__/lib/motionGsap.test.ts
git commit -m "feat(motion): GSAP foundation — tokens, surfer eases, reduced-motion guard"
```

### Task 0.2: Register plugins once at app start

**Files:**
- Modify: `pages/_app.tsx`

Per the plan review (#1): register once instead of relying on per-hook calls. `registerMotionPlugins()`
stays idempotent so hooks calling it remain safe no-ops.

- [ ] **Step 1: Add a client-only registration** in the `App` component body (GSAP must not run during SSR):

```tsx
import { useGSAP } from '@gsap/react';
import { registerMotionPlugins } from '../lib/motion/gsap';
// inside the App component, before return:
useGSAP(() => { registerMotionPlugins(); });
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no new errors.

- [ ] **Step 3: Manual verify** — app boots, no console errors, no SSR `window is not defined`.

- [ ] **Step 4: Commit**

```bash
git add pages/_app.tsx
git commit -m "feat(motion): register GSAP plugins once at app start"
```

---

## Phase 1 — Data & list reveals

### Task 1.1: useStaggerReveal hook

**Files:**
- Create: `lib/motion/useStaggerReveal.ts`
- Test: `__tests__/lib/motionGsap.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to the existing file)

```ts
// __tests__/lib/motionGsap.test.ts (append)
import { revealVars } from '../../lib/motion/useStaggerReveal';

describe('revealVars', () => {
  it('animates from hidden when motion is allowed', () => {
    const v = revealVars(false);
    expect(v.from).toMatchObject({ opacity: 0, y: 16 });
    expect(v.to.opacity).toBe(1);
    expect(v.to.y).toBe(0);
    expect(v.to.duration).toBeGreaterThan(0);
    expect(v.to.stagger).toBeGreaterThan(0);
  });

  it('snaps to final state with no motion when reduced', () => {
    const v = revealVars(true);
    expect(v.from).toMatchObject({ opacity: 1, y: 0 });
    expect(v.to.duration).toBe(0);
    expect(v.to.stagger).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/motionGsap.test.ts --ci`
Expected: FAIL — `Cannot find module '../../lib/motion/useStaggerReveal'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/motion/useStaggerReveal.ts
import { useRef, RefObject } from 'react';
import { gsap, useGSAP, ScrollTrigger, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/** Pure config for the reveal tween. Reduced motion → base state already final, zero-duration set. */
export function revealVars(reduced: boolean) {
  if (reduced) {
    return { from: { opacity: 1, y: 0 }, to: { opacity: 1, y: 0, duration: 0, stagger: 0 } };
  }
  return {
    from: { opacity: 0, y: 16 },
    to: { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.out, stagger: 0.06 },
  };
}

/**
 * Stagger-reveals a container's matching children as they enter the viewport.
 * `selector` is scoped to the container (e.g. '.rec-row', ':scope > *').
 * Uses gsap.from so children are visible at rest — a JS failure degrades to no animation.
 */
export function useStaggerReveal<T extends HTMLElement>(selector: string): RefObject<T> {
  const ref = useRef<T>(null);
  // Created SYNCHRONOUSLY inside useGSAP so the ScrollTriggers are captured by the context and
  // auto-reverted on unmount (an async import().then() would escape cleanup → leak).
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    registerMotionPlugins(); // idempotent; plugins already registered in _app
    const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(selector));
    if (!items.length) return;
    const { from, to } = revealVars(prefersReducedMotion());
    if (to.duration === 0) { gsap.set(items, from); return; }
    // batchMax caps how many items animate together so long lists (e.g. 200 rows) don't
    // stagger into one giant sweep.
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      batchMax: 8,
      once: true,
      onEnter: (batch) => gsap.from(batch, { ...from, ...to, overwrite: true }),
    });
    // Recalculate trigger positions after this content (images/fonts) settles.
    ScrollTrigger.refresh();
  }, { scope: ref });
  return ref;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/motionGsap.test.ts --ci`
Expected: PASS (6 tests total).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/motion/useStaggerReveal.ts __tests__/lib/motionGsap.test.ts
git commit -m "feat(motion): useStaggerReveal hook (ScrollTrigger.batch, reduced-motion aware)"
```

### Task 1.2: Wire dashboard card reveal

**Files:**
- Modify: `pages/dashboard/index.tsx`

The card column lives at ~line 230: `<div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>`. Cards are its **direct children**.

- [ ] **Step 1: Import the hook** — add near the top imports:

```tsx
import { useStaggerReveal } from '../../lib/motion/useStaggerReveal';
```

- [ ] **Step 2: Create the ref** — inside the component body (with the other hooks):

```tsx
const revealRef = useStaggerReveal<HTMLDivElement>(':scope > *');
```

- [ ] **Step 3: Attach the ref** — on the card column div (~line 230), add `ref={revealRef}`:

```tsx
<div ref={revealRef} style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verify** — `npm run dev`, open `/dashboard`. Cards fade+rise in, staggered. Reload with DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": cards appear instantly, no motion. Disable JS: cards still visible.

- [ ] **Step 6: Commit**

```bash
git add pages/dashboard/index.tsx
git commit -m "feat(motion): stagger-reveal dashboard cards"
```

### Task 1.3: Wire recommendations + content-audit row reveals

**Files:**
- Modify: `pages/sites/[domain]/recommendations.tsx`
- Modify: `pages/sites/[domain]/content-audit.tsx`

Rows carry `className="rec-row"` in recommendations. First confirm the audit row class:
Run: `grep -nE "className=\"[a-z-]*row" "pages/sites/[domain]/content-audit.tsx"` and use that class as the selector below (it is `rec-row` if shared; otherwise use the actual class).

- [ ] **Step 1: recommendations.tsx** — import the hook, create `const rowsRef = useStaggerReveal<HTMLDivElement>('.rec-row');`, and attach `ref={rowsRef}` to the element that directly wraps the `.map(...)` of rows (the rows list container; locate it by the `filtered.map(` near line 629 and add the ref to its parent list `<div>`).

```tsx
import { useStaggerReveal } from '../../../lib/motion/useStaggerReveal';
// ...
const rowsRef = useStaggerReveal<HTMLDivElement>('.rec-row');
// ...
<div ref={rowsRef}> {/* the existing list container that holds filtered.map(...) rows */}
```

- [ ] **Step 2: content-audit.tsx** — same pattern with the row class confirmed in the grep above.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verify** — open a domain's Recommendations and Content Audit; rows stagger in on scroll. Verify reduced-motion path (instant) and JS-disabled (rows visible).

- [ ] **Step 5: Build gate (end of Phase 1)**

Run: `npm run build`
Expected: exit 0, no `window is not defined` / SSR errors.

- [ ] **Step 6: Commit**

```bash
git add "pages/sites/[domain]/recommendations.tsx" "pages/sites/[domain]/content-audit.tsx"
git commit -m "feat(motion): stagger-reveal recommendations + content-audit rows"
```

---

## Phase 2 — View transitions

> **Engineering note:** True cross-route Flip shared-element transitions require keeping DOM nodes alive across Next page unmounts (heavy, fragile). YAGNI: Phase 2 ships the realistic win — a GSAP timeline fade/slide of the content area on route change. Flip is used in Phase 3 where the layout change is in-page (where it genuinely shines).

### Task 2.1: Route transition hook

**Files:**
- Create: `lib/motion/useRouteTransition.ts`
- Modify: `components/common/AppShell.tsx`
- Modify: `styles/globals.css` (drop the CSS animation from `.motion-page-enter`)

- [ ] **Step 1: Create the hook**

```ts
// lib/motion/useRouteTransition.ts
import { useRef, RefObject } from 'react';
import { useRouter } from 'next/router';
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/** Fades/slides the referenced element in on each completed route change. */
export function useRouteTransition<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);
  const router = useRouter();
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    registerMotionPlugins();
    const play = () => {
      if (!ref.current) return;
      if (prefersReducedMotion()) { gsap.set(ref.current, { opacity: 1, y: 0 }); return; }
      gsap.fromTo(ref.current, { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.out });
    };
    play(); // initial mount
    router.events.on('routeChangeComplete', play);
    return () => router.events.off('routeChangeComplete', play);
  }, { scope: ref, dependencies: [] });
  return ref;
}
```

- [ ] **Step 2: Mount it in AppShell** — replace the `<main>` block in `components/common/AppShell.tsx` (lines 44-46). Add the import and the ref:

```tsx
// add import:
import { useRouteTransition } from '../../lib/motion/useRouteTransition';
// inside component, before return:
const contentRef = useRouteTransition<HTMLElement>();
// the main element:
<main ref={contentRef} className={`app-content motion-page-enter ${contentClassName}`}>
   {children}
</main>
```

- [ ] **Step 3: Remove the duplicate CSS animation** — in `styles/globals.css` line 83, change:

```css
.motion-page-enter { animation: motionSlideUp var(--motion-normal) var(--motion-ease-out) both; }
```
to (keep the class as a no-op hook for selectors, GSAP now drives the entrance):
```css
.motion-page-enter { /* entrance handled by useRouteTransition (GSAP) */ }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verify** — navigate between sidebar pages; content fades/slides in each time (not just first load). Reduced-motion: instant. JS off: content visible (no opacity:0 stuck).

- [ ] **Step 6: Build gate + commit**

```bash
npm run build   # expect exit 0
git add lib/motion/useRouteTransition.ts components/common/AppShell.tsx styles/globals.css
git commit -m "feat(motion): GSAP route transition for content area"
```

---

## Phase 3 — Editor: section expand/collapse (height tween, NOT Flip)

> **SUPERSEDES the Flip approach below (plan review #4).** Flip is overkill for two accordions.
> Implement Phase 3 as a single task: animate the section's **height** on open, in
> `components/articles/WriteOptimizePanel.tsx`, with `useGSAP` keyed on `seoOpen`/`aiOpen`:
>
> ```tsx
> import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from '../../lib/motion/gsap';
> // ref on each collapsible section wrapper; run on open:
> useGSAP(() => {
>   const el = sectionRef.current;
>   if (!el || !open || prefersReducedMotion()) return;
>   registerMotionPlugins();
>   gsap.killTweensOf(el);                                  // race guard (#2)
>   gsap.from(el, { height: 0, opacity: 0, duration: DURATION.normal, ease: EASE.out,
>     onComplete: () => gsap.set(el, { height: 'auto' }) }); // release fixed height after open
> }, { dependencies: [open], scope: sectionRef });
> ```
>
> No `lib/motion/useFlipResize.ts`, no `Flip` import. Commit: `feat(motion): height-animate
> Write & Optimize section expand/collapse`. The Flip-based Task 3.1/3.2 below are kept only for
> historical context — **do not implement them**.

### Task 3.1 (DO NOT IMPLEMENT — superseded): useFlipResize hook

**Files:**
- Create: `lib/motion/useFlipResize.ts`

- [ ] **Step 1: Create the hook**

```ts
// lib/motion/useFlipResize.ts
import { useRef, useLayoutEffect, RefObject } from 'react';
import { gsap, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/**
 * Animates the layout change of `ref`'s subtree whenever `dep` changes (e.g. a section
 * expands/collapses). Captures Flip state before the change and tweens the delta after.
 * Reduced motion → no tween (React's normal layout applies instantly).
 */
export function useFlipResize<T extends HTMLElement>(dep: unknown): RefObject<T> {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (first.current) { first.current = false; return; } // skip initial mount
    if (prefersReducedMotion()) return;
    registerMotionPlugins();
    // Dynamic import keeps Flip out of the shared bundle.
    import('gsap/Flip').then(({ Flip }) => {
      const state = Flip.getState(root.querySelectorAll('[data-flip]'));
      Flip.from(state, { duration: DURATION.normal, ease: EASE.out, absolute: false, nested: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return ref;
}
```

> Note: `Flip.getState` is captured **after** React already applied the new layout here, so for a crisp Flip the simplest robust pattern in this codebase is the height tween fallback below. If the `[data-flip]` capture-after-change proves jumpy in manual testing, switch Task 3.2 to animate the panel's `height` via `gsap.from(panel, { height: 0 })` on open — still using DURATION.normal/EASE.out and the reduced-motion guard. Pick whichever reads better in the browser; document the choice in the commit.

### Task 3.2: Wire WriteOptimizePanel expand/collapse

**Files:**
- Modify: `components/articles/WriteOptimizePanel.tsx`

The panel already has `seoOpen`/`aiOpen` state (`setSeoOpen`/`setAiOpen`) controlling the SEO and AI sections.

- [ ] **Step 1: Import + ref**

```tsx
import { useFlipResize } from '../../lib/motion/useFlipResize';
// inside component:
const flipRef = useFlipResize<HTMLDivElement>(`${seoOpen}-${aiOpen}`);
```

- [ ] **Step 2: Attach** `ref={flipRef}` to the container `<div>` that wraps both collapsible sections, and add `data-flip` to each section's wrapper element so Flip tracks them.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verify** — in the editor, click SEO / AI score to expand/collapse; the section height animates smoothly (no jump). Reduced-motion: instant. Confirm the existing click-to-open behavior (from ScoreTrio) still works.

- [ ] **Step 5: Build gate + commit**

```bash
npm run build   # expect exit 0
git add lib/motion/useFlipResize.ts components/articles/WriteOptimizePanel.tsx
git commit -m "feat(motion): Flip-animate Write & Optimize section expand/collapse"
```

---

## Phase 4 — Spring press (CSS, no GSAP)

### Task 4.1: `.press-spring` utility + apply to primary buttons

**Files:**
- Modify: `styles/globals.css`
- Modify: primary CTA buttons (e.g. in `components/common/` and editor toolbar — locate with the grep below)

- [ ] **Step 1: Add the utility** — append to `styles/globals.css` (uses existing tokens; back-ish ease gives a subtle spring):

```css
/* Springy press feedback for primary actions. Honors reduced-motion via the global block. */
.press-spring { transition: transform var(--motion-fast) cubic-bezier(0.34, 1.56, 0.64, 1); }
.press-spring:active { transform: scale(0.97); }
```

- [ ] **Step 2: Find the primary buttons**

Run: `grep -rn "background: '#2F2F34'" components/ pages/ | head`
(`#2F2F34` is the primary CTA background per design.md.)

- [ ] **Step 3: Apply** — add `className="press-spring"` (or append to existing className) to those primary `<button>`s. Do NOT add any color/shadow change — press is geometry only.

- [ ] **Step 4: Confirm reduced-motion** — `styles/globals.css` already has a `@media (prefers-reduced-motion: reduce)` block (line 103) that neutralizes transitions; verify `.press-spring` transform is covered (the block sets `transition-duration` minimal). If `transform` still animates under reduce, add `.press-spring { transition: none; }` inside that media block.

- [ ] **Step 5: Manual verify** — press primary buttons: subtle scale-down on press, springs back. Reduced-motion: no scale animation.

- [ ] **Step 6: Build gate + commit**

```bash
npm run build   # expect exit 0
git add styles/globals.css components/ pages/   # ONLY the files you actually edited — list them explicitly
git commit -m "feat(motion): spring press feedback on primary buttons"
```

> Reminder: never `git add -A`. Stage only the specific files changed in the step.

---

## Phase 5 — Auto-Optimize animations

> Covers the auto-optimize UI added in commits `a6d8070..2d32039`. Before implementing, invoke
> `gsap-react`, `gsap-scrolltrigger`, and `gsap-core`. Reuse Phase-0 tokens + reduced-motion guard.
> Target files: `components/articles/ContentOptimizerNodeView.tsx`, `OptimizeResultsPanel.tsx`,
> `OptimizeReviewBar.tsx`.

### Task 5.1: Section entrance as optimized sections stream in

**Files:**
- Modify: `components/articles/ContentOptimizerNodeView.tsx`

Each optimized section renders through this node-view as its SSE diff arrives. Animate each one in
on mount so sections cascade in during optimization.

- [ ] **Step 1: Import + entrance** — add a mount entrance via `useGSAP` scoped to the node wrapper:

```tsx
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from '../../lib/motion/gsap';
// inside the component, with a ref on the NodeViewWrapper root:
const rootRef = useRef<HTMLDivElement>(null);
useGSAP(() => {
  if (!rootRef.current || prefersReducedMotion()) return;
  registerMotionPlugins();
  gsap.from(rootRef.current, { opacity: 0, y: 12, duration: DURATION.normal, ease: EASE.out });
}, { scope: rootRef });
```

- [ ] **Step 2: Attach** `ref={rootRef}` to the node-view's root `NodeViewWrapper`.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → no new errors.

- [ ] **Step 4: Manual verify** — run Auto-Optimize on an article; sections fade/rise in as they
  arrive. Reduced-motion: instant. Existing accept/reject diff still works.

- [ ] **Step 5: Commit**

```bash
git add components/articles/ContentOptimizerNodeView.tsx
git commit -m "feat(motion): entrance animation for streamed Auto-Optimize sections"
```

### Task 5.2: Results panel + review bar entrance

**Files:**
- Modify: `components/articles/OptimizeResultsPanel.tsx`
- Modify: `components/articles/OptimizeReviewBar.tsx`

- [ ] **Step 1: OptimizeResultsPanel** — when the panel mounts (results ready), animate the panel
  container in with a timeline; the score gauges keep their existing odometer animation (do not
  duplicate). Add a `ref` to the panel root and:

```tsx
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from '../../lib/motion/gsap';
const panelRef = useRef<HTMLDivElement>(null);
useGSAP(() => {
  if (!panelRef.current || prefersReducedMotion()) return;
  registerMotionPlugins();
  gsap.from(panelRef.current, { opacity: 0, y: 16, duration: DURATION.slow, ease: EASE.out });
}, { scope: panelRef });
```

- [ ] **Step 2: OptimizeReviewBar** — same pattern, but slide up from the bottom edge
  (`gsap.from(barRef.current, { yPercent: 100, opacity: 0, duration: DURATION.normal, ease: EASE.out })`)
  when entering review mode.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → no new errors.

- [ ] **Step 4: Manual verify** — finish Auto-Optimize: results panel rises in, review bar slides
  up. Reduced-motion: instant. Score values still animate (odometer) without double-animating.

- [ ] **Step 5: Build gate + commit**

```bash
npm run build   # expect exit 0
git add components/articles/OptimizeResultsPanel.tsx components/articles/OptimizeReviewBar.tsx
git commit -m "feat(motion): entrance for Auto-Optimize results panel + review bar"
```

---

## Final verification (after all phases)

- [ ] `npx jest __tests__/lib/motionGsap.test.ts --ci` — green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — exit 0.
- [ ] Manual smoke across dashboard / recommendations / content-audit / route nav / editor expand / button press, in both normal and `prefers-reduced-motion: reduce` modes.
- [ ] `graphify update .`

---

## Self-review notes (spec coverage)

- Foundation (registration + tokens + reduced-motion guard) → Task 0.1. ✓
- Surface 1 data reveals (ScrollTrigger.batch) → Tasks 1.1–1.3. ✓
- Surface 2 view transitions → Task 2.1 (timeline; cross-route Flip explicitly deferred with rationale). ✓
- Surface 3 editor Flip → Tasks 3.1–3.2. ✓
- Surface 4 spring press, no GSAP "shine" → Task 4.1. ✓
- Reduced-motion respected in every hook + CSS utility. ✓
- `gsap.from` base-visible degradation + SSR-safe (client effects, dynamic plugin imports) + per-surface plugin imports. ✓
- Easel/Pixi never imported. ✓
