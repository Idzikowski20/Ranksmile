jest.mock('sequelize', () => ({ Op: { in: 'Op.in' }, QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('@/src/infrastructure/identity/tenancy', () => ({ assertArticleAccess: jest.fn().mockResolvedValue(true) }));
jest.mock('@/src/infrastructure/ai/aiBudget', () => ({
  resolveOrgId: jest.fn().mockResolvedValue(1),
  orgBudgetBlocked: jest.fn().mockResolvedValue(null),
  recordAiTokens: jest.fn(),
}));
jest.mock('@/src/infrastructure/persistence/schema/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/src/infrastructure/stores/contentSettings', () => ({
  readContentSettings: jest.fn().mockResolvedValue({ brandName: '', brandKnowledge: '', voices: [] }),
}));
jest.mock('@/src/infrastructure/articles/articleTerms', () => ({ readArticleTerms: jest.fn().mockResolvedValue([]) }));
jest.mock('@/src/infrastructure/coverage/coverageStore', () => ({ mergedPlannerQuestions: jest.fn().mockReturnValue([]) }));
jest.mock('@/src/infrastructure/contentPlanner/runContentPlanner', () => ({
  runContentPlanner: jest.fn().mockReturnValue({
    bundle: { outline: { sections: [] }, briefs: [{}], targetKg: { claims: [], questions: [] } },
    canWrite: true,
    blueprintValidation: { issues: [] },
    outlineValidation: { issues: [] },
    briefValidation: { issues: [] },
  }),
}));
jest.mock('@/src/infrastructure/contentPlanner/briefWriter', () => ({
  writeOutlineBrief: jest.fn().mockResolvedValue([
    { level: 1, text: 'Prywatny detektyw Warszawa' },
    { level: 2, text: 'Ile kosztuje detektyw', instructions: ['Podaj widełki cenowe.'] },
  ]),
}));

import handler from '../../pages/api/articles/[id]/content-plan';
import db from '../../database/database';

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;
const dbResult = (value: unknown) => value as Awaited<ReturnType<typeof db.query>>;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

beforeEach(() => { jest.clearAllMocks(); });

/**
 * Leaving outline review before generating and coming back must restore the outline,
 * not pay for a second planner run. The editor restores from `approvedOutline`, so a
 * plan that never wrote one sends the returning reviewer straight back into planning.
 */
it('stores the planned outline as approvedOutline so a returning reviewer restores it', async () => {
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([{
        id: 28,
        target_keyword: 'prywatny detektyw warszawa',
        score_data: JSON.stringify({ terms: [] }),
        competitor_outlines_cache: null,
        language: 'pl',
        ai_info_to_cover: null,
      }]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '28' }, body: { persist: true }, headers: {}, cookies: {} } as any,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(200);
  const writes = mockDbQuery.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE articles SET score_data'));
  const lastWrite = writes[writes.length - 1];
  const stored = JSON.parse((lastWrite[1] as { replacements: string[] }).replacements[0]);
  expect(stored.content_planner_v2.brief).toHaveLength(2);
  expect(stored.content_planner_v2.approvedOutline).toHaveLength(2);
});
