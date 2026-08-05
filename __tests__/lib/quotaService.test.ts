/**
 * Stateful in-memory mock of quota tables — concurrency / idempotency without live Postgres.
 */
jest.mock('../../lib/ensurePlanQuotaTables', () => ({
  ensurePlanQuotaTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/orgBilling', () => ({
  getOrgBillingState: jest.fn().mockResolvedValue({
    planSlug: 'starter',
    subscriptionStatus: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }),
}));

type BalRow = { used: number; reserved: number };
type ResRow = {
  id: number;
  org_id: number;
  meter: string;
  period_key: string;
  quantity: number;
  status: string;
  idempotency_key: string;
  ref_type: string | null;
  ref_id: string | null;
  user_id: string | null;
  expires_at: string | null;
};

const store: {
  bal: Map<string, BalRow>;
  reservations: Map<string, ResRow>;
  events: Array<{ org_id: number; idempotency_key: string; event_type: string; quantity: number }>;
  nextResId: number;
} = {
  bal: new Map(),
  reservations: new Map(),
  events: [],
  nextResId: 1,
};

function bk(orgId: number, meter: string, period: string): string {
  return `${orgId}|${meter}|${period}`;
}

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[]; type?: unknown }) => {
      const r = opts?.replacements ?? [];
      const s = String(sql);
      const asSelect = opts?.type != null;
      const wrap = (rows: unknown[]) => (asSelect ? rows : [rows, {}]);

      if (s.includes('INSERT INTO org_quota_balances')) {
        const [orgId, meter, periodKey, used] = r as [number, string, string, number];
        const key = bk(orgId, meter, periodKey);
        if (!store.bal.has(key)) store.bal.set(key, { used: Number(used ?? 0), reserved: 0 });
        return wrap([]);
      }

      if (s.includes('FROM org_quota_balances WHERE org_id')) {
        const [orgId, meter, periodKey] = r as [number, string, string];
        const row = store.bal.get(bk(orgId, meter, periodKey));
        if (!row) return wrap([]);
        return wrap([{ org_id: orgId, meter, period_key: periodKey, used: row.used, reserved: row.reserved }]);
      }

      if (s.includes('UPDATE org_quota_balances') && s.includes('used = used +') && s.includes('RETURNING')) {
        const [qty, orgId, meter, periodKey, , limit] = r as [number, number, string, string, number, number];
        const key = bk(orgId, meter, periodKey);
        const row = store.bal.get(key) ?? { used: 0, reserved: 0 };
        if (row.used + row.reserved + qty > limit) return wrap([]);
        row.used += qty;
        store.bal.set(key, row);
        return wrap([{ used: row.used, reserved: row.reserved }]);
      }

      if (s.includes('UPDATE org_quota_balances') && s.includes('used = used -') && s.includes('RETURNING')) {
        const [qty, orgId, meter, periodKey] = r as [number, number, string, string, number];
        const key = bk(orgId, meter, periodKey);
        const row = store.bal.get(key) ?? { used: 0, reserved: 0 };
        if (row.used < qty) return wrap([]);
        row.used -= qty;
        store.bal.set(key, row);
        return wrap([{ used: row.used }]);
      }

      if (s.includes('UPDATE org_quota_balances') && s.includes('reserved = reserved +') && s.includes('RETURNING')) {
        const [qty, orgId, meter, periodKey, , limit] = r as [number, number, string, string, number, number];
        const key = bk(orgId, meter, periodKey);
        const row = store.bal.get(key) ?? { used: 0, reserved: 0 };
        if (row.used + row.reserved + qty > limit) return wrap([]);
        row.reserved += qty;
        store.bal.set(key, row);
        return wrap([{ used: row.used, reserved: row.reserved }]);
      }

      if (s.includes('UPDATE org_quota_balances') && s.includes('reserved = CASE') && s.includes('used = used +')) {
        const [fullQty, , addUsed, orgId, meter, periodKey] = r as [number, number, number, number, string, string];
        const key = bk(orgId, meter, periodKey);
        const row = store.bal.get(key) ?? { used: 0, reserved: 0 };
        row.reserved = Math.max(0, row.reserved - fullQty);
        row.used += addUsed;
        store.bal.set(key, row);
        return wrap([]);
      }

      if (s.includes('UPDATE org_quota_balances') && s.includes('reserved = CASE')) {
        const [qty, , orgId, meter, periodKey] = r as [number, number, number, string, string];
        const key = bk(orgId, meter, periodKey);
        const row = store.bal.get(key) ?? { used: 0, reserved: 0 };
        row.reserved = Math.max(0, row.reserved - qty);
        store.bal.set(key, row);
        return wrap([]);
      }

      if (s.includes('INSERT INTO quota_reservations')) {
        const [orgId, meter, periodKey, quantity, idem, refType, refId, userId, expires] = r as [
          number, string, string, number, string, string, string, string | null, string | null,
        ];
        const key = `${orgId}|${idem}`;
        if (store.reservations.has(key)) {
          throw new Error('duplicate key value violates unique constraint');
        }
        const id = store.nextResId++;
        store.reservations.set(key, {
          id,
          org_id: orgId,
          meter,
          period_key: periodKey,
          quantity,
          status: 'reserved',
          idempotency_key: idem,
          ref_type: refType,
          ref_id: refId,
          user_id: userId,
          expires_at: expires,
        });
        return wrap([]);
      }

      if (s.includes('FROM quota_reservations WHERE org_id = ? AND idempotency_key')) {
        const [orgId, idem] = r as [number, string];
        const row = store.reservations.get(`${orgId}|${idem}`);
        return wrap(row ? [row] : []);
      }

      if (s.includes('FROM quota_reservations WHERE id = ?')) {
        const [id] = r as [number];
        const row = [...store.reservations.values()].find((x) => x.id === id);
        return wrap(row ? [row] : []);
      }

      if (s.includes("UPDATE quota_reservations SET status = 'committed'")) {
        const [qty, id] = r as [number, number];
        const row = [...store.reservations.values()].find((x) => x.id === id);
        if (row && row.status === 'reserved') {
          row.status = 'committed';
          row.quantity = qty;
        }
        return wrap([]);
      }

      if (
        s.includes('UPDATE quota_reservations SET status = ?')
        || s.includes("UPDATE quota_reservations SET status = 'released'")
        || s.includes("UPDATE quota_reservations SET status = 'closed'")
        || s.includes("UPDATE quota_reservations SET status = 'expired'")
      ) {
        const status = s.includes('status = ?') ? String(r[0]) : (
          s.includes('closed') ? 'closed' : s.includes('expired') ? 'expired' : 'released'
        );
        const id = s.includes('status = ?') ? Number(r[1]) : Number(r[0]);
        const row = [...store.reservations.values()].find((x) => x.id === id);
        if (row && row.status === 'reserved') row.status = status;
        return wrap([]);
      }

      if (s.includes('INSERT INTO usage_events')) {
        const [orgId, , , eventType, quantity, idem] = r as [number, string, string, string, number, string];
        const dup = store.events.find(
          (e) => e.org_id === orgId && e.idempotency_key === idem && e.event_type === eventType,
        );
        if (dup) throw new Error('duplicate key value violates unique constraint');
        store.events.push({ org_id: orgId, idempotency_key: idem, event_type: eventType, quantity });
        return wrap([]);
      }

      return wrap([]);
    }),
  },
}));

