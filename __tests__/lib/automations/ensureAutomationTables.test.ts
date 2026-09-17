import db from '@/database/database';
import { ensureAutomationTables } from '@/src/infrastructure/persistence/schema/ensureAutomationTables';

jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

const mockQuery = db.query as jest.Mock;

it('retries after a real schema failure, and indexes the article-status lookup', async () => {
  mockQuery.mockRejectedValueOnce(new Error('connection reset'));
  await expect(ensureAutomationTables()).rejects.toThrow('connection reset');

  mockQuery.mockResolvedValue([[], 0]);
  await ensureAutomationTables();
  const sql = mockQuery.mock.calls.map((c) => String(c[0])).join('\n');
  expect(sql).toContain('ON automation_events (article_id, status)');
  expect(sql).toContain('ADD COLUMN time_zone');

  mockQuery.mockClear();
  await ensureAutomationTables();
  expect(mockQuery).not.toHaveBeenCalled(); // ready is cached only after success
});
