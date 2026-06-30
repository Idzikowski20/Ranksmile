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
