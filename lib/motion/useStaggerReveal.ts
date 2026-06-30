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

/** Nearest scrollable ancestor — the app scrolls inside `overflow:auto` panels, not the window,
 *  so ScrollTrigger needs that element as its `scroller`. Returns undefined → default (window). */
function nearestScroller(el: HTMLElement): HTMLElement | undefined {
  let p = el.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return undefined;
}

/**
 * Stagger-reveals a container's matching children as they enter the viewport.
 * `selector` is scoped to the container (e.g. '.rec-row', ':scope > *').
 * Uses gsap.from so children are visible at rest — a JS failure (or wrong scroller) degrades to
 * "no animation", never invisible content.
 *
 * ScrollTriggers are created SYNCHRONOUSLY inside useGSAP so the hook's context captures them and
 * reverts/kills them on unmount (an async import().then() would escape that cleanup → leak).
 */
export function useStaggerReveal<T extends HTMLElement>(selector: string): RefObject<T> {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    registerMotionPlugins(); // idempotent; plugins already registered in _app
    const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(selector));
    if (!items.length) return;
    const { from, to } = revealVars(prefersReducedMotion());
    if (to.duration === 0) { gsap.set(items, from); return; }
    // batchMax caps how many items animate together so long lists (e.g. 200 rows)
    // don't stagger into one giant sweep.
    ScrollTrigger.batch(items, {
      scroller: nearestScroller(root),
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
