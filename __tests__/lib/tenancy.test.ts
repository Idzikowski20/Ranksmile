jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), transaction: jest.fn(async (cb: any) => cb('TX')) },
}));
jest.mock('../../lib/ensureTenancyTables', () => ({
  ensureTenancyTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('id') }));

import db from '../../database/database';
import { ensureUserTenancy, getAccessibleWorkspaceIds, getActiveWorkspaceId, assertArticleAccess } from '../../lib/tenancy';

const mockQuery = db.query as jest.Mock;
const mockTx = (db as any).transaction as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('ensureUserTenancy', () => {
  beforeEach(() => { mockQuery.mockReset(); mockTx.mockClear(); });

  it('returns existing org/workspace without creating anything when a membership exists', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 7 }]))      // SELECT membership
      .mockResolvedValueOnce(rows([{ id: 12 }]));        // SELECT default workspace
    const res = await ensureUserTenancy('user-a');
    expect(res).toEqual({ orgId: 7, defaultWorkspaceId: 12 });
    const sql = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sql.some((s) => s.includes('INSERT INTO organizations'))).toBe(false);
  });

  it('provisions org, workspace, owner membership and claims the user own domains', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // SELECT membership -> none
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT organizations
      .mockResolvedValueOnce(rows([{ id: 3 }]))          // [tx] SELECT org back
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT workspaces
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT membership
      .mockResolvedValueOnce(rows([{ id: 9 }]))          // [tx] SELECT workspace back (claim)
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE domain (claim own)
      .mockResolvedValueOnce(rows([{ org_id: 3 }]))      // re-read membership (authoritative)
      .mockResolvedValueOnce(rows([{ id: 9 }]));         // SELECT default workspace
    const res = await ensureUserTenancy('user-b');
    expect(res).toEqual({ orgId: 3, defaultWorkspaceId: 9 });
    expect(mockTx).toHaveBeenCalledTimes(1);
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    const idx = (sub: string) => calls.findIndex((s) => s.includes(sub));
    expect(idx('INSERT INTO organizations')).toBeGreaterThanOrEqual(0);
    expect(idx('INSERT INTO organizations')).toBeLessThan(idx('INSERT INTO workspaces'));
    expect(idx('INSERT INTO workspaces')).toBeLessThan(idx('INSERT INTO organization_members'));
    expect(calls.some((s) => s.includes('UPDATE domain SET workspace_id') && s.includes('"userId" = ?'))).toBe(true);
  });

  it('falls back to the winner org when the provisioning insert conflicts (race)', async () => {
    mockTx.mockImplementationOnce(async () => { throw new Error('UNIQUE constraint failed: organizations.owner_user_id'); });
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // SELECT membership -> none
      .mockResolvedValueOnce(rows([{ org_id: 42 }]))     // re-read membership -> winner exists
      .mockResolvedValueOnce(rows([{ id: 77 }]));        // SELECT default workspace
    const res = await ensureUserTenancy('user-race');
    expect(res).toEqual({ orgId: 42, defaultWorkspaceId: 77 });
  });

  it('claims legacy (userId NULL) domains only for the configured owner', async () => {
    process.env.TENANCY_OWNER_USER_ID = 'owner-1';
    mockQuery
      .mockResolvedValueOnce(rows([]))                   // membership none
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT org
      .mockResolvedValueOnce(rows([{ id: 1 }]))          // [tx] org back
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT workspace
      .mockResolvedValueOnce(rows([]))                   // [tx] INSERT membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // [tx] workspace back
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE own domains
      .mockResolvedValueOnce(rows([]))                   // [tx] UPDATE legacy domains
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // re-read membership
      .mockResolvedValueOnce(rows([{ id: 2 }]));         // SELECT default ws
    await ensureUserTenancy('owner-1');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('"userId" IS NULL'))).toBe(true);
  });
});

describe('getAccessibleWorkspaceIds', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns [] for a falsy user without provisioning', async () => {
    const res = await getAccessibleWorkspaceIds('');
    expect(res).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('maps the SELECT rows to numeric workspace ids', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 5 }]))      // ensureUserTenancy: membership
      .mockResolvedValueOnce(rows([{ id: 8 }]))          // ensureUserTenancy: default ws
      .mockResolvedValueOnce(rows([{ id: 8 }, { id: 9 }])); // accessible ws
    const res = await getAccessibleWorkspaceIds('user-c');
    expect(res).toEqual([8, 9]);
  });
});

describe('getActiveWorkspaceId', () => {
  beforeEach(() => mockQuery.mockReset());
  it('falls back to the default workspace when no cookie is set', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // membership
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // default ws
    const req = { cookies: {} } as any;
    expect(await getActiveWorkspaceId(req, 'user-d')).toBe(4);
  });
  it('rejects a cookie pointing at a non-accessible workspace', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]))          // default ws
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // getAccessible: ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]))          // getAccessible: default ws
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // getAccessible: accessible ws -> [4]
    const req = { cookies: { active_workspace: '999' } } as any;
    expect(await getActiveWorkspaceId(req, 'user-e')).toBe(4);
  });
  it('ignores a non-positive / non-integer cookie value and uses the default', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 4 }]));         // default ws
    const req = { cookies: { active_workspace: '-1' } } as any;
    expect(await getActiveWorkspaceId(req, 'user-f')).toBe(4);
  });
});

describe('assertArticleAccess', () => {
  beforeEach(() => mockQuery.mockReset());
  it('returns false for a falsy user without querying', async () => {
    expect(await assertArticleAccess('', 1)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('returns true when the article workspace is accessible', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // default ws
      .mockResolvedValueOnce(rows([{ ok: 1 }]));         // join hit
    expect(await assertArticleAccess('u1', 123)).toBe(true);
  });
  it('returns false when the join finds no accessible article', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ org_id: 1 }]))      // ensureUserTenancy membership
      .mockResolvedValueOnce(rows([{ id: 2 }]))          // default ws
      .mockResolvedValueOnce(rows([]));                  // join miss
    expect(await assertArticleAccess('u1', 999)).toBe(false);
  });
});
