import type { NextApiRequest, NextApiResponse } from 'next';

/** Legacy JWT login removed — use Neon Auth (`/auth/sign-in`). */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).json({ error: 'Not found' });
}
