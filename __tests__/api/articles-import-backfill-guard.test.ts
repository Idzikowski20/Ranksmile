jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT' } }));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('intruder') }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
   verifyDomainOwnershipById: jest.fn(),
   firstAccessibleDomainId: jest.fn(),
}));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));
jest.mock('../../utils/searchConsole', () => ({ readLocalSCData: jest.fn() }));
jest.mock('../../utils/gsc', () => ({
   kwScore: jest.fn(),
   normalizeUrlForMatch: jest.fn((url: string) => url),
}));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock('../../lib/uploadToBlob', () => ({ uploadImageFromUrl: jest.fn() }));
jest.mock('../../utils/spaScraper', () => ({ renderPage: jest.fn() }));
jest.mock('../../lib/ssrfGuard', () => ({ assertPublicUrl: jest.fn().mockResolvedValue(new URL('https://safe.example/post')) }));

import db from '../../database/database';
import backfillHandler from '../../pages/api/articles/backfill';
import importHandler from '../../pages/api/articles/import';
import { firstAccessibleDomainId, verifyDomainOwnershipById } from '../../utils/verifyDomainOwnership';
import { assertPublicUrl } from '../../lib/ssrfGuard';

const mockAssertPublicUrl = assertPublicUrl as jest.MockedFunction<typeof assertPublicUrl>;

const makeRes = () => {
   const res: any = {};
   res.status = jest.fn().mockReturnValue(res);
   res.json = jest.fn().mockReturnValue(res);
   return res;
};

describe('article import/backfill domain guards', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockAssertPublicUrl.mockResolvedValue(new URL('https://safe.example/post'));
      global.fetch = jest.fn() as unknown as typeof fetch;
   });

   it('denies backfill for a domain outside the caller workspace before mutating rows', async () => {
      (verifyDomainOwnershipById as jest.Mock).mockResolvedValue(false);
      const res = makeRes();

      await backfillHandler({ method: 'POST', body: { domainId: 77 } } as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(db.query).not.toHaveBeenCalled();
   });

   it('denies URL import for a domain outside the caller workspace before fetching or inserting', async () => {
      (verifyDomainOwnershipById as jest.Mock).mockResolvedValue(false);
      const res = makeRes();

      await importHandler({ method: 'POST', body: { url: 'https://victim.example/post', domainId: 77 } } as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
   });

   it('does not fall back to a global first domain when importing without an accessible domain', async () => {
      (firstAccessibleDomainId as jest.Mock).mockResolvedValue(null);
      const res = makeRes();

      await importHandler({ method: 'POST', body: { url: 'https://victim.example/post' } } as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
   });

   it('blocks private import URLs before fetching or inserting', async () => {
      (verifyDomainOwnershipById as jest.Mock).mockResolvedValue({ ID: 77 });
      mockAssertPublicUrl.mockRejectedValueOnce(new Error('Blocked private address'));
      const res = makeRes();

      await importHandler({ method: 'POST', body: { url: 'http://169.254.169.254/latest/meta-data/', domainId: 77 } } as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
   });
});
