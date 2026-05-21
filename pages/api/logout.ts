import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Logout obsługiwany przez Auth0 v3 pod /api/auth/logout.
 * Ten endpoint istnieje dla kompatybilności wstecznej.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
   res.redirect(307, '/api/auth/logout');
}
