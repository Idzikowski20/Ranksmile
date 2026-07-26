import { ACTIVE_PERIOD_KEY } from '../../lib/planLimits';
import type { ReconciliationMismatch } from '../../lib/quota/reconciliation';

jest.mock('../../lib/ensurePlanQuotaTables', () => ({
  ensurePlanQuotaTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/planUsage', () => ({
  getOrgPlanUsage: jest.fn().mockResolvedValue({
    documents: 5,
    brandSpaces: 1,
    aiPrompts: 3,
    keywordResearch: 2,
  }),
}));

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[] }) => {
      const s = String(sql);
      const r = opts?.replacements ?? [];
      if (s.includes('FROM org_quota_balances')) {
        const meter = String(r[1]);
        if (meter === 'documents') return [{ used: 5 }];
        if (meter === 'brandSpaces') return [{ used: 1 }];
        if (meter === 'aiPrompts') return [{ used: 99 }];
        if (meter === 'keywordResearch') return [{ used: 2 }];
        return [{ used: 0 }];
      }
      if (s.includes('SUM(quantity)')) return [{ n: 2 }];
      return [];
    }),
  },
}));

import { reconcileOrgQuotas } from '../../lib/quota/reconciliation';

describe('reconcileOrgQuotas', () => {
  it('reports COUNT vs used mismatches for active meters', async () => {
    const mismatches: ReconciliationMismatch[] = await reconcileOrgQuotas(1);
    expect(mismatches.some((m) => m.meter === 'aiPrompts' && m.expected === 3 && m.actual === 99)).toBe(true);
    expect(mismatches.some((m) => m.meter === 'documents')).toBe(false);
    expect(
      mismatches.every((m) => m.periodKey === ACTIVE_PERIOD_KEY || /^\d{4}-\d{2}$/.test(m.periodKey)),
    ).toBe(true);
  });
});
