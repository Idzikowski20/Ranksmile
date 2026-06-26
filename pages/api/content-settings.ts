// GET/PUT /api/content-settings — shared Brand Knowledge + Custom Voices.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../utils/verifyUser';
import { readContentSettings, writeContentSettings } from '../../lib/contentSettings';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method === 'GET') {
    return res.status(200).json(await readContentSettings());
  }

  if (req.method === 'PUT') {
    const { brandName, brandKnowledge, voices } = req.body || {};
    const partial: any = {};
    if (brandName !== undefined) partial.brandName = String(brandName);
    if (brandKnowledge !== undefined) partial.brandKnowledge = String(brandKnowledge);
    if (Array.isArray(voices)) partial.voices = voices;
    return res.status(200).json(await writeContentSettings(partial));
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
