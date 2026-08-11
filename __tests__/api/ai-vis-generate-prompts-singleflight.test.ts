/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../lib/db/query', () => ({ queryOne: jest.fn() }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue({ ID: 7 }),
}));
jest.mock('../../lib/ensureAiVisibilityTables', () => ({
  ensureAiVisibilityTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/domainLanguage', () => ({
  getDomainLocale: jest.fn().mockResolvedValue({ languageCode: 'pl', countryCode: 'PL' }),
  looksLikeLanguage: () => true,
  promptTemplatesForLocale: () => [{ text: 'szablon', provenance: ['template'] }],
}));
jest.mock('../../lib/dataforseo', () => ({
  isDataForSeoConfigured: () => true,
  getPeopleAlsoAsk: jest.fn(),
}));
jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));

import db from '../../database/database';
import { queryOne } from '../../lib/db/query';
import { getPeopleAlsoAsk } from '../../lib/dataforseo';
import handler from '../../pages/api/ai-visibility/[slug]/generate-prompts';

const dbQuery = db.query as jest.Mock;
const cacheRead = queryOne as jest.Mock;
const paa = getPeopleAlsoAsk as jest.Mock;

function mockReq(): NextApiRequest {
  return { method: 'POST', query: { slug: 'example-com' }, body: { topic: 'fizjoterapia' } } as unknown as NextApiRequest;
}

function mockRes() {
  const res: Partial<NextApiResponse> & { _status?: number; _json?: Record<string, unknown> } = {};
  res.status = jest.fn((code: number) => { res._status = code; return res as NextApiResponse; });
  res.json = jest.fn((body: unknown) => { res._json = body as Record<string, unknown>; return res as NextApiResponse; });
  res.setHeader = jest.fn();
  return res as NextApiResponse & { _status?: number; _json?: Record<string, unknown> };
}

const POOL = [{ text: 'najlepszy fizjoterapeuta', provenance: ['google'] }];

beforeEach(() => {
  jest.clearAllMocks();
  dbQuery.mockResolvedValue([]);
});

describe('generate-prompts single-flight', () => {
  it('the request that loses the claim replays the winner’s pool instead of buying its own', async () => {
    // Cache miss on entry; the winner's pool lands while we are polling.
    cacheRead
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ prompts: JSON.stringify(POOL) });
    // The unique index rejects the second INSERT for the same (domain, topic).
    dbQuery.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

    const res = mockRes();
    await handler(mockReq(), res);

    expect(paa).not.toHaveBeenCalled();
    expect(res._json).toEqual({ prompts: POOL, degraded: false, cached: true });
  });

  it('the claim holder releases the row when the result is only templates', async () => {
    cacheRead.mockResolvedValue(null);
    // Claim INSERT succeeds; PAA then fails, so nothing will ever fill the claim.
    paa.mockRejectedValue(new Error('locale mismatch'));

    const res = mockRes();
    await handler(mockReq(), res);

    const deletes = dbQuery.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE'));
    expect(deletes).toHaveLength(1);
    expect(res._json).toMatchObject({ degraded: true });
  });
});
