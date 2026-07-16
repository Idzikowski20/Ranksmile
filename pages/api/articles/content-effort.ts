// POST /api/articles/content-effort  { articleId }
// LLM (or heuristic fallback) content-effort estimate — our score, not Google NSR.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { callSidecar } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, ArticleRow } from '../../../lib/db/query';
import { heuristicContentEffort, type ContentEffortInsight } from '../../../lib/contentEffort';
import { safeJsonParse } from '../../../lib/safeJson';
import type { ScoreData } from '../../../lib/contentScore';

export const config = { maxDuration: 60 };

type EffortBody = { score?: unknown; reasons?: unknown; source?: unknown };

function normalizeInsight(raw: EffortBody, fallback: ContentEffortInsight): ContentEffortInsight {
   const score = typeof raw.score === 'number' && Number.isFinite(raw.score)
      ? Math.max(0, Math.min(100, Math.round(raw.score)))
      : fallback.score;
   const reasons = Array.isArray(raw.reasons)
      ? raw.reasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim().slice(0, 200)).slice(0, 3)
      : fallback.reasons;
   const source = raw.source === 'llm' || raw.source === 'heuristic' ? raw.source : 'llm';
   return {
      score,
      reasons: reasons.length ? reasons : fallback.reasons,
      source,
      at: new Date().toISOString(),
   };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { articleId } = req.body as { articleId?: number };
   if (!articleId) return res.status(400).json({ error: 'articleId is required' });

   const userId = await getCurrentUserId(req, res);
   if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<Pick<ArticleRow, 'content' | 'meta_title' | 'meta_description' | 'target_keyword' | 'title' | 'score_data'>>(
         `SELECT content, meta_title, meta_description, target_keyword, title, score_data FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const html = article.content || '';
      const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const keyword = article.target_keyword || article.title || '';
      const scoreData = (typeof article.score_data === 'string'
         ? safeJsonParse<ScoreData>(article.score_data, {} as ScoreData)
         : (article.score_data as ScoreData | null)) || ({} as ScoreData);

      const heuristic = heuristicContentEffort({
         html,
         plainText,
         keyword,
         paaQuestions: scoreData.paa_questions,
      });

      let insight = heuristic;
      try {
         const articleContent = `${article.meta_title || ''}\n${article.meta_description || ''}\n${html}`;
         const data = await callSidecar<EffortBody>('/content-effort', {
            article_content: articleContent,
            keyword,
         });
         insight = normalizeInsight(data || {}, heuristic);
      } catch {
         insight = { ...heuristic, source: 'heuristic', at: new Date().toISOString() };
      }

      const prev = scoreData.content_effort;
      const history = [
         ...(Array.isArray(prev?.history) ? prev.history : []),
         ...(prev?.score != null && prev.at
            ? [{ score: prev.score, at: prev.at, source: prev.source }]
            : []),
      ].slice(-11);

      const nextScoreData: ScoreData = {
         ...scoreData,
         content_effort: {
            score: insight.score,
            reasons: insight.reasons,
            source: insight.source,
            at: insight.at,
            history,
         },
      };

      try {
         await db.query(
            `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(nextScoreData), articleId] },
         );
      } catch { /* non-fatal */ }

      return res.status(200).json(insight);
   } catch (err) {
      return res.status(500).json({ error: getErrorMessage(err) });
   }
}
