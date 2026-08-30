// POST /api/articles/[id]/content-plan
// Runs Content Planner v2 from article score_data / competitor cache.
// body: { produceArticle?: boolean, persist?: boolean }
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { getErrorMessage } from '@/src/core/shared/errors';
import type { NlpTerm } from '@/src/infrastructure/articles/contentScore';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { safeJsonParse } from '@/src/core/shared/safeJson';
import {
  aiIntelFromScoreData,
  competitorsFromScoreData,
  competitorHeadingTitles,
  diagnosePlannerInputs,
  enrichWithCorpusClaims,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
} from '@/src/infrastructure/contentPlanner/fromArticleInputs';
import { runContentPlanner } from '@/src/infrastructure/contentPlanner/runContentPlanner';
import { writeOutlineBrief } from '@/src/infrastructure/contentPlanner/briefWriter';
import { importantTermsFromScoreData } from '@/src/infrastructure/articles/mergeArticleTerms';
import { readContentSettings } from '@/src/infrastructure/stores/contentSettings';
import { readArticleTerms } from '@/src/infrastructure/articles/articleTerms';
import { resolveOrgId, orgBudgetBlocked, recordAiTokens } from '@/src/infrastructure/ai/aiBudget';
import { mergedPlannerQuestions } from '@/src/infrastructure/coverage/coverageStore';
import { parseApprovedOutline, type ApprovedOutlineHeading } from '@/src/infrastructure/contentPlanner/applyApprovedOutline';
import { outlineForReview } from '@/src/infrastructure/contentPlanner/reviewOutline';
import { getResearchedFacts, withResearchedFacts } from '@/src/infrastructure/contentPlanner/researchFacts';
import {
  benchmarkDocsFromCompetitors,
  buildStructuralBenchmark,
  toPlannerTargets,
} from '@/src/infrastructure/benchmarkIntelligence/index';
import type { AdaptiveOutline } from '@/src/core/domain/contentPlanner/types';
import type { KnowledgeGraph } from '@/src/core/domain/knowledgeEngine/types';
import type { PlannerTargets, StructuralBenchmark } from '@/src/core/domain/benchmark/types';

/**
 * Structure-only rescue for a failed brief: the planner's own H1 and section headings,
 * with no instructions invented for them.
 */
function outlineHeadingsFromBundle(outline: AdaptiveOutline | null): ApprovedOutlineHeading[] {
  if (!outline) return [];
  const h1 = (outline.h1 || '').trim();
  const sections = (outline.sections || [])
    .map((section) => ({
      level: 2,
      text: (section.heading || '').trim(),
      ...(section.expectedWords > 0 ? { targetWords: Math.round(section.expectedWords) } : {}),
    }))
    .filter((section) => section.text);
  return [...(h1 ? [{ level: 1, text: h1 }] : []), ...sections];
}

