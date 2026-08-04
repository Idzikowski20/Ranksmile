import type { Transaction } from 'sequelize';
import db from '../../database/database';
import { ensurePlanQuotaTables } from '../ensurePlanQuotaTables';
import { hasActiveBillingEntitlement } from '../billingEntitlement';
import { getOrgBillingState } from '../orgBilling';
import {
  ACTIVE_PERIOD_KEY,
  DEFAULT_PLAN_SLUG,
  getMeterKind,
  getPlanMeterLimit,
  resolvePlanSlug,
  type QuotaMeter,
} from '../planLimits';
import { PlanLimitError } from './errors';
import { periodKeyForMeter } from './period';
import type {
  AdjustActiveParams,
  QuotaBalanceRow,
  QuotaReservationRow,
  ReserveQuotaParams,
  UsageEventType,
} from './types';

type TxOpt = { transaction?: Transaction };

async function q<T extends object>(
  sql: string,
  replacements: unknown[],
  opt: TxOpt = {},
): Promise<T[]> {
  return db.query(sql, {
    replacements,
    type: 'SELECT',
    transaction: opt.transaction,
  }) as Promise<T[]>;
}

async function exec(sql: string, replacements: unknown[], opt: TxOpt = {}): Promise<void> {
  await db.query(sql, { replacements, transaction: opt.transaction });
}

async function resolvePlan(orgId: number): Promise<string> {
  const billing = await getOrgBillingState(orgId);
  // Ignore stale plan_slug from incomplete checkout / canceled subs.
  if (!hasActiveBillingEntitlement(billing)) return DEFAULT_PLAN_SLUG;
  return resolvePlanSlug(billing?.planSlug);
}

function throwLimit(
  plan: string,
  meter: QuotaMeter,
  used: number,
  reserved: number,
  requested: number,
  limit: number,
): never {
  throw new PlanLimitError({
    plan,
    meter,
    used,
    reserved,
    requested,
    limit,
    remaining: Math.max(0, limit - used - reserved),
  });
}

