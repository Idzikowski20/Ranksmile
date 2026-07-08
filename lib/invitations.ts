import crypto from 'crypto';
import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type Invitation = { id: number; org_id: number; email: string; role: string; workspace_ids: string | null; token: string; status: string; expires_at: string | null };
import type { DbRow, SqlReplacements } from './types/db';

type Row = DbRow;
const select = async (sql: string, r: SqlReplacements): Promise<Row[]> => { const [rows] = await db.query(sql, { replacements: r }) as [Row[], unknown]; return rows; };

export async function createInvitation(userId: string, p: { email: string; role: string; workspaceIds: number[] | null }): Promise<Invitation> {
   const { orgId } = await ensureUserTenancy(userId);
   const token = crypto.randomBytes(24).toString('base64url');
   const role = ['admin', 'member'].includes(p.role) ? p.role : 'member';
   const ws = p.workspaceIds && p.workspaceIds.length ? JSON.stringify(p.workspaceIds) : null;
   const expires = new Date(Date.now() + 7 * 864e5).toISOString();
   await db.query("INSERT INTO invitations (org_id, email, role, workspace_ids, token, status, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      { replacements: [orgId, p.email.trim().toLowerCase(), role, ws, token, userId, expires] });
   const back = await select('SELECT * FROM invitations WHERE token = ? LIMIT 1', [token]);
   return back[0] as Invitation;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
   const rows = await select('SELECT * FROM invitations WHERE token = ? LIMIT 1', [token]);
   return (rows[0] as Invitation) || null;
}

export async function listInvitations(userId: string): Promise<Invitation[]> {
   const { orgId } = await ensureUserTenancy(userId);
   return await select("SELECT * FROM invitations WHERE org_id = ? AND status = 'pending' ORDER BY id DESC", [orgId]) as Invitation[];
}

export async function revokeInvitation(userId: string, id: number): Promise<void> {
   const { orgId } = await ensureUserTenancy(userId);
   await db.query("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?", { replacements: [id, orgId] });
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
   await db.query("UPDATE invitations SET status = 'accepted' WHERE id = ?", { replacements: [inv.id] });
}
