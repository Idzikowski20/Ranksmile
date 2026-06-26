jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/organization', () => ({
  readOrganization: jest.fn().mockResolvedValue({ name: 'Acme', logoUrl: null }),
  writeOrganization: jest.fn(async (_u, p) => ({ name: p.name ?? 'Acme', logoUrl: p.logoUrl ?? null })),
}));
jest.mock('../../lib/uploadToBlob', () => ({
  parseDataUrl: jest.fn(() => ({ buffer: Buffer.from('x'), contentType: 'image/png' })),
  uploadImageBuffer: jest.fn().mockResolvedValue('https://cdn/org-logos/logo.png'),
}));

import handler from '../../pages/api/organization';
import { writeOrganization } from '../../lib/organization';
import { uploadImageBuffer } from '../../lib/uploadToBlob';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); r.setHeader = jest.fn(); return r; };

describe('/api/organization', () => {
  it('GET returns the org profile', async () => {
    const res = makeRes();
    await handler({ method: 'GET', cookies: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ name: 'Acme', logoUrl: null });
  });

  it('PUT uploads a logo data URL to R2 and saves the returned url', async () => {
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, body: { name: 'New', logoDataUrl: 'data:image/png;base64,eA==' } } as any, res);
    expect(uploadImageBuffer).toHaveBeenCalled();
    expect((writeOrganization as jest.Mock).mock.calls[0][1]).toEqual({ name: 'New', logoUrl: 'https://cdn/org-logos/logo.png' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PUT without auth returns 401', async () => {
    const { getCurrentUserId } = require('../../utils/getUser');
    (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