async function insertEvent(
  args: {
    orgId: number;
    meter: string;
    periodKey: string;
    eventType: UsageEventType;
    quantity: number;
    idempotencyKey: string;
    reservationId?: number | null;
    refType?: string | null;
    refId?: string | null;
    userId?: string | null;
    planSlug?: string | null;
  },
  opt: TxOpt = {},
): Promise<void> {
  try {
    await exec(
      `INSERT INTO usage_events
        (org_id, meter, period_key, event_type, quantity, idempotency_key,
         reservation_id, ref_type, ref_id, user_id, plan_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        args.orgId,
        args.meter,
        args.periodKey,
        args.eventType,
        args.quantity,
        args.idempotencyKey,
        args.reservationId ?? null,
        args.refType ?? null,
        args.refId ?? null,
        args.userId ?? null,
        args.planSlug ?? null,
      ],
      opt,
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!/unique|duplicate/i.test(m)) throw e;
    // idempotent audit insert
  }
}

async function getBalance(
  orgId: number,
  meter: string,
  periodKey: string,
  opt: TxOpt = {},
): Promise<QuotaBalanceRow | undefined> {
  const rows = await q<QuotaBalanceRow>(
    `SELECT org_id, meter, period_key, used, reserved
     FROM org_quota_balances WHERE org_id = ? AND meter = ? AND period_key = ?`,
    [orgId, meter, periodKey],
    opt,
  );
  return rows[0];
}

async function ensureBalanceRow(
  orgId: number,
  meter: string,
  periodKey: string,
  opt: TxOpt = {},
): Promise<void> {
  // Postgres: never let INSERT fail inside a caller transaction (aborts the whole tx).
  // Match ensureBalances.upsertBalance — ON CONFLICT, not try/catch on "Validation error".
  if (process.env.DATABASE_URL) {
    await exec(
      `INSERT INTO org_quota_balances (org_id, meter, period_key, used, reserved)
       VALUES (?, ?, ?, 0, 0)
       ON CONFLICT (org_id, meter, period_key) DO NOTHING`,
      [orgId, meter, periodKey],
      opt,
    );
    return;
  }
  try {
    await exec(
      `INSERT INTO org_quota_balances (org_id, meter, period_key, used, reserved)
       VALUES (?, ?, ?, 0, 0)`,
      [orgId, meter, periodKey],
      opt,
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!/unique|duplicate|primary/i.test(m)) throw e;
  }
}

/**
 * active_resource used-only adjust. Must share the caller's transaction with the resource mutate.
 * delta > 0 → adjustment_increase; delta < 0 → adjustment_decrease.
 */
export async function adjustActiveUsage(
  params: AdjustActiveParams,
  opt: TxOpt = {},
): Promise<{ used: number }> {
  await ensurePlanQuotaTables();
  const kind = getMeterKind(params.meter);
  if (kind !== 'active_resource') {
    throw new Error(`adjustActiveUsage only for active_resource; got ${params.meter}`);
  }
  if (params.delta === 0) {
    throw new Error('adjustActiveUsage delta must be non-zero');
  }

  const periodKey = ACTIVE_PERIOD_KEY;
  const plan = await resolvePlan(params.orgId);
  const planSlug = resolvePlanSlug(plan);
  const limit = getPlanMeterLimit(planSlug, params.meter);
  const qty = Math.abs(params.delta);
  const eventType: UsageEventType = params.delta > 0 ? 'adjustment_increase' : 'adjustment_decrease';

  await ensureBalanceRow(params.orgId, params.meter, periodKey, opt);

  if (params.delta > 0) {
    if (limit != null) {
      const updated = await q<{ used: number; reserved: number }>(
        `UPDATE org_quota_balances
           SET used = used + ?, updated_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND meter = ? AND period_key = ?
           AND used + reserved + ? <= ?
         RETURNING used, reserved`,
        [qty, params.orgId, params.meter, periodKey, qty, limit],
        opt,
      );
      // SQLite may not support RETURNING — fallback path
      if (!updated.length && !process.env.DATABASE_URL) {
        const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
        const used = Number(bal?.used ?? 0);
        const reserved = Number(bal?.reserved ?? 0);
        if (used + reserved + qty > limit) {
          throwLimit(planSlug, params.meter, used, reserved, qty, limit);
        }
        await exec(
          `UPDATE org_quota_balances SET used = used + ?, updated_at = CURRENT_TIMESTAMP
           WHERE org_id = ? AND meter = ? AND period_key = ?`,
          [qty, params.orgId, params.meter, periodKey],
          opt,
        );
      } else if (!updated.length) {
        const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
        throwLimit(
          planSlug,
          params.meter,
          Number(bal?.used ?? 0),
          Number(bal?.reserved ?? 0),
          qty,
          limit,
        );
      }
    } else {
      await exec(
        `UPDATE org_quota_balances SET used = used + ?, updated_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND meter = ? AND period_key = ?`,
        [qty, params.orgId, params.meter, periodKey],
        opt,
      );
    }
  } else {
    const updated = await q<{ used: number }>(
      `UPDATE org_quota_balances
         SET used = used - ?, updated_at = CURRENT_TIMESTAMP
       WHERE org_id = ? AND meter = ? AND period_key = ?
         AND used >= ?
       RETURNING used`,
      [qty, params.orgId, params.meter, periodKey, qty],
      opt,
    );
    if (!updated.length && !process.env.DATABASE_URL) {
      const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
      const used = Number(bal?.used ?? 0);
      const next = Math.max(0, used - qty);
      await exec(
        `UPDATE org_quota_balances SET used = ?, updated_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND meter = ? AND period_key = ?`,
        [next, params.orgId, params.meter, periodKey],
        opt,
      );
    } else if (!updated.length) {
      // already at 0 — clamp (grandfather / reconciliation drift)
      await exec(
        `UPDATE org_quota_balances SET used = 0, updated_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND meter = ? AND period_key = ? AND used < ?`,
        [params.orgId, params.meter, periodKey, qty],
        opt,
      );
    }
  }

  await insertEvent(
    {
      orgId: params.orgId,
      meter: params.meter,
      periodKey,
      eventType,
      quantity: qty,
      idempotencyKey: params.idempotencyKey,
      refType: params.ref.type,
      refId: params.ref.id,
      userId: params.userId,
      planSlug,
    },
    opt,
  );

  const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
  return { used: Number(bal?.used ?? 0) };
}

async function findReservationByIdem(
  orgId: number,
  idempotencyKey: string,
  opt: TxOpt = {},
): Promise<QuotaReservationRow | undefined> {
  const rows = await q<QuotaReservationRow>(
    `SELECT id, org_id, meter, period_key, quantity, status, idempotency_key,
            ref_type, ref_id, user_id, expires_at
     FROM quota_reservations WHERE org_id = ? AND idempotency_key = ?`,
    [orgId, idempotencyKey],
    opt,
  );
  return rows[0];
}

export async function getReservationById(
  id: number,
  opt: TxOpt = {},
): Promise<QuotaReservationRow | undefined> {
  await ensurePlanQuotaTables();
  const rows = await q<QuotaReservationRow>(
    `SELECT id, org_id, meter, period_key, quantity, status, idempotency_key,
            ref_type, ref_id, user_id, expires_at
     FROM quota_reservations WHERE id = ?`,
    [id],
    opt,
  );
  return rows[0];
}

export async function findReservationByIdempotency(
  orgId: number,
  idempotencyKey: string,
  opt: TxOpt = {},
): Promise<QuotaReservationRow | undefined> {
  await ensurePlanQuotaTables();
  return findReservationByIdem(orgId, idempotencyKey, opt);
}

/** Latest reserved reservation for a logical ref (BullMQ retries reuse it). */
export async function findActiveReservationByRef(
  orgId: number,
  refType: string,
  refId: string,
  opt: TxOpt = {},
): Promise<QuotaReservationRow | undefined> {
  await ensurePlanQuotaTables();
  const rows = await q<QuotaReservationRow>(
    `SELECT id, org_id, meter, period_key, quantity, status, idempotency_key,
            ref_type, ref_id, user_id, expires_at
     FROM quota_reservations
     WHERE org_id = ? AND ref_type = ? AND ref_id = ? AND status = 'reserved'
     ORDER BY id DESC LIMIT 1`,
    [orgId, refType, refId],
    opt,
  );
  return rows[0];
}

/**
 * period_usage / per_run_cap only. Rejects active_resource.
 * Retries with same idempotency_key return existing reservation.
 */
export async function reserveQuota(
  params: ReserveQuotaParams,
  opt: TxOpt = {},
): Promise<QuotaReservationRow> {
  await ensurePlanQuotaTables();
  const kind = getMeterKind(params.meter);
  if (kind === 'active_resource') {
    throw new Error(`reserveQuota rejected for active_resource meter ${params.meter}`);
  }
  if (params.quantity <= 0) {
    throw new Error('reserveQuota quantity must be > 0');
  }

  const existing = await findReservationByIdem(params.orgId, params.idempotencyKey, opt);
  if (existing) return existing;

  const periodKey = params.periodKey ?? periodKeyForMeter(params.meter);
  const plan = await resolvePlan(params.orgId);
  const planSlug = resolvePlanSlug(plan);
  const limit = getPlanMeterLimit(planSlug, params.meter);

  if (kind === 'per_run_cap') {
    if (limit != null && params.quantity > limit) {
      throwLimit(planSlug, params.meter, 0, 0, params.quantity, limit);
    }
    try {
      await exec(
        `INSERT INTO quota_reservations
          (org_id, meter, period_key, quantity, status, idempotency_key, ref_type, ref_id, user_id, expires_at)
         VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?)`,
        [
          params.orgId,
          params.meter,
          periodKey,
          params.quantity,
          params.idempotencyKey,
          params.ref.type,
          params.ref.id,
          params.userId ?? null,
          params.expiresAt ? params.expiresAt.toISOString() : null,
        ],
        opt,
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate/i.test(m)) {
        const again = await findReservationByIdem(params.orgId, params.idempotencyKey, opt);
        if (again) return again;
      }
      throw e;
    }
    const row = await findReservationByIdem(params.orgId, params.idempotencyKey, opt);
    if (!row) throw new Error('reserveQuota insert failed');
    await insertEvent(
      {
        orgId: params.orgId,
        meter: params.meter,
        periodKey,
        eventType: 'reserve',
        quantity: params.quantity,
        idempotencyKey: params.idempotencyKey,
        reservationId: row.id,
        refType: params.ref.type,
        refId: params.ref.id,
        userId: params.userId,
        planSlug,
      },
      opt,
    );
    return row;
  }

  // period_usage
  await ensureBalanceRow(params.orgId, params.meter, periodKey, opt);
  if (limit != null) {
    const updated = await q<{ used: number; reserved: number }>(
      `UPDATE org_quota_balances
         SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP
       WHERE org_id = ? AND meter = ? AND period_key = ?
         AND used + reserved + ? <= ?
       RETURNING used, reserved`,
      [params.quantity, params.orgId, params.meter, periodKey, params.quantity, limit],
      opt,
    );
    if (!updated.length && !process.env.DATABASE_URL) {
      const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
      const used = Number(bal?.used ?? 0);
      const reserved = Number(bal?.reserved ?? 0);
      if (used + reserved + params.quantity > limit) {
        throwLimit(planSlug, params.meter, used, reserved, params.quantity, limit);
      }
      await exec(
        `UPDATE org_quota_balances SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND meter = ? AND period_key = ?`,
        [params.quantity, params.orgId, params.meter, periodKey],
        opt,
      );
    } else if (!updated.length) {
      const bal = await getBalance(params.orgId, params.meter, periodKey, opt);
      throwLimit(
        planSlug,
        params.meter,
        Number(bal?.used ?? 0),
        Number(bal?.reserved ?? 0),
        params.quantity,
        limit,
      );
    }
  } else {
    await exec(
      `UPDATE org_quota_balances SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP
       WHERE org_id = ? AND meter = ? AND period_key = ?`,
      [params.quantity, params.orgId, params.meter, periodKey],
      opt,
    );
  }

  try {
    await exec(
      `INSERT INTO quota_reservations
        (org_id, meter, period_key, quantity, status, idempotency_key, ref_type, ref_id, user_id, expires_at)
       VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?)`,
      [
        params.orgId,
        params.meter,
        periodKey,
        params.quantity,
        params.idempotencyKey,
        params.ref.type,
        params.ref.id,
        params.userId ?? null,
        params.expiresAt ? params.expiresAt.toISOString() : null,
      ],
      opt,
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(m)) {
      // concurrent winner — undo our reserved bump if we raced after their insert
      const again = await findReservationByIdem(params.orgId, params.idempotencyKey, opt);
      if (again) {
        // We may have double-bumped reserved; only the winner should keep it.
        // Safer: release our bump if we don't own the row (another txn inserted).
        // If again exists from other txn, roll back our reserved increment.
        if (again.status === 'reserved') {
          // another txn already reserved — undo our increment
          await exec(
            `UPDATE org_quota_balances SET reserved = CASE WHEN reserved >= ? THEN reserved - ? ELSE 0 END,
               updated_at = CURRENT_TIMESTAMP
             WHERE org_id = ? AND meter = ? AND period_key = ?`,
            [params.quantity, params.quantity, params.orgId, params.meter, periodKey],
            opt,
          );
        }
        return again;
      }
    }
    throw e;
  }

  const row = await findReservationByIdem(params.orgId, params.idempotencyKey, opt);
  if (!row) throw new Error('reserveQuota insert failed');
  await insertEvent(
    {
      orgId: params.orgId,
      meter: params.meter,
      periodKey,
      eventType: 'reserve',
      quantity: params.quantity,
      idempotencyKey: params.idempotencyKey,
      reservationId: row.id,
      refType: params.ref.type,
      refId: params.ref.id,
      userId: params.userId,
      planSlug,
    },
    opt,
  );
  return row;
}

/** period_usage success: reserved → used. Idempotent. */
export async function commitReservation(
  reservationId: number,
  actualQuantity?: number,
  opt: TxOpt = {},
): Promise<void> {
  await ensurePlanQuotaTables();
  const row = await getReservationById(reservationId, opt);
  if (!row) return;
  if (row.status === 'committed') return;
  if (row.status !== 'reserved') return;

  const qty = actualQuantity ?? Number(row.quantity);
  if (qty <= 0) throw new Error('commitReservation quantity must be > 0');
  if (qty > Number(row.quantity)) throw new Error('commit actual cannot exceed reserved');

  const rest = Number(row.quantity) - qty;
  await exec(
    `UPDATE org_quota_balances
       SET reserved = CASE WHEN reserved >= ? THEN reserved - ? ELSE 0 END,
           used = used + ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE org_id = ? AND meter = ? AND period_key = ?`,
    [row.quantity, row.quantity, qty, row.org_id, row.meter, row.period_key],
    opt,
  );
  // If we reserved more than actual, the reserved decrement above removes full reserved qty
  // then we only add `qty` to used — correct. If rest > 0 was part of reserved, full row.quantity
  // is removed from reserved which is correct.

  await exec(
    `UPDATE quota_reservations SET status = 'committed', quantity = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'reserved'`,
    [qty, reservationId],
    opt,
  );

  await insertEvent(
    {
      orgId: Number(row.org_id),
      meter: row.meter,
      periodKey: row.period_key,
      eventType: 'commit',
      quantity: qty,
      idempotencyKey: row.idempotency_key,
      reservationId,
      refType: row.ref_type,
      refId: row.ref_id,
      userId: row.user_id,
    },
    opt,
  );

  void rest;
}

/** Cancel / fail / sweeper. Idempotent. */
export async function releaseReservation(
  reservationId: number,
  opt: TxOpt & { asExpired?: boolean } = {},
): Promise<void> {
  await ensurePlanQuotaTables();
  const row = await getReservationById(reservationId, opt);
  if (!row) return;
  if (row.status === 'released' || row.status === 'expired') return;
  if (row.status !== 'reserved') return;

  const kind = getMeterKind(row.meter as QuotaMeter);
  if (kind === 'period_usage') {
    await exec(
      `UPDATE org_quota_balances
         SET reserved = CASE WHEN reserved >= ? THEN reserved - ? ELSE 0 END,
             updated_at = CURRENT_TIMESTAMP
       WHERE org_id = ? AND meter = ? AND period_key = ?`,
      [row.quantity, row.quantity, row.org_id, row.meter, row.period_key],
      opt,
    );
  }

  const nextStatus = opt.asExpired ? 'expired' : 'released';
  await exec(
    `UPDATE quota_reservations SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'reserved'`,
    [nextStatus, reservationId],
    opt,
  );

  await insertEvent(
    {
      orgId: Number(row.org_id),
      meter: row.meter,
      periodKey: row.period_key,
      eventType: 'release',
      quantity: Number(row.quantity),
      idempotencyKey: row.idempotency_key,
      reservationId,
      refType: row.ref_type,
      refId: row.ref_id,
      userId: row.user_id,
    },
    opt,
  );
}

/** per_run_cap finish — status closed + audit close; no lifetime used. Idempotent. */
export async function closePerRunReservation(
  reservationId: number,
  opt: TxOpt = {},
): Promise<void> {
  await ensurePlanQuotaTables();
  const row = await getReservationById(reservationId, opt);
  if (!row) return;
  if (row.status === 'closed') return;
  if (row.status !== 'reserved') return;

  await exec(
    `UPDATE quota_reservations SET status = 'closed', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'reserved'`,
    [reservationId],
    opt,
  );

  await insertEvent(
    {
      orgId: Number(row.org_id),
      meter: row.meter,
      periodKey: row.period_key,
      eventType: 'close',
      quantity: Number(row.quantity),
      idempotencyKey: row.idempotency_key,
      reservationId,
      refType: row.ref_type,
      refId: row.ref_id,
      userId: row.user_id,
    },
    opt,
  );
}

/** Mark expired reserved rows and release (period) or close path via release. */
export async function sweepExpiredReservations(limit = 100): Promise<number> {
  await ensurePlanQuotaTables();
  const rows = await q<{ id: number }>(
    `SELECT id FROM quota_reservations
     WHERE status = 'reserved' AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
     ORDER BY id ASC LIMIT ?`,
    [limit],
  );
  let n = 0;
  for (const r of rows) {
    const row = await getReservationById(r.id);
    if (!row || row.status !== 'reserved') continue;
    await releaseReservation(r.id, { asExpired: true });
    n += 1;
  }
  return n;
}
