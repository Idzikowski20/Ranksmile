import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../utils/getUser';
import { readProfile, writeProfile } from '../../lib/userProfile';
import { parseDataUrl, uploadImageBuffer } from '../../lib/uploadToBlob';

// Avatar data URLs can be a few MB — raise the JSON body limit above the 1mb default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      return res.status(200).json(await readProfile(userId));
   }

   if (req.method === 'PUT') {
      const { name, avatarDataUrl } = req.body || {};
      const patch: { name?: string; avatarUrl?: string } = {};
      if (name !== undefined) patch.name = String(name).slice(0, 80);
      if (typeof avatarDataUrl === 'string' && avatarDataUrl.startsWith('data:')) {
         const parsed = parseDataUrl(avatarDataUrl);
         if (!parsed) return res.status(400).json({ error: 'Invalid image' });
         const url = await uploadImageBuffer(parsed.buffer, parsed.contentType, 'avatar', 'avatars');
         if (!url) return res.status(502).json({ error: 'Avatar upload failed (R2 not configured?)' });
         patch.avatarUrl = url;
      }
      return res.status(200).json(await writeProfile(userId, patch));
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
