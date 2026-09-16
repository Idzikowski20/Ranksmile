import { deriveStages, enqueueDomainSetup, claimJob, materializeDomainSetup, resetDomainSetupRun, domainSetupActiveFresh } from '@/src/infrastructure/cron/domainPipeline';
import db from '../../database/database';

jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), transaction: jest.fn() } }));
jest.mock('@/src/infrastructure/persistence/schema/ensurePipelineTables', () => ({ ensurePipelineTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('../../database/models/gscAccount', () => ({ __esModule: true, default: { findAll: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/src/infrastructure/gsc/gscAccounts', () => ({ buildOAuthClientFromAccount: jest.fn() }));
jest.mock('@googleapis/searchconsole', () => ({ searchconsole_v1: { Searchconsole: jest.fn() } }));
const mockQuery = db.query as jest.Mock;
const sel = (r: unknown[]) => r; // SELECT returns rows directly
beforeEach(() => { mockQuery.mockReset(); });

describe('deriveStages', () => {
  it('marks stages before current=done, current=running, after=pending', () => {
    expect(deriveStages('running', 'topics', 40)).toEqual({
      stages: { gsc: 'done', keywords: 'done', topics: 'running', competitors: 'pending', recommendations: 'pending' },
      stagePercent: 40,
    });
  });
  it('all done when status=done', () => {
    expect(deriveStages('done', 'recommendations', 100).stages.recommendations).toBe('done');
    expect(deriveStages('done', null, 0).stages.gsc).toBe('done');
  });
  it('folds the hidden blog_audit stage into competitors (no all-pending flicker)', () => {
    // blog_audit runs between competitors and recommendations but has no UI row.
    expect(deriveStages('running', 'blog_audit', 50).stages).toEqual({
      gsc: 'done', keywords: 'done', topics: 'done', competitors: 'running', recommendations: 'pending',
    });
  });
});

describe('enqueueDomainSetup', () => {
  it('reuses the deterministic job id and skips INSERT when the job already exists', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ id: 'dsetup_99' }])); // lookup by id → found
    const { jobId: id } = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
    expect(mockQuery.mock.calls.every((c: unknown[]) => !String((c as unknown[])[0]).includes('INSERT INTO analysis_jobs'))).toBe(true);
  });
  it('inserts a queued job under the deterministic id when none exists', async () => {
    mockQuery.mockResolvedValueOnce(sel([])); // lookup → none
    mockQuery.mockResolvedValueOnce([[], {}]); // INSERT
    const { jobId: id } = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
    expect(String(mockQuery.mock.calls[1][0])).toContain('INSERT INTO analysis_jobs');
  });
  it('swallows a PK-collision INSERT (concurrent enqueue) and still returns the id', async () => {
    mockQuery.mockResolvedValueOnce(sel([])); // lookup → none
    mockQuery.mockRejectedValueOnce(new Error('UNIQUE constraint failed: analysis_jobs.id')); // INSERT loses race
    const { jobId: id } = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
  });
  it('re-throws a genuine (non-collision) INSERT error instead of masking it', async () => {
    mockQuery.mockResolvedValueOnce(sel([])); // lookup → none
    mockQuery.mockRejectedValueOnce(new Error('permission denied for table analysis_jobs'));
    await expect(enqueueDomainSetup(99)).rejects.toThrow('permission denied');
  });

  it('reports an existing queued job as runnable and never inserts', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ status: 'queued' }]));
    const { runnable } = await enqueueDomainSetup(99);
    expect(runnable).toBe(true);
    expect(mockQuery.mock.calls.every((c: unknown[]) => !String((c as unknown[])[0]).includes('INSERT INTO analysis_jobs'))).toBe(true);
  });
});

