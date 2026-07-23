// POST /api/articles/ai-readability  { articleId }
// Runs the LLM "AI Readability" rubric (10 criteria) on the article via the sidecar,
// persists the result, and returns { score, criteria }.
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
import { CoverageItem } from '../../../lib/aiCoverage';
import { mergeCoverageItems, parseSnapshot, buildSnapshot } from '../../../lib/coverageStore';
import { persistCoverageFeatureRun } from '../../../lib/persistCoverageFeatureRun';
import { safeJsonParse } from '../../../lib/safeJson';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const article = await queryOne<Pick<ArticleRow, 'content' | 'meta_title' | 'meta_description' | 'target_keyword' | 'title'> & { domain_id?: number | null }>(
         `SELECT content, meta_title, meta_description, target_keyword, title, domain_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
         [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const articleContent = `${article.meta_title || ''}\n${article.meta_description || ''}\n${article.content || ''}`;
      const data = await callSidecar('/ai-readability', { article_content: articleContent, keyword: article.target_keyword || article.title || '' });
      try {
         await db.query(
            `UPDATE articles SET ai_readability_json = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(data), articleId] },
         );
      } catch { /* non-fatal */ }

      // Merge fresh readability CoverageItems into the shared ai_info_to_cover snapshot so a
      // standalone "Analyze Content" run updates the Content Score gauge's coverage breakdown,
      // while preserving the paa/intent/entity items from the last deep-analysis run.
      // Additive + non-fatal — never blocks the ai_readability_json write or the response above.
      try {
         const readabilityItems: CoverageItem[] = Array.isArray((data as { coverage_items?: unknown })?.coverage_items)
            ? ((data as { coverage_items: CoverageItem[] }).coverage_items)
            : [];

         if (readabilityItems.length === 0) {
            // Sidecar returned no readability coverage items (empty/failed) — do NOT overwrite the
            // snapshot, which would delete the prior readability assessment. Leave ai_info_to_cover untouched.
            console.warn('[coverage] ai-readability returned no coverage_items — leaving snapshot unchanged');
         } else {
            const row = await queryOne<{ ai_info_to_cover: string | null }>(
               `SELECT ai_info_to_cover FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
               [articleId],
            );
            const rawSnapshot = row?.ai_info_to_cover;
            const parsedSnapshot = typeof rawSnapshot === 'string' ? safeJsonParse(rawSnapshot, null) : rawSnapshot;
            const prev = parseSnapshot(parsedSnapshot);
            const keep = prev ? prev.items.filter((i) => i.type !== 'readability') : [];

            const items = mergeCoverageItems({
               paa: keep, // ALL kept non-readability items via one bucket (forward-compat for future types)
               intent: [],
               readability: readabilityItems,
               entity: [],
            });

            // Re-grade using the prior verdicts already baked into the kept items + the fresh
            // readability items. This endpoint does NOT re-run the coverage judge, so preserve
            // prev's version metadata.
            const verdictItems = items.map((i) => ({ id: i.id, covered: i.covered, quality: i.quality, confidence: i.confidence ?? 1 }));
            const snapshot = buildSnapshot(items, {
               items: verdictItems,
               answersMainQuestionEarly: prev?.answersMainQuestionEarly ?? false,
            }, {
               judgeVersion: prev?.judgeVersion ?? 'v1|deepseek-chat|0',
               promptVersion: prev?.promptVersion ?? 'v1',
               model: prev?.model ?? 'deepseek-chat',
               createdAt: new Date().toISOString(),
            }, prev?.topics);

            await db.query(
               `UPDATE articles SET ai_info_to_cover = ? WHERE ${articleIdSql} = ?`,
               { replacements: [JSON.stringify(snapshot), articleId] },
            );

            await persistCoverageFeatureRun({
               snapshot,
               articleId: Number(articleId),
               domainId: article.domain_id != null ? Number(article.domain_id) : undefined,
               keyword: article.target_keyword || article.title || undefined,
            }).catch((err: unknown) => {
               console.warn('[coverage] feature store persist failed (non-fatal):', getErrorMessage(err));
            });
         }
      } catch (err) {
         console.warn('[coverage] ai-readability snapshot merge failed', err);
      }

      return res.status(200).json(data);
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'AI readability failed' });
   }
}
