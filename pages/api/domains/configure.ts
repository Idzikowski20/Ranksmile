// POST /api/domains/configure
// Creates a domain + site_context with selected language and pages
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const userId = await getCurrentUserId(req, res);
   const { domain: domainName, language = 'pl', pages = [] } = req.body;

   if (!domainName) return res.status(400).json({ error: 'domain is required' });

   try {
      const domainTrimmed = (domainName as string).trim();
      const slug = domainTrimmed
         .replaceAll('-', '_')
         .replaceAll('.', '-')
         .replaceAll('/', '-');

      // Create or find existing domain
      const [domain] = await Domain.findOrCreate({
         where: { domain: domainTrimmed },
         defaults: {
            domain: domainTrimmed,
            slug,
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
            userId: userId || null,
         } as any,
      });

      const domainId = domain.ID;

      // Create site_context entries
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
      }

      return res.status(200).json({ domainSlug: domain.slug, domainId });
   } catch (error: any) {
      console.error('[configure] Error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to configure domain' });
   }
}
