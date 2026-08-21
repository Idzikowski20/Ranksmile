/**
 * Minimal in-process circuit breaker. After N consecutive failures a named
 * breaker trips OPEN and fails fast for a cooldown, so a down provider isn't
 * hammered by every request. Once the cooldown passes exactly one caller is
 * let through (half-open probe): success closes it, failure re-opens for
 * another cooldown; every other caller keeps failing fast while the probe runs.
 *
 * In-process only — state is per Node process, not shared across serverless
 * instances. That's fine here: it protects each instance from its own retry
 * storms; it is not a global request budget (that's aiBudget / dfsRateLimiter).
 */

type BreakerState = { failures: number; openUntil: number; probing: boolean };

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

  // Publish the state synchronously (before any await) so concurrent callers
  // share one object — otherwise their failure increments overwrite each other
  // and the circuit can stay closed despite reaching the threshold.
  let s = breakers.get(name);
  if (!s) {
    s = { failures: 0, openUntil: 0, probing: false };
    breakers.set(name, s);
  }

  const now = Date.now();
  if (s.openUntil > now) throw new CircuitOpenError(name, s.openUntil - now);
  // Cooldown elapsed but circuit was open → half-open: admit a single probe,
  // reject everyone else until it resolves.
  if (s.openUntil !== 0) {
    if (s.probing) throw new CircuitOpenError(name, cooldownMs);
    s.probing = true;
  }

  try {
    const result = await fn();
    s.failures = 0;
    s.openUntil = 0;
    s.probing = false;
    return result;
  } catch (err) {
    s.failures += 1;
    // Re-read the clock: fn() may have outlasted cooldownMs, which would leave
    // openUntil already in the past and let the next request bypass the breaker.
    if (s.failures >= threshold) s.openUntil = Date.now() + cooldownMs;
    s.probing = false;
    breakers.set(name, s);
    throw err;
  }
}

/** Test hook — reset a breaker (or all) between cases. */
export function resetBreaker(name?: string): void {
  if (name) breakers.delete(name);
  else breakers.clear();
}
