import type { Transaction } from 'sequelize';
import db from '../../database/database';
import { ensurePlanQuotaTables } from '../ensurePlanQuotaTables';
import {
  ACTIVE_PERIOD_KEY,
  METER_KIND,
  type QuotaMeter,
} from '../planLimits';
import { getOrgPlanUsage, type OrgPlanUsage } from '../planUsage';
import { calendarPeriodKey } from './period';

const ACTIVE_METERS: Array<keyof OrgPlanUsage & QuotaMeter> = ['documents', 'aiPrompts', 'brandSpaces'];

async function upsertBalance(
  orgId: number,
  meter: string,
  periodKey: string,
  used: number,
  transaction?: Transaction,
): Promise<void> {
  const isPg = !!process.env.DATABASE_URL;
  if (isPg) {
    await db.query(
      `INSERT INTO org_quota_balances (org_id, meter, period_key, used, reserved)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (org_id, meter, period_key) DO NOTHING`,
      { replacements: [orgId, meter, periodKey, used], transaction },
    );
  } else {
    try {
      await db.query(
        `INSERT INTO org_quota_balances (org_id, meter, period_key, used, reserved)
         VALUES (?, ?, ?, ?, 0)`,
        { replacements: [orgId, meter, periodKey, used], transaction },
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/unique|duplicate|primary/i.test(m)) throw e;
    }
  }
}

/**
 * Proactive balance rows for an org. Seeds active meters from live COUNTs once;
 * period_usage row for current month starts at 0 used (or seeds KW count if missing).
 */
export async function ensureOrgQuotaBalances(
  orgId: number,
  opts: { transaction?: Transaction; seedFromCounts?: boolean } = {},
): Promise<void> {
  await ensurePlanQuotaTables();
  const seed = opts.seedFromCounts !== false;
  const usage = seed ? await getOrgPlanUsage(orgId) : null;
  const periodKey = calendarPeriodKey();

  for (const meter of ACTIVE_METERS) {
    const used = usage ? usage[meter] : 0;
    await upsertBalance(orgId, meter, ACTIVE_PERIOD_KEY, used, opts.transaction);
  }

  await upsertBalance(
    orgId,
    'keywordResearch',
    periodKey,
    usage?.keywordResearch ?? 0,
    opts.transaction,
  );

  // per_run_cap has no lifetime balance row
  void METER_KIND;
}

/** Org id for a domain (via workspace). */
export async function getOrgIdForDomain(domainId: number): Promise<number | null> {
  const rows = await db.query(
    `SELECT w.org_id AS org_id FROM domain d
     JOIN workspaces w ON w.id = d.workspace_id
     WHERE d."ID" = ? LIMIT 1`,
    { replacements: [domainId], type: 'SELECT' },
  ) as Array<{ org_id: number }>;
  return rows[0] ? Number(rows[0].org_id) : null;
}
