// POST /api/articles/[id]/generate
// Generates article content INTO an existing article (created by deep-analysis),
// reusing its target keyword + analysis. Planner First: Article Execution Plan
// must pass Plan Validator before the Python Write Engine is kicked off.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import axios from 'axios';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { readContentSettings } from '../../../../lib/contentSettings';
import { getDomainVoices } from '../../../../lib/domainVoices';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { resolveOrgId, orgBudgetBlocked } from '../../../../lib/aiBudget';
import { resolveContentLocale } from '../../../../lib/domainLanguage';
import { getErrorMessage } from '../../../../lib/errors';
import { nextjsUrl, sidecarUrl } from '../../../../lib/serviceUrls';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';
import { safeJsonParse } from '../../../../lib/safeJson';
import { pipelineVersionTag } from '../../../../lib/pipelineVersion';
import {
  aiIntelFromScoreData,
  competitorsFromScoreData,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
  competitorHeadingTitles,
} from '../../../../lib/contentPlanner/fromArticleInputs';
import {
  compileAndValidateWritePlan,
  finalizePlannerForWrite,
  runContentPlanner,
  applyApprovedOutlineToPlan,
  approvedOutlineWarnings,
  parseApprovedOutline,
  toSidecarCompiledPlan,
} from '../../../../lib/contentPlanner';
import {
  buildStructuralBenchmark,
  benchmarkDocsFromCompetitors,
  toPlannerTargets,
} from '../../../../lib/benchmarkIntelligence';
import {
  runKnowledgeEngine,
  shouldUseKnowledgePlanner,
} from '../../../../lib/knowledgeEngine';
import type { KnowledgeGraph } from '../../../../lib/knowledgeEngine';
import type { StructuralBenchmark, PlannerTargets } from '../../../../lib/benchmarkIntelligence';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

/** A claimed job with no update this long is presumed dead (killed function, timeout) and reclaimable. */
const GENERATE_STALE_MINUTES = 10;

