jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5 }) }));
import db from '../../database/database';
import { listWorkspaceAccess, setWorkspaceAccess } from '../../lib/workspaceMembers';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];
const updateCalls = () => mockQuery.mock.calls.filter((c) => String(c[0]).includes('UPDATE organization_members'));

describe('listWorkspaceAccess', () => {
  beforeEach(() => mockQuery.mockReset());

  it('marks owner/admin hasAccess=true regardless of workspace_ids; honors member sets', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));        // assertCanManage -> getCallerRole
    mockQuery.mockResolvedValueOnce(rows([{ id: 3 }]));                // assertInOrg
    mockQuery.mockResolvedValueOnce(rows([                            // members
      { id: 1, email: 'o@x', role: 'owner', workspace_ids: '[99]' },   // owner with a restricted-looking set -> still true
      { id: 2, email: 'a@x', role: 'admin', workspace_ids: '[99]' },   // admin -> still true
      { id: 3, email: 'm@x', role: 'member', workspace_ids: '[3]' },   // has 3
      { id: 4, email: 'n@x', role: 'member', workspace_ids: null },    // NULL -> all
    ]));
    const out = await listWorkspaceAccess('caller', 3);
    expect(out.find((m) => m.id === 1)!.hasAccess).toBe(true);
    expect(out.find((m) => m.id === 2)!.hasAccess).toBe(true);
    expect(out.find((m) => m.id === 3)!.hasAccess).toBe(true);   // member with [3] accesses ws 3
    expect(out.find((m) => m.id === 4)!.hasAccess).toBe(true);   // NULL = all
  });

  it('member with workspace_ids [3] has access to ws 3 but not ws 5', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));        // assertCanManage
    mockQuery.mockResolvedValueOnce(rows([{ id: 5 }]));                // assertInOrg
    mockQuery.mockResolvedValueOnce(rows([{ id: 3, email: 'm@x', role: 'member', workspace_ids: '[3]' }]));
    const out = await listWorkspaceAccess('caller', 5);
    expect(out[0].hasAccess).toBe(false);
  });
});

describe('setWorkspaceAccess', () => {
  beforeEach(() => mockQuery.mockReset());

  it('granting adds the workspace id to the member set', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));        // assertCanManage
    mockQuery.mockResolvedValueOnce(rows([{ id: 3 }]));                // assertInOrg
    mockQuery.mockResolvedValueOnce(rows([{ id: 7, role: 'member', workspace_ids: '[1]' }])); // members
    mockQuery.mockResolvedValueOnce(rows([{ id: 1 }, { id: 2 }, { id: 3 }]));                 // ready workspaces
    mockQuery.mockResolvedValueOnce(rows([]));                         // UPDATE
    await setWorkspaceAccess('caller', 3, [7]);
    const upd = updateCalls();
    expect(upd).toHaveLength(1);
    expect(JSON.parse(upd[0][1].replacements[0])).toEqual([1, 3]);
    expect(upd[0][1].replacements.slice(1)).toEqual([7, 5]);
  });

  it('revoking from a NULL (all) member materializes to all-except', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'owner' }]));        // assertCanManage
    mockQuery.mockResolvedValueOnce(rows([{ id: 3 }]));                // assertInOrg
    mockQuery.mockResolvedValueOnce(rows([{ id: 9, role: 'member', workspace_ids: null }])); // members (NULL = all)
    mockQuery.mockResolvedValueOnce(rows([{ id: 1 }, { id: 2 }, { id: 3 }]));                 // ready workspaces
    mockQuery.mockResolvedValueOnce(rows([]));                         // UPDATE
    await setWorkspaceAccess('caller', 3, []);                         // member 9 not in the grant list -> revoke ws 3
    const upd = updateCalls();
    expect(upd).toHaveLength(1);
    expect(JSON.parse(upd[0][1].replacements[0])).toEqual([1, 2]);     // all ready except 3
  });

  it('owners/admins are never written', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ role: 'admin' }]));        // assertCanManage
    mockQuery.mockResolvedValueOnce(rows([{ id: 3 }]));                // assertInOrg
    mockQuery.mockResolvedValueOnce(rows([
      { id: 1, role: 'owner', workspace_ids: null },
      { id: 2, role: 'admin', workspace_ids: '[1]' },
    ]));
    mockQuery.mockResolvedValueOnce(rows([{ id: 1 }, { id: 3 }]));     // ready workspaces
    await setWorkspaceAccess('caller', 3, [1, 2]);
    expect(updateCalls()).toHaveLength(0);
  });
});
