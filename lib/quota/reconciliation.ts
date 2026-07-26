import db from '../../database/database';
import { ensurePlanQuotaTables } from '../ensurePlanQuotaTables';
import { ACTIVE_PERIOD_KEY, type QuotaMeter } from '../planLimits';
import { getOrgPlanUsage } from '../planUsage';
import { calendarPeriodKey } from './period';

export interface ReconciliationMismatch {
  orgId: number;
  meter: QuotaMeter;
  periodKey: string;
  expected: number;
  actual: number;
  detail: string;
}

async function balanceUsed(orgId: number, meter: string, periodKey: string): Promise<number> {
  const rows = await db.query(
    `SELECT used FROM org_quota_balances WHERE org_id = ? AND meter = ? AND period_key = ?`,
    { replacements: [orgId, meter, periodKey], type: 'SELECT' },
  ) as Array<{ used: number }>;
  return Number(rows[0]?.used ?? 0);
}

async function sumCommitEvents(orgId: number, meter: string, periodKey: string): Promise<number> {
  const rows = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS n FROM usage_events
     WHERE org_id = ? AND meter = ? AND period_key = ? AND event_type = 'commit'`,
    { replacements: [orgId, meter, periodKey], type: 'SELECT' },
  ) as Array<{ n: number | string }>;
  return Number(rows[0]?.n ?? 0);
}

/** Per-meter reconciliation for one org. Does not auto-fix. */
export async function reconcileOrgQuotas(orgId: number): Promise<ReconciliationMismatch[]> {
  await ensurePlanQuotaTables();
  const mismatches: ReconciliationMismatch[] = [];
  const usage = await getOrgPlanUsage(orgId);
  const periodKey = calendarPeriodKey();

  for (const meter of ['documents', 'brandSpaces', 'aiPrompts'] as const) {
    const expected = usage[meter];
    const actual = await balanceUsed(orgId, meter, ACTIVE_PERIOD_KEY);
    if (expected !== actual) {
      mismatches.push({
        orgId,
        meter,
        periodKey: ACTIVE_PERIOD_KEY,
        expected,
        actual,
        detail: 'COUNT vs balances.used',
      });
    }
  }

  const kwBalance = await balanceUsed(orgId, 'keywordResearch', periodKey);
  const kwCommits = await sumCommitEvents(orgId, 'keywordResearch', periodKey);
  if (kwBalance !== kwCommits) {
    mismatches.push({
      orgId,
      meter: 'keywordResearch',
      periodKey,
      expected: kwCommits,
      actual: kwBalance,
      detail: 'SUM(commit) vs balances.used',
    });
  }

  return mismatches;
}
