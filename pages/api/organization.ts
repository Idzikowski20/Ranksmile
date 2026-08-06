import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../utils/getUser';
import { readOrganization, writeOrganization } from '../../lib/organization';
import ORG_NAME_MAX_LENGTH from '../../lib/organizationLimits';
import { parseDataUrl, uploadImageBuffer } from '../../lib/uploadToBlob';
import { assertCanManage } from '../../lib/members';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

// Logo data URLs can be a few MB — raise the JSON body limit above the 1mb default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      return res.status(200).json(await readOrganization(userId));
   }

   if (req.method === 'PUT') {
      // The org name and logo are shared by everyone in it — only owners/admins may
      // change them. GET stays open: reading your own org's identity is harmless.
      try { await assertCanManage(userId); } catch { return res.status(403).json({ error: 'FORBIDDEN' }); }
      const { name, logoDataUrl } = req.body || {};
      const patch: { name?: string; logoUrl?: string | null } = {};

      if (name !== undefined) {
         // The name labels the org across the app and in invite subject lines, so a
         // blank or whitespace-only value is rejected rather than silently stored.
         const trimmed = String(name).trim();
         if (!trimmed) return res.status(400).json({ error: 'Organization name is required' });
         patch.name = trimmed.slice(0, ORG_NAME_MAX_LENGTH);
      }

      // `null` clears the logo (the settings form's Remove); a data URL replaces it.
      if (logoDataUrl === null) {
         patch.logoUrl = null;
      } else if (typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:')) {
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

export default withOrgPaymentAccess(handler);
