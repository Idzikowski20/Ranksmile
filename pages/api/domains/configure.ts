// POST /api/domains/configure
// Creates a domain + site_context with selected language and pages
import type { CreationAttributes } from 'sequelize';
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getActiveWorkspaceId, getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { getWorkspace } from '../../../lib/workspaces';
import { getErrorMessage } from '../../../lib/errors';
import { mergeGscProperty } from '../../../lib/gscProperty';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const userId = await getCurrentUserId(req, res);
   const {
      domain: domainName,
      language = 'pl',
      country = null,
      languageName = null,
      pages = [],
      workspaceId: bodyWorkspaceId,
      gscSiteUrl,
   } = req.body;

   if (!domainName) return res.status(400).json({ error: 'domain is required' });

   try {
      const domainTrimmed = (domainName as string).trim();
      const slug = domainTrimmed
         .replaceAll('-', '_')
         .replaceAll('.', '-')
         .replaceAll('/', '-');

      let workspaceId = userId ? await getActiveWorkspaceId(req, userId) : null;
      if (userId && bodyWorkspaceId != null && bodyWorkspaceId !== '') {
         const explicitWs = Number(bodyWorkspaceId);
         const accessible = await getAccessibleWorkspaceIds(userId);
         if (Number.isInteger(explicitWs) && explicitWs > 0 && accessible.includes(explicitWs)) {
            workspaceId = explicitWs;
         }
      }

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
         } as CreationAttributes<Domain>,
      });

      if (!created && userId && workspaceId) {
         const existingWs = (domain as unknown as { workspace_id: number | null }).workspace_id;
         const wsIds = await getAccessibleWorkspaceIds(userId);
         const targetWs = await getWorkspace(userId, workspaceId);
         if (targetWs?.status === 'setup') {
            // Setup wizard: always attach the domain to the in-progress workspace.
            await db.query('UPDATE domain SET workspace_id = ? WHERE "ID" = ?', {
               replacements: [workspaceId, domain.ID],
            });
         } else if (existingWs == null || !wsIds.includes(Number(existingWs))) {
            return res.status(403).json({ error: 'Access denied.' });
         } else if (Number(existingWs) !== workspaceId) {
            return res.status(409).json({ error: 'This domain already belongs to another workspace.' });
         }
      } else if (!created) {
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

      // Persist the GSC property the user picked in setup so Performance uses the
      // correct siteUrl (URL-prefix vs sc-domain:), not a blind sc-domain: default.
      const gscSite = typeof gscSiteUrl === 'string' ? gscSiteUrl.trim() : '';
      if (gscSite) {
         try {
            const scJson = mergeGscProperty(domain.search_console, gscSite);
            await db.query('UPDATE domain SET search_console = ? WHERE "ID" = ?', {
               replacements: [scJson, domainId],
            });
         } catch {
            // non-fatal
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
   } catch (error) {
      console.error('[configure] Error:', error);
      return res.status(500).json({ error: getErrorMessage(error) || 'Failed to configure domain' });
   }
}
