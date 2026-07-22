import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../lib/errors';
import { importGoogleBusinessDetails } from '../../../lib/local/googleBusinessInfo';
import type { BusinessDetails } from '../../../lib/local/types';
import verifyUser from '../../../utils/verifyUser';

type GbpImportResponse = {
  details: BusinessDetails;
  source: 'dataforseo' | 'serper' | 'mock';
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GbpImportResponse>,
) {
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
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  const website = typeof req.query.website === 'string' ? req.query.website.trim() : '';
  const country = typeof req.query.country === 'string' ? req.query.country : 'PL';

  try {
    const result = await importGoogleBusinessDetails(
      { name, address, phone, website },
      country,
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error('[local/gbp-import]', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}
