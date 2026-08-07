import type { NextApiRequest, NextApiResponse } from 'next';
import { isPageTourSeen, markPageTourSeen } from '../../../lib/onboardingState';
import { getCurrentUserId } from '../../../utils/getUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

/**
 * Page-tour state for the logged-in user.
 *  GET  → { seen: boolean }  — read on dashboard mount to decide whether to open it
 *  POST → { seen: true }     — Skip or the last step; idempotent
 *
 * Unauthenticated GET answers `seen: true` rather than 401: the caller only uses this
 * to decide whether to pop a walkthrough, and a signed-out visitor must never trigger
 * one. Failing closed keeps that decision from depending on error handling upstream.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getCurrentUserId(req, res);

  if (req.method === 'GET') {
    // Fail closed: a signed-out visitor must never be shown the walkthrough.
    if (!userId) return res.status(200).json({ seen: true });
    return res.status(200).json({ seen: await isPageTourSeen(userId) });
  }

  if (req.method === 'POST') {
    // Never acknowledge a dismissal we cannot persist — a 200 here would let the
    // client believe the tour is permanently closed when nothing was written.
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    await markPageTourSeen(userId);
    return res.status(200).json({ seen: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
