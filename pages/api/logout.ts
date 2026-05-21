import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Legacy logout endpoint — przekierowuje do strony sign-in po wylogowaniu.
 * Faktyczne usunięcie sesji odbywa się client-side przez authClient.signOut().
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
   res.redirect(307, '/auth/sign-in');
}
