jest.mock('../../database/models/domain', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock('../../lib/tenancy', () => ({
  getAccessibleWorkspaceIds: jest.fn(),
}));

import Domain from '../../database/models/domain';
import { getAccessibleWorkspaceIds } from '../../lib/tenancy';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';

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
