jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[], {}]) } }));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
import db from '../../database/database';
import { ensurePipelineTables } from '../../lib/ensurePipelineTables';
const mockQuery = db.query as jest.Mock;

describe('ensurePipelineTables', () => {
  beforeEach(() => mockQuery.mockClear());
  it('creates the five domain tables and alters analysis_jobs', async () => {
    await ensurePipelineTables();
    const sql = mockQuery.mock.calls.map((c: unknown[]) => String((c as unknown[])[0])).join('\n');
    for (const t of ['domain_gsc_pages', 'domain_keywords', 'domain_topics', 'domain_competitors', 'domain_recommendations']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
    expect(sql).toContain('ALTER TABLE analysis_jobs ADD COLUMN domain_id');
    expect(sql).toContain('ALTER TABLE analysis_jobs ADD COLUMN metadata');
  });
});
