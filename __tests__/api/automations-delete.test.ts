/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

import { adjustActiveUsage } from '@/src/infrastructure/quota/index';
import db from '../../database/database';
import handler from '../../pages/api/automations/[slug]/[id]';

jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn((fn: (tx: unknown) => unknown) => fn('tx')) },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue({ ID: 9 }) }));
jest.mock('@/src/infrastructure/persistence/schema/ensureAutomationTables', () => ({ ensureAutomationTables: jest.fn() }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('"ID"') }));
jest.mock('@/src/infrastructure/quota/index', () => ({
  getOrgIdForDomain: jest.fn().mockResolvedValue(7),
  ensureOrgQuotaBalances: jest.fn(),
  adjustActiveUsage: jest.fn(),
}));

const mockQuery = db.query as jest.Mock;

function call() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: jest.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  const req = { method: 'DELETE', query: { slug: 'site', id: '3' } } as unknown as NextApiRequest;
  return handler(req, res as unknown as NextApiResponse).then(() => res);
}

/** `event` is what the locked SELECT finds; `articleRemoved` is the article DELETE's row count. */
function route(event: { article_id: number | null; status: string } | null, articleRemoved = 1) {
  mockQuery.mockImplementation((sql: string) => {
    const s = String(sql);
    if (s.startsWith('SELECT')) return Promise.resolve(event ? [event] : []);
    if (s.includes('DELETE FROM articles')) return Promise.resolve([[], articleRemoved]);
    return Promise.resolve([[], 1]);
  });
}

const sqls = () => mockQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => jest.clearAllMocks());

it('removes the event and its unpublished draft, refunding the document once', async () => {
  route({ article_id: 55, status: 'created' });
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(sqls().some((s) => s.includes('DELETE FROM articles'))).toBe(true);
  expect(adjustActiveUsage).toHaveBeenCalledTimes(1);
  expect(adjustActiveUsage).toHaveBeenCalledWith(
    expect.objectContaining({ orgId: 7, delta: -1, idempotencyKey: 'doc-delete:55' }),
    { transaction: 'tx' },
  );
});

it('does not refund when the article was already deleted elsewhere', async () => {
  route({ article_id: 55, status: 'failed' }, 0);
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(adjustActiveUsage).not.toHaveBeenCalled();
});

it('refuses while the event is being published', async () => {
  route({ article_id: 55, status: 'publishing' });
  const res = await call();
  expect(res.statusCode).toBe(409);
  expect(sqls().some((s) => s.startsWith('DELETE'))).toBe(false);
});

it('keeps a published article and a scheduled event has none to remove', async () => {
  route({ article_id: 55, status: 'published' });
  await call();
  route({ article_id: null, status: 'scheduled' });
  await call();
  expect(sqls().some((s) => s.includes('DELETE FROM articles'))).toBe(false);
  expect(adjustActiveUsage).not.toHaveBeenCalled();
});

it('answers 404 for an event that does not exist', async () => {
  route(null);
  const res = await call();
  expect(res.statusCode).toBe(404);
});
