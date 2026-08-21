/**
 * Minimal in-process circuit breaker. After N consecutive failures a named
 * breaker trips OPEN and fails fast for a cooldown, so a down provider isn't
 * hammered by every request. First call after the cooldown is let through
 * (half-open): success closes it, failure re-opens for another cooldown.
 *
 * In-process only — state is per Node process, not shared across serverless
 * instances. That's fine here: it protects each instance from its own retry
 * storms; it is not a global request budget (that's aiBudget / dfsRateLimiter).
 */

type BreakerState = { failures: number; openUntil: number };

const breakers = new Map<string, BreakerState>();

export class CircuitOpenError extends Error {
  constructor(name: string, retryInMs: number) {
    super(`Circuit "${name}" is open — retry in ${Math.ceil(retryInMs / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}

export async function withBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts: { threshold?: number; cooldownMs?: number } = {},
): Promise<T> {
  const threshold = opts.threshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 30_000;
  const s = breakers.get(name) ?? { failures: 0, openUntil: 0 };

  const now = Date.now();
  if (s.openUntil > now) throw new CircuitOpenError(name, s.openUntil - now);

  try {
    const result = await fn();
    if (s.failures) breakers.set(name, { failures: 0, openUntil: 0 });
    return result;
  } catch (err) {
    s.failures += 1;
    if (s.failures >= threshold) s.openUntil = now + cooldownMs;
    breakers.set(name, s);
    throw err;
  }
}

/** Test hook — reset a breaker (or all) between cases. */
export function resetBreaker(name?: string): void {
  if (name) breakers.delete(name);
  else breakers.clear();
}
