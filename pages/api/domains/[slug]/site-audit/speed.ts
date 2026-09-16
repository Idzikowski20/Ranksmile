// POST /api/domains/[slug]/site-audit/speed — run PageSpeed Insights for the homepage
// and store the result the Site Audit overview shows as Site Speed Score.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/src/core/shared/errors';
import { isPageSpeedConfigured, measureSiteSpeed, type SiteSpeedRecord } from '@/src/infrastructure/siteAudit/siteSpeed';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { verifyDomainOwnershipBySlug } from '../../../../../utils/verifyDomainOwnership';
import { getCurrentUserId } from '../../../../../utils/getUser';
import verifyUser from '../../../../../utils/verifyUser';

async function handler(req: NextApiRequest, res: NextApiResponse<SiteSpeedRecord | { error: string }>) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const userId = await getCurrentUserId(req, res);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
  if (!isPageSpeedConfigured()) return res.status(503).json({ error: 'Site speed measurement is not configured' });

  const { ID: domainId, domain } = ownership as unknown as { ID: number; domain: string };
  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  try {
    const record = await measureSiteSpeed(domainId, url);
    return res.status(200).json(record);
  } catch (err) {
    return res.status(502).json({ error: getErrorMessage(err) || 'PageSpeed Insights failed' });
  }
}

export default withOrgPaymentAccess(handler);
