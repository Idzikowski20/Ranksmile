jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue(undefined), sync: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../lib/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(true) }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../lib/db/query', () => ({ queryOne: jest.fn() }));
jest.mock('../../lib/sidecar', () => ({ callSidecar: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import handler from '../../pages/api/articles/ai-readability';
import { queryOne } from '../../lib/db/query';
import { callSidecar } from '../../lib/sidecar';
import { buildSnapshot, parseSnapshot } from '../../lib/coverageStore';
import type { CoverageItem } from '../../lib/aiCoverage';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockCallSidecar = callSidecar as jest.MockedFunction<typeof callSidecar>;

const makeRes = (): NextApiResponse => {
  const res = {} as NextApiResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const coverageItem = (id: string, type: CoverageItem['type']): CoverageItem => ({
  id,
  label: id,
  type,
  category: type === 'readability' ? 'quality' : 'knowledge',
  importance: 'recommended',
  source: type === 'readability' ? 'llm' : 'paa',
  covered: false,
  quality: 0,
});

describe('/api/articles/ai-readability coverage merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves existing coverage topic groups when merging readability items', async () => {
    const previousSnapshot = buildSnapshot(
      [coverageItem('paa-1', 'paa')],
      { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false },
      { judgeVersion: 'v1|deepseek-chat|0', promptVersion: 'v1', model: 'deepseek-chat', createdAt: '2026-07-16T00:00:00Z' },
      [{ title: 'Core questions', itemIds: ['paa-1'] }],
    );

    mockQueryOne
      .mockResolvedValueOnce({
        content: '<p>Body</p>',
        meta_title: 'Meta title',
        meta_description: 'Meta description',
        target_keyword: 'keyword',
        title: 'Title',
      })
      .mockResolvedValueOnce({ ai_info_to_cover: JSON.stringify(previousSnapshot) });
    mockCallSidecar.mockResolvedValueOnce({
      score: 90,
      coverage_items: [coverageItem('readability-1', 'readability')],
    });

    const res = makeRes();
    await handler(
      { method: 'POST', body: { articleId: 123 }, query: {}, cookies: {} } as unknown as NextApiRequest,
      res,
    );

    const snapshotUpdate = mockDbQuery.mock.calls.find(([sql]) => String(sql).includes('ai_info_to_cover = ?'));
    expect(snapshotUpdate).toBeDefined();

    const replacements = snapshotUpdate?.[1]?.replacements;
    expect(Array.isArray(replacements)).toBe(true);
    const savedSnapshot = parseSnapshot(String(Array.isArray(replacements) ? replacements[0] : ''));

    expect(savedSnapshot?.topics).toEqual(previousSnapshot.topics);
    expect(savedSnapshot?.items.map((item) => item.id)).toEqual(['paa-1', 'readability-1']);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
