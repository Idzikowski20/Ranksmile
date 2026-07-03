// The module imports database/database (sequelize-typescript) at load time, which
// can't initialise under jsdom. claimScan is pure (takes an exec stub), so stub the db.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { claimScan } from '../../lib/aiVisibilityScan';

describe('claimScan', () => {
   it('returns true only when the UPDATE changed a row', async () => {
      const hits: string[] = [];
      const execOnce = async (sql: string) => { hits.push(sql); return [[], 1] as [unknown[], number]; };
      const execNone = async () => [[], 0] as [unknown[], number];
      expect(await claimScan(7, execOnce)).toBe(true);
      expect(hits[0]).toMatch(/status\s*=\s*'running'/i);
      expect(hits[0]).toMatch(/status\s*=\s*'queued'/i);
      expect(await claimScan(7, execNone)).toBe(false);
   });
});
