import { withBreaker, CircuitOpenError, resetBreaker } from '../../lib/circuitBreaker';

const fail = () => Promise.reject(new Error('boom'));
const ok = () => Promise.resolve('ok');

describe('withBreaker', () => {
  beforeEach(() => resetBreaker());

  it('trips open after threshold consecutive failures, then fails fast', async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 10_000 })).rejects.toThrow('boom');
    }
    // 4th call is blocked without invoking fn
    await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 10_000 })).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('closes again after cooldown and a success resets failures', async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 0 })).rejects.toThrow('boom');
    }
    // cooldownMs 0 → half-open immediately, success closes it
    await expect(withBreaker('t', ok, { threshold: 3, cooldownMs: 0 })).resolves.toBe('ok');
  });

  it('re-opens for another cooldown when the half-open probe fails again', async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 0 })).rejects.toThrow('boom');
    }
    // cooldownMs 0 → the next call is the half-open probe; it fails, so the
    // circuit must re-open (this time for a real cooldown)...
    await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 10_000 })).rejects.toThrow('boom');
    // ...and the following call is rejected fast without invoking fn.
    await expect(withBreaker('t', fail, { threshold: 3, cooldownMs: 10_000 })).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('isolates breakers by name', async () => {
    await expect(withBreaker('a', fail, { threshold: 1, cooldownMs: 10_000 })).rejects.toThrow('boom');
    await expect(withBreaker('b', ok, { threshold: 1 })).resolves.toBe('ok');
  });
});