type ArticlePlanRow = {
  id: number;
  content: string | null;
  target_keyword: string | null;
  score_data: string | null;
  competitor_outlines_cache: string | null;
  language: string | null;
  ai_info_to_cover: string | null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();
  // Cron secret, same as deep-analysis and generate: the outline sits between them in
  // the pipeline, and requiring a browser session here made the whole chain
  // unrunnable headlessly (eval suites, scripted regeneration).
  const { assertCronSecret } = await import('@/src/infrastructure/cron/cronAuth');
  const isCron = assertCronSecret(req);
  if (!isCron) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId)) {
    return res.status(400).json({ error: 'article id required' });
  }
  if (!isCron) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, articleId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }
  const articleIdSql = await getArticleIdSql();

  try {
    const rows = await db.query<ArticlePlanRow>(
      `SELECT id, target_keyword, score_data, competitor_outlines_cache, language, ai_info_to_cover
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

    // Read before the fresh plan overwrites it — a failed brief falls back to whatever
    // structure this article already had.
    const previousPlanner = scoreData?.content_planner_v2 && typeof scoreData.content_planner_v2 === 'object'
      ? scoreData.content_planner_v2 as Record<string, unknown>
      : null;

    const produceArticle = !!(req.body?.produceArticle);
    const persist = req.body?.persist !== false;

    let competitors = competitorsFromScoreData(scoreData);
    if (!competitors.length) {
      competitors = parseCompetitorCacheJson(row.competitor_outlines_cache);
    }
    competitors = enrichWithCorpusClaims(competitors, scoreData?.competitor_claims ?? null);
    competitors = enrichWithWieSynthesis(
      competitors,
      scoreData?.competitor_synthesis ?? null,
    );

    const researchedFacts = await getResearchedFacts({
      keyword: (row.target_keyword || '').trim(),
      language: row.language,
      scoreData: scoreData ?? {},
    });
    const ai = withResearchedFacts(aiIntelFromScoreData(scoreData), researchedFacts);
    // The coverage judge's own questions lead: the AI Search score is graded against
    // them, and planning without them wrote articles blind to their rubric — 4/10
    // covered on questions no section was ever asked to answer.
    const paa = mergedPlannerQuestions(row.ai_info_to_cover, scoreData?.paa_questions);

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

    // Read before the planner call — the blueprint's brand sections need the name.
    const contentSettings = await readContentSettings()
      .catch(() => ({ brandName: '', brandKnowledge: '', voices: [] }));

    const result = runContentPlanner({
      keyword,
      year: new Date().getFullYear(),
      allowBrandNiche: false,
      brandName: contentSettings.brandName,
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

    // Kept so the brief written further down can be added to exactly this document
    // instead of a Postgres-only jsonb_set — this route has to work on SQLite too.
    let persisted: Record<string, unknown> | null = null;

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
      persisted = next;
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(next), articleId] },
      );
    } else if (persist && !scoreData) {
      persisted = {
        content_planner_v2: {
          bundle: result.bundle,
          canWrite: result.canWrite,
          updatedAt: new Date().toISOString(),
        },
      };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(persisted), articleId] },
      );
    }

    // An empty outline is a failure, not an empty success: the planner gates on the
    // knowledge harvested by deep-analysis, so returning 200 + [] left the editor with
    // nothing but a generic "Could not generate an outline" and no way to see why.
    // Loaded here rather than at the top of the handler: only the outline branch needs it,
    // and the approvedOutline save path above returns long before this point.
    const brand = contentSettings;
    // Same list /generate compiles the write plan from — terms activated after the
    // analysis live only in article_terms, and a brief written against the stale half
    // would tell the writer to weave in words the editor does not grade.
    const tableTerms = await readArticleTerms(articleId).catch(() => []);

    // The brief is the first LLM spend this route ever made, and nothing stopped a client
    // from re-requesting an outline in a loop. Same gate every other generating route uses.
    const orgId = await resolveOrgId(req, res);
    const over = await orgBudgetBlocked(orgId);
    if (over) return res.status(429).json(over);

    // Brand knowledge finally reaches the planner. Without it the only company facts in
    // scope were the competitors', which is exactly how a rival's address, licence number
    // and testimonials ended up as instructions in a reviewed outline.
    const written = await writeOutlineBrief({
      keyword,
      bundle: result.bundle,
      brandKnowledge: brand.brandKnowledge,
      brandName: brand.brandName,
      importantTerms: importantTermsFromScoreData(scoreData ?? {}, { tableTerms }),
      headingTerms: (Array.isArray(scoreData?.terms) ? scoreData.terms as NlpTerm[] : [])
        .filter((t) => t.in_headings)
        .map((t) => t.term)
        .slice(0, 10),
      language: row.language || undefined,
      competitorHeadings: competitorHeadingTitles(row.competitor_outlines_cache),
      onTokens: (tokens) => recordAiTokens(orgId, tokens),
    });
    // Instructions are never reconstructed mechanically. reviewOutlineFromBundle used to
    // catch a failed brief and hand the reviewer "Pokryj <heading> z przypisanymi claims"
    // plus raw scraped sentences — a rival's opening hours as instructions for our writer.
    // The fallback below restores structure only: an earlier run's outline, or the
    // planner's own headings, so a failed brief costs the instructions and not the plan.
    let headings = written ?? [];
    if (!headings.length && result.bundle.outline && result.bundle.briefs.length) {
      // The brief writer failed, but the planner's own structure is already paid for.
      // Two ways out before giving up, in order of how much they preserve:
      //   1. the outline this article already had — an earlier run's reviewed structure;
      //   2. the plan's headings alone.
      // Instructions are NOT reconstructed. The old mechanical fallback filled them with
      // scraped competitor sentences, which is what made a failed brief worse than none;
      // headings the planner wrote are ours, and the reviewer can see the shape and retry.
      headings = outlineForReview({
        approvedOutline: previousPlanner?.approvedOutline,
        brief: previousPlanner?.brief,
      });
      if (!headings.length) headings = outlineHeadingsFromBundle(result.bundle.outline);
      if (!headings.length) {
        return res.status(503).json({
          error: 'Could not write the outline brief. Try again in a moment.',
          cause: 'brief_writer_failed',
          headings: [],
          canWrite: result.canWrite,
        });
      }
    }
    // Persisted, not just returned. The brief is the expensive part of this endpoint and
    // it used to live only in the reply: the editor rendered it into the TipTap document
    // and nothing else kept it. Every later read — a refresh, a second generation, the
    // same keyword after deleting the article — fell through to reviewOutlineFromBundle
    // and rebuilt the mechanical "Pokryj … / Cover: <scraped sentence>" version from the
    // bundle, so the LLM brief was paid for and thrown away on every run.
    if (headings.length && persisted) {
      const planner = (persisted.content_planner_v2 ?? {}) as Record<string, unknown>;
      // Stored as the approved outline too, not only as the brief. Restoring a review
      // reads `approvedOutline` first and the brief only as a fallback, and until the
      // reviewer edited a heading nothing ever wrote the first one — so a plan the
      // reviewer merely looked at came back as "nothing saved" and was planned again.
      const withBrief = {
        ...persisted,
        content_planner_v2: {
          ...planner,
          brief: written ?? headings,
          approvedOutline: headings,
          approvedOutlineAt: new Date().toISOString(),
        },
      };
      // The step the article is on, written down instead of inferred. Review used to be
      // recognised only from "empty content + a planner bundle", so anything that put a
      // byte into content — a stray autosave, a partial import — lost the step and sent
      // the reader back through the wizard. Only for an article nobody has written yet:
      // re-planning a finished article must not demote it to review.
      const awaitingReview = !(row.content || '').trim();
      try {
        await db.query(
          awaitingReview
            ? `UPDATE articles SET score_data = ?, status = 'review', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`
            : `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(withBrief), articleId] },
        );
      } catch (e) {
        // Not swallowed. Persisting the brief IS the fix this route exists for now — a
        // 200 with headings that were never stored puts the reviewer straight back into
        // the bug, losing the brief on the next refresh with nothing to explain it.
        console.warn('[content-plan] brief persist failed:', getErrorMessage(e));
        return res.status(503).json({
          error: 'The outline was created but could not be saved. Try again.',
          cause: 'brief_persist_failed',
          headings: [],
          canWrite: result.canWrite,
        });
      }
    }
    if (!headings.length) {
      const reason = [
        ...result.blueprintValidation.issues,
        ...result.outlineValidation.issues,
        ...result.briefValidation.issues,
      ].map((issue) => issue.message).find(Boolean);
      // Which data gap this is decides what the reader should do about it; the validator
      // code (`claims_too_low`) only names the gate that tripped.
      //
      // `finalizing` counts as running: job-progress sets it while results are still
      // being persisted, and mid-finish the reader was told to start an analysis that
      // was seconds from producing the very data they were missing.
      const analysisRunning = await db.query<{ id: string }>(
        `SELECT id FROM analysis_jobs
          WHERE article_id = ? AND job_type = 'deep_analysis'
            AND status IN ('queued', 'running', 'finalizing')
          LIMIT 1`,
        { replacements: [articleId], type: QueryTypes.SELECT },
      ).then((jobs) => jobs.length > 0).catch(() => false);
      const gap = diagnosePlannerInputs({
        scoreData,
        competitorCount: competitors.length,
        claimCount: result.bundle.targetKg.claims.length,
        analysisRunning,
      });
      return res.status(422).json({
        error: gap.message,
        cause: gap.code,
        validatorReason: reason ?? null,
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
