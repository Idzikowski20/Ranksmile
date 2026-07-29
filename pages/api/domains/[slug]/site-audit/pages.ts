import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../../utils/verifyDomainOwnership';
import { ensurePipelineTables } from '../../../../../lib/ensurePipelineTables';
import { buildCrawledPagesReport } from '../../../../../lib/siteAudit/buildPageReport';
import { resolveSiteAuditPageLimit } from '../../../../../lib/siteAudit/pageLimit';
import type { CrawledPagesReport } from '../../../../../lib/siteAudit/types';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CrawledPagesReport | { error: string }>,
) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domainId = (ownership as { ID: number }).ID;
  await ensurePipelineTables();

  const limitInfo = await resolveSiteAuditPageLimit(userId);
  const payload = await buildCrawledPagesReport(req.query.slug as string, domainId, limitInfo);
  return res.status(200).json(payload);
}

export default withOrgPaymentAccess(handler);
