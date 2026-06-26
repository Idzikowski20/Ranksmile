jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn(async (cb: any) => cb('TX')) },
}));
jest.mock('../../lib/ensureTenancyTables', () => ({ ensureTenancyTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import { ensureUserTenancy, getAccessibleWorkspaceIds, getActiveWorkspaceId, assertArticleAccess } from '../../lib/tenancy';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];
const owner = (extra: any = {}) => rows([{ org_id: 5, role: 'owner', workspace_ids: null, ...extra }]);

describe('ensureUserTenancy', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns the org and runs a no-op migration when nothing is shared/orphaned', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())     // membership
      .mockResolvedValueOnce(rows([]))    // migrate: shared -> none
      .mockResolvedValueOnce(rows([]));   // migrate: orphans -> none
    expect(await ensureUserTenancy('u1')).toEqual({ orgId: 5 });
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO workspaces'))).toBe(false);
  });

  it('splits a legacy multi-domain workspace into one per domain', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                                  // membership
      .mockResolvedValueOnce(rows([{ ws: 9 }]))                        // shared workspaces
      .mockResolvedValueOnce(rows([{ id: 1, domain: 'a.com' }, { id: 2, domain: 'b.com' }])) // domains in ws 9
      .mockResolvedValueOnce(rows([]))                                 // UPDATE rename ws 9 -> a.com
      .mockResolvedValueOnce(rows([]))                                 // INSERT workspace for b.com
      .mockResolvedValueOnce(rows([{ id: 20 }]))                       // SELECT new ws id
      .mockResolvedValueOnce(rows([]))                                 // UPDATE domain 2 -> ws 20
      .mockResolvedValueOnce(rows([]));                                // orphans -> none
    await ensureUserTenancy('u1');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO workspaces'))).toBe(true);
    expect(calls.some((s) => s.includes('UPDATE workspaces SET name'))).toBe(true);
    expect(calls.some((s) => s.includes('UPDATE domain SET workspace_id'))).toBe(true);
  });
});

describe('getAccessibleWorkspaceIds', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns [] for a falsy user', async () => {
    expect(await getAccessibleWorkspaceIds('')).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns ALL org workspaces for an owner', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
    expect(await getAccessibleWorkspaceIds('u1')).toEqual([9, 10]);
  });

  it('restricts a Member to their workspace_ids', async () => {
    const member = () => rows([{ org_id: 5, role: 'member', workspace_ids: '[9]' }]);
    mockQuery
      .mockResolvedValueOnce(member())                // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(member())                // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
    expect(await getAccessibleWorkspaceIds('u1')).toEqual([9]);
  });
});

describe('getActiveWorkspaceId', () => {
  beforeEach(() => mockQuery.mockReset());
  const accessibleOwner = () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([{ id: 9 }, { id: 10 }])); // workspaces
  };

  it('uses a valid cookie', async () => {
    accessibleOwner();
    expect(await getActiveWorkspaceId({ cookies: { active_workspace: '10' } } as any, 'u1')).toBe(10);
  });
  it('falls back to the first accessible workspace', async () => {
    accessibleOwner();
    expect(await getActiveWorkspaceId({ cookies: {} } as any, 'u1')).toBe(9);
  });
  it('returns 0 when the user has no workspaces', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership
      .mockResolvedValueOnce(rows([]));               // workspaces -> none
    expect(await getActiveWorkspaceId({ cookies: {} } as any, 'u1')).toBe(0);
  });
});

describe('assertArticleAccess', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns false for a falsy user', async () => {
    expect(await assertArticleAccess('', 1)).toBe(false);
  });
  it('passes when the article workspace is accessible', async () => {
    mockQuery
      .mockResolvedValueOnce(owner())                 // ensure: membership
      .mockResolvedValueOnce(rows([]))                // ensure: shared
      .mockResolvedValueOnce(rows([]))                // ensure: orphans
      .mockResolvedValueOnce(owner())                 // own membership (getAccessible)
      .mockResolvedValueOnce(rows([{ id: 9 }]))       // workspaces
      .mockResolvedValueOnce(rows([{ ok: 1 }]));      // join hit
    expect(await assertArticleAccess('u1', 123)).toBe(true);
  });
});
