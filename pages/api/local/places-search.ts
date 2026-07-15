import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../lib/errors';
import { searchPlaces } from '../../../lib/local/mockPlaces';
import { fetchSerperPlaces, getSerperPlacesApiKeys } from '../../../lib/local/serperPlaces';
import type { BusinessPlace } from '../../../lib/local/types';
import verifyUser from '../../../utils/verifyUser';

type PlacesSearchResponse = {
  places: BusinessPlace[];
  source: 'serper' | 'mock';
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlacesSearchResponse>,
) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(400).json({ error: 'q must be at least 2 characters' });
  }

  const country = typeof req.query.country === 'string' ? req.query.country : 'PL';

  if (getSerperPlacesApiKeys().length > 0) {
    try {
      const places = await fetchSerperPlaces(q, country);
      if (places.length > 0) {
        return res.status(200).json({ places, source: 'serper' });
      }
    } catch (err) {
      console.error('[local/places-search] serper error:', getErrorMessage(err));
    }
  }

  const places = searchPlaces(q);
  return res.status(200).json({ places, source: 'mock' });
}
