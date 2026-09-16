import db from '@/database/database';
import { runAutomationsSweep } from '@/src/infrastructure/cron/automationsScheduler';
import { createAutopilotDraft, triggerAutopilotAnalysis } from '@/src/infrastructure/cron/autopilot';
import { getConnectionForWorkspace } from '@/src/infrastructure/wordpress/wpConnection';
import { publishToWordPress } from '@/src/infrastructure/wordpress/wordpressPublish';

jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('@/src/infrastructure/persistence/schema/ensureAutomationTables', () => ({ ensureAutomationTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('"ID"') }));
jest.mock('@/src/infrastructure/cron/autopilot', () => ({
  createAutopilotDraft: jest.fn().mockResolvedValue(555),
  triggerAutopilotAnalysis: jest.fn().mockResolvedValue(true),
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

beforeEach(() => {
  jest.clearAllMocks();
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue(null);
});

/** Route db.query by SQL so START and FINALIZE queries can return fixtures. */
function route(handlers: { due?: unknown[]; generating?: unknown[] }) {
  mockQuery.mockImplementation((sql: string) => {
    const s = String(sql);
    if (s.includes('FROM automation_events') && s.includes("status = 'scheduled'")) return Promise.resolve(handlers.due ?? []);
    if (s.includes('FROM automation_events e') && s.includes("e.status = 'generating'")) return Promise.resolve(handlers.generating ?? []);
    return Promise.resolve([]); // UPDATEs, article updates
  });
}

it('starts a due scheduled event: creates the draft, kicks analysis, moves to generating', async () => {
  route({ due: [{ id: 1, domain_id: 9, workspace_id: 3, title: 'Post A', target_keyword: 'seo', publish_mode: 'draft' }] });
  const res = await runAutomationsSweep(args);
  expect(createAutopilotDraft).toHaveBeenCalledWith(9, 'seo');
  expect(triggerAutopilotAnalysis).toHaveBeenCalledWith(args, expect.objectContaining({ articleId: 555, domainId: 9, keyword: 'seo' }));
  const movedToGenerating = mockQuery.mock.calls.some((c) => String(c[0]).includes("status = 'generating'") && String(c[0]).includes('UPDATE'));
  expect(movedToGenerating).toBe(true);
  expect(res.started).toEqual([1]);
});

it('publishes a live generating event once its article has content', async () => {
  (getConnectionForWorkspace as jest.Mock).mockResolvedValue({ site_url: 'https://x.pl', api_key: 'user:pass' });
  (publishToWordPress as jest.Mock).mockResolvedValue({ id: 1, link: 'https://x.pl/post', status: 'publish' });
  route({
    generating: [{
      id: 2, workspace_id: 3, publish_mode: 'live', article_id: 555,
      content: '<p>Body</p>', article_title: 'Post', meta_title: null, analysis_status: 'done', analysis_stale: 0,
    }],
  });
  const res = await runAutomationsSweep(args);
  expect(publishToWordPress).toHaveBeenCalledWith(expect.objectContaining({ wpUrl: 'https://x.pl', content: '<p>Body</p>', status: 'publish' }));
  expect(res.published).toEqual([2]);
});

it('leaves a generating event waiting while its article has no content yet', async () => {
  route({
    generating: [{
      id: 3, workspace_id: 3, publish_mode: 'draft', article_id: 555,
      content: '', article_title: 'Post', meta_title: null, analysis_status: 'running', analysis_stale: 0,
    }],
  });
  const res = await runAutomationsSweep(args);
  expect(res.waiting).toBe(1);
  expect(publishToWordPress).not.toHaveBeenCalled();
});

it('marks a generating event created (draft ready) when content exists but intent is draft', async () => {
  route({
    generating: [{
      id: 4, workspace_id: 3, publish_mode: 'draft', article_id: 555,
      content: '<p>Body</p>', article_title: 'Post', meta_title: null, analysis_status: 'done', analysis_stale: 0,
    }],
  });
  const res = await runAutomationsSweep(args);
  expect(res.created).toEqual([4]);
  expect(publishToWordPress).not.toHaveBeenCalled();
});

it('fails a generating event whose analysis died with no content', async () => {
  route({
    generating: [{
      id: 5, workspace_id: 3, publish_mode: 'live', article_id: 555,
      content: '', article_title: 'Post', meta_title: null, analysis_status: 'failed', analysis_stale: 1,
    }],
  });
  const res = await runAutomationsSweep(args);
  expect(res.failed).toEqual([5]);
});
