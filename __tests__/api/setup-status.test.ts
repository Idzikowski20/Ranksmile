jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/tenancy', () => ({ getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([5]) }));
jest.mock('../../database/database', () => ({
   __esModule: true,
   default: { query: jest.fn() },
}));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('../../lib/domainPipeline', () => ({
   getSetupStatus: jest.fn().mockResolvedValue({
      status: 'running',
      currentStage: 'gsc',
      stagePercent: 50,
      stages: { gsc: 'running', keywords: 'pending', topics: 'pending', competitors: 'pending', recommendations: 'pending' },
      error: null,
   }),
}));

import { getCurrentUserId } from '../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import db from '../../database/database';
import { getSetupStatus } from '../../lib/domainPipeline';
import handler from '../../pages/api/domains/[id]/setup-status';

const mockQuery = db.query as jest.Mock;

const makeRes = () => {
   const r: Record<string, jest.Mock> = {};
   r.status = jest.fn().mockReturnValue(r);
   r.json = jest.fn().mockReturnValue(r);
   r.setHeader = jest.fn();
   return r;
};

beforeEach(() => {
   jest.clearAllMocks();
   (getCurrentUserId as jest.Mock).mockResolvedValue('u1');
   (getAccessibleWorkspaceIds as jest.Mock).mockResolvedValue([5]);
   // domain row with workspace_id = 5 (accessible)
   mockQuery.mockResolvedValue([{ workspace_id: 5 }]);
});

describe('GET /api/domains/[id]/setup-status', () => {
   it('returns 401 when not authenticated', async () => {
      (getCurrentUserId as jest.Mock).mockResolvedValue(null);
      const res = makeRes();
      await handler({ method: 'GET', cookies: {}, query: { id: '42' } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(401);
   });

   it('returns 405 for non-GET methods', async () => {
      const res = makeRes();
      await handler({ method: 'POST', cookies: {}, query: { id: '42' } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
   });

   it('returns 404 when domain workspace is not accessible', async () => {
      // domain belongs to workspace_id = 99, not in accessible list [5]
      mockQuery.mockResolvedValue([{ workspace_id: 99 }]);
      const res = makeRes();
      await handler({ method: 'GET', cookies: {}, query: { id: '42' } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(404);
   });

   it('returns 404 when domain row not found', async () => {
      mockQuery.mockResolvedValue([]);
      const res = makeRes();
      await handler({ method: 'GET', cookies: {}, query: { id: '42' } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(404);
   });

   it('returns 200 with status object for accessible domain', async () => {
      const res = makeRes();
      await handler({ method: 'GET', cookies: {}, query: { id: '42' } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(getSetupStatus).toHaveBeenCalledWith(42);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'running', currentStage: 'gsc' }));
   });
});
