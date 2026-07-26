import type { QuotaMeter } from '../planLimits';
import type { PlanLimitPayload } from './types';

export class PlanLimitError extends Error {
  readonly code = 'plan_limit' as const;
  readonly status = 402;
  readonly payload: PlanLimitPayload;

  constructor(payload: Omit<PlanLimitPayload, 'error' | 'code' | 'upgradePath'> & { upgradePath?: string }) {
    super('Plan quota exceeded');
    this.name = 'PlanLimitError';
    this.payload = {
      error: 'Plan quota exceeded',
      code: 'plan_limit',
      upgradePath: payload.upgradePath ?? '/settings/billing',
      plan: payload.plan,
      meter: payload.meter,
      used: payload.used,
      reserved: payload.reserved,
      requested: payload.requested,
      limit: payload.limit,
      remaining: payload.remaining,
    };
  }
}

export function isPlanLimitError(e: unknown): e is PlanLimitError {
  return e instanceof PlanLimitError;
}

export function planLimitBody(e: PlanLimitError): PlanLimitPayload {
  return e.payload;
}

/** Narrow helper for callers that need a typed meter after catching. */
export function meterFromPayload(p: PlanLimitPayload): QuotaMeter {
  return p.meter;
}
