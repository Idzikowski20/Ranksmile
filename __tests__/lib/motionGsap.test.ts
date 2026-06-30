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
    window.matchMedia = ((q: string) => ({
      matches: true, media: q,
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      addListener: jest.fn(), removeListener: jest.fn(), onchange: null, dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = orig;
  });
});
