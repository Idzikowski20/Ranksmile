jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({ verifyDomainOwnershipBySlug: jest.fn().mockResolvedValue({ ID: 42 }) }));
jest.mock('../../lib/domainPipeline', () => ({
   getSetupStatus: jest.fn().mockResolvedValue({
      status: 'running',
      currentStage: 'gsc',
      stagePercent: 50,
      stages: { gsc: 'running', keywords: 'pending', topics: 'pending', competitors: 'pending', recommendations: 'pending' },
      error: null,
   }),
}));

import verifyUser from '../../utils/verifyUser';
import { verifyDomainOwnershipBySlug } from '../../utils/verifyDomainOwnership';
import { getSetupStatus } from '../../lib/domainPipeline';
import handler from '../../pages/api/domains/[slug]/setup-status';

const makeRes = () => {
   const r: Record<string, jest.Mock> = {};
   r.status = jest.fn().mockReturnValue(r);
   r.json = jest.fn().mockReturnValue(r);
   r.setHeader = jest.fn();
   return r;
};
const req = (method: string) => ({ method, cookies: {}, query: { slug: 'example-com' } } as never);

beforeEach(() => {
   jest.clearAllMocks();
   (verifyUser as jest.Mock).mockResolvedValue('authorized');
   (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue({ ID: 42 });
});

describe('GET /api/domains/[slug]/setup-status', () => {
   it('returns 401 when not authenticated', async () => {
      (verifyUser as jest.Mock).mockResolvedValue('not authorized');
      const res = makeRes();
      await handler(req('GET'), res as never);
      expect(res.status).toHaveBeenCalledWith(401);
   });

   it('returns 405 for non-GET methods', async () => {
      const res = makeRes();
      await handler(req('POST'), res as never);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
   });

   it('returns 403 when the domain is not accessible', async () => {
      (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue(false);
      const res = makeRes();
      await handler(req('GET'), res as never);
      expect(res.status).toHaveBeenCalledWith(403);
   });

   it('returns 404 when the domain is not found', async () => {
      (verifyDomainOwnershipBySlug as jest.Mock).mockResolvedValue(null);
      const res = makeRes();
      await handler(req('GET'), res as never);
      expect(res.status).toHaveBeenCalledWith(404);
   });

   it('returns 200 with the status object for an accessible domain', async () => {
      const res = makeRes();
      await handler(req('GET'), res as never);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(getSetupStatus).toHaveBeenCalledWith(42);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'running', currentStage: 'gsc' }));
   });
});
