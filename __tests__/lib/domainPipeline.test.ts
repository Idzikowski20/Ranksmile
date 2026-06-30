jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), transaction: jest.fn() } }));
jest.mock('../../lib/ensurePipelineTables', () => ({ ensurePipelineTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('../../database/models/gscAccount', () => ({ __esModule: true, default: { findAll: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../lib/gscAccounts', () => ({ buildOAuthClientFromAccount: jest.fn() }));
jest.mock('@googleapis/searchconsole', () => ({ searchconsole_v1: { Searchconsole: jest.fn() } }));
import db from '../../database/database';
import { deriveStages, enqueueDomainSetup, claimJob, materializeDomainSetup } from '../../lib/domainPipeline';
const mockQuery = db.query as jest.Mock;
const sel = (r: unknown[]) => r;            // SELECT returns rows directly
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
    const id = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
    expect(mockQuery.mock.calls.every((c: unknown[]) => !String((c as unknown[])[0]).includes('INSERT INTO analysis_jobs'))).toBe(true);
  });
  it('inserts a queued job under the deterministic id when none exists', async () => {
    mockQuery.mockResolvedValueOnce(sel([])); // lookup → none
    mockQuery.mockResolvedValueOnce([[], {}]); // INSERT
    const id = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
    expect(String(mockQuery.mock.calls[1][0])).toContain('INSERT INTO analysis_jobs');
  });
  it('swallows a PK-collision INSERT (concurrent enqueue) and still returns the id', async () => {
    mockQuery.mockResolvedValueOnce(sel([]));               // lookup → none
    mockQuery.mockRejectedValueOnce(new Error('UNIQUE constraint failed: analysis_jobs.id')); // INSERT loses race
    const id = await enqueueDomainSetup(99);
    expect(id).toBe('dsetup_99');
  });
  it('re-throws a genuine (non-collision) INSERT error instead of masking it', async () => {
    mockQuery.mockResolvedValueOnce(sel([]));               // lookup → none
    mockQuery.mockRejectedValueOnce(new Error('permission denied for table analysis_jobs'));
    await expect(enqueueDomainSetup(99)).rejects.toThrow('permission denied');
  });
});

describe('claimJob', () => {
  it('aborts when SELECT-back shows another locker', async () => {
    mockQuery.mockResolvedValueOnce([[], {}]);                              // UPDATE claim
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
    (db.transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => cb(tx));
    mockQuery.mockResolvedValue([[], {}]);
    await materializeDomainSetup(99, { keywords: [{ keyword: 'k', source: 'gsc' }], topics: [], competitors: [], recommendations: [] });
    const sqls = mockQuery.mock.calls.map((c: unknown[]) => String((c as unknown[])[0]));
    const firstInsertIdx = sqls.findIndex((s) => s.includes('INSERT INTO domain_keywords'));
    const deleteIdx = sqls.findIndex((s) => s.includes('DELETE FROM domain_keywords'));
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(firstInsertIdx); // delete before insert
    expect((db.transaction as jest.Mock)).toHaveBeenCalled();
  });
});
