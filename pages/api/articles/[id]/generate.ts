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
import {
  aiIntelFromScoreData,
  competitorsFromScoreData,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
} from '../../../../lib/contentPlanner/fromArticleInputs';
import {
  compileAndValidateWritePlan,
  finalizePlannerForWrite,
  runContentPlanner,
  toSidecarCompiledPlan,
  toSidecarExecutionPlan,
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
  } = req.body || {};

  try {
    const articleIdSql = await getArticleIdSql();

    // 1. Load the existing article (keyword + domain + analysed language + score_data)
    const articleRows = await db.query<ArticleGenerateRow>(
      `SELECT target_keyword, domain_id, language, score_data, competitor_outlines_cache
         FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const article = articleRows[0];
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const keyword = article.target_keyword;
    if (!keyword) return res.status(400).json({ error: 'Article has no target keyword' });
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
          knowledgeGraph = null;
        }
      }
    } catch (cieErr) {
      cieWarning = `knowledge_engine_error:${getErrorMessage(cieErr) || 'unknown'}`;
      knowledgeGraph = null;
      cieGate = { use: false, reason: 'verifier_fail' };
      console.warn('[articles/[id]/generate] CIE skipped:', cieWarning);
    }

    const plannerResult = runContentPlanner({
      keyword,
      year: new Date().getFullYear(),
      allowBrandNiche,
      competitors,
      ai,
      paaQuestions: paa,
      produceArticle: false,
      knowledgeGraph: cieGate.use ? knowledgeGraph : null,
      plannerTargets,
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
      ...(knowledgeGraph && cieGate.use ? { knowledge_graph: knowledgeGraph } : {}),
      ...(cieWarning ? { cie_warning: cieWarning } : {}),
      cie_gate: cieGate,
    };
    await db.query(
      `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [JSON.stringify(nextScore), articleId] },
    );

    if (!finalized.canWrite || !finalized.bundle.executionPlan) {
      return res.status(422).json({
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

    const compiledResult = compileAndValidateWritePlan(finalized.bundle.executionPlan, {
      importantTerms: [],
      allowBrandNiche,
    });
    if (!compiledResult.ok) {
      return res.status(422).json({
        error: 'compiled_write_plan_invalid',
        issues: compiledResult.issues,
        diagnostics: compiledResult.diagnostics,
      });
    }

    const executionPlan = toSidecarExecutionPlan(finalized.bundle.executionPlan);
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
      execution_plan: executionPlan,
      compiled_write_plan: compiledWritePlan,
    };

    // 7. Async: enqueue a job, mark the article 'generating', and kick off the sidecar.
    const jobId = `gen_${articleId}_${Date.now()}`;
    await db.query(
      `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'article_generate', 'queued', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: [jobId, articleIdNum, JSON.stringify(sidecarPayload)] },
    );
    await db.query(
      `UPDATE articles SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [articleId] },
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
      planHash: finalized.bundle.executionPlan.planHash,
      diagnostics: compiledResult.diagnostics,
    });
  } catch (error) {
    console.error('[articles/[id]/generate] error:', error);
    return res.status(500).json({ error: getErrorMessage(error) || 'Generation failed' });
  }
}

export default withOrgPaymentAccess(handler);
