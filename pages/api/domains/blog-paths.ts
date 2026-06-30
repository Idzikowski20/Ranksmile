// GET/PUT /api/domains/blog-paths?slug=... — read/write domain.blog_paths (JSON array)
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../utils/verifyDomainOwnership';
import { normalizeBlogPaths } from '../../../lib/blogPaths';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   const slug = (req.query.slug as string) || (req.body?.slug as string);
   const ownership = await verifyDomainOwnershipBySlug(slug, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   if (req.method === 'GET') {
      const rows = await db.query<{ blog_paths: string | null }>(
         `SELECT blog_paths FROM domain WHERE "ID" = ?`,
         { replacements: [domainId], type: QueryTypes.SELECT },
      );
      let paths: string[] = [];
      try { paths = JSON.parse(rows[0]?.blog_paths || '[]'); } catch { paths = []; }
      return res.status(200).json({ blogPaths: paths });
   }

   if (req.method === 'PUT') {
      const input = Array.isArray(req.body?.blogPaths) ? (req.body.blogPaths as string[]) : [];
      const normalized = normalizeBlogPaths(input);
      await db.query(`UPDATE domain SET blog_paths = ? WHERE "ID" = ?`, {
         replacements: [JSON.stringify(normalized), domainId],
      });
      return res.status(200).json({ blogPaths: normalized });
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
