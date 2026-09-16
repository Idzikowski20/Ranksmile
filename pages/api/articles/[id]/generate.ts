// POST /api/articles/[id]/generate
// Generates article content INTO an existing article (created by deep-analysis),
// reusing its target keyword + analysis. Planner First: Article Execution Plan
// must pass Plan Validator before the Python Write Engine is kicked off.
import type { NextApiRequest, NextApiResponse } from 'next';
import { isDomainBusy, DOMAIN_BUSY_MESSAGE } from '@/src/infrastructure/cron/domainLock';
import { QueryTypes } from 'sequelize';
import axios from 'axios';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { readContentSettings } from '@/src/infrastructure/stores/contentSettings';
import { getDomainVoices } from '@/src/infrastructure/seo/domainVoices';
import { getDomainTemplates } from '@/src/infrastructure/seo/domainTemplates';
import { assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { resolveOrgId, orgBudgetBlocked, recordAiTokens } from '@/src/infrastructure/ai/aiBudget';
import { mergedPlannerQuestions } from '@/src/infrastructure/coverage/coverageStore';
import { resolveContentLocale } from '@/src/infrastructure/config/domainLanguage';
import { getErrorMessage } from '@/src/core/shared/errors';
import { nextjsUrl, sidecarUrl } from '@/src/infrastructure/config/serviceUrls';
import { getResearchedFacts, withResearchedFacts } from '@/src/infrastructure/contentPlanner/researchFacts';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { safeJsonParse } from '@/src/core/shared/safeJson';
import { llmGateway } from '@/src/infrastructure/ai/llmGateway';
import { gatherBlogUrls } from '@/src/infrastructure/seo/gatherBlogUrls';
import { pickLinkTargets } from '@/src/core/domain/seo/sitemapLinkTargets';
import { pipelineVersionTag } from '@/src/core/domain/pipeline/pipelineVersion';
import {
  aiIntelFromScoreData,
  competitorsFromScoreData,
  enrichWithCorpusClaims,
  enrichWithWieSynthesis,
  parseCompetitorCacheJson,
  competitorHeadingTitles,
  competitorPageTitles,
} from '@/src/infrastructure/contentPlanner/fromArticleInputs';
import {
  compileAndValidateWritePlan,
  finalizePlannerForWrite,
  runContentPlanner,
  applyApprovedOutlineToPlan,
  approvedOutlineWarnings,
  parseApprovedOutline,
  toSidecarCompiledPlan,
} from '@/src/infrastructure/contentPlanner/index';
import {
  buildStructuralBenchmark,
  benchmarkDocsFromCompetitors,
  toPlannerTargets,
  clampPlannerWordsToScorer,
} from '@/src/infrastructure/benchmarkIntelligence/index';
import {
  runKnowledgeEngine,
  shouldUseKnowledgePlanner,
} from '@/src/infrastructure/knowledgeEngine/index';
import type { KnowledgeGraph } from '@/src/infrastructure/knowledgeEngine/index';
import type { StructuralBenchmark, PlannerTargets } from '@/src/infrastructure/benchmarkIntelligence/index';
import { importantTermsFromScoreData } from '@/src/infrastructure/articles/mergeArticleTerms';
import { readArticleTerms } from '@/src/infrastructure/articles/articleTerms';
import { writeOutlineBrief } from '@/src/infrastructure/contentPlanner/briefWriter';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';
import db from '../../../../database/database';

/** Bounds the brief LLM call: nothing else force-kills this request, so an unbounded
 *  completion would hang it forever and starve the compile and the sidecar kickoff. */
const BRIEF_TIMEOUT_MS = 25_000;

/** Readable title from a URL's last path segment — page_audits often stores a null title. */
function titleFromSlug(url: string): string {
  const seg = url.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || '';
  const words = seg.replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : url;
}

/** A claimed job with no update this long is presumed dead (killed function, timeout) and reclaimable. */
const GENERATE_STALE_MINUTES = 10;

type ArticleGenerateRow = {
  target_keyword: string;
  domain_id: number;
  language: string;
  score_data: string | null;
  competitor_outlines_cache: string | null;
  ai_info_to_cover: string | null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();

  const { assertCronSecret } = await import('@/src/infrastructure/cron/cronAuth');
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

  // Kept in scope past the gate: the brief call further down spends tokens against the
  // same pool, and a gate that never sees what it authorised stops metering anything.
  let orgId: number | null = null;
  if (!isCron) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, articleIdNum))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    orgId = await resolveOrgId(req, res);
    const over = await orgBudgetBlocked(orgId);
    if (over) return res.status(429).json(over);
  }

  const articleId = req.query.id;
  const {
    language, tone = 'professional',
    contentType, instructions = '', voiceId = 'serp', templateId = '',
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
      // process crash or a deploy restart between the claim and the sidecar kickoff — that
      // leaves a 'queued' row with no reaper, permanently blocking this article under the
      // partial unique index. Reclaim it here if it's gone stale instead of requiring an
      // operator to clear it by hand.
      //
      // Only 'queued' is eligible: the window between the claim and the sidecar kickoff is
      // seconds of local work, so GENERATE_STALE_MINUTES is a generous margin for a row that
      // never got there. 'running'/'finalizing' rows are a live sidecar generation with
      // its own heartbeat (job-progress bumps updated_at on every status/stream event) —
      // reclaiming those on a flat timeout would start a duplicate LLM run racing the one
      // still in flight.
      const isPg = Boolean(process.env.DATABASE_URL);
      const staleCutoff = isPg
        ? `updated_at < NOW() - INTERVAL '${GENERATE_STALE_MINUTES} minutes'`
        : `updated_at < datetime('now', '-${GENERATE_STALE_MINUTES} minutes')`;
      await db.query(
        `UPDATE analysis_jobs SET status = 'failed', error = 'stale in-flight claim reclaimed'
          WHERE article_id = ? AND job_type = 'article_generate'
            AND status = 'queued' AND ${staleCutoff}`,
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
      `SELECT target_keyword, domain_id, language, score_data, competitor_outlines_cache, ai_info_to_cover
         FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const article = articleRows[0];
    if (!article) return rejectClaim(404, { error: 'Article not found' });
    const keyword = article.target_keyword;
    if (!keyword) return rejectClaim(400, { error: 'Article has no target keyword' });
    // rejectClaim, not a bare 409: the job row was already claimed above, and a plain
    // return would strand it 'queued' — permanently 409-ing every future generate.
    const busyReason = await isDomainBusy(article.domain_id);
    if (busyReason) {
      return rejectClaim(409, { error: 'DOMAIN_BUSY', reason: busyReason, message: DOMAIN_BUSY_MESSAGE[busyReason] });
    }
    const locale = await resolveContentLocale({ domainId: article.domain_id, articleId: articleIdNum, bodyLanguage: language });
    const lang = article.language || locale.languageCode;

    // 2. Domain
    const domainRows = await db.query<{ domain: string }>(
      'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
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
    // Content template: reusable reference content whose structure the article mirrors.
    // Explicit id, else the domain default (Surfer's default:true), else none.
    const domainTemplates = await getDomainTemplates(article.domain_id);
    const selectedTemplate = templateId
      ? domainTemplates.find((t) => t.id === templateId)
      : domainTemplates.find((t) => t.isDefault);
    const templateReference = selectedTemplate?.referenceText || '';
    const allowBrandNiche = false;
    // 5. Planner First — build + validate Article Execution Plan (Writer never decides structure).
    const scoreData = safeJsonParse<Record<string, unknown>>(article.score_data, {}) || {};
    let competitors = competitorsFromScoreData(scoreData);
    if (!competitors.length) {
      competitors = parseCompetitorCacheJson(article.competitor_outlines_cache);
    }
    competitors = enrichWithCorpusClaims(competitors, scoreData.competitor_claims ?? null);
    competitors = enrichWithWieSynthesis(
      competitors,
      scoreData.competitor_synthesis ?? null,
    );
    const researchedFacts = await getResearchedFacts({
      keyword,
      language: lang,
      scoreData,
    });
    const ai = withResearchedFacts(aiIntelFromScoreData(scoreData), researchedFacts);
    // Coverage-judge questions lead — the AI Search score grades against exactly these.
    // Shared helper so review and straight-generate plan from an identical question set.
    const paa = mergedPlannerQuestions(article.ai_info_to_cover, scoreData.paa_questions);

    // 5a. CIE — Benchmark + Knowledge Engine (never blocks generate on failure).
    const useKnowledgeEngine = process.env.USE_KNOWLEDGE_ENGINE === 'true'
      || process.env.USE_KNOWLEDGE_ENGINE === '1';
    let structuralBenchmark: StructuralBenchmark | null = null;
    let plannerTargets: PlannerTargets | null = null;
    let knowledgeGraph: KnowledgeGraph | null = null;
    let cieGate: { use: boolean; reason: string } = { use: false, reason: 'flag_off' };
    let cieWarning: string | null = null;

    try {
      // Prefer the benchmark deep-analysis stored, exactly as /content-plan does. Deriving
      // it only from `competitors` here meant the two endpoints planned against different
      // structural targets whenever the competitor rows had lost the fields
      // benchmarkDocsFromCompetitors needs: the outline passed its gate in /content-plan
      // and the same article then failed the write gate, with no way to tell why.
      const storedBenchmark = scoreData.structural_benchmark && typeof scoreData.structural_benchmark === 'object'
        ? (scoreData.structural_benchmark as StructuralBenchmark)
        : null;
      const benchDocs = benchmarkDocsFromCompetitors(competitors);
      structuralBenchmark = storedBenchmark
        ?? (benchDocs.length ? buildStructuralBenchmark(benchDocs) : null);
      if (structuralBenchmark) {
        plannerTargets = clampPlannerWordsToScorer(
          toPlannerTargets(structuralBenchmark),
          typeof scoreData.words_target === 'number' ? scoreData.words_target : null,
        );
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
          // Rewrites scraped competitor prose into atomic facts and merges duplicates so
          // claims carry real source counts. The gateway is injected rather than imported
          // by the engine, which must stay free of the database for its unit tests.
          normalizeCompletion: async (prompt) => {
            const { text } = await llmGateway({
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              maxTokens: 3000,
              responseFormat: 'json_object',
              jobType: 'knowledge_normalize_claims',
              keyword,
              workspaceId: orgId == null ? undefined : String(orgId),
            });
            // Charged to the org's shared pool like every other completion here. Without
            // this the stage spent up to 3000 completion tokens per batch that the 5-hour
            // budget never saw, so repeated generates walked straight past the gate.
            // Four chars per token is the same estimate the gateway bills its telemetry on
            // — the providers in the chain do not all return usage counts.
            if (orgId != null) {
              await recordAiTokens(orgId, Math.ceil((prompt.length + text.length) / 4));
            }
            return text;
          },
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
      brandName: cs.brandName,
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

    const reviewed = parseApprovedOutline(approvedOutline);

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

    // Straight to Generate, no outline review: the plan's own section objectives carry
    // nothing about our company, so the writer would produce a service page that never
    // names the business it is selling. Write the brief here too, from the same brand
    // document /content-plan uses, and feed it in exactly as a reviewed outline would be.
    //
    // After the plan gate on purpose — a rejected plan must not cost an LLM call.
    //
    // Bounded: this handler has ~60s before the platform kills it, and being killed here
    // strands the 'queued' job claim made at step 0. If the brief is slow we write from
    // the plan's own objectives instead — worse copy, but an article rather than a failed
    // request and an article that can no longer be generated.
    // article_terms holds terms activated after the analysis ran; score_data alone is the
    // stale half of the list the editor grades against. Loaded before the brief so the
    // brief and the compiled plan cannot be written against different vocabularies.
    const tableTerms = await readArticleTerms(articleIdNum).catch(() => []);

    // Always enrich the writer's link allowlist from the client's own sitemap, not only
    // when Ranksmile has published nothing yet. Surfer links a fresh draft to ~15 of the
    // client's existing pages; gating this on `domainArticles.length < 3` starved every
    // established domain (which already has a few Ranksmile pages) back down to a handful
    // of internal links. Merge deduped so the writer sees the client's real topical pages.
    if (domainName) {
      try {
        const known = new Set(domainArticles.map((a) => a.url.replace(/\/+$/, '')));

        // The client's own crawled pages (page_audits) are the richest, most on-topic link
        // pool — the site's whole topical map, already stored, no fetch. Surfer links a fresh
        // draft to ~15 of these. The suggester matches anchors on title, so when the crawl
        // left the title null we derive a readable one from the slug.
        try {
          const audited = await db.query<{ url: string; title: string | null }>(
            'SELECT url, title FROM page_audits WHERE domain_id = ? LIMIT 100',
            { replacements: [article.domain_id], type: QueryTypes.SELECT },
          );
          for (const p of audited) {
            const key = p.url.replace(/\/+$/, '');
            if (!p.url || known.has(key)) continue;
            known.add(key);
            domainArticles.push({ id: 0, title: p.title || titleFromSlug(p.url), url: p.url });
          }
        } catch (err) {
          console.warn('[articles/[id]/generate] page_audits link pool skipped:', getErrorMessage(err));
        }

        const sitemapUrls = await gatherBlogUrls(article.domain_id, domainName);
        // Terms, not just the keyword: the client's topical pages rarely repeat the query
        // in their slug, and ranking on the keyword alone found exactly one page.
        const linkTerms = importantTermsFromScoreData(scoreData, { tableTerms });
        for (const target of pickLinkTargets({ urls: sitemapUrls, keyword, terms: linkTerms, limit: 16 })) {
          if (!known.has(target.url.replace(/\/+$/, ''))) domainArticles.push(target);
        }
      } catch (err) {
        console.warn('[articles/[id]/generate] sitemap link targets skipped:', getErrorMessage(err));
      }
    }

    const approvedHeadings = reviewed.length > 0
      ? reviewed
      : parseApprovedOutline(await writeOutlineBrief({
        keyword,
        bundle: finalized.bundle,
        brandKnowledge,
        brandName: cs.brandName,
        importantTerms: importantTermsFromScoreData(scoreData, { tableTerms, max: 120 }),
        // Heading terms, same as /content-plan: the SERP-flagged terms the brief writer
        // works into H2/H3. Omitting them here let the express path (no outline review)
        // ignore heading placement entirely, which the scorer now measures.
        headingTerms: (Array.isArray(scoreData.terms) ? scoreData.terms : [])
          .filter((t): t is { term: string; in_headings?: boolean } => Boolean(t?.in_headings))
          .map((t) => t.term)
          .slice(0, 10),
        language: lang,
        competitorHeadings: competitorHeadingTitles(article.competitor_outlines_cache),
        competitorTitles: competitorPageTitles(article.competitor_outlines_cache),
        // Cron runs resolve no org and skip the budget gate entirely, so there is nothing
        // to charge — same shape deep-analysis uses for its coverage spend.
        onTokens: orgId == null ? undefined : (tokens) => recordAiTokens(orgId, tokens),
        signal: AbortSignal.timeout(BRIEF_TIMEOUT_MS),
      }));

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
      importantTerms: importantTermsFromScoreData(scoreData, { tableTerms, max: 120 }),
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
      // Always. allowBrandNiche gates the PLANNER's niche-topic selection; wiring it to
      // this field silently stripped brand knowledge from every generation, so articles
      // never named the agency ("nawiąż do nas" bullets had nothing to draw on).
      brand_knowledge: brandKnowledge,
      // The name separately from the knowledge blob: "name the company as written in
      // the block" left the model to fish it out of 700 chars of prose, and 3 of 7
      // articles shipped without it. An explicit field also powers the deterministic
      // closing-CTA fallback in the sidecar.
      brand_name: cs.brandName || '',
      voice_tone: voiceTone,
      template_reference: templateReference,
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
      // `reviewed`, not `approvedHeadings`: the tag records that a human approved the
      // structure, and an auto-written brief is not that however it is applied.
      { replacements: [pipelineVersionTag({ manualOutline: reviewed.length > 0 }), articleId] },
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
      await db.query('UPDATE analysis_jobs SET status = \'failed\', error = ? WHERE id = ?', { replacements: [String(detail).slice(0, 500), jobId] });
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
