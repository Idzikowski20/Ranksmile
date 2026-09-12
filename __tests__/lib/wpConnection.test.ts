import db from '@/database/database';
import { createConnection, getConnectionForWorkspace, resolveByApiKey } from '@/src/infrastructure/wordpress/wpConnection';
import { isSealedApiKey, sealApiKey } from '@/src/infrastructure/wordpress/wpApiKeySeal';

jest.mock('@/database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('@/src/infrastructure/persistence/schema/ensureWpTables', () => ({
  ensureWpTables: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

describe('wpConnection key storage', () => {
  const raw = 'b'.repeat(64);
  const OLD = process.env.WP_API_KEY_SECRET;

  beforeEach(() => {
    mockQuery.mockReset();
    process.env.WP_API_KEY_SECRET = 'test-wp-key-secret';
  });

  afterEach(() => {
    if (OLD === undefined) delete process.env.WP_API_KEY_SECRET;
    else process.env.WP_API_KEY_SECRET = OLD;
  });

  it('inserts a sealed key, not the raw secret', async () => {
    mockQuery.mockResolvedValue([[], { rowCount: 1 }] as never);
    await createConnection({
      workspaceId: 1,
      userId: 'u1',
      siteUrl: 'https://example.com',
      apiKey: raw,
      orgName: 'Org',
    });
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO wp_connections'));
    expect(insert).toBeTruthy();
    const stored = (insert?.[1] as { replacements: unknown[] }).replacements[3];
    expect(typeof stored).toBe('string');
    expect(isSealedApiKey(stored as string)).toBe(true);
    expect(stored).not.toBe(raw);
  });

  it('does not delete an existing row when sealing fails', async () => {
    delete process.env.WP_API_KEY_SECRET;
    await expect(createConnection({
      workspaceId: 1,
      userId: 'u1',
      siteUrl: 'https://example.com',
      apiKey: raw,
      orgName: 'Org',
    })).rejects.toThrow(/WP_API_KEY_SECRET/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('resolves a sealed row and upgrades a legacy plaintext row', async () => {
    const sealed = sealApiKey(raw);
    mockQuery
      .mockResolvedValueOnce([[{ id: 1, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: sealed, org_name: null }], { rowCount: 1 }] as never);
    const hit = await resolveByApiKey(raw);
    expect(hit?.api_key).toBe(raw);

    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce([[], { rowCount: 0 }] as never) // sealed miss
      .mockResolvedValueOnce([[{ id: 2, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], { rowCount: 1 }] as never)
      .mockResolvedValueOnce([[], { rowCount: 1 }] as never); // upgrade write
    const legacy = await resolveByApiKey(raw);
    expect(legacy?.api_key).toBe(raw);
    const upgrade = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE wp_connections'));
    expect(upgrade).toBeTruthy();
    const rewritten = (upgrade?.[1] as { replacements: unknown[] }).replacements[0];
    expect(isSealedApiKey(rewritten as string)).toBe(true);
  });

  it('rejects a legacy row when the rewrite fails', async () => {
    mockQuery
      .mockResolvedValueOnce([[], { rowCount: 0 }] as never)
      .mockResolvedValueOnce([[{ id: 3, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], { rowCount: 1 }] as never)
      .mockRejectedValueOnce(new Error('write failed'));
    await expect(resolveByApiKey(raw)).resolves.toBeNull();
  });

  it('rejects a legacy row when the rewrite matches zero rows', async () => {
    mockQuery
      .mockResolvedValueOnce([[], { rowCount: 0 }] as never)
      .mockResolvedValueOnce([[{ id: 5, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], { rowCount: 1 }] as never)
      .mockResolvedValueOnce([[], { rowCount: 0 }] as never);
    await expect(resolveByApiKey(raw)).resolves.toBeNull();
  });

  it('upgrades a legacy row when SQLite reports changes', async () => {
    mockQuery
      .mockResolvedValueOnce([[], { changes: 0 }] as never)
      .mockResolvedValueOnce([[{ id: 6, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], { changes: 1 }] as never)
      .mockResolvedValueOnce([[], { changes: 1 }] as never);
    await expect(resolveByApiKey(raw)).resolves.toMatchObject({ api_key: raw });
  });

  it('upgrades a legacy row when Sequelize returns a numeric count', async () => {
    mockQuery
      .mockResolvedValueOnce([[], 0] as never)
      .mockResolvedValueOnce([[{ id: 7, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], 1] as never)
      .mockResolvedValueOnce([[], 1] as never);
    await expect(resolveByApiKey(raw)).resolves.toMatchObject({ api_key: raw });
  });

  it('upgrades a legacy row on getConnectionForWorkspace', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 4, workspace_id: 1, user_id: 'u1', site_url: 'https://example.com', api_key: raw, org_name: null }], { rowCount: 1 }] as never)
      .mockResolvedValueOnce([[], { rowCount: 1 }] as never);
    const conn = await getConnectionForWorkspace(1);
    expect(conn?.api_key).toBe(raw);
    const upgrade = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE wp_connections'));
    expect(upgrade).toBeTruthy();
  });
});
