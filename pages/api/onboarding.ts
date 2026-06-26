import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import { ensureArticlesTables } from '../../lib/ensureArticlesTables';
import { getCurrentUserId } from '../../utils/getUser';

/**
 * Onboarding state for the logged-in user.
 *  GET  → { completed: boolean }   — read by the auth-guard in _app.tsx
 *  POST → { completed: true }      — body { answers }, marks the survey done
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ completed: false, error: 'Not authenticated' });

   await ensureArticlesTables();

   if (req.method === 'GET') {
      const [rows] = await db.query(
         'SELECT completed FROM user_onboarding WHERE user_id = ?',
         { replacements: [userId] },
      ) as [Array<{ completed: number | boolean }>, unknown];
      const completed = rows.length > 0 && !!Number(rows[0].completed);
      return res.status(200).json({ completed });
   }

   if (req.method === 'POST') {
      const answers = req.body?.answers ?? null;
      const answersJson = answers ? JSON.stringify(answers) : null;
      // Dialect-agnostic upsert (avoids ON CONFLICT, which not every SQLite build supports).
      const [existing] = await db.query(
         'SELECT user_id FROM user_onboarding WHERE user_id = ?',
         { replacements: [userId] },
      ) as [Array<unknown>, unknown];
      if (existing.length) {
         await db.query(
            'UPDATE user_onboarding SET completed = 1, answers = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            { replacements: [answersJson, userId] },
         );
      } else {
         await db.query(
            'INSERT INTO user_onboarding (user_id, completed, answers, updated_at) VALUES (?, 1, ?, CURRENT_TIMESTAMP)',
            { replacements: [userId, answersJson] },
         );
      }
      return res.status(200).json({ completed: true });
   }

   res.setHeader('Allow', 'GET, POST');
   return res.status(405).json({ error: 'Method not allowed' });
}