type ArticleGenerateRow = {
  target_keyword: string;
  domain_id: number;
  language: string;
  score_data: string | null;
  competitor_outlines_cache: string | null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();

  const { assertCronSecret } = await import('../../../../lib/cronAuth');
  const isCron = assertCronSecret(req);
  if (!isCron) {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const articleIdNum = parseInt((req.query.id ?? req.query.articleId) as string, 10);
  if (!Number.isFinite(articleIdNum)) {
    return res.status(400).json({ error: 'article id required' });
  }

  if (!isCron) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, articleIdNum))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const orgId = await resolveOrgId(req, res);
    const over = await orgBudgetBlocked(orgId);
    if (over) return res.status(429).json(over);
  }

  const articleId = req.query.id;
  const {
    language, tone = 'professional',
    contentType, instructions = '', voiceId = 'serp',
    internalLinks = true, externalLinks = true, reviewOutline = false,
    approvedOutline = null,
  } = req.body || {};

  let jobId: string | null = null;
  try {
    const articleIdSql = await getArticleIdSql();

    // 0. One in-flight generation per article, enforced by a partial unique index
    // (idx_analysis_jobs_generate_inflight, see ensureArticlesTables) rather than a
    // plain check-then-act SELECT: the planner + Write Engine run for tens of seconds
    // between the old check and its INSERT, wide enough for two concurrent requests to
    // both pass the check, both spend an LLM run, and race two terminal callbacks onto
    // the same article row. Claiming the job row up front — before any of that work —
    // makes the guard atomic at the database level instead of racy in application code.
    jobId = `gen_${articleIdNum}_${Date.now()}`;
    const claimed = await db.query<{ id: string }>(
      `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'article_generate', 'queued', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (article_id) WHERE job_type = 'article_generate' AND status IN ('queued', 'running', 'finalizing')
       DO NOTHING
       RETURNING id`,
      { replacements: [jobId, articleIdNum], type: QueryTypes.SELECT },
    );
    if (!claimed[0]) {
      jobId = null;
      // Self-heal: a claim survives a thrown error via the catch blocks below, but not a
      // Vercel timeout or hard kill between the claim and the sidecar callback — that
      // leaves a 'queued'/'running' row with no reaper, permanently blocking this article
      // under the partial unique index. Reclaim it here if it's gone stale instead of
      // requiring an operator to clear it by hand.
      const isPg = Boolean(process.env.DATABASE_URL);
      const staleCutoff = isPg
        ? `updated_at < NOW() - INTERVAL '${GENERATE_STALE_MINUTES} minutes'`
        : `updated_at < datetime('now', '-${GENERATE_STALE_MINUTES} minutes')`;
      await db.query(
        `UPDATE analysis_jobs SET status = 'failed', error = 'stale in-flight claim reclaimed'
          WHERE article_id = ? AND job_type = 'article_generate'
            AND status IN ('queued', 'running', 'finalizing') AND ${staleCutoff}`,
        { replacements: [articleIdNum] },
      ).catch(() => {});
      jobId = `gen_${articleIdNum}_${Date.now()}`;
      const retried = await db.query<{ id: string }>(
        `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
         VALUES (?, ?, 'article_generate', 'queued', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (article_id) WHERE job_type = 'article_generate' AND status IN ('queued', 'running', 'finalizing')
         DO NOTHING
         RETURNING id`,
        { replacements: [jobId, articleIdNum], type: QueryTypes.SELECT },
      );
      if (!retried[0]) {
        jobId = null;
        const inflight = await db.query<{ id: string }>(
          `SELECT id FROM analysis_jobs
            WHERE article_id = ? AND job_type = 'article_generate'
              AND status IN ('queued', 'running', 'finalizing')
            ORDER BY created_at DESC LIMIT 1`,
          { replacements: [articleIdNum], type: QueryTypes.SELECT },
        );
        return res.status(409).json({
          error: 'generation_in_progress',
          message: 'This article is already being generated.',
          jobId: inflight[0]?.id,
          articleId,
        });
      }
    }

    // Every rejection below the claim must release the row: these are ordinary
    // res.status(...) returns (not throws), so the outer catch's cleanup never runs for
    // them — under the partial unique index a row left 'queued' here would permanently
    // 409 every future generate call for this article.
    const rejectClaim = async (status: number, body: Record<string, unknown>) => {
      if (jobId) {
        // Swallowed on failure rather than retried: a transient failure here doesn't
        // strand the article permanently — the stale-claim reclaim above frees it on the
        // next generate attempt once GENERATE_STALE_MINUTES elapses.
        await db.query("UPDATE analysis_jobs SET status = 'failed', error = ? WHERE id = ? AND status = 'queued'", {
          replacements: [String(body.error || body.message || 'validation_failed').slice(0, 500), jobId],
        }).catch((cleanupErr) => {
          console.error('[articles/[id]/generate] rejectClaim cleanup failed:', jobId, cleanupErr);
        });
      }
      return res.status(status).json(body);
    };

    // 1. Load the existing article (keyword + domain + analysed language + score_data)
    const articleRows = await db.query<ArticleGenerateRow>(
      `SELECT target_keyword, domain_id, language, score_data, competitor_outlines_cache
         FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const article = articleRows[0];
    if (!article) return rejectClaim(404, { error: 'Article not found' });
    const keyword = article.target_keyword;
    if (!keyword) return rejectClaim(400, { error: 'Article has no target keyword' });
    const locale = await resolveContentLocale({ domainId: article.domain_id, articleId: articleIdNum, bodyLanguage: language });
    const lang = article.language || locale.languageCode;

    // 2. Domain
    const domainRows = await db.query<{ domain: string }>(
      `SELECT domain FROM domain WHERE "ID" = ? LIMIT 1`,
      { replacements: [article.domain_id], type: QueryTypes.SELECT },
    );
    const domainName = domainRows[0]?.domain || '';

    // 3. Existing published articles for internal linking
    const existing = await db.query<{ id: number; title: string; meta_url: string }>(
      `SELECT id, title, meta_url FROM articles
       WHERE domain_id = ? AND status = 'published' AND meta_url IS NOT NULL AND meta_url != ''
       ORDER BY created_at DESC LIMIT 30`,
      { replacements: [article.domain_id], type: QueryTypes.SELECT },
    );
    const domainArticles = existing.map((a) => ({
      id: a.id, title: a.title, url: `https://${domainName}/${(a.meta_url || '').replace(/^\//, '')}`,
    }));

    // 4. Resolve content settings — Brand Knowledge (global) + per-domain voice tone.
    const cs = await readContentSettings();
    const brandKnowledge = cs.brandKnowledge || '';
    const domainVoices = await getDomainVoices(article.domain_id);
    const selectedVoice = voiceId && voiceId !== 'serp' ? domainVoices.find((v) => v.id === voiceId) : undefined;
    const voiceTone = selectedVoice?.description || '';
    const allowBrandNiche = false;
    // 5. Planner First — build + validate Article Execution Plan (Writer never decides structure).
    const scoreData = safeJsonParse<Record<string, unknown>>(article.score_data, {}) || {};
    let competitors = competitorsFromScoreData(scoreData);
    if (!competitors.length) {
      competitors = parseCompetitorCacheJson(article.competitor_outlines_cache);
    }
    competitors = enrichWithWieSynthesis(
      competitors,
      scoreData.competitor_synthesis ?? null,
    );
    const ai = aiIntelFromScoreData(scoreData);
    const paa = Array.isArray(scoreData.paa_questions)
      ? (scoreData.paa_questions as unknown[]).filter((q): q is string => typeof q === 'string')
      : [];

    // 5a. CIE — Benchmark + Knowledge Engine (never blocks generate on failure).
    const useKnowledgeEngine =
      process.env.USE_KNOWLEDGE_ENGINE === 'true'
      || process.env.USE_KNOWLEDGE_ENGINE === '1';
    let structuralBenchmark: StructuralBenchmark | null = null;
    let plannerTargets: PlannerTargets | null = null;
    let knowledgeGraph: KnowledgeGraph | null = null;
    let cieGate: { use: boolean; reason: string } = { use: false, reason: 'flag_off' };
    let cieWarning: string | null = null;

    try {
      const benchDocs = benchmarkDocsFromCompetitors(competitors);
      if (benchDocs.length) {
        structuralBenchmark = buildStructuralBenchmark(benchDocs);
        plannerTargets = toPlannerTargets(structuralBenchmark);
      }
      if (useKnowledgeEngine) {
        const extraTexts: Array<{ text: string; url: string; kind?: string }> = [];
        const pushExtra = (text: string, url: string, kind?: string) => {
          const t = text.trim();
          if (t.length >= 20) extraTexts.push({ text: t, url, kind });
        };
        for (const c of competitors) {
          for (const claim of c.claims || []) {
            pushExtra(claim, c.url || 'synthetic://competitor-claim', 'competitor');
          }
        }
        for (const c of ai.claims || []) {
          pushExtra(c, 'synthetic://ai-claim', 'ai_overview');
        }
        const wie = scoreData.competitor_synthesis;
        if (wie && typeof wie === 'object') {
          const w = wie as Record<string, unknown>;
          for (const key of ['expert_claims', 'critical'] as const) {
            const list = w[key];
            if (!Array.isArray(list)) continue;
            for (const item of list) {
              if (typeof item === 'string') {
                pushExtra(item, 'synthetic://wie-synthesis', 'industry');
              }
            }
          }
        }
        for (const q of paa) {
          pushExtra(q, 'synthetic://paa', 'paa');
        }
        const ke = await runKnowledgeEngine({
          keyword,
          outlinesCache: article.competitor_outlines_cache,
          scoreData,
          paaQuestions: paa,
          extraTexts,
        });
        knowledgeGraph = ke.graph;
        cieGate = shouldUseKnowledgePlanner(knowledgeGraph, true);
        if (!cieGate.use) {
          cieWarning = `knowledge_engine_fallback:${cieGate.reason}`;
          // below_floor: keep partial graph when topicBlocks exist (avoid SEO-template outline).
          if (cieGate.reason === 'below_floor' && knowledgeGraph?.topicBlocks?.length) {
            cieWarning = `${cieWarning}:partial_topic_blocks`;
          } else {
            knowledgeGraph = null;
          }
        }
      }
    } catch (cieErr) {
      cieWarning = `knowledge_engine_error:${getErrorMessage(cieErr) || 'unknown'}`;
      knowledgeGraph = null;
      cieGate = { use: false, reason: 'verifier_fail' };
      console.warn('[articles/[id]/generate] CIE skipped:', cieWarning);
    }

    const usePartialKg = Boolean(
      !cieGate.use
      && cieGate.reason === 'below_floor'
      && knowledgeGraph?.topicBlocks?.length,
    );
    const plannerResult = runContentPlanner({
      keyword,
      year: new Date().getFullYear(),
      allowBrandNiche,
      competitors,
      ai,
      paaQuestions: paa,
      produceArticle: false,
      knowledgeGraph: cieGate.use ? knowledgeGraph : null,
      topicBlocks: usePartialKg ? knowledgeGraph?.topicBlocks : null,
      plannerTargets,
      language: lang,
      commonHeadings: competitorHeadingTitles(article.competitor_outlines_cache),
    });
    const finalized = await finalizePlannerForWrite(plannerResult);

    const plannerPersist = {
      bundle: finalized.bundle,
      canWrite: finalized.canWrite,
      blueprintValidation: finalized.blueprintValidation,
      outlineValidation: finalized.outlineValidation,
      briefValidation: finalized.briefValidation,
      planValidation: finalized.planValidation ?? null,
      updatedAt: new Date().toISOString(),
    };
    const nextScore = {
      ...scoreData,
      content_planner_v2: plannerPersist,
      ...(structuralBenchmark ? { structural_benchmark: structuralBenchmark } : {}),
      // Persist graph when full CIE OR partial topic-block fallback.
      knowledge_graph: (cieGate.use || usePartialKg) && knowledgeGraph ? knowledgeGraph : null,
      ...(cieWarning ? { cie_warning: cieWarning } : {}),
      cie_gate: cieGate,
    };
    await db.query(
      `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [JSON.stringify(nextScore), articleId] },
    );

    const approvedHeadings = parseApprovedOutline(approvedOutline);

    let writePlan = finalized.bundle.executionPlan;
    if (!finalized.canWrite || !writePlan) {
      return rejectClaim(422, {
        error: 'plan_validation_failed',
        message: 'Article Execution Plan failed Plan Validator — Write Engine not started',
        canWrite: false,
        planValidation: finalized.planValidation ?? null,
        blueprintValidation: finalized.blueprintValidation,
        outlineValidation: finalized.outlineValidation,
        briefValidation: finalized.briefValidation,
        knowledgeCoverage: finalized.bundle.knowledgeCoverage,
      });
    }

    // Reviewer owns the structure: added / removed / reordered H2 is applied as-is,
    // benchmark shortfalls come back as warnings instead of blocking the write.
    let outlineWarnings: string[] = [];
    if (approvedHeadings.length > 0) {
      const approvedPlan = applyApprovedOutlineToPlan(writePlan, approvedHeadings);
      if (!approvedPlan) {
        return rejectClaim(422, {
          error: 'approved_outline_empty',
          message: 'The approved outline has no usable headings. Add at least one H2 before writing.',
        });
      }
      writePlan = approvedPlan;
      outlineWarnings = approvedOutlineWarnings(writePlan);
    }

    const compiledResult = compileAndValidateWritePlan(writePlan, {
      importantTerms: [],
      allowBrandNiche,
    });
    if (!compiledResult.ok) {
      return rejectClaim(422, {
        error: 'compiled_write_plan_invalid',
        issues: compiledResult.issues,
        diagnostics: compiledResult.diagnostics,
      });
    }

    const compiledWritePlan = toSidecarCompiledPlan(compiledResult.plan);
    await db.query(
      `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      {
        replacements: [
          JSON.stringify({ ...nextScore, compiled_write_plan: compiledResult.plan }),
          articleId,
        ],
      },
    );

    // 6. Build the sidecar payload (snake_case keys match the sidecar GenerateRequest).
    const sidecarPayload = {
      url: `https://${domainName}`,
      keyword,
      language: lang,
      tone,
      existing_articles: domainArticles,
      content_type: contentType,
      instructions,
      internal_links: internalLinks,
      external_links: externalLinks,
      review_outline: reviewOutline,
      brand_knowledge: allowBrandNiche ? brandKnowledge : '',
      voice_tone: voiceTone,
      compiled_write_plan: compiledWritePlan,
    };

    // 7. Fill in the job claimed at step 0, mark the article 'generating', kick off the sidecar.
    await db.query(
      'UPDATE analysis_jobs SET payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      { replacements: [JSON.stringify(sidecarPayload), jobId] },
    );
    await db.query(
      `UPDATE articles SET status = 'generating', pipeline_version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE ${articleIdSql} = ?`,
      { replacements: [pipelineVersionTag({ manualOutline: approvedHeadings.length > 0 }), articleId] },
    );

    const base = sidecarUrl();
    const appUrl = nextjsUrl();
    try {
      await axios.post(`${base}/pipeline/generate`,
        { jobId, payload: sidecarPayload, nextjsUrl: appUrl },
        { timeout: 15000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } });
    } catch (kickoffErr) {
      const e = kickoffErr as { response?: { data?: unknown }; message?: string };
      const detail = e?.response?.data || e?.message || 'sidecar unavailable';
      console.error('[articles/[id]/generate] kickoff failed:', detail);
      await db.query(`UPDATE analysis_jobs SET status = 'failed', error = ? WHERE id = ?`, { replacements: [String(detail).slice(0, 500), jobId] });
      await db.query(`UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`, { replacements: [articleId] });
      return res.status(502).json({ error: 'Generation service unavailable', detail });
    }

    return res.status(202).json({
      jobId,
      articleId,
      planHash: writePlan.planHash,
      diagnostics: compiledResult.diagnostics,
      ...(outlineWarnings.length ? { outlineWarnings } : {}),
    });
  } catch (error) {
    console.error('[articles/[id]/generate] error:', error);
    // A claimed-but-never-finished job would sit in 'queued' forever and permanently
    // block this article under the single-in-flight index (planner/validator errors
    // land here, before the sidecar-kickoff try/catch that already handles its own).
    if (jobId) {
      await db.query("UPDATE analysis_jobs SET status = 'failed', error = ? WHERE id = ? AND status = 'queued'", {
        replacements: [getErrorMessage(error).slice(0, 500), jobId],
      }).catch(() => {});
    }
    return res.status(500).json({ error: getErrorMessage(error) || 'Generation failed' });
  }
}

export default withOrgPaymentAccess(handler);
