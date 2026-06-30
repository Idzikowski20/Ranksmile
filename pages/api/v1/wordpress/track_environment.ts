// POST /api/v1/wordpress/track_environment — accept and ignore plugin analytics.
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
   return res.status(200).json({ ok: true });
}
