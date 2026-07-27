import type { Transaction } from 'sequelize';
import db from '../../database/database';
import { ensureNotificationTables } from '../ensureNotificationTables';
import { OPTIMIZATION_TYPE, optimizationCopy, optimizationEventId } from './copy';
import { acquireInboxOrgLock } from './orgLock';
import type { DomainSnapshotRow } from './types';

async function fetchSnapshot(
  orgId: number,
  accessibleWorkspaceIds: number[],
  transaction: Transaction,
): Promise<DomainSnapshotRow[]> {
  if (!accessibleWorkspaceIds.length) return [];
  const placeholders = accessibleWorkspaceIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT
       d."ID" AS domain_id,
       d.workspace_id,
       d.domain,
       d.slug,
       w.org_id,
       COUNT(a.id) AS current_count,
       MAX(COALESCE(a.updated_at, a.created_at)) AS latest_at
     FROM domain d
     JOIN workspaces w ON w.id = d.workspace_id
     LEFT JOIN articles a
       ON a.domain_id = d."ID"
      AND a.title IS NOT NULL AND a.title != ''
      AND a.content_score > 0 AND a.content_score < 70
     WHERE w.org_id = ?
       AND d.workspace_id IN (${placeholders})
     GROUP BY d."ID", d.workspace_id, d.domain, d.slug, w.org_id`,
    { replacements: [orgId, ...accessibleWorkspaceIds], transaction },
  );
  return (rows as DomainSnapshotRow[]).map((r) => ({
    ...r,
    domain_id: Number(r.domain_id),
    workspace_id: Number(r.workspace_id),
    org_id: Number(r.org_id),
    current_count: Number(r.current_count),
    latest_at: toIsoTimestamp(r.latest_at),
  }));
}

/** pg/sequelize may return Date; String(date) is locale junk Postgres rejects. */
function toIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function upsertProjection(row: DomainSnapshotRow, transaction: Transaction): Promise<void> {
  const eventId = optimizationEventId(row.domain_id);
  const copy = optimizationCopy(row.slug, row.domain, row.current_count);
  const updatedAt = row.latest_at ?? new Date().toISOString();
  await db.query(
    `INSERT INTO notification_events (
       event_id, org_id, workspace_id, domain_id, type,
       title, body, href, current_count, revision, payload_json,
       created_at, updated_at, archived_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, ?, NULL)
     ON CONFLICT (event_id) DO UPDATE SET
       body = EXCLUDED.body,
       title = EXCLUDED.title,
       href = EXCLUDED.href,
       current_count = EXCLUDED.current_count,
       workspace_id = EXCLUDED.workspace_id,
       org_id = EXCLUDED.org_id,
       payload_json = EXCLUDED.payload_json,
       archived_at = NULL,
       revision = CASE
         WHEN notification_events.current_count IS DISTINCT FROM EXCLUDED.current_count
           OR notification_events.archived_at IS NOT NULL
           OR notification_events.workspace_id IS DISTINCT FROM EXCLUDED.workspace_id
         THEN notification_events.revision + 1
         ELSE notification_events.revision
       END,
       updated_at = EXCLUDED.updated_at
     WHERE notification_events.current_count IS DISTINCT FROM EXCLUDED.current_count
        OR notification_events.archived_at IS NOT NULL
        OR notification_events.workspace_id IS DISTINCT FROM EXCLUDED.workspace_id
        OR notification_events.updated_at IS DISTINCT FROM EXCLUDED.updated_at`,
    {
      replacements: [
        eventId,
        row.org_id,
        row.workspace_id,
        row.domain_id,
        OPTIMIZATION_TYPE,
        copy.title,
        copy.body,
        copy.href,
        row.current_count,
        copy.payloadJson,
        updatedAt,
      ],
      transaction,
    },
  );
}

async function archiveMissing(
  orgId: number,
  activeDomainIds: number[],
  accessibleWorkspaceIds: number[],
  transaction: Transaction,
): Promise<void> {
  if (!accessibleWorkspaceIds.length) {
    await db.query(
      `UPDATE notification_events
          SET archived_at = CURRENT_TIMESTAMP
        WHERE org_id = ?
          AND archived_at IS NULL`,
      { replacements: [orgId], transaction },
    );
    return;
  }
  const wsPlaceholders = accessibleWorkspaceIds.map(() => '?').join(',');
  if (!activeDomainIds.length) {
    await db.query(
      `UPDATE notification_events
          SET archived_at = CURRENT_TIMESTAMP
        WHERE org_id = ?
          AND workspace_id IN (${wsPlaceholders})
          AND archived_at IS NULL`,
      { replacements: [orgId, ...accessibleWorkspaceIds], transaction },
    );
    return;
  }
  const domainPlaceholders = activeDomainIds.map(() => '?').join(',');
  await db.query(
    `UPDATE notification_events
        SET archived_at = CURRENT_TIMESTAMP
      WHERE org_id = ?
        AND workspace_id IN (${wsPlaceholders})
        AND domain_id NOT IN (${domainPlaceholders})
        AND archived_at IS NULL`,
    { replacements: [orgId, ...accessibleWorkspaceIds, ...activeDomainIds], transaction },
  );
}

async function runSync(
  orgId: number,
  accessibleWorkspaceIds: number[],
  transaction: Transaction,
): Promise<void> {
  await acquireInboxOrgLock(orgId, transaction);
  const snapshot = await fetchSnapshot(orgId, accessibleWorkspaceIds, transaction);
  const active = snapshot.filter((r) => r.current_count > 0);
  for (const row of active) {
    await upsertProjection(row, transaction);
  }
  await archiveMissing(
    orgId,
    active.map((r) => r.domain_id),
    accessibleWorkspaceIds,
    transaction,
  );
}

/** Rebuilds optimization_recommendation projections from articles snapshot. */
export async function syncOptimizationInbox(
  orgId: number,
  accessibleWorkspaceIds: number[],
): Promise<void> {
  await ensureNotificationTables();
  await db.transaction(async (transaction: Transaction) => {
    await runSync(orgId, accessibleWorkspaceIds, transaction);
  });
}
