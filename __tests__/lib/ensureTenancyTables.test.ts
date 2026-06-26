jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([[], {}]) },
}));

import db from '../../database/database';
import { ensureTenancyTables } from '../../lib/ensureTenancyTables';

const mockQuery = db.query as jest.Mock;

describe('ensureTenancyTables', () => {
  beforeEach(() => mockQuery.mockClear());

  it('issues DDL for the three tenancy tables and the domain column', async () => {
    await ensureTenancyTables();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS organization_members');
    expect(sql).toContain('ALTER TABLE domain ADD COLUMN workspace_id');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_owner');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS invitations');
    expect(sql).toContain('ALTER TABLE organization_members ADD COLUMN workspace_ids');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token');
    // hardening: workspace name uniqueness + member (user_id,status) lookup index
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_org_name ON workspaces(org_id, name)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_org_members_user_status ON organization_members(user_id, status)');
  });
});
