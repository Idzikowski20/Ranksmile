import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../utils/verifyDomainOwnership';
import { ensureRankTrackingTables } from '../ensureRankTrackingTables';
import { isRankTrackingRunnerEnabled, isRankTrackingUiEnabled } from '../featureFlags';

export type RankTrackingApiContext = {
  domainId: number;
  slug: string;
};

export async function resolveRankTrackingApi(
  req: NextApiRequest,
  res: NextApiResponse,
  opts?: { requireUi?: boolean; requireRunner?: boolean },
): Promise<RankTrackingApiContext | null> {
  await ensureRankTrackingTables();
  const requireUi = opts?.requireUi !== false;
  const requireRunner = opts?.requireRunner === true;

  if (requireUi && !isRankTrackingUiEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (requireRunner && !isRankTrackingRunnerEnabled()) {
    res.status(503).json({ error: 'Rank tracking runner is disabled' });
    return null;
  }

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    res.status(401).json({ error: authorized });
    return null;
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!slug) {
    res.status(400).json({ error: 'Domain slug is required' });
    return null;
  }

  const userId = await getCurrentUserId(req, res);
  const ownership = await verifyDomainOwnershipBySlug(slug, userId);
  if (ownership === false) {
    res.status(403).json({ error: 'Access denied.' });
    return null;
  }
  if (ownership === null) {
    res.status(404).json({ error: 'Domain not found' });
    return null;
  }

  const domainId = (ownership as unknown as { ID: number }).ID;
  return { domainId, slug };
}
