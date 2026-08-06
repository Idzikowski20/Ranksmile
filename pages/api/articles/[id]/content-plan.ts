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
  competitorHeadingTitles,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
} from '../../../../lib/contentPlanner/fromArticleInputs';
import { runContentPlanner } from '../../../../lib/contentPlanner/runContentPlanner';
import { reviewOutlineFromBundle } from '../../../../lib/contentPlanner/reviewOutline';
import { parseApprovedOutline } from '../../../../lib/contentPlanner/applyApprovedOutline';
import {
  benchmarkDocsFromCompetitors,
  buildStructuralBenchmark,
  toPlannerTargets,
} from '../../../../lib/benchmarkIntelligence';
import type { KnowledgeGraph } from '../../../../lib/knowledgeEngine/types';
import type { PlannerTargets, StructuralBenchmark } from '../../../../lib/benchmarkIntelligence/types';

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

    // Persist the reviewer's edited outline without re-planning. Manual edits live only
    // in the TipTap document otherwise, so leaving review discarded them.
    if (req.body?.approvedOutline !== undefined) {
      const approvedOutline = parseApprovedOutline(req.body.approvedOutline);
      const planner = scoreData?.content_planner_v2 && typeof scoreData.content_planner_v2 === 'object'
        ? scoreData.content_planner_v2 as Record<string, unknown>
        : {};
      const next = {
        ...(scoreData || {}),
        content_planner_v2: {
          ...planner,
          approvedOutline,
          approvedOutlineAt: new Date().toISOString(),
        },
      };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(next), articleId] },
      );
      return res.status(200).json({ ok: true, saved: approvedOutline.length });
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

    const keyword = (row.target_keyword || '').trim();
    if (!keyword) {
      return res.status(400).json({ error: 'Article has no target keyword' });
    }

    // Reuse CIE snapshot when present so re-runs do not wipe Execution Plan / AO patching inputs.
    const storedGraph = scoreData?.knowledge_graph && typeof scoreData.knowledge_graph === 'object'
      ? (scoreData.knowledge_graph as KnowledgeGraph)
      : null;
    const storedGate = scoreData?.cie_gate && typeof scoreData.cie_gate === 'object'
      ? scoreData.cie_gate as { reason?: unknown }
      : null;
    const usePartialTopics = storedGate?.reason === 'below_floor';
    const storedBenchmark = scoreData?.structural_benchmark && typeof scoreData.structural_benchmark === 'object'
      ? (scoreData.structural_benchmark as StructuralBenchmark)
      : null;
    const benchmarkDocs = benchmarkDocsFromCompetitors(competitors);
    const benchmark = storedBenchmark || (benchmarkDocs.length ? buildStructuralBenchmark(benchmarkDocs) : null);
    const plannerTargets: PlannerTargets | null = benchmark ? toPlannerTargets(benchmark) : null;

    const result = runContentPlanner({
      keyword,
      year: new Date().getFullYear(),
      allowBrandNiche: false,
      competitors,
      ai,
      paaQuestions: paa,
      produceArticle,
      knowledgeGraph: usePartialTopics ? null : storedGraph,
      topicBlocks: usePartialTopics ? storedGraph?.topicBlocks : null,
      plannerTargets,
      language: row.language || undefined,
      commonHeadings: competitorHeadingTitles(row.competitor_outlines_cache),
    });

    if (persist && scoreData) {
      const prevPlanner = scoreData.content_planner_v2 && typeof scoreData.content_planner_v2 === 'object'
        ? (scoreData.content_planner_v2 as Record<string, unknown>)
        : null;
      const prevBundle = prevPlanner?.bundle && typeof prevPlanner.bundle === 'object'
        ? (prevPlanner.bundle as Record<string, unknown>)
        : null;
      const next = {
        ...scoreData,
        content_planner_v2: {
          // A fresh plan intentionally drops any saved approvedOutline: the reviewer
          // asked for a new structure, so their edits to the old one no longer apply.
          bundle: {
            ...result.bundle,
            // Preserve CIE write artifacts when this endpoint rebuilds without finalize.
            executionPlan: result.bundle.executionPlan ?? prevBundle?.executionPlan ?? null,
            quickAnswer: result.bundle.quickAnswer ?? prevBundle?.quickAnswer ?? null,
            knowledgeCoverage: result.bundle.knowledgeCoverage ?? prevBundle?.knowledgeCoverage ?? null,
          },
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

    // An empty outline is a failure, not an empty success: the planner gates on the
    // knowledge harvested by deep-analysis, so returning 200 + [] left the editor with
    // nothing but a generic "Could not generate an outline" and no way to see why.
    const headings = reviewOutlineFromBundle(result.bundle);
    if (!headings.length) {
      const reason = [
        ...result.blueprintValidation.issues,
        ...result.outlineValidation.issues,
        ...result.briefValidation.issues,
      ].map((issue) => issue.message).find(Boolean);
      return res.status(422).json({
        error: reason
          ? `Outline planner has too little analysis data: ${reason}. Re-run the article analysis, then try again.`
          : 'Outline planner produced no sections — re-run the article analysis, then try again.',
        headings: [],
        canWrite: result.canWrite,
        validations: {
          blueprint: result.blueprintValidation,
          outline: result.outlineValidation,
          brief: result.briefValidation,
        },
        claimCount: result.bundle.targetKg.claims.length,
        questionCount: result.bundle.targetKg.questions.length,
      });
    }

    return res.status(200).json({
      ok: true,
      canWrite: result.canWrite,
      blueprint: result.bundle.blueprint,
      outline: result.bundle.outline,
      headings,
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
