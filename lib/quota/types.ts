import type { QuotaMeter } from '../planLimits';

export type UsageEventType =
  | 'reserve'
  | 'commit'
  | 'release'
  | 'close'
  | 'adjustment_increase'
  | 'adjustment_decrease';

export type ReservationStatus =
  | 'reserved'
  | 'committed'
  | 'released'
  | 'expired'
  | 'closed';

export interface QuotaRef {
  type: string;
  id: string;
}

export interface QuotaBalanceRow {
  org_id: number;
  meter: string;
  period_key: string;
  used: number;
  reserved: number;
}

export interface QuotaReservationRow {
  id: number;
  org_id: number;
  meter: string;
  period_key: string;
  quantity: number;
  status: ReservationStatus;
  idempotency_key: string;
  ref_type: string | null;
  ref_id: string | null;
  user_id: string | null;
  expires_at: string | null;
}

export interface AdjustActiveParams {
  orgId: number;
  meter: QuotaMeter;
  delta: number;
  idempotencyKey: string;
  ref: QuotaRef;
  userId?: string | null;
}

export interface ReserveQuotaParams {
  orgId: number;
  meter: QuotaMeter;
  quantity: number;
  idempotencyKey: string;
  ref: QuotaRef;
  userId?: string | null;
  /** Override period; default calendar YYYY-MM for period_usage, '_' otherwise */
  periodKey?: string;
  expiresAt?: Date;
}

export interface PlanLimitPayload {
  error: string;
  code: 'plan_limit';
  plan: string;
  meter: QuotaMeter;
  used: number;
  reserved: number;
  requested: number;
  limit: number;
  remaining: number;
  upgradePath: string;
}
