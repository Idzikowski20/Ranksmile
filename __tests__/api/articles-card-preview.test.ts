/* eslint-disable import/first, import/order -- jest.mock must precede the handler import */
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h, withOrgAccessPolicy: (h: unknown) => h }));
/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn(), query: jest.fn() },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('@/src/infrastructure/persistence/schema/ensureAutomationTables', () => ({ ensureAutomationTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([1]),
  getScopedWorkspaceIds: jest.fn().mockResolvedValue([1]),
  ForbiddenWorkspaceError: class ForbiddenWorkspaceError extends Error {},
}));
jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([{ ID: 1 }]), findOne: jest.fn() },
}));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import handler from '../../pages/api/articles/index';
import { reviewOutlineToHtml } from '@/src/infrastructure/contentPlanner/reviewOutline';

function mockRes() {
  const res: Partial<NextApiResponse> & { _json?: unknown } = {};
  res.status = jest.fn(() => res as NextApiResponse);
  res.json = jest.fn((body: unknown) => { res._json = body; return res as NextApiResponse; });
  return res as NextApiResponse & { _json?: unknown };
}

type Row = { id: number; title: string; status: string; publish_url: string | null; content: string | null; featured_image: string | null };
type Out = { articles: Array<Record<string, unknown>> };

async function list(rows: Row[]): Promise<Out['articles']> {
  (db.query as jest.Mock)
    .mockResolvedValueOnce([[{ total: rows.length }], undefined])
    .mockResolvedValueOnce([rows, undefined]);
  const res = mockRes();
  await handler({ method: 'GET', query: {} } as NextApiRequest, res);
  return (res._json as Out).articles;
}

/**
 * The article cards render a thumbnail from the article's own HTML and pick a badge from
 * its state. The list therefore carries a bounded preview and the two facts the badge
 * needs — and never the full body.
 */
describe('GET /api/articles — card fields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ships a bounded, inert preview and drops the full content', async () => {
    const body = `<h1>Najemca nie płaci</h1>${'<p>Akapit o najemcy i czynszu. </p>'.repeat(300)}<script>x()</script>`;
    const [a] = await list([{ id: 1, title: 'A', status: 'draft', publish_url: null, content: body, featured_image: '/img.png' }]);
    expect(a.content).toBeUndefined();
    expect(String(a.preview_html).length).toBeLessThan(body.length);
    expect(String(a.preview_html)).toContain('<h1>Najemca nie płaci</h1>');
    expect(String(a.preview_html)).not.toContain('<script');
    expect(a.featured_image).toBe('/img.png');
    expect(a.has_content).toBe(true);
    expect(a.is_outline).toBe(false);
  });

  it('flags a planned outline so the card can say Waiting review', async () => {
    const outline = reviewOutlineToHtml([
      { level: 1, text: 'Najemca nie płaci' },
      { level: 2, text: 'Wezwanie do zapłaty', instructions: ['Podaj termin.'] },
    ]);
    const [a] = await list([{ id: 2, title: 'B', status: 'draft', publish_url: null, content: outline, featured_image: null }]);
    expect(a.is_outline).toBe(true);
    expect(a.has_content).toBe(true);
  });

  it('flags an empty draft as having no content', async () => {
    const [a] = await list([{ id: 3, title: 'C', status: 'draft', publish_url: null, content: null, featured_image: null }]);
    expect(a.has_content).toBe(false);
    expect(a.preview_html).toBe('');
  });
});
