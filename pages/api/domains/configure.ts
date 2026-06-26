// POST /api/domains/configure
// Creates a domain + site_context with selected language and pages
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getActiveWorkspaceId, getAccessibleWorkspaceIds } from '../../../lib/tenancy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const userId = await getCurrentUserId(req, res);
   const { domain: domainName, language = 'pl', country = null, languageName = null, pages = [] } = req.body;

   if (!domainName) return res.status(400).json({ error: 'domain is required' });

   try {
      const domainTrimmed = (domainName as string).trim();
      const slug = domainTrimmed
         .replaceAll('-', '_')
         .replaceAll('.', '-')
         .replaceAll('/', '-');

      const workspaceId = userId ? await getActiveWorkspaceId(req, userId) : null;

      // Create or find existing domain
      const [domain, created] = await Domain.findOrCreate({
         where: { domain: domainTrimmed },
         defaults: {
            domain: domainTrimmed,
            slug,
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
            userId: userId || null,
            workspace_id: workspaceId,
         } as any,
      });

      if (!created) {
         const existingWs = (domain as unknown as { workspace_id: number | null }).workspace_id;
         const wsIds = await getAccessibleWorkspaceIds(userId);
         if (existingWs == null || !wsIds.includes(Number(existingWs))) {
            return res.status(403).json({ error: 'Access denied.' });
         }
      }

      const domainId = domain.ID;

      // Persist the picked location on the workspace's domain (country/language NAMES,
      // e.g. 'Poland' / 'Polish') so Workspace settings can show the real values.
      if (country || languageName) {
         try {
            await db.query('UPDATE domain SET country = ?, language = ? WHERE "ID" = ?', {
               replacements: [country || null, languageName || null, domainId],
            });
         } catch {
            // non-fatal — location is a display nicety, not required for setup
         }
      }

      // Create site_context entries + skeleton articles for each page
      const pagesToInsert: string[] = pages.length > 0
         ? (pages as string[]).filter(Boolean)
         : [`https://${domainTrimmed}`];

      for (const pageUrl of pagesToInsert) {
         try {
            await db.query(
               `INSERT INTO site_context (domain_id, url, language, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
               { replacements: [domainId, pageUrl.trim(), language] },
            );
         } catch {
            // ignore duplicate entries
         }

         // Create skeleton article so deep-analysis can find & update it
         try {
            const articleSlug = pageUrl
               .replace(/https?:\/\//, '')
               .replace(/[^a-z0-9]/gi, '-')
               .substring(0, 60);
            await db.query(
               `INSERT INTO articles (domain_id, title, slug, meta_url, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
               { replacements: [domainId, pageUrl.trim(), articleSlug, pageUrl.trim()] },
            );
         } catch {
            // article may already exist — skip
         }
      }

      return res.status(200).json({ domainSlug: domain.slug, domainId });
   } catch (error: any) {
      console.error('[configure] Error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to configure domain' });
   }
}
