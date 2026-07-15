import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getDomainLocale } from '../../../../lib/domainLanguage';
import { topicsNeedLocalization } from '../../../../lib/domainLanguagePrompts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   const locale = await getDomainLocale(domainId);

   const topics = await db.query<{
      id: number; domain_id: number; title: string; summary: string | null; created_at: string;
   }>(
      `SELECT * FROM domain_topics WHERE domain_id = ? ORDER BY id`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   const titles = topics.map((t) => t.title);
   return res.status(200).json({
      topics,
      locale,
      needsLocalization: topicsNeedLocalization(titles, locale.languageCode),
   });
}
