// Local sequelize-chain mock (mirror __tests__/utils/verifyDomainOwnership.test.ts) — NEVER touch global jest infra.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn(async () => 'id') }));

import db from '../../database/database';
import { buildArticleContext } from '../../lib/articleContext';

const mockQuery = (db as unknown as { query: jest.Mock }).query;

describe('buildArticleContext — core fields', () => {
  beforeEach(() => mockQuery.mockReset());

  it('assembles keyword/scoreData/coverage/paa from the article row; sparse when columns null', async () => {
    // 1st query = article row (Task 5 reads this). Return a minimal row.
    mockQuery.mockResolvedValueOnce([[{
      id: 1, target_keyword: 'react hooks', language: 'en', content_type: 'guide',
      score_data: JSON.stringify({ terms: [], paa_questions: ['What are hooks?'] }),
      ai_info_to_cover: null,        // un-analyzed -> coverage null
    }]]);
    // subsequent queries (terms/competitors in Task 6) — default empty
    mockQuery.mockResolvedValue([[]]);

    const ctx = await buildArticleContext(1);
    expect(ctx.articleId).toBe(1);
    expect(ctx.keyword).toBe('react hooks');
    expect(ctx.language).toBe('en');
    expect(ctx.contentType).toBe('guide');
    expect(ctx.paa).toEqual(['What are hooks?']);
    expect(ctx.coverage).toBeNull();           // parseSnapshot(null) -> null
  });

  it('does not throw when the article row is missing', async () => {
    mockQuery.mockResolvedValue([[]]); // no row
    const ctx = await buildArticleContext(999);
    expect(ctx.articleId).toBe(999);
    expect(ctx.keyword).toBe('');
    expect(ctx.coverage).toBeNull();
    expect(ctx.paa).toEqual([]);
  });
});
