import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../utils/verifyDomainOwnership';
import { getErrorMessage } from '../../../lib/errors';
import { buildSeoOverviewPayload } from '../../../lib/seoOverview/buildPayload';
import type { SeoOverviewPayload } from '../../../lib/seoOverview/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse<SeoOverviewPayload | { error: string }>) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!slug) return res.status(400).json({ error: 'Domain slug is required' });

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
  if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

  const domain = ownership as unknown as { ID: number; domain: string };

  try {
    const payload = await buildSeoOverviewPayload(domain.ID, domain.domain);
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
