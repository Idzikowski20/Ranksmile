// GET /api/pixabay/search?q=<query>&page=1&per_page=20
// Server-side proxy to Pixabay API — keeps the API key secret.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

export interface PixabayImage {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  collections: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

export interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayImage[];
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = (req.query.q as string || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  const page = parseInt(req.query.page as string, 10) || 1;
  const perPage = Math.min(parseInt(req.query.per_page as string, 10) || 20, 50);
  const key = process.env.PIXABAY_API_KEY || '';

  if (!key) return res.status(500).json({ error: 'PIXABAY_API_KEY not configured' });

  try {
    const params = new URLSearchParams({
      key,
      q,
      image_type: 'photo',
      orientation: 'horizontal',
      safesearch: 'true',
      order: 'popular',
      page: String(page),
      per_page: String(perPage),
    });

    const pixabayRes = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    if (!pixabayRes.ok) {
      const text = await pixabayRes.text();
      return res.status(pixabayRes.status).json({ error: text });
    }

    const data: PixabayResponse = await pixabayRes.json();
    return res.status(200).json(data);
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error('[pixabay] error:', msg);
    return res.status(500).json({ error: msg || 'Pixabay search failed' });
  }
}

export default withOrgPaymentAccess(handler);
