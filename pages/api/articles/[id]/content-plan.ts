// POST /api/articles/[id]/content-plan
// Runs Content Planner v2 from article score_data / competitor cache.
// body: { produceArticle?: boolean, persist?: boolean }
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { getErrorMessage } from '../../../../lib/errors';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';
import { safeJsonParse } from '../../../../lib/safeJson';
import {
  aiIntelFromScoreData,
  competitorsFromScoreData,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
} from '../../../../lib/contentPlanner/fromArticleInputs';
import { runContentPlanner } from '../../../../lib/contentPlanner/runContentPlanner';

type ArticlePlanRow = {
  id: number;
  target_keyword: string | null;
  score_data: string | null;
  competitor_outlines_cache: string | null;
  language: string | null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getCurrentUserId(req, res);
  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId) || !(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const articleIdSql = await getArticleIdSql();

  try {
    const rows = await db.query<ArticlePlanRow>(
      `SELECT id, target_keyword, score_data, competitor_outlines_cache, language
         FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Article not found' });

    const scoreData = safeJsonParse<Record<string, unknown> | null>(row.score_data, null);
    if (req.method === 'GET') {
      const existing = scoreData?.content_planner_v2 ?? null;
      return res.status(200).json({ ok: true, content_planner_v2: existing });
    }

    const produceArticle = !!(req.body?.produceArticle);
    const persist = req.body?.persist !== false;

    let competitors = competitorsFromScoreData(scoreData);
    if (!competitors.length) {
      competitors = parseCompetitorCacheJson(row.competitor_outlines_cache);
    }
    competitors = enrichWithWieSynthesis(
      competitors,
      scoreData?.competitor_synthesis ?? null,
    );

    const ai = aiIntelFromScoreData(scoreData);
    const paa = Array.isArray(scoreData?.paa_questions)
      ? (scoreData!.paa_questions as unknown[]).filter((q): q is string => typeof q === 'string')
      : [];

    const keyword = (row.target_keyword || '').trim() || 'untitled';
    const result = runContentPlanner({
      keyword,
      year: new Date().getFullYear(),
      allowBrandNiche: false,
      competitors,
      ai,
      paaQuestions: paa,
      produceArticle,
    });

    if (persist && scoreData) {
      const next = {
        ...scoreData,
        content_planner_v2: {
          bundle: result.bundle,
          canWrite: result.canWrite,
          blueprintValidation: result.blueprintValidation,
          outlineValidation: result.outlineValidation,
          briefValidation: result.briefValidation,
          postWrite: result.postWrite ?? null,
          updatedAt: new Date().toISOString(),
        },
      };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(next), articleId] },
      );
    } else if (persist && !scoreData) {
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        {
          replacements: [
            JSON.stringify({
              content_planner_v2: {
                bundle: result.bundle,
                canWrite: result.canWrite,
                updatedAt: new Date().toISOString(),
              },
            }),
            articleId,
          ],
        },
      );
    }

    return res.status(200).json({
      ok: true,
      canWrite: result.canWrite,
      blueprint: result.bundle.blueprint,
      outline: result.bundle.outline,
      reader: result.bundle.reader,
      benchmark: result.bundle.benchmark,
      validations: {
        blueprint: result.blueprintValidation,
        outline: result.outlineValidation,
        brief: result.briefValidation,
        postWrite: result.postWrite ?? null,
      },
      html: produceArticle ? result.html : undefined,
      claimCount: result.bundle.targetKg.claims.length,
      questionCount: result.bundle.targetKg.questions.length,
    });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'content-plan failed' });
  }
}

export default withOrgPaymentAccess(handler);
