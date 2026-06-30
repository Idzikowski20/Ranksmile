import { useRef, RefObject } from 'react';
import { useRouter } from 'next/router';
import { gsap, useGSAP, DURATION, EASE, registerMotionPlugins, prefersReducedMotion } from './gsap';

/**
 * Fades/slides the referenced element in on mount and on every completed route change.
 * The replay runs on `routeChangeComplete`, so it's wrapped in `contextSafe` to stay inside the
 * useGSAP context (cleaned up on unmount). `killTweensOf` guards against rapid navigation stacking
 * overlapping tweens. Reduced motion → snap to final state.
 */
export function useRouteTransition<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);
  const router = useRouter();
  useGSAP((_ctx, contextSafe) => {
    if (!ref.current) return;
    registerMotionPlugins();
    const play = contextSafe!(() => {
      const node = ref.current;
      if (!node) return;
      gsap.killTweensOf(node);
      if (prefersReducedMotion()) { gsap.set(node, { opacity: 1, y: 0 }); return; }
      gsap.fromTo(node, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.out });
    });
    play(); // initial mount
    router.events.on('routeChangeComplete', play);
    return () => router.events.off('routeChangeComplete', play);
  }, { scope: ref, dependencies: [] });
  return ref;
}
