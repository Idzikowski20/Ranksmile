import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../utils/getUser';
import { readOrganization, writeOrganization } from '../../lib/organization';
import { parseDataUrl, uploadImageBuffer } from '../../lib/uploadToBlob';

// Logo data URLs can be a few MB — raise the JSON body limit above the 1mb default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      return res.status(200).json(await readOrganization(userId));
   }

   if (req.method === 'PUT') {
      const { name, logoDataUrl } = req.body || {};
      const patch: { name?: string; logoUrl?: string } = {};
      if (name !== undefined) patch.name = String(name).slice(0, 80);
      if (typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:')) {
         const parsed = parseDataUrl(logoDataUrl);
         if (!parsed) return res.status(400).json({ error: 'Invalid image' });
         const url = await uploadImageBuffer(parsed.buffer, parsed.contentType, 'org-logo', 'org-logos');
         if (!url) return res.status(502).json({ error: 'Logo upload failed (R2 not configured?)' });
         patch.logoUrl = url;
      }
      return res.status(200).json(await writeOrganization(userId, patch));
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
