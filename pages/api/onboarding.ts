import type { NextApiRequest, NextApiResponse } from 'next';
import { isOnboardingCompleted, markOnboardingCompleted } from '../../lib/onboardingState';
import { getCurrentUserId } from '../../utils/getUser';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

/**
 * Onboarding state for the logged-in user.
 *  GET  → { completed: boolean }   — read by the auth-guard in _app.tsx
 *  POST → { completed: true }      — body { answers }, marks the survey done
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ completed: false, error: 'Not authenticated' });

   if (req.method === 'GET') {
      return res.status(200).json({ completed: await isOnboardingCompleted(userId) });
   }

   if (req.method === 'POST') {
      const answers = req.body?.answers ?? null;
      await markOnboardingCompleted(userId, answers ? JSON.stringify(answers) : null);
      return res.status(200).json({ completed: true });
   }

   res.setHeader('Allow', 'GET, POST');
   return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
