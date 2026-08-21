import { useEffect, type RefObject } from 'react';

/**
 * Hero radar: the scanner sweeps left↔right and every pill it passes re-samples its
 * number inside its own range, so the stats tick like a live tracker.
 *
 * Same contract as useLandingMotion — GSAP is lazy-loaded, everything lives inside a
 * context that reverts on unmount, reduced-motion users get the static SSR frame.
 */
export function useRadarMotion(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let cancelled = false;
    let ctx: { revert(): void } | undefined;

    import('../../lib/motion/gsap').then((m) => {
      if (cancelled || m.prefersReducedMotion()) return;
      const { gsap } = m;

      ctx = gsap.context(() => {
        const sweep = root.querySelector<HTMLElement>('[data-radar-sweep]');
        const pills = gsap.utils.toArray<HTMLElement>('[data-radar-pill]');
        if (!sweep) return;

        // Concentric rings breathe in from the centre once, staggered.
        gsap.from('[data-radar-ring]', { scale: 0.6, autoAlpha: 0, duration: 1.2, ease: 'power3.out', stagger: 0.08 });
        gsap.from(pills, { x: -24, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12, delay: 0.4 });

        // Tick a pill: re-sample inside [min,max], recolour the delta, pulse the pill.
        const tick = (pill: HTMLElement) => {
          const num = pill.querySelector<HTMLElement>('[data-radar-value]');
          const delta = pill.querySelector<HTMLElement>('[data-radar-delta]');
          if (!num) return;
          const min = Number(pill.dataset.min);
          const max = Number(pill.dataset.max);
          const decimals = Number(pill.dataset.decimals ?? 0);
          const suffix = pill.dataset.suffix ?? '';
          const dSuffix = pill.dataset.deltaSuffix ?? '';
          const prev = Number(num.dataset.current ?? num.textContent);
          const next = Number((min + Math.random() * (max - min)).toFixed(decimals));
          const state = { v: prev };
          gsap.to(state, {
            v: next,
            duration: 0.6,
            ease: 'power2.out',
            onUpdate: () => {
              const node = num;
              node.textContent = `${state.v.toFixed(decimals)}${suffix}`;
            },
            onComplete: () => {
              const node = num;
              node.dataset.current = String(next);
            },
          });
          if (delta) {
            const diff = Number((next - prev).toFixed(decimals));
            const node = delta;
            node.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(decimals)}${dSuffix}`;
            node.dataset.trend = diff >= 0 ? 'up' : 'down';
          }
          gsap.fromTo(pill, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut' });
        };

        // Sweep: -22° (left of vertical) ↔ +34° and back, forever. Pills sit at known
        // angles along the sweep path; when the sweep crosses one, that pill ticks.
        const FROM = -22;
        const TO = 34;
        const angles = pills.map((p) => Number(p.dataset.angle ?? 0));
        let last = FROM;
        const rot = { a: FROM };
        gsap.to(rot, {
          a: TO,
          duration: 3.6,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          onUpdate: () => {
            sweep.style.transform = `rotate(${rot.a}deg)`;
            pills.forEach((p, i) => {
              const a = angles[i];
              if ((last < a && rot.a >= a) || (last > a && rot.a <= a)) tick(p);
            });
            last = rot.a;
          },
        });
      }, root);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [rootRef]);
}

export default useRadarMotion;
