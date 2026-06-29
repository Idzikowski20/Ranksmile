jest.mock('../../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../../../lib/articleSql', () => ({
  __esModule: true,
  getArticleIdSql: jest.fn().mockResolvedValue('"ID"'),
}));

import db from '../../../database/database';
import { resolveArticleSeoMeta } from '../../../lib/ai/articleMeta';

const mockedQuery = (db as any).query as jest.Mock;

describe('resolveArticleSeoMeta', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('resolves domain/language/targetKeyword/competitors from the DB', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ domain: 'mine.com', language: 'pl', target_keyword: 'seo', title: 'T', competitor_outlines_cache: null }]])
      .mockResolvedValueOnce([[{ domain: 'c1.com', url: '' }]]);

    const result = await resolveArticleSeoMeta(1);

    expect(result.domain).toBe('mine.com');
    expect(result.language).toBe('pl');
    expect(result.targetKeyword).toBe('seo');
    expect(result.competitorDomains).toContain('c1.com');
  });

  it('returns safe defaults when the article query returns no rows', async () => {
    mockedQuery.mockResolvedValueOnce([[]]);

    await expect(resolveArticleSeoMeta(999)).resolves.toEqual({
      domain: '',
      language: 'pl',
      targetKeyword: '',
      competitorDomains: [],
    });
  });

  it('returns safe defaults and does not throw when the DB errors', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('boom'));

    await expect(resolveArticleSeoMeta(1)).resolves.toEqual({
      domain: '',
      language: 'pl',
      targetKeyword: '',
      competitorDomains: [],
    });
  });
});
