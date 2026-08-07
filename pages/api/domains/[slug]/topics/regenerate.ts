import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../../utils/verifyDomainOwnership';
import { getErrorMessage } from '../../../../../lib/errors';
import { regenerateDomainTopics } from '../../../../../lib/regenerateDomainTopics';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domainId = (ownership as { ID: number }).ID;

  try {
    const topics = await regenerateDomainTopics(domainId);
    return res.status(200).json({ topics });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'Topic regeneration failed' });
  }
}

export default withOrgPaymentAccess(handler);
