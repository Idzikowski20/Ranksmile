import { DURATION, EASE, prefersReducedMotion, registerMotionPlugins } from '../../lib/motion/gsap';
import { revealVars } from '../../lib/motion/useStaggerReveal';

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
    window.matchMedia = ((q: string) => ({
      matches: true, media: q,
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      addListener: jest.fn(), removeListener: jest.fn(), onchange: null, dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = orig;
  });
});

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
