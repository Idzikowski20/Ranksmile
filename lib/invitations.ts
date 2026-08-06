import crypto from 'crypto';
import db from '../database/database';
import { ensureUserTenancy } from './tenancy';
import { ensureArticlesTables } from './ensureArticlesTables';
import type { DbRow, SqlReplacements } from './types/db';

export type Invitation = {
   id: number;
   org_id: number;
   email: string;
   role: string;
   workspace_ids: string | null;
   token: string;
   status: string;
   expires_at: string | null;
};

type Row = DbRow;

const select = async (sql: string, r: SqlReplacements): Promise<Row[]> => {
   const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown];
   return rows;
};

const INVITATION_COLS = 'id, org_id, email, role, workspace_ids, token, status, expires_at';

export async function createInvitation(
   userId: string,
   p: { email: string; role: string; workspaceIds: number[] | null },
): Promise<Invitation> {
   const { orgId } = await ensureUserTenancy(userId);
   const token = crypto.randomBytes(24).toString('base64url');
   const role = ['admin', 'member'].includes(p.role) ? p.role : 'member';
   const ws = p.workspaceIds && p.workspaceIds.length ? JSON.stringify(p.workspaceIds) : null;
   const expires = new Date(Date.now() + 7 * 864e5).toISOString();
   await db.query(
      `INSERT INTO invitations (org_id, email, role, workspace_ids, token, status, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      { replacements: [orgId, p.email.trim().toLowerCase(), role, ws, token, userId, expires] },
   );
   const back = await select(`SELECT ${INVITATION_COLS} FROM invitations WHERE token = ? LIMIT 1`, [token]);
   return back[0] as Invitation;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
   const rows = await select(`SELECT ${INVITATION_COLS} FROM invitations WHERE token = ? LIMIT 1`, [token]);
   return (rows[0] as Invitation) || null;
}

export async function listInvitations(userId: string): Promise<Invitation[]> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select(
      `SELECT ${INVITATION_COLS} FROM invitations WHERE org_id = ? AND status = 'pending' ORDER BY id DESC`,
      [orgId],
   );
   return rows as Invitation[];
}

export async function revokeInvitation(userId: string, id: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await db.query("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?", { replacements: [id, orgId] });
}

/**
 * Joining an existing organization completes onboarding for that user.
 *
 * The wizard exists to configure a *brand-new* org — it names it, uploads its logo
 * and invites its team. Someone joining an org that is already set up has nothing
 * to fill in, and `resolveAppState` checks ONBOARDING before BILLING, so leaving
 * this unmarked routes every invited member into a wizard whose closing step would
 * overwrite the org's name and logo.
 *
 * Dialect-agnostic upsert (no ON CONFLICT — not every SQLite build supports it),
 * mirroring `pages/api/onboarding.ts`. Answers are left untouched so a partially
 * filled survey survives.
 */
async function markOnboardingCompleted(userId: string): Promise<void> {
   await ensureArticlesTables();
   const seen = await select('SELECT user_id FROM user_onboarding WHERE user_id = ? LIMIT 1', [userId]);
   if (seen.length) {
      await db.query('UPDATE user_onboarding SET completed = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
         { replacements: [userId] });
      return;
   }
   await db.query('INSERT INTO user_onboarding (user_id, completed, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP)',
      { replacements: [userId] });
}

export async function acceptInvitation(sessionUserId: string, sessionEmail: string | null, token: string): Promise<void> {
   const inv = await getInvitationByToken(token);
   if (!inv || inv.status !== 'pending') throw new Error('INVITE_NOT_PENDING');
   // Expiry is enforced on the GET preview but was ignored here — an expired-but-pending token
   // stayed redeemable forever. Reject it (and mark it expired so it can't be retried).
   if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
      await db.query("UPDATE invitations SET status = 'expired' WHERE id = ?", { replacements: [inv.id] }).catch(() => {});
      throw new Error('INVITE_EXPIRED');
   }
   if (!sessionEmail || sessionEmail.trim().toLowerCase() !== inv.email) throw new Error('INVITE_EMAIL_MISMATCH');
   const existing = await select('SELECT id FROM organization_members WHERE org_id = ? AND user_id = ? LIMIT 1', [inv.org_id, sessionUserId]);
   if (!existing.length) {
      await db.query("INSERT INTO organization_members (org_id, user_id, email, role, status, workspace_ids) VALUES (?, ?, ?, ?, 'active', ?)",
         { replacements: [inv.org_id, sessionUserId, inv.email, inv.role, inv.workspace_ids] });
   }
   // Before the status flip, so a failure here leaves the invite pending and the
   // whole accept stays retryable (the membership insert above is already guarded).
   await markOnboardingCompleted(sessionUserId);
   await db.query("UPDATE invitations SET status = 'accepted' WHERE id = ?", { replacements: [inv.id] });
}
