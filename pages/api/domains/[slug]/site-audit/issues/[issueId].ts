import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../../../utils/verifyDomainOwnership';
import { ensurePipelineTables } from '../../../../../../lib/ensurePipelineTables';
import { queryRows, queryOne } from '../../../../../../lib/db/query';
import { buildIssueDetail } from '../../../../../../lib/siteAudit/buildIssueDetail';
import { loadSiteAuditContext } from '../../../../../../lib/siteAudit/issues';
import type { AuditRow } from '../../../../../../lib/siteAudit/issues';
import type { SiteAuditIssueDetailPayload } from '../../../../../../lib/siteAudit/types';
import { withOrgPaymentAccess } from '../../../../../../lib/requireOrgPaymentAccess';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SiteAuditIssueDetailPayload | { error: string }>,
) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = req.query.slug as string;
  const issueId = req.query.issueId as string;
  if (!issueId) return res.status(400).json({ error: 'Missing issueId' });

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domainId = (ownership as { ID: number }).ID;
  await ensurePipelineTables();

  const rows = await queryRows<AuditRow & { last_audited_at: string | null; title: string | null }>(
    `SELECT url, title, score, fetch_status, signals_json, duration_ms, last_audited_at
     FROM page_audits WHERE domain_id = ? ORDER BY url`,
    [domainId],
  );

  const meta = await queryOne<{ domain: string }>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  const domain = meta?.domain ?? slug;

  const job = await queryOne<{ updated_at: string | null }>(
    `SELECT updated_at FROM analysis_jobs WHERE id = ? LIMIT 1`,
    [`dsetup_${domainId}`],
  );

  const updatedAt = rows.reduce<string | null>((max, r) => {
    const t = r.last_audited_at;
    if (!t) return max;
    if (!max || t > max) return t;
    return max;
  }, job?.updated_at ?? null);

  const ctx = await loadSiteAuditContext(domain, rows);
  const payload = buildIssueDetail(issueId, rows, updatedAt, ctx);
  if (!payload) return res.status(404).json({ error: 'Issue not found' });

  return res.status(200).json(payload);
}

export default withOrgPaymentAccess(handler);
