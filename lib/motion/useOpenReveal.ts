import { useRef, RefObject } from 'react';
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/**
 * Height + fade reveal for an accordion section that mounts when `open` becomes true.
 * Animates the OPEN (height 0 → natural); close is instant (the block unmounts). Reduced motion →
 * no tween. overflow:hidden is applied during the tween so content clips as the height grows, then
 * cleared so the natural layout (and any inner scroll) is restored.
 */
export function useOpenReveal<T extends HTMLElement>(open: boolean): RefObject<T> {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || !open || prefersReducedMotion()) return;
    registerMotionPlugins();
    gsap.killTweensOf(el);
    gsap.set(el, { overflow: 'hidden' });
    gsap.from(el, {
      height: 0,
      opacity: 0,
      duration: DURATION.normal,
      ease: EASE.out,
      clearProps: 'height,opacity,overflow',
    });
  }, { dependencies: [open], scope: ref });
  return ref;
}
