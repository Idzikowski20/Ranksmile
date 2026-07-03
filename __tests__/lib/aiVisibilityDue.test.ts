jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { findDueConfigIds } from '../../lib/aiVisibilityScan';

describe('findDueConfigIds', () => {
   it('selects configs whose latest completed scan is stale and none active, oldest first, capped', async () => {
      let captured = '';
      const run = async (sql: string) => { captured = sql; return [{ id: 3 }, { id: 7 }]; };
      const ids = await findDueConfigIds(5, run);
      expect(ids).toEqual([3, 7]);
      expect(captured).toMatch(/status\s*=\s*'completed'/i);        // considers completed scans
      expect(captured).toMatch(/finished_at/i);                      // cadence measured on finished_at
      expect(captured).toMatch(/IN\s*\(\s*'queued'\s*,\s*'running'\s*\)/i); // excludes active
      expect(captured).toMatch(/ORDER BY[\s\S]*last_done ASC/i);     // oldest first
      expect(captured).toMatch(/LIMIT\s+5/i);                        // batch cap
   });
});
