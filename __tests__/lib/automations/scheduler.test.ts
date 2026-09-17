import db from '@/database/database';
import { runAutomationsSweep } from '@/src/infrastructure/cron/automationsScheduler';
import { createAutopilotDraft, discardAutopilotDraft, triggerAutopilotAnalysis } from '@/src/infrastructure/cron/autopilot';
import { adjustActiveUsage } from '@/src/infrastructure/quota/index';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { publishToWordPress } from '@/src/infrastructure/wordpress/wordpressPublish';

jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('@/src/infrastructure/persistence/schema/ensureAutomationTables', () => ({ ensureAutomationTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('"ID"') }));
jest.mock('@/src/infrastructure/cron/autopilot', () => ({
  createAutopilotDraft: jest.fn(),
  triggerAutopilotAnalysis: jest.fn(),
  discardAutopilotDraft: jest.fn(),
}));
jest.mock('@/src/infrastructure/wordpress/wpConnection', () => ({ getConnectionForWorkspace: jest.fn() }));
jest.mock('@/src/infrastructure/wordpress/wordpressPublish', () => ({ publishToWordPress: jest.fn() }));
jest.mock('@/src/infrastructure/quota/index', () => ({
  getOrgIdForDomain: jest.fn().mockResolvedValue(7),
  ensureOrgQuotaBalances: jest.fn().mockResolvedValue(undefined),
  adjustActiveUsage: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = db.query as jest.Mock;
const args = { baseUrl: 'http://localhost:3000', cronSecret: 's' };
const due = { id: 1, domain_id: 9, workspace_id: 3, title: 'Post A', target_keyword: 'seo', publish_mode: 'draft' };
const gen = (over: Record<string, unknown>) => ({
  id: 2, domain_id: 9, workspace_id: 3, publish_mode: 'draft', article_id: 555,
  content: '', article_title: 'Post', meta_title: null, analysis_status: 'running', stale: 0, ...over,
});
const live = { site_url: 'https://x.pl', api_key: 'user:pass' };

beforeEach(() => {
  jest.clearAllMocks();
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue(null);
  (createAutopilotDraft as jest.Mock).mockResolvedValue(555);
  (triggerAutopilotAnalysis as jest.Mock).mockResolvedValue(true);
  (discardAutopilotDraft as jest.Mock).mockResolvedValue(true);
});

/**
 * Route db.query by SQL. Writes report one affected row, except status transitions listed
 * in `lost` (as "from>to") — those another sweep already took.
 */
function route(h: { due?: unknown[]; generating?: unknown[]; lost?: string[] }) {
  mockQuery.mockImplementation((sql: string, opts?: { replacements?: unknown[] }) => {
    const s = String(sql).trim();
    if (s.startsWith('SELECT') && s.includes("status = 'scheduled'")) return Promise.resolve(h.due ?? []);
    if (s.includes('FROM automation_events e')) return Promise.resolve(h.generating ?? []);
    const r = opts?.replacements ?? [];
    const key = s.includes('SET status') ? `${String(r[2])}>${String(r[0])}` : '';
    return Promise.resolve([[], h.lost?.includes(key) ? 0 : 1]);
  });
}

const sqls = () => mockQuery.mock.calls.map((c) => String(c[0]));

it('claims a due event before drafting, bills it, links it and kicks analysis', async () => {
  route({ due: [due] });
  const res = await runAutomationsSweep(args);
  const claim = mockQuery.mock.calls.findIndex((c) => String(c[0]).includes('SET status')
    && (c[1] as { replacements: unknown[] }).replacements[0] === 'generating');
  expect(claim).toBeGreaterThanOrEqual(0);
  expect(mockQuery.mock.invocationCallOrder[claim]).toBeLessThan((createAutopilotDraft as jest.Mock).mock.invocationCallOrder[0]);
  expect(adjustActiveUsage).toHaveBeenCalledWith(expect.objectContaining({ delta: 1, idempotencyKey: 'auto-doc:7:1' }));
  expect(sqls().some((s) => s.includes('SET article_id = ?'))).toBe(true);
  expect(triggerAutopilotAnalysis).toHaveBeenCalledWith(args, expect.objectContaining({ articleId: 555, domainId: 9, keyword: 'seo' }));
  expect(res.started).toEqual([1]);
});

it('skips an event another sweep already claimed: no draft, no bill', async () => {
  route({ due: [due], lost: ['scheduled>generating'] });
  const res = await runAutomationsSweep(args);
  expect(createAutopilotDraft).not.toHaveBeenCalled();
  expect(adjustActiveUsage).not.toHaveBeenCalled();
  expect(res).toEqual(expect.objectContaining({ started: [], skipped: 1 }));
});

it('fails the event and drops + refunds the draft when analysis is not accepted', async () => {
  (triggerAutopilotAnalysis as jest.Mock).mockResolvedValue(false);
  route({ due: [due] });
  const res = await runAutomationsSweep(args);
  expect(res.failed).toEqual([1]);
  expect(discardAutopilotDraft).toHaveBeenCalledWith(555);
  expect(adjustActiveUsage).toHaveBeenCalledWith(expect.objectContaining({ delta: -1, idempotencyKey: 'doc-delete:555' }));
});

it('does not refund a draft the pipeline already picked up', async () => {
  (triggerAutopilotAnalysis as jest.Mock).mockResolvedValue(false);
  (discardAutopilotDraft as jest.Mock).mockResolvedValue(false);
  route({ due: [due] });
  await runAutomationsSweep(args);
  expect(adjustActiveUsage).not.toHaveBeenCalledWith(expect.objectContaining({ delta: -1 }));
});

it('publishes a live event once its article has content, through the publishing claim', async () => {
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue(live);
  (publishToWordPress as jest.Mock).mockResolvedValue({ id: 1, link: 'https://x.pl/post', status: 'publish' });
  route({ generating: [gen({ publish_mode: 'live', content: '<p>Body</p>', analysis_status: 'done' })] });
  const res = await runAutomationsSweep(args);
  expect(publishToWordPress).toHaveBeenCalledWith(expect.objectContaining({ wpUrl: 'https://x.pl', content: '<p>Body</p>', status: 'publish' }));
  expect(res.published).toEqual([2]);
});

it('does not publish when another sweep holds the publishing claim', async () => {
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue(live);
  route({
    generating: [gen({ publish_mode: 'live', content: '<p>Body</p>', analysis_status: 'done' })],
    lost: ['generating>publishing'],
  });
  const res = await runAutomationsSweep(args);
  expect(publishToWordPress).not.toHaveBeenCalled();
  expect(res.waiting).toBe(1);
});

it('leaves a generating event waiting while its article has no content yet', async () => {
  route({ generating: [gen({})] });
  const res = await runAutomationsSweep(args);
  expect(res.waiting).toBe(1);
  expect(publishToWordPress).not.toHaveBeenCalled();
});

it('marks a draft-intent event created once content exists', async () => {
  route({ generating: [gen({ content: '<p>Body</p>', analysis_status: 'done' })] });
  const res = await runAutomationsSweep(args);
  expect(res.created).toEqual([2]);
  expect(publishToWordPress).not.toHaveBeenCalled();
});

it('fails a stale event with no content and drops its draft', async () => {
  route({ generating: [gen({ analysis_status: null, stale: 1 })] });
  const res = await runAutomationsSweep(args);
  expect(res.failed).toEqual([2]);
  expect(discardAutopilotDraft).toHaveBeenCalledWith(555);
  expect(sqls().some((s) => s.includes('SET article_id = NULL'))).toBe(true);
});

it('counts an event with no analysis job as stale by its own age', async () => {
  route({});
  await runAutomationsSweep(args);
  const sql = sqls().find((s) => s.includes('FROM automation_events e')) ?? '';
  expect(sql).toMatch(/j\.id IS NULL AND .*e\.updated_at/);
});
