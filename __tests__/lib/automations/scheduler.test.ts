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
const due = {
  id: 1, domain_id: 9, workspace_id: 3, title: 'Post A', target_keyword: 'seo', publish_mode: 'draft',
  scheduled_date: '2024-12-16', time_zone: null,
};
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

// Tests that silence console.error must not leave it silenced for the rest.
afterEach(() => (console.error as unknown as Partial<jest.SpyInstance>).mockRestore?.());

/**
 * Route db.query by SQL. Writes report one affected row, except status transitions listed
 * in `lost` (as "from>to") — those another sweep already took.
 */
function route(h: { due?: unknown[]; generating?: unknown[]; lost?: string[]; charged?: boolean }) {
  mockQuery.mockImplementation((sql: string, opts?: { replacements?: unknown[] }) => {
    const s = String(sql).trim();
    // The +1 charge is on record unless `charged: false`.
    if (s.includes('FROM usage_events')) return Promise.resolve(h.charged === false ? [] : [{ one: 1 }]);
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

it("starts an event on the day it is in the scheduler's time zone, not the UTC day", async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-17T12:00:00Z'));
  try {
    route({
      due: [
        { ...due, id: 1, scheduled_date: '2026-09-18', time_zone: 'Pacific/Kiritimati' }, // already the 18th there
        { ...due, id: 2, scheduled_date: '2026-09-18', time_zone: 'Europe/Warsaw' }, // still the 17th
        { ...due, id: 3, scheduled_date: '2026-09-17', time_zone: null }, // UTC today
      ],
    });
    const res = await runAutomationsSweep(args);
    expect(res.started).toEqual([1, 3]);
    const select = mockQuery.mock.calls.find((c) => String(c[0]).includes("status = 'scheduled'"));
    expect((select?.[1] as { replacements: unknown[] }).replacements[0]).toBe('2026-09-18');
  } finally {
    jest.useRealTimers();
  }
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

it('drops the draft without a refund when the quota rejects the charge', async () => {
  (adjustActiveUsage as jest.Mock).mockRejectedValueOnce(new Error('Document limit reached'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  route({ due: [due], charged: false });
  const res = await runAutomationsSweep(args);
  expect(res.failed).toEqual([1]);
  expect(discardAutopilotDraft).toHaveBeenCalledWith(555);
  expect(adjustActiveUsage).toHaveBeenCalledTimes(1); // the rejected +1 only, no -1
  expect(triggerAutopilotAnalysis).not.toHaveBeenCalled();
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

it('keeps a live event waiting (not draft-ready) while WordPress is disconnected', async () => {
  route({ generating: [gen({ publish_mode: 'live', content: '<p>Body</p>', analysis_status: 'done' })] });
  const res = await runAutomationsSweep(args);
  expect(res).toEqual(expect.objectContaining({ created: [], waiting: 1 }));
});

it('does not record a live post as failed when only the local update fails', async () => {
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue(live);
  (publishToWordPress as jest.Mock).mockResolvedValue({ id: 1, link: 'https://x.pl/post', status: 'publish' });
  route({ generating: [gen({ publish_mode: 'live', content: '<p>Body</p>', analysis_status: 'done' })] });
  const base = mockQuery.getMockImplementation() as (sql: string, o?: unknown) => Promise<unknown>;
  mockQuery.mockImplementation((sql: string, o?: unknown) => (String(sql).includes('UPDATE articles')
    ? Promise.reject(new Error('db down'))
    : base(sql, o)));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await runAutomationsSweep(args);
  expect(res).toEqual(expect.objectContaining({ published: [2], failed: [] }));
  const toFailed = mockQuery.mock.calls.some((c) => (c[1] as { replacements?: unknown[] } | undefined)?.replacements?.[0] === 'failed');
  expect(toFailed).toBe(false);
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

it('drops a stale draft without a refund when its charge was never recorded', async () => {
  route({ generating: [gen({ analysis_status: null, stale: 1 })], charged: false });
  const res = await runAutomationsSweep(args);
  expect(res.failed).toEqual([2]);
  expect(discardAutopilotDraft).toHaveBeenCalledWith(555);
  expect(adjustActiveUsage).not.toHaveBeenCalled();
});

it('counts an event with no analysis job as stale by its own age', async () => {
  route({});
  await runAutomationsSweep(args);
  const sql = sqls().find((s) => s.includes('FROM automation_events e')) ?? '';
  expect(sql).toMatch(/j\.id IS NULL AND .*e\.updated_at/);
});
