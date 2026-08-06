import type { NextApiRequest } from 'next';
import { makeRes, callHandler, type MockRes } from '../../test-utils/apiHandler';
import { assertCanManage } from '../../lib/members';
import { writeOrganization } from '../../lib/organization';
import handler from '../../pages/api/organization';

jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/members', () => ({ assertCanManage: jest.fn() }));
jest.mock('../../lib/organization', () => ({
  readOrganization: jest.fn().mockResolvedValue({ name: 'Acme', logoUrl: null }),
  writeOrganization: jest.fn().mockResolvedValue({ name: 'Renamed', logoUrl: null }),
}));
jest.mock('../../lib/uploadToBlob', () => ({ parseDataUrl: jest.fn(), uploadImageBuffer: jest.fn() }));
jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));

const mockAssert = assertCanManage as jest.Mock;
const mockWrite = writeOrganization as jest.Mock;

// withOrgPaymentAccess is mocked to a pass-through, so the default export is the raw handler.
const call = (req: Partial<NextApiRequest>, res: MockRes) => callHandler(handler, req, res);

beforeEach(() => {
  mockAssert.mockReset();
  mockWrite.mockClear();
});

describe('PUT /api/organization role guard', () => {
  it('rejects a plain member with 403 and never writes', async () => {
    mockAssert.mockRejectedValue(new Error('FORBIDDEN'));
    const res = makeRes();
    await call({ method: 'PUT', body: { name: 'Renamed' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('lets an owner/admin through to the write', async () => {
    mockAssert.mockResolvedValue(undefined);
    const res = makeRes();
    await call({ method: 'PUT', body: { name: 'Renamed' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockWrite).toHaveBeenCalledWith('u1', { name: 'Renamed' });
  });

  it('leaves GET open to every member', async () => {
    mockAssert.mockRejectedValue(new Error('FORBIDDEN'));
    const res = makeRes();
    await call({ method: 'GET' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockAssert).not.toHaveBeenCalled();
  });

  it('does not turn a database failure into 403', async () => {
    // The role lookup queries the DB — reporting an outage as "Forbidden" would send
    // people hunting for a permission they already have.
    mockAssert.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = makeRes();
    await expect(call({ method: 'PUT', body: { name: 'Renamed' } }, res)).rejects.toThrow('ECONNREFUSED');
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
