import type { Transaction } from 'sequelize';
import db from '../../database/database';
import { ensureNotificationTables } from '../ensureNotificationTables';
import { ensureUserTenancy, getAccessibleWorkspaceIds } from '../tenancy';
import { acquireInboxOrgLock } from './orgLock';
import type { InboxItem, InboxListResponse, MarkInboxReadInput } from './types';

type EventRow = {
  event_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  current_count: number;
  revision: number;
  updated_at: string | Date | null;
  payload_json: string | null;
  read_revision: number | null;
};

function parsePayload(payloadJson: string | null): { domain: string; slug: string } {
  if (!payloadJson) return { domain: '', slug: '' };
  try {
    const parsed = JSON.parse(payloadJson) as { domain?: string; slug?: string };
    return { domain: String(parsed.domain ?? ''), slug: String(parsed.slug ?? '') };
  } catch {
    return { domain: '', slug: '' };
  }
}

function toInboxItem(row: EventRow): InboxItem {
  const { domain, slug } = parsePayload(row.payload_json);
  const revision = Number(row.revision);
  const readRevision = row.read_revision == null ? null : Number(row.read_revision);
  let at = '';
  if (row.updated_at instanceof Date) {
    at = row.updated_at.toISOString();
  } else if (row.updated_at) {
    const raw = String(row.updated_at);
    // Postgres often returns "YYYY-MM-DD HH:MM:SS" without Z — force UTC parse.
    const parsed = new Date(/^\d{4}-\d{2}-\d{2} /.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw);
    at = Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }
  return {
    eventId: row.event_id,
    type: row.type as InboxItem['type'],
    title: row.title,
    body: row.body,
    href: row.href,
    domain,
    slug,
    count: Number(row.current_count),
    at,
    revision,
    isRead: readRevision != null && readRevision >= revision,
  };
}

async function countUnread(
  userId: string,
  accessibleWorkspaceIds: number[],
): Promise<number> {
  if (!accessibleWorkspaceIds.length) return 0;
  const placeholders = accessibleWorkspaceIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n
       FROM notification_events e
       LEFT JOIN notification_reads r
         ON r.event_id = e.event_id AND r.user_id = ?
      WHERE e.workspace_id IN (${placeholders})
        AND e.archived_at IS NULL
        AND (r.event_id IS NULL OR r.read_revision < e.revision)`,
    { replacements: [userId, ...accessibleWorkspaceIds] },
  );
  return Number((rows as Array<{ n: number | string }>)[0]?.n ?? 0);
}

export async function listInboxForUser(
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<InboxListResponse> {
  await ensureNotificationTables();
  const accessible = await getAccessibleWorkspaceIds(userId);
  const unreadCount = await countUnread(userId, accessible);
  if (!accessible.length) return { unreadCount: 0, items: [] };

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const placeholders = accessible.map(() => '?').join(',');
  const unreadFilter = opts.unreadOnly
    ? 'AND (r.event_id IS NULL OR r.read_revision < e.revision)'
    : '';
  const [rows] = await db.query(
    `SELECT e.event_id, e.type, e.title, e.body, e.href,
            e.current_count, e.revision, e.updated_at, e.payload_json,
            r.read_revision
       FROM notification_events e
       LEFT JOIN notification_reads r
         ON r.event_id = e.event_id AND r.user_id = ?
      WHERE e.workspace_id IN (${placeholders})
        AND e.archived_at IS NULL
        ${unreadFilter}
      ORDER BY e.updated_at DESC
      LIMIT ?`,
    { replacements: [userId, ...accessible, limit] },
  );
  const items = (rows as EventRow[]).map(toInboxItem);
  return { unreadCount, items };
}

export async function markInboxRead(
  userId: string,
  input: MarkInboxReadInput,
): Promise<void> {
  await ensureNotificationTables();
  const { orgId } = await ensureUserTenancy(userId);
  const accessible = await getAccessibleWorkspaceIds(userId);
  if (!accessible.length) return;

  const placeholders = accessible.map(() => '?').join(',');
  const replacements: unknown[] = [userId];
  let idFilter = '';
  if (input.all) {
    // all active in scope — no extra filter
  } else if (input.eventIds?.length) {
    const idPlaceholders = input.eventIds.map(() => '?').join(',');
    idFilter = `AND e.event_id IN (${idPlaceholders})`;
    replacements.push(...input.eventIds);
  } else {
    return;
  }
  replacements.push(...accessible);

  await db.transaction(async (transaction: Transaction) => {
    await acquireInboxOrgLock(orgId, transaction);
    await db.query(
      `INSERT INTO notification_reads (user_id, event_id, read_revision, read_at)
       SELECT ?, e.event_id, e.revision, CURRENT_TIMESTAMP
         FROM notification_events e
        WHERE e.workspace_id IN (${placeholders})
          AND e.archived_at IS NULL
          ${idFilter}
       ON CONFLICT (user_id, event_id) DO UPDATE SET
         read_revision = EXCLUDED.read_revision,
         read_at = EXCLUDED.read_at
       WHERE notification_reads.read_revision < EXCLUDED.read_revision`,
      { replacements, transaction },
    );
  });
}
