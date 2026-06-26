jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }) }));

import db from '../../database/database';
import { readOrganization, writeOrganization } from '../../lib/organization';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('organization helpers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('readOrganization returns name + logoUrl for the caller org', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ name: 'Acme', logo_url: 'https://cdn/x.png' }]));
    expect(await readOrganization('u1')).toEqual({ name: 'Acme', logoUrl: 'https://cdn/x.png' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM organizations');
  });

  it('writeOrganization updates only provided fields and returns the fresh record', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                                  // UPDATE
      .mockResolvedValueOnce(rows([{ name: 'New', logo_url: null }]));  // re-read
    const res = await writeOrganization('u1', { name: 'New' });
    expect(res).toEqual({ name: 'New', logoUrl: null });
    expect(String(mockQuery.mock.calls[0][0])).toContain('UPDATE organizations SET name = ?');
  });
});
