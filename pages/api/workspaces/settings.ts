// GET/PUT /api/workspaces/settings — general settings for the active workspace's domain.
// GET  → { name, domain, country, language, logoUrl, cc }
// PUT  { logoDataUrl } → uploads to R2 and stores domain.logo_url → { logoUrl }
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getActiveWorkspaceId } from '../../../lib/tenancy';
import { parseDataUrl, uploadImageBuffer } from '../../../lib/uploadToBlob';
import { SETUP_LOCATIONS } from '../../../lib/setupLocations';

// Logo data URLs can be a few MB — raise the JSON body limit above the 1mb default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

type DomainRow = {
   ID: number;
   domain: string | null;
   country: string | null;
   language: string | null;
   logo_url: string | null;
};

type Row = Record<string, unknown>;

async function selectOne(sql: string, replacements: unknown[]): Promise<Row | null> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows.length ? rows[0] : null;
}

/** ISO-3166 alpha-2 (for the flag) resolved from the stored country NAME. */
function ccForCountry(country: string | null): string | null {
   if (!country) return null;
   const match = SETUP_LOCATIONS.find((l) => l.country === country);
   return match ? match.cc : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   const workspaceId = await getActiveWorkspaceId(req, userId);
   if (!workspaceId) return res.status(404).json({ error: 'No active workspace' });

   const wsRow = await selectOne('SELECT name FROM workspaces WHERE id = ? LIMIT 1', [workspaceId]);
   const domainRow = await selectOne(
      'SELECT "ID", domain, country, language, logo_url FROM domain WHERE workspace_id = ? LIMIT 1',
      [workspaceId],
   ) as DomainRow | null;
   if (!domainRow) return res.status(404).json({ error: 'No domain in this workspace' });

   if (req.method === 'GET') {
      const country = domainRow.country ?? null;
      return res.status(200).json({
         name: wsRow ? String(wsRow.name ?? '') : '',
         domain: domainRow.domain ?? null,
         country,
         language: domainRow.language ?? null,
         logoUrl: domainRow.logo_url ?? null,
         cc: ccForCountry(country),
      });
   }

   if (req.method === 'PUT') {
      const { logoDataUrl } = req.body || {};
      if (typeof logoDataUrl !== 'string' || !logoDataUrl.startsWith('data:')) {
         return res.status(400).json({ error: 'logoDataUrl is required' });
      }
      const parsed = parseDataUrl(logoDataUrl);
      if (!parsed) return res.status(400).json({ error: 'Invalid image' });
      const url = await uploadImageBuffer(parsed.buffer, parsed.contentType, 'workspace-logo', 'workspace-logos');
      if (!url) return res.status(502).json({ error: 'Logo upload failed (R2 not configured?)' });
      await db.query('UPDATE domain SET logo_url = ? WHERE "ID" = ?', { replacements: [url, domainRow.ID] });
      return res.status(200).json({ logoUrl: url });
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
