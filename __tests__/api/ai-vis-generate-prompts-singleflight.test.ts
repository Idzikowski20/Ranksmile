/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@/src/infrastructure/db/query', () => ({ queryOne: jest.fn() }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue({ ID: 7 }),
}));
jest.mock('@/src/infrastructure/persistence/schema/ensureAiVisibilityTables', () => ({
  ensureAiVisibilityTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/infrastructure/config/domainLanguage', () => ({
  getDomainLocale: jest.fn().mockResolvedValue({ languageCode: 'pl', countryCode: 'PL' }),
  looksLikeLanguage: () => true,
  languageNameForLlm: () => 'Polish (polski)',
  promptTemplatesForLocale: () => [{ text: 'szablon', provenance: ['template'] }],
}));
// These tests are about the claim, not about prompt quality. Stubbed so the handler never
// reaches the network — an unmocked generator would make every case here a live LLM call.
jest.mock('@/src/infrastructure/aiVisibility/aiVisibilityPromptGen', () => ({
  generateTrackerPrompts: jest.fn(async () => [
    'Jakie gabinety fizjoterapii polecacie po operacji kolana?',
    'Jakie gabinety fizjoterapii pomagają przy bólu kręgosłupa?',
    'Jakie gabinety fizjoterapii prowadzą rehabilitację sportowców?',
    'Jakie gabinety fizjoterapii przyjmują dzieci?',
    'Jakie gabinety fizjoterapii oferują terapię manualną?',
  ]),
}));
jest.mock('@/src/infrastructure/dataforseo/dataforseo', () => ({
  isDataForSeoConfigured: () => true,
  getPeopleAlsoAsk: jest.fn(),
}));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));

import db from '../../database/database';
import { queryOne } from '@/src/infrastructure/db/query';
import { getPeopleAlsoAsk } from '@/src/infrastructure/dataforseo/dataforseo';
import { generateTrackerPrompts } from '@/src/infrastructure/aiVisibility/aiVisibilityPromptGen';
import handler from '../../pages/api/ai-visibility/[slug]/generate-prompts';

const dbQuery = db.query as jest.Mock;
const cacheRead = queryOne as jest.Mock;
const paa = getPeopleAlsoAsk as jest.Mock;
const generate = generateTrackerPrompts as jest.Mock;

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
/** What a claim row looks like: somebody's token, plus when they took it. */
const claimRow = (ageMs: number) => ({
  prompts: JSON.stringify({ claim: 'a2ba0d1e-0000-4000-8000-000000000000' }),
  created_at: new Date(Date.now() - ageMs),
});

beforeEach(() => {
  jest.clearAllMocks();
  dbQuery.mockResolvedValue([]);
});

describe('generate-prompts single-flight', () => {
  it('waits out a live claim and replays the winner’s pool instead of buying its own', async () => {
    // A claim taken a second ago; the holder's pool lands while we are polling.
    cacheRead
      .mockResolvedValueOnce(claimRow(1000))
      .mockResolvedValue({ prompts: JSON.stringify(POOL), created_at: new Date() });

    const res = mockRes();
    await handler(mockReq(), res);

    expect(paa).not.toHaveBeenCalled();
    expect(res._json).toEqual({ prompts: POOL, degraded: false, cached: true });
  });

  // Nothing may wait on a claim whose holder is gone: it would never be filled, and the
  // wait would be paid again on every visit for as long as the row sits there.
  it('ignores a stale claim outright — no wait, and the write replaces the row', async () => {
    cacheRead.mockResolvedValue(claimRow(10 * 60_000));
    paa.mockResolvedValue({ questions: [{ question: POOL[0].text, domain: 'google.com' }], related: [] });

    const started = Date.now();
    const res = mockRes();
    await handler(mockReq(), res);

    // Straight past the abandoned claim: no polling, and no claim INSERT to lose.
    expect(Date.now() - started).toBeLessThan(1000);
    expect(paa).toHaveBeenCalled();
    expect(res._json).toMatchObject({ degraded: false });
    // The stale row goes the ordinary way — writeCached replacing it with a real pool —
    // rather than this request deleting a claim it never owned.
    const writes = dbQuery.mock.calls.map(([sql]) => String(sql).split(' ')[0]);
    expect(writes).toEqual(['DELETE', 'INSERT']);
  });

  it('the claim holder releases its own row when the result is only templates', async () => {
    cacheRead.mockResolvedValue(null);
    // Claim INSERT succeeds; PAA then fails, so nothing will ever fill the claim.
    paa.mockRejectedValue(new Error('locale mismatch'));
    // Generation unavailable too, so the result really is the template fallback.
    generate.mockResolvedValueOnce(null);

    const res = mockRes();
    await handler(mockReq(), res);

    const inserted = dbQuery.mock.calls.find(([sql]) => String(sql).startsWith('INSERT'));
    const token = (inserted?.[1] as { replacements: unknown[] }).replacements[2];
    const deletes = dbQuery.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE'));
    expect(deletes).toHaveLength(1);
    // Scoped to the token this request inserted. Deleting by (domain, topic) also erased
    // a newer request's claim, and the pool a concurrent refresh had just written.
    expect(String(deletes[0][0])).toContain('prompts = ?');
    expect((deletes[0][1] as { replacements: unknown[] }).replacements[2]).toBe(token);
    expect(res._json).toMatchObject({ degraded: true });
  });

  // Losing the INSERT after a clean read means someone claimed the topic in between —
  // that is a live holder, so it is waited for like any other.
  it('waits when it loses the claim race after reading no row at all', async () => {
    cacheRead.mockResolvedValue(null);
    dbQuery.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    paa.mockRejectedValue(new Error('locale mismatch'));
    generate.mockResolvedValueOnce(null);

    const res = mockRes();
    await handler(mockReq(), res);

    expect(paa).toHaveBeenCalled();
    // No token, so nothing of ours to release — and nothing of the holder's to touch.
    expect(dbQuery.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE'))).toHaveLength(0);
    expect(res._json).toMatchObject({ degraded: true });
  }, 15000);
});
