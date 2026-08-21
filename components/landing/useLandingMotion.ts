import { useEffect, type RefObject } from 'react';
import { ENGINES } from './content';

type GsapModule = typeof import('../../lib/motion/gsap');

/**
 * All landing motion in one client effect.
 *
 * GSAP is imported lazily so the first paint ships zero animation JS; everything is
 * authored with `from` / `set` inside the context so the SSR markup is complete and
 * visible for crawlers and for visitors who prefer reduced motion (we then do nothing).
 *
 * The landing root is its own scroll container (globals lock html/body ≥1024px), so every
 * ScrollTrigger is told to watch it instead of the window.
 */
export function useLandingMotion(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let cancelled = false;
    let ctx: ReturnType<GsapModule['gsap']['context']> | undefined;

    import('../../lib/motion/gsap').then((m) => {
      if (cancelled || m.prefersReducedMotion()) return;
      m.registerMotionPlugins();
      const { gsap, ScrollTrigger, EASE } = m;
      // Per-trigger scroller (not ScrollTrigger.defaults) so nothing leaks into app
      // pages that mount ScrollTriggers after an SPA navigation away from the landing.
      const onRoot = <T extends object>(cfg: T) => ({ scroller: root, ...cfg });

      ctx = gsap.context(() => {
        // ── Hero: one orchestrated entrance ─────────────────────────────────
        const hero = gsap.timeline({ defaults: { ease: EASE.out, duration: 0.7 } });
        hero
          .from('[data-hero="eyebrow"]', { y: 12, autoAlpha: 0, duration: 0.5 })
          .from('[data-hero="line"]', { y: 28, autoAlpha: 0, stagger: 0.09 }, '-=0.25')
          .from('[data-hero="cta"]', { y: 16, autoAlpha: 0, duration: 0.5 }, '-=0.35')
          .from('[data-hero="proof"]', { y: 12, autoAlpha: 0, duration: 0.5 }, '-=0.3')
          .from('[data-hero="preview"]', { y: 48, autoAlpha: 0, duration: 0.9 }, '-=0.4');

        // ── Hero: engine word cycles like a typed answer ────────────────────
        const word = root.querySelector<HTMLElement>('[data-hero="engine"]');
        if (word) {
          let i = 0;
          gsap.timeline({ repeat: -1, repeatDelay: 2.1, delay: 2.4 })
            .to(word, { yPercent: -40, autoAlpha: 0, duration: 0.28, ease: 'power2.in' })
            .call(() => {
              i = (i + 1) % ENGINES.length;
              word.textContent = ENGINES[i];
            })
            .fromTo(word, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.36, ease: EASE.out });
        }

        // ── Generic reveal: anything tagged data-reveal rises in once ───────
        const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]');
        gsap.set(reveals, { autoAlpha: 0, y: 24 });
        ScrollTrigger.batch(reveals, onRoot({
          start: 'top 88%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.out, stagger: 0.08, overwrite: true }),
        }));

        // ── Stats: count up when the card enters ────────────────────────────
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
          const target = Number(el.dataset.count);
          const decimals = Number(el.dataset.decimals ?? 0);
          const suffix = el.dataset.suffix ?? '';
          const state = { v: 0 };
          gsap.to(state, {
            v: target,
            duration: 1.6,
            ease: 'power3.out',
            scrollTrigger: onRoot({ trigger: el, start: 'top 85%', once: true }),
            onUpdate: () => {
              const node = el;
              node.textContent = `${state.v.toFixed(decimals)}${suffix}`;
            },
          });
        });

        // ── Stats: the chart shapes grow with the number ────────────────────
        gsap.utils.toArray<HTMLElement>('[data-grow]').forEach((el) => {
          gsap.from(el, {
            scaleY: 0,
            transformOrigin: 'bottom',
            duration: 1.2,
            ease: EASE.out,
            scrollTrigger: onRoot({ trigger: el, start: 'top 85%', once: true }),
          });
        });

        // ── Workflow: each colour panel slides in from its side ─────────────
        gsap.utils.toArray<HTMLElement>('[data-panel]').forEach((panel) => {
          gsap.from(panel, {
            xPercent: 8,
            autoAlpha: 0,
            duration: 0.9,
            ease: EASE.out,
            scrollTrigger: onRoot({ trigger: panel, start: 'top 80%', once: true }),
          });
          const mock = panel.querySelector('[data-panel-mock]');
          if (mock) {
            gsap.from(mock, {
              y: 40,
              autoAlpha: 0,
              duration: 0.9,
              delay: 0.15,
              ease: EASE.out,
              scrollTrigger: onRoot({ trigger: panel, start: 'top 80%', once: true }),
            });
          }
        });

        // ── CTA: the dashboard peeks up as the band arrives ─────────────────
        const ctaMock = root.querySelector('[data-cta-mock]');
        if (ctaMock) {
          gsap.from(ctaMock, {
            y: 80,
            duration: 1.1,
            ease: EASE.out,
            scrollTrigger: onRoot({ trigger: ctaMock, start: 'top 95%', once: true }),
          });
        }
      }, root);

      // Fonts settle after hydration — re-measure so trigger positions are exact.
      if (typeof document !== 'undefined' && 'fonts' in document) {
        document.fonts.ready.then(() => { if (!cancelled) ScrollTrigger.refresh(); });
      }
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [rootRef]);
}

export default useLandingMotion;
