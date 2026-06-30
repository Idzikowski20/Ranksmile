import { useRef, RefObject } from 'react';
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/**
 * One-shot mount entrance: fade + slight rise. For elements that appear (Auto-Optimize sections
 * streaming in, results panel, review bar). Uses gsap.from so the element is visible at rest —
 * a JS failure or null ref degrades to no animation. Reduced motion → no tween.
 */
export function useEntrance<T extends HTMLElement>(opts?: { y?: number; duration?: number }): RefObject<T> {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    registerMotionPlugins();
    const y = opts?.y ?? 12;
    const vars: gsap.TweenVars = { opacity: 0, duration: opts?.duration ?? DURATION.normal, ease: EASE.out };
    // y:0 → opacity-only (don't touch transform — e.g. an element already centered via translateX).
    if (y !== 0) vars.y = y;
    gsap.from(el, vars);
  }, { scope: ref });
  return ref;
}