import {
  adjustActiveUsage,
  closePerRunReservation,
  commitReservation,
  releaseReservation,
  reserveQuota,
} from '../../lib/quota/quotaService';
import { PlanLimitError } from '../../lib/quota/errors';

beforeAll(() => {
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgres://test';
});

beforeEach(() => {
  store.bal.clear();
  store.reservations.clear();
  store.events.length = 0;
  store.nextResId = 1;
});

describe('quotaService concurrency + idempotency', () => {
  it('parallel adjustActiveUsage respects limit', async () => {
    store.bal.set(bk(1, 'documents', '_'), { used: 0, reserved: 0 });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        adjustActiveUsage({
          orgId: 1,
          meter: 'documents',
          delta: 1,
          idempotencyKey: `doc-${i}`,
          ref: { type: 'article', id: String(i) },
        }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const limited = results.filter((r) => r.status === 'rejected' && r.reason instanceof PlanLimitError).length;
    expect(ok).toBe(10);
    expect(limited).toBe(10);
    expect(store.bal.get(bk(1, 'documents', '_'))?.used).toBe(10);
  });

  it('rejects reserveQuota on active_resource', async () => {
    await expect(
      reserveQuota({
        orgId: 1,
        meter: 'documents',
        quantity: 1,
        idempotencyKey: 'x',
        ref: { type: 'a', id: '1' },
      }),
    ).rejects.toThrow(/active_resource/);
  });

  it('idempotent reserve returns same reservation', async () => {
    store.bal.set(bk(1, 'keywordResearch', '2026-07'), { used: 0, reserved: 0 });
    const a = await reserveQuota({
      orgId: 1,
      meter: 'keywordResearch',
      quantity: 1,
      idempotencyKey: 'kw:1',
      periodKey: '2026-07',
      ref: { type: 'keyword_research', id: '1' },
    });
    const b = await reserveQuota({
      orgId: 1,
      meter: 'keywordResearch',
      quantity: 1,
      idempotencyKey: 'kw:1',
      periodKey: '2026-07',
      ref: { type: 'keyword_research', id: '1' },
    });
    expect(a.id).toBe(b.id);
    expect(store.bal.get(bk(1, 'keywordResearch', '2026-07'))?.reserved).toBe(1);
  });

  it('commit then release is no-op; commit moves reserved → used', async () => {
    store.bal.set(bk(1, 'keywordResearch', '2026-07'), { used: 0, reserved: 0 });
    const res = await reserveQuota({
      orgId: 1,
      meter: 'keywordResearch',
      quantity: 1,
      idempotencyKey: 'kw:2',
      periodKey: '2026-07',
      ref: { type: 'keyword_research', id: '2' },
    });
    await commitReservation(res.id);
    await commitReservation(res.id);
    await releaseReservation(res.id);
    const row = store.bal.get(bk(1, 'keywordResearch', '2026-07'));
    expect(row?.used).toBe(1);
    expect(row?.reserved).toBe(0);
    expect(store.events.filter((e) => e.event_type === 'commit')).toHaveLength(1);
  });

  it('siteAudit close does not bump org used', async () => {
    const res = await reserveQuota({
      orgId: 1,
      meter: 'siteAuditPages',
      quantity: 100,
      idempotencyKey: 'site-audit:dsetup_1',
      ref: { type: 'domain_setup', id: 'dsetup_1' },
    });
    await closePerRunReservation(res.id);
    await closePerRunReservation(res.id);
    expect([...store.bal.values()].every((b) => b.used === 0)).toBe(true);
    expect(store.events.filter((e) => e.event_type === 'close')).toHaveLength(1);
    expect(store.events.some((e) => e.event_type === 'commit')).toBe(false);
  });

  it('usage_events allow same idempotency_key across event_types', async () => {
    store.bal.set(bk(1, 'keywordResearch', '2026-07'), { used: 0, reserved: 0 });
    const res = await reserveQuota({
      orgId: 1,
      meter: 'keywordResearch',
      quantity: 1,
      idempotencyKey: 'kw:shared',
      periodKey: '2026-07',
      ref: { type: 'keyword_research', id: '9' },
    });
    await commitReservation(res.id);
    const types = store.events.filter((e) => e.idempotency_key === 'kw:shared').map((e) => e.event_type);
    expect(types).toEqual(expect.arrayContaining(['reserve', 'commit']));
  });
});
