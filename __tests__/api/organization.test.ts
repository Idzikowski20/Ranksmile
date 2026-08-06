import type { NextApiRequest, NextApiResponse } from 'next';
import { writeOrganization } from '../../lib/organization';
import { uploadImageBuffer } from '../../lib/uploadToBlob';
import { getCurrentUserId } from '../../utils/getUser';
import handler from '../../pages/api/organization';

jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/organization', () => ({
  readOrganization: jest.fn().mockResolvedValue({ name: 'Acme', logoUrl: null }),
  writeOrganization: jest.fn(
    (_userId: string, patch: { name?: string; logoUrl?: string | null }) => Promise.resolve({
      name: patch.name ?? 'Acme',
      logoUrl: patch.logoUrl ?? null,
    }),
  ),
}));
jest.mock('../../lib/uploadToBlob', () => ({
  parseDataUrl: jest.fn(() => ({ buffer: Buffer.from('x'), contentType: 'image/png' })),
  uploadImageBuffer: jest.fn().mockResolvedValue('https://cdn/org-logos/logo.png'),
}));
// PUT is owner/admin-only; these cases cover the request contract, not authz
// (see organization-role-guard.test.ts for the role checks).
jest.mock('../../lib/members', () => ({ assertCanManage: jest.fn().mockResolvedValue(undefined) }));
// The access-policy wrapper has its own coverage; here it would only drag the real
// tenancy + billing lookups into what is a handler unit test.
jest.mock('../../lib/requireOrgPaymentAccess', () => ({ withOrgPaymentAccess: (h: unknown) => h }));

const mockWrite = writeOrganization as jest.Mock;
const mockUpload = uploadImageBuffer as jest.Mock;
const mockUserId = getCurrentUserId as jest.Mock;

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

const call = (req: Partial<NextApiRequest>, res: Record<string, jest.Mock>) => handler(
  { headers: {}, cookies: {}, ...req } as NextApiRequest,
  res as unknown as NextApiResponse,
);

beforeEach(() => {
  mockWrite.mockClear();
  mockUpload.mockClear();
});

describe('/api/organization', () => {
  it('GET returns the org profile', async () => {
    const res = makeRes();
    await call({ method: 'GET' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ name: 'Acme', logoUrl: null });
  });

  it('PUT uploads a logo data URL to R2 and saves the returned url', async () => {
    const res = makeRes();
    await call({ method: 'PUT', body: { name: 'New', logoDataUrl: 'data:image/png;base64,eA==' } }, res);
    expect(mockUpload).toHaveBeenCalled();
    expect(mockWrite.mock.calls[0][1]).toEqual({ name: 'New', logoUrl: 'https://cdn/org-logos/logo.png' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PUT without auth returns 401', async () => {
    mockUserId.mockResolvedValueOnce(null);
    const res = makeRes();
    await call({ method: 'PUT', body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('PUT trims the name and leaves the logo untouched when none is sent', async () => {
    const res = makeRes();
    await call({ method: 'PUT', body: { name: '  Acme Marketing  ' } }, res);
    expect(mockWrite.mock.calls[0][1]).toEqual({ name: 'Acme Marketing' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('PUT rejects a blank name instead of storing it', async () => {
    const res = makeRes();
    await call({ method: 'PUT', body: { name: '   ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('PUT clears the logo when logoDataUrl is null', async () => {
    const res = makeRes();
    await call({ method: 'PUT', body: { name: 'Acme', logoDataUrl: null } }, res);
    expect(mockWrite.mock.calls[0][1]).toEqual({ name: 'Acme', logoUrl: null });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PUT caps an over-long name at the shared limit', async () => {
    const res = makeRes();
    await call({ method: 'PUT', body: { name: 'x'.repeat(200) } }, res);
    expect((mockWrite.mock.calls[0][1] as { name: string }).name).toHaveLength(80);
  });

  it('rejects methods other than GET and PUT', async () => {
    const res = makeRes();
    await call({ method: 'DELETE' }, res);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, PUT');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
