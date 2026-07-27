import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { ensureUserTenancy } from '../../lib/tenancy';
import { getAppSettings } from './settings';
import { getErrorMessage } from '../../lib/errors';
import {
  enqueueKeywordPositionEmails,
  type DomainNotifyCandidate,
} from '../../lib/notifications/emailQueue';
import type { EnqueueNotifyResult } from '../../lib/notifications/emailTypes';

type NotifyResponse = EnqueueNotifyResult | { success?: boolean; error?: string | null };

export const config = { maxDuration: 60 };

function isApiKeyAuth(req: NextApiRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ') || !process.env.APIKEY) return false;
  return auth.substring('Bearer '.length) === process.env.APIKEY;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(401).json({ success: false, error: 'Invalid Method' });
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ success: false, error: authorized });
  await db.sync();
  return notify(req, res);
}

const notify = async (req: NextApiRequest, res: NextApiResponse<NotifyResponse>) => {
  const reqDomain = (req?.query?.domain as string) || '';
  try {
    const settings = await getAppSettings();
    const notificationInterval = String(settings.notification_interval || 'daily');
    const defaultToEmail = String(settings.notification_email || '');

    // APIKEY = install-wide scheduler. Session users are scoped to their org.
    let orgId: number | null = null;
    if (!isApiKeyAuth(req)) {
      const userId = await getCurrentUserId(req, res);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }
      ({ orgId } = await ensureUserTenancy(userId));
    }

    const candidates = await loadDomainCandidates(reqDomain, orgId);
    const result = await enqueueKeywordPositionEmails({
      domains: candidates,
      defaultToEmail,
      notificationInterval,
    });

    return res.status(202).json(result);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error) || 'Error enqueueing notification emails.',
    });
  }
};

async function loadDomainCandidates(
  reqDomain: string,
  orgId: number | null,
): Promise<DomainNotifyCandidate[]> {
  if (reqDomain) {
    const sql = orgId == null
      ? `SELECT d."ID" AS domain_id, d.domain, d.notification, d.notification_emails,
                w.org_id AS org_id
           FROM domain d
           LEFT JOIN workspaces w ON w.id = d.workspace_id
          WHERE d.domain = ?
          LIMIT 1`
      : `SELECT d."ID" AS domain_id, d.domain, d.notification, d.notification_emails,
                w.org_id AS org_id
           FROM domain d
           JOIN workspaces w ON w.id = d.workspace_id
          WHERE d.domain = ? AND w.org_id = ?
          LIMIT 1`;
    const replacements = orgId == null ? [reqDomain] : [reqDomain, orgId];
    const [rows] = await db.query(sql, { replacements });
    return mapRows(rows as Array<Record<string, unknown>>);
  }

  if (orgId == null) {
    const [rows] = await db.query(
      `SELECT d."ID" AS domain_id, d.domain, d.notification, d.notification_emails,
              w.org_id AS org_id
         FROM domain d
         LEFT JOIN workspaces w ON w.id = d.workspace_id`,
    );
    return mapRows(rows as Array<Record<string, unknown>>);
  }

  const [rows] = await db.query(
    `SELECT d."ID" AS domain_id, d.domain, d.notification, d.notification_emails,
            w.org_id AS org_id
       FROM domain d
       JOIN workspaces w ON w.id = d.workspace_id
      WHERE w.org_id = ?`,
    { replacements: [orgId] },
  );
  return mapRows(rows as Array<Record<string, unknown>>);
}

function mapRows(rows: Array<Record<string, unknown>>): DomainNotifyCandidate[] {
  return rows.map((r) => ({
    domainId: Number(r.domain_id),
    domain: String(r.domain ?? ''),
    orgId: r.org_id == null ? null : Number(r.org_id),
    notification: r.notification == null ? true : Boolean(r.notification),
    notificationEmails: r.notification_emails == null ? null : String(r.notification_emails),
  }));
}