describe('domainSetupActiveFresh', () => {
  it('is true for a recent running job', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', updated_at: new Date().toISOString() }]));
    expect((await domainSetupActiveFresh(99)).activeFresh).toBe(true);
  });
  it('is false for a terminal job', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ status: 'done', updated_at: new Date().toISOString() }]));
    expect((await domainSetupActiveFresh(99)).activeFresh).toBe(false);
  });
  it('is false for a stale (crashed) running job', async () => {
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() }]));
    expect((await domainSetupActiveFresh(99)).activeFresh).toBe(false);
  });
});

describe('resetDomainSetupRun', () => {
  it('wins when its own token sticks on the reset row', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]); // UPDATE reset stamped with runKey
    mockQuery.mockResolvedValueOnce(sel([{ status: 'queued', locked_by: 'tok-1' }])); // re-read → ours
    expect(await resetDomainSetupRun(99, 'tok-1')).toBe(true);
    const upd = String(mockQuery.mock.calls[0][0]);
    expect(upd).toContain('UPDATE analysis_jobs');
    expect(upd).toContain("'finalizing'"); // stale finalizing is resettable
  });

  it('loses when a concurrent rerun stamped its token first', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);
    mockQuery.mockResolvedValueOnce(sel([{ status: 'queued', locked_by: 'other-tok' }])); // someone else won
    expect(await resetDomainSetupRun(99, 'tok-1')).toBe(false);
  });

  it('inserts and wins when no job row exists yet', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]); // UPDATE matches nothing
    mockQuery.mockResolvedValueOnce(sel([])); // re-read → absent
    mockQuery.mockResolvedValueOnce([[], {}]); // INSERT ok
    expect(await resetDomainSetupRun(99, 'tok-1')).toBe(true);
    expect(String(mockQuery.mock.calls[2][0])).toContain('INSERT INTO analysis_jobs');
  });

  it('loses when a concurrent insert wins the PK race', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);
    mockQuery.mockResolvedValueOnce(sel([])); // absent
    mockQuery.mockRejectedValueOnce(new Error('UNIQUE constraint failed: analysis_jobs.id'));
    expect(await resetDomainSetupRun(99, 'tok-1')).toBe(false);
  });
});

describe('claimJob', () => {
  it('aborts when SELECT-back shows another locker', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]); // UPDATE claim
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', locked_by: 'other' }])); // SELECT-back
    expect(await claimJob('job_x', 'me')).toBe(false);
  });
  it('succeeds when SELECT-back shows our token', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);
    mockQuery.mockResolvedValueOnce(sel([{ status: 'running', locked_by: 'me' }]));
    expect(await claimJob('job_x', 'me')).toBe(true);
  });
});

describe('materializeDomainSetup', () => {
  it('deletes existing rows before inserting, inside a transaction', async () => {
    const tx = {};
    (db.transaction as jest.Mock).mockImplementation(async (cb: (t: unknown) => Promise<void>) => cb(tx));
    mockQuery.mockResolvedValue([[], {}]);
    await materializeDomainSetup(99, { keywords: [{ keyword: 'k', source: 'gsc' }], topics: [], competitors: [], recommendations: [] });
    const sqls = mockQuery.mock.calls.map((c: unknown[]) => String((c as unknown[])[0]));
    const firstInsertIdx = sqls.findIndex((s) => s.includes('INSERT INTO domain_keywords'));
    const deleteIdx = sqls.findIndex((s) => s.includes('DELETE FROM domain_keywords'));
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(firstInsertIdx); // delete before insert
    expect((db.transaction as jest.Mock)).toHaveBeenCalled();
  });

  it('keeps existing page audits when a rerun returns no audited URLs', async () => {
    const tx = {};
    (db.transaction as jest.Mock).mockImplementation(async (cb: (t: unknown) => Promise<void>) => cb(tx));
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT url FROM page_audits')) {
        return [{ url: 'https://example.com/old-post' }];
      }
      return [[], {}];
    });

    await materializeDomainSetup(99, {
      keywords: [],
      topics: [],
      competitors: [],
      recommendations: [],
      page_audits: [],
    });

    const sqls = mockQuery.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s) => s.includes('DELETE FROM page_audits'))).toBe(false);
  });
});
