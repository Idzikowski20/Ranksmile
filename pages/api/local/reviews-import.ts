import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../lib/errors';
import { importGoogleReviews } from '../../../lib/local/googleReviews';
import type { ReviewItem, ReviewProgressMonth } from '../../../lib/local/reviewsData';
import verifyUser from '../../../utils/verifyUser';

type ReviewsImportResponse = {
  reviews: ReviewItem[];
  totalReviews: number;
  averageRating: number;
  progress: ReviewProgressMonth[];
  source: 'dataforseo';
  businessTitle?: string;
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReviewsImportResponse>,
) {
  // DataForSEO reviews are async (post + poll); allow up to ~90s.
  res.setHeader('Cache-Control', 'no-store');

  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (name.length < 2) {
    return res.status(400).json({ error: 'name is required' });
  }

  const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
  const country = typeof req.query.country === 'string' ? req.query.country : 'PL';
  const depthRaw = typeof req.query.depth === 'string' ? Number(req.query.depth) : 30;
  const depth = Number.isFinite(depthRaw)
    ? Math.min(Math.max(Math.round(depthRaw), 10), 100)
    : 30;

  try {
    const result = await importGoogleReviews(
      { name, address },
      { country, depth },
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error('[local/reviews-import]', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}
