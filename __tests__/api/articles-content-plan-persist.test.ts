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
    bundle: {
      outline: {
        h1: 'Prywatny detektyw Warszawa',
        sections: [
          { heading: 'Ile kosztuje detektyw', expectedWords: 320 },
          { heading: 'Jak wygląda współpraca', expectedWords: 280 },
        ],
      },
      briefs: [{}, {}],
      targetKg: { claims: [], questions: [] },
    },
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

const plannerBundle = {
  outline: {
    h1: 'Prywatny detektyw Warszawa',
    sections: [
      { heading: 'Ile kosztuje detektyw', expectedWords: 320 },
      { heading: 'Jak wygląda współpraca', expectedWords: 280 },
    ],
  },
  briefs: [{}, {}],
  targetKg: { claims: [], questions: [] },
};

const articleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 28,
  content: '',
  target_keyword: 'prywatny detektyw warszawa',
  score_data: JSON.stringify({ terms: [] }),
  competitor_outlines_cache: null,
  language: 'pl',
  ai_info_to_cover: null,
  ...overrides,
});

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
      return Promise.resolve(dbResult([articleRow()]));
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

/**
 * A failed brief used to throw the whole plan away — the planner's structure was paid
 * for and then 503'd, so the next visit planned again from scratch.
 */
it('falls back to the planner headings when the brief writer fails', async () => {
  const { writeOutlineBrief } = jest.requireMock('@/src/infrastructure/contentPlanner/briefWriter');
  (writeOutlineBrief as jest.Mock).mockResolvedValueOnce(null);
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([articleRow()]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '28' }, body: { persist: true }, headers: {}, cookies: {} } as any,
    res,
  );

  expect(res.status).toHaveBeenCalledWith(200);
  const payload = (res.json as jest.Mock).mock.calls[0][0];
  expect(payload.headings.map((h: { text: string }) => h.text)).toEqual([
    'Prywatny detektyw Warszawa',
    'Ile kosztuje detektyw',
    'Jak wygląda współpraca',
  ]);
});

it('reuses the outline this article already had over the planner headings', async () => {
  const { writeOutlineBrief } = jest.requireMock('@/src/infrastructure/contentPlanner/briefWriter');
  (writeOutlineBrief as jest.Mock).mockResolvedValueOnce(null);
  const saved = [{ level: 2, text: 'Reviewed heading', instructions: ['Keep this instruction.'] }];
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([articleRow({
        score_data: JSON.stringify({ terms: [], content_planner_v2: { approvedOutline: saved } }),
      })]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '28' }, body: { persist: true }, headers: {}, cookies: {} } as any,
    res,
  );

  const payload = (res.json as jest.Mock).mock.calls[0][0];
  expect(payload.headings).toEqual(saved);
});

it("records the article's step as review while the outline waits", async () => {
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([articleRow()]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '28' }, body: { persist: true }, headers: {}, cookies: {} } as any,
    res,
  );

  const statusWrites = mockDbQuery.mock.calls.filter(([sql]) => String(sql).includes("status = 'review'"));
  expect(statusWrites).toHaveLength(1);
});

it('leaves a written article on its own status when it is re-planned', async () => {
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([articleRow({ content: '<h1>Napisany artykuł</h1><p>Treść.</p>' })]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  await handler(
    { method: 'POST', query: { id: '28' }, body: { persist: true }, headers: {}, cookies: {} } as any,
    res,
  );

  expect(mockDbQuery.mock.calls.filter(([sql]) => String(sql).includes("status = 'review'"))).toHaveLength(0);
});

/**
 * `?stream=1`: the editor's pill wants the per-section count, so the reply is SSE —
 * one `status` per landed brief, then the JSON payload under `done`.
 */
it('streams the section count and the final payload when asked', async () => {
  const { writeOutlineBrief } = jest.requireMock('@/src/infrastructure/contentPlanner/briefWriter');
  (writeOutlineBrief as jest.Mock).mockImplementationOnce(async (input: { onProgress?: (d: number, t: number) => void }) => {
    input.onProgress?.(1, 2);
    input.onProgress?.(2, 2);
    return [
      { level: 1, text: 'Prywatny detektyw Warszawa' },
      { level: 2, text: 'Ile kosztuje detektyw', instructions: ['Podaj widełki cenowe.'] },
    ];
  });
  mockDbQuery.mockImplementation((sql: string) => {
    if (String(sql).startsWith('SELECT id, target_keyword')) {
      return Promise.resolve(dbResult([articleRow()]));
    }
    return Promise.resolve(dbResult([]));
  });

  const res = makeRes();
  res.write = jest.fn();
  res.end = jest.fn();
  await handler(
    { method: 'POST', query: { id: '28', stream: '1' }, body: { persist: true }, headers: {}, cookies: {}, on: jest.fn() } as any,
    res,
  );

  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
  const frames = (res.write as jest.Mock).mock.calls.map(([f]) => String(f));
  expect(frames.filter((f) => f.startsWith('event: status'))).toEqual([
    'event: status\ndata: {"done":0,"total":2}\n\n',
    'event: status\ndata: {"done":1,"total":2}\n\n',
    'event: status\ndata: {"done":2,"total":2}\n\n',
  ]);
  const done = frames.find((f) => f.startsWith('event: done'));
  expect(done).toBeDefined();
  const payload = JSON.parse(String(done).replace(/^event: done\ndata: /, ''));
  expect(payload.status).toBe(200);
  expect(payload.headings).toHaveLength(2);
  expect(res.json).not.toHaveBeenCalled();
  expect(res.end).toHaveBeenCalled();
});
