import type { NextApiRequest, NextApiResponse } from 'next';
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

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

// withOrgPaymentAccess is mocked to a pass-through, so the default export is the raw handler.
const call = (req: Partial<NextApiRequest>, res: Record<string, jest.Mock>) => handler(
  req as NextApiRequest,
  res as unknown as NextApiResponse,
);

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
});
