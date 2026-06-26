jest.mock('sequelize', () => ({ Op: { in: 'Op.in' } }));
jest.mock('../../utils/verifyDomainOwnership', () => ({
  verifyDomainOwnership: jest.fn(),
}));
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), sync: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../database/models/keyword', () => {
  const findAll = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const destroy = jest.fn();
  const bulkCreate = jest.fn();
  return { __esModule: true, default: { findAll, findOne, update, destroy, bulkCreate } };
});
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('user-1') }));
jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/parseKeywords', () => ({ __esModule: true, default: jest.fn().mockReturnValue([]) }));
jest.mock('../../utils/searchConsole', () => ({ integrateKeywordSCData: jest.fn(), readLocalSCData: jest.fn() }));
jest.mock('../../utils/refresh', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../utils/adwords', () => ({ getKeywordsVolume: jest.fn(), updateKeywordsVolumeData: jest.fn(), getAdwordsCredentials: jest.fn() }));
jest.mock('../../utils/scraper', () => ({ removeFromRetryQueue: jest.fn() }));
jest.mock('./settings', () => ({ getAppSettings: jest.fn().mockResolvedValue({}) }), { virtual: true });
jest.mock('../../pages/api/settings', () => ({ getAppSettings: jest.fn().mockResolvedValue({}) }));

import Keyword from '../../database/models/keyword';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
import { userOwnsAllKeywords } from '../../pages/api/keywords';

const mockFindAll = Keyword.findAll as jest.Mock;
const mockVerify = verifyDomainOwnership as jest.Mock;

describe('userOwnsAllKeywords', () => {
  beforeEach(() => {
    mockFindAll.mockReset();
    mockVerify.mockReset();
  });

  it('returns false when any domain is denied', async () => {
    mockFindAll.mockResolvedValue([
      { domain: 'own.com' },
      { domain: 'victim.com' },
    ]);
    mockVerify.mockImplementation((_domain: string, _userId: string) => {
      if (_domain === 'victim.com') return Promise.resolve(false);
      return Promise.resolve({ ID: 1 });
    });

    const result = await userOwnsAllKeywords([1, 2], 'user-1');
    expect(result).toBe(false);
    // Keyword.update must NOT have been called (caller checks before update)
    expect(Keyword.update).not.toHaveBeenCalled();
  });

  it('returns true when all domains are owned', async () => {
    mockFindAll.mockResolvedValue([{ domain: 'own.com' }]);
    mockVerify.mockResolvedValue({ ID: 1 });

    const result = await userOwnsAllKeywords([1], 'user-1');
    expect(result).toBe(true);
  });

  it('returns false for empty ids array', async () => {
    const result = await userOwnsAllKeywords([], 'user-1');
    expect(result).toBe(false);
    expect(mockFindAll).not.toHaveBeenCalled();
  });
});
