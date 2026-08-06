import db from '../../database/database';
import {
  createInvitation, getInvitationByToken, acceptInvitation, revokeInvitation,
} from '../../lib/invitations';

jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({
  ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }),
}));
jest.mock('../../lib/ensureArticlesTables', () => ({
  ensureArticlesTables: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('invitations', () => {
  beforeEach(() => mockQuery.mockReset());

  it('createInvitation inserts a pending invite and returns it (email lowercased)', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'admin', token: 'tok', status: 'pending', workspace_ids: '[9]' }]));
    const inv = await createInvitation('u1', { email: 'A@B.com', role: 'admin', workspaceIds: [9] });
    expect(inv.email).toBe('a@b.com');
    expect(String(mockQuery.mock.calls[0][0])).toContain('INSERT INTO invitations');
  });
  it('getInvitationByToken returns null when missing', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));
    expect(await getInvitationByToken('x')).toBeNull();
  });
  it('acceptInvitation throws on email mismatch', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'member', status: 'pending', workspace_ids: null }]));
    await expect(acceptInvitation('u1', 'other@x.com', 'tok')).rejects.toThrow('INVITE_EMAIL_MISMATCH');
  });
  it('acceptInvitation throws when not pending', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ id: 1, org_id: 5, email: 'a@b.com', status: 'revoked' }]));
    await expect(acceptInvitation('u1', 'a@b.com', 'tok')).rejects.toThrow('INVITE_NOT_PENDING');
  });
  it('acceptInvitation creates membership and marks accepted on success', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'admin', status: 'pending', workspace_ids: '[9]' }]))
      .mockResolvedValueOnce(rows([])) // existing membership -> none
      .mockResolvedValueOnce(rows([])) // INSERT membership
      .mockResolvedValueOnce(rows([])) // existing user_onboarding row -> none
      .mockResolvedValueOnce(rows([])) // INSERT user_onboarding
      .mockResolvedValueOnce(rows([])); // UPDATE invitation
    await acceptInvitation('u1', 'A@B.com', 'tok');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO organization_members'))).toBe(true);
    expect(calls.some((s) => s.includes("UPDATE invitations SET status = 'accepted'"))).toBe(true);
  });

  // Joining an existing org must not drop the user into the new-org wizard:
  // resolveAppState checks ONBOARDING before BILLING, so an unmarked user is
  // redirected to /onboarding, whose final step renames their new org.
  it('acceptInvitation marks onboarding complete so invited members skip the wizard', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'member', status: 'pending', workspace_ids: null }]))
      .mockResolvedValueOnce(rows([])) // existing membership -> none
      .mockResolvedValueOnce(rows([])) // INSERT membership
      .mockResolvedValueOnce(rows([])) // CREATE TABLE IF NOT EXISTS user_onboarding
      .mockResolvedValueOnce(rows([])) // INSERT user_onboarding
      .mockResolvedValueOnce(rows([])); // UPDATE invitation
    await acceptInvitation('u1', 'a@b.com', 'tok');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('INSERT INTO user_onboarding') && s.includes('1'))).toBe(true);
  });

  // The upsert inserts first and recovers from the duplicate, so two concurrent accepts
  // both succeed instead of the loser of a check-then-insert race throwing on the PK.
  it('acceptInvitation falls back to UPDATE when the onboarding row already exists', async () => {
    const duplicate = Object.assign(new Error('duplicate key'), { name: 'SequelizeUniqueConstraintError' });
    // Keyed on the statement rather than call order: `ensureUserOnboardingTable` memoizes
    // its DDL, so whether the CREATE runs depends on which test got there first.
    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT id, org_id')) {
        return Promise.resolve(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'member', status: 'pending', workspace_ids: null }]));
      }
      if (String(sql).includes('INSERT INTO user_onboarding')) return Promise.reject(duplicate);
      return Promise.resolve(rows([]));
    });
    await acceptInvitation('u1', 'a@b.com', 'tok');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('UPDATE user_onboarding SET completed = 1'))).toBe(true);
    expect(calls.some((s) => s.includes("UPDATE invitations SET status = 'accepted'"))).toBe(true);
  });

  it('acceptInvitation surfaces a non-duplicate insert failure instead of masking it as an update', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('SELECT id, org_id')) {
        return Promise.resolve(rows([{ id: 1, org_id: 5, email: 'a@b.com', role: 'member', status: 'pending', workspace_ids: null }]));
      }
      if (String(sql).includes('INSERT INTO user_onboarding')) return Promise.reject(new Error('ECONNRESET'));
      return Promise.resolve(rows([]));
    });
    await expect(acceptInvitation('u1', 'a@b.com', 'tok')).rejects.toThrow('ECONNRESET');
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("UPDATE invitations SET status = 'accepted'"))).toBe(false);
  });
  it('revokeInvitation sets status revoked scoped to the org', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));
    await revokeInvitation('u1', 3);
    expect(String(mockQuery.mock.calls[0][0])).toContain("UPDATE invitations SET status = 'revoked'");
  });
});
