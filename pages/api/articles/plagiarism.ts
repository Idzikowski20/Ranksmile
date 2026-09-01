import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne } from '../../../lib/db/query';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { resolveContentLocale } from '../../../lib/domainLanguage';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId } = req.body;
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<{ content: string | null; language: string | null; domain: string | null; domain_id: number | null }>(
         `SELECT a.content, a.language, a.domain_id, d.domain
          FROM articles a
          LEFT JOIN domain d ON d."ID" = a.domain_id
          WHERE a.${articleIdSql} = ?
          LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const text = (article.content || '').toString();
      if (!text.trim()) return res.status(200).json({ available: true, checked: 0, matched: 0, uniqueness: 100, matches: [] });

      const locale = await resolveContentLocale({ domainId: article.domain_id, articleId: Number(articleId) });
      const data = await callSidecar('/plagiarism', {
         text,
         domain: article.domain || '',
         language: article.language || locale.languageCode,
      }, 90000);
      // Persist so the panel can restore it on reload without re-scanning.
      try {
         await db.query(
            `UPDATE articles SET plagiarism_json = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(data), articleId] },
         );
      } catch { /* non-fatal */ }
      return res.status(200).json(data);
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Plagiarism scan failed' });
   }
}

export default withOrgPaymentAccess(handler);
