import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../../utils/verifyDomainOwnership';
import { ensurePipelineTables } from '../../../../../lib/ensurePipelineTables';
import { buildCompareCrawlsReport } from '../../../../../lib/siteAudit/buildCompareCrawls';
import type { CompareCrawlsReport } from '../../../../../lib/siteAudit/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompareCrawlsReport | { error: string }>,
) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  const slug = req.query.slug as string;
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domainId = (ownership as { ID: number }).ID;
  const domain = (ownership as { domain: string }).domain;
  await ensurePipelineTables();

  const olderId = typeof req.query.older === 'string' ? req.query.older : undefined;
  const newerId = typeof req.query.newer === 'string' ? req.query.newer : undefined;

  const payload = await buildCompareCrawlsReport(domainId, domain, olderId, newerId);
  return res.status(200).json(payload);
}
