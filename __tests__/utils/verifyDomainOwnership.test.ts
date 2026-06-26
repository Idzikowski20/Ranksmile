// Local sequelize mock — the helper imports { Op } at runtime, which pulls real
// sequelize (ESM uuid dep) and crashes Jest. String-keyed Op also lets
// JSON.stringify serialise the WHERE clause for the assertion below. Kept local
// (not a root __mocks__/ auto-mock) so it can't affect unrelated suites.
jest.mock('sequelize', () => ({ Op: { in: 'Op.in', notIn: 'Op.notIn' } }));
jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn(),
}));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { verifyDomainOwnership, verifyDomainOwnershipById, firstAccessibleDomainId } from '../../utils/verifyDomainOwnership';

const findOne = Domain.findOne as jest.Mock;
const accessible = getAccessibleWorkspaceIds as jest.Mock;

describe('verifyDomainOwnership (workspace-scoped)', () => {
  beforeEach(() => { findOne.mockReset(); accessible.mockReset(); });

  it('returns null when the domain does not exist', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null)   // workspace-filtered lookup misses
           .mockResolvedValueOnce(null);  // existence check misses
    expect(await verifyDomainOwnership('x.com', 'u1')).toBeNull();
  });

  it('returns false when the domain exists but its workspace is not accessible', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null)        // filtered lookup misses
           .mockResolvedValueOnce({ ID: 1 });  // existence check hits
    expect(await verifyDomainOwnership('x.com', 'u1')).toBe(false);
  });

  it('returns the domain when its workspace is accessible (single query)', async () => {
    accessible.mockResolvedValue([5, 6]);
    const rec = { ID: 1, workspace_id: 6 };
    findOne.mockResolvedValueOnce(rec);
    expect(await verifyDomainOwnership('x.com', 'u1')).toBe(rec);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('carries the accessible workspace ids in the query WHERE clause', async () => {
    accessible.mockResolvedValue([6]);
    findOne.mockResolvedValueOnce({ ID: 1 });
    await verifyDomainOwnership('x.com', 'u1');
    expect(JSON.stringify(findOne.mock.calls[0][0].where)).toContain('6');
  });
});

describe('verifyDomainOwnershipById (workspace-scoped)', () => {
  beforeEach(() => { findOne.mockReset(); accessible.mockReset(); });

  it('returns the domain when its workspace is accessible (single query)', async () => {
    accessible.mockResolvedValue([5, 6]);
    const rec = { ID: 7, workspace_id: 6 };
    findOne.mockResolvedValueOnce(rec);
    expect(await verifyDomainOwnershipById(7, 'u1')).toBe(rec);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(findOne.mock.calls[0][0].where)).toContain('"ID":7');
  });

  it('returns false when the domain exists but its workspace is not accessible', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null)        // filtered lookup misses
           .mockResolvedValueOnce({ ID: 7 });  // existence check hits
    expect(await verifyDomainOwnershipById(7, 'u1')).toBe(false);
  });

  it('returns null when the domain does not exist', async () => {
    accessible.mockResolvedValue([5]);
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect(await verifyDomainOwnershipById(7, 'u1')).toBeNull();
  });
});

describe('firstAccessibleDomainId', () => {
  beforeEach(() => { findOne.mockReset(); accessible.mockReset(); });

  it('returns the id of the caller\'s first accessible domain', async () => {
    accessible.mockResolvedValue([5, 6]);
    findOne.mockResolvedValueOnce({ ID: 3 });
    expect(await firstAccessibleDomainId('u1')).toBe(3);
    expect(JSON.stringify(findOne.mock.calls[0][0].where)).toContain('6');
  });

  it('returns null when the caller can reach no domain', async () => {
    accessible.mockResolvedValue([]);
    findOne.mockResolvedValueOnce(null);
    expect(await firstAccessibleDomainId('u1')).toBeNull();
  });
});
