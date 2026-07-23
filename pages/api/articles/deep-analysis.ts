// POST /api/articles/deep-analysis
// Thin orchestrator: creates article skeleton, INSERTs analysis_job,
// POSTs to Python sidecar /pipeline/deep-analysis, awaits result,
// writes result back to job row, streams SSE to frontend.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { computeContentScore, countOccurrences } from '../../../lib/contentScore';
import { buildGradedCoverageSnapshot } from '../../../lib/buildCoverageSnapshot';
import { dedupePaaQuestions } from '../../../lib/curateCoverageItems';
import { harvestAiCoverage } from '../../../lib/harvestAiCoverage';
import type { SerpAnalysis, SerpCompetitor, DeepAnalysisPipelineResult } from '../../../lib/types/sidecar';
import { flushHeaders, flushSse } from '../../../lib/types/api';
import type { NlpTerm, ScoreData } from '../../../lib/contentScore';
import {
  calibrateTermRangesFromCorpus,
  filterUsefulNlpTerms,
  hasMinCompetitorDomains,
  scaleTermRangesToWordCount,
} from '../../../lib/competitorTermCalibration';
import { runArticleAiPipeline } from '../../../lib/articleAiPipeline';
import { computeAiSearchScoreV2, computeOverallContentScore } from '../../../lib/aiSearchScore';
import type { ArticleFact } from '../../../lib/articleFacts';

type RawSerpTerm = NlpTerm & { text?: string; importance?: number; count?: number };
import {
  discoverRankingKeywords,
  enrichNlpTermsIfNeeded,
  hostFromUrl,
  mergeNlpTerms,
  saveArticleKeywords,
} from '../../../lib/articleKeywordDiscovery';
import { keywordFromUrl, resolveAnalysisSeedKeyword } from '../../../lib/inferPageKeyword';
import { resolveFactKeyword } from '../../../lib/resolveFactKeyword';
import { persistAiVisibilityRun } from '../../../lib/aiVisibilityStore';
import { persistCoverageFeatureRun } from '../../../lib/persistCoverageFeatureRun';
import { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { sidecarBase, nextjsUrl } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { verifyDomainOwnershipById, firstAccessibleDomainId } from '../../../utils/verifyDomainOwnership';
import { resolveOrgId, orgBudgetBlocked } from '../../../lib/aiBudget';
import { getOrgUsage5h, recordAiTokens } from '../../../lib/aiTokenUsage';
import { getErrorMessage } from '../../../lib/errors';
import { buildCompetitorBenchmarks } from '../../../lib/competitorAuditScore';
import { buildRankingSourcesPayload } from '../../../lib/rankingSources';
import { enrichTermsWithSalience } from '../../../lib/termSalience';
import { filterNlpTermsForAnalysis } from '../../../lib/topicRelevance';
import { buildAuditResult, computeSeoScoreFromAudit } from '../../../lib/auditCompute';
import { findInternalLinkOpportunities } from '../../../lib/auditInternalLinks';
import { assertPublicUrl } from '../../../lib/ssrfGuard';
import { resolveContentLocale } from '../../../lib/domainLanguage';
import { replaceArticleTerms, replaceCompetitors } from '../../../lib/articleAnalysisStorage';

function sse(res: NextApiResponse, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  flushSse(res);
}

async function deepAnalysisJobIsCurrent(articleId: number, jobId: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `SELECT current_job.id
     FROM analysis_jobs current_job
     WHERE current_job.id = ?
       AND current_job.article_id = ?
       AND current_job.job_type = 'deep_analysis'
       AND current_job.status = 'running'
       AND NOT EXISTS (
         SELECT 1
         FROM analysis_jobs newer
         WHERE newer.article_id = current_job.article_id
           AND newer.job_type = 'deep_analysis'
           AND (
             newer.created_at > current_job.created_at
             OR (newer.created_at = current_job.created_at AND newer.id > current_job.id)
           )
       )
     LIMIT 1`,
    { replacements: [jobId, articleId], type: QueryTypes.SELECT },
  );
  return rows.length > 0;
}

async function abortIfSuperseded(res: NextApiResponse, articleId: number, jobId: string): Promise<boolean> {
  if (await deepAnalysisJobIsCurrent(articleId, jobId)) return false;
  sse(res, 'error', { step: 'save', message: 'Analysis superseded by a newer run' });
  res.end();
  return true;
}

function summaryFromSidecar(aiSearch: AiVisibilitySummary | null | undefined): AiVisibilitySummary | null {
  if (!aiSearch || !Array.isArray(aiSearch.citations) || !aiSearch.citations.length) return null;
  return {
    prompts_total: aiSearch.prompts_total || aiSearch.citations.length,
    prompts_cited: aiSearch.prompts_cited || 0,
    competitor_citations: aiSearch.competitor_citations || 0,
    extractability_score: aiSearch.extractability_score || 0,
    citations: aiSearch.citations,
  };
}

/** Build the article score_data target ranges from a sidecar SERP result. */
function buildScoreData(
  serp: SerpAnalysis,
  terms: NlpTerm[],
  competitorCount: number,
  opts?: {
    scoringModel?: 'competitor' | 'legacy';
    contentTargets?: { avgWords: number; avgHeadings: number; avgPs: number };
    auditResult?: import('../../../lib/auditTypes').AuditResult;
    seoScore?: number;
    competitorWordSpread?: { min: number; max: number };
  },
): ScoreData {
  const wordMin = opts?.competitorWordSpread?.min ?? serp.words_min ?? 1500;
  const wordMax = opts?.competitorWordSpread?.max ?? serp.words_max ?? 3000;
  return {
    terms,
    words_target: serp.words_target || 2200,
    words_min: wordMin,
    words_max: wordMax,
    headings_target: serp.headings_target || 15,
    headings_min: serp.headings_min || 10,
    headings_max: serp.headings_max || 25,
    paragraphs_target: serp.paragraphs_target || 20,
    paragraphs_min: serp.paragraphs_min || 10,
    paragraphs_max: serp.paragraphs_max || 40,
    competitor_count: competitorCount,
    paa_questions: serp.paa_questions || [],
    scoring_model: opts?.scoringModel || 'legacy',
    content_targets: opts?.contentTargets,
    audit_result: opts?.auditResult,
    seo_score: opts?.seoScore,
  };
}

function mapSerpTerms(rawTerms: RawSerpTerm[]): NlpTerm[] {
  return rawTerms.map((t) => ({
    term: String(t.term || t.text || '').toLowerCase().trim(),
    target_count: t.target_count ?? t.importance ?? t.count ?? 1,
    suggested_min: t.suggested_min,
    suggested_max: t.suggested_max,
    relevance: t.relevance,
    doc_freq: t.doc_freq,
    salience: t.salience,
  })).filter((t) => t.term);
}

/**
 * Keyword mode: fold the modal-selected keywords into the competitor-derived term
 * list so they show up as "important terms" in the editor. The main keyword is
 * already stored as target_keyword; these are the rest of the cluster selection.
 */
function addSelectedKeywordTerms(terms: NlpTerm[], selected: string[], plainText: string): NlpTerm[] {
  const have = new Set(terms.map((t) => t.term.toLowerCase().trim()));
  const extra: NlpTerm[] = [];
  for (const kw of selected || []) {
    const term = (kw || '').toLowerCase().trim();
    if (!term || have.has(term)) continue;
    have.add(term);
    extra.push({
      term,
      target_count: 3,
      suggested_min: 1,
      suggested_max: 3,
      current_count: countOccurrences(plainText, term),
    });
  }
  // Selected keywords first — they carry the cluster's intent.
  return [...extra, ...terms];
}

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[deep-analysis] handler invoked', req.method);
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url: rawUrl, keywords = [], country: bodyCountry, language: bodyLanguage, articleId: existingArticleId, domainId: reqDomainId } = req.body;
  const url: string = (rawUrl as string) || '';
  const primaryKeyword = (keywords as string[])[0] || '';
  const isKeywordMode = !url && !!primaryKeyword && (!!reqDomainId || !!existingArticleId);
  if (!url && !primaryKeyword) return res.status(400).json({ error: 'url or keywords is required' });
  if (!url && !isKeywordMode) return res.status(400).json({ error: 'url or (keywords + domainId) is required' });
  if (url) {
    try {
      await assertPublicUrl(String(url));
    } catch (err) {
      return res.status(400).json({ error: getErrorMessage(err) || 'Blocked URL' });
    }
  }

  const bodyLanguageOverride = typeof bodyLanguage === 'string' && bodyLanguage.trim()
    ? bodyLanguage.trim().toLowerCase()
    : undefined;

  // Resolve the home domain for new-content creation up front, before the SSE stream
  // starts, so any access denial is a plain JSON status (not an SSE error frame) and
  // an article can only ever land in a domain the caller's workspace can reach.
  let resolvedDomainId: number | undefined;
  if (existingArticleId) {
    // Re-analyzing an existing article mutates it by raw id — only its owner may.
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, Number(existingArticleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  } else {
    const userId = await getCurrentUserId(req, res);
    if (reqDomainId) {
      // Caller-supplied domain (keyword mode, or URL mode with a domainId) — only a
      // member of that domain's workspace may create under it.
      const owned = await verifyDomainOwnershipById(Number(reqDomainId), userId);
      if (!owned) return res.status(owned === null ? 404 : 403).json({ error: 'Access denied.' });
      resolvedDomainId = owned.ID;
    } else {
      // URL mode without a domainId — fall back to the caller's own first domain.
      const fallback = await firstAccessibleDomainId(userId);
      if (!fallback) return res.status(403).json({ error: 'No accessible domain to create the article under.' });
      resolvedDomainId = fallback;
    }
  }

  const locale = await resolveContentLocale({
    domainId: resolvedDomainId,
    articleId: existingArticleId ? Number(existingArticleId) : undefined,
    bodyLanguage: bodyLanguageOverride,
    bodyCountry: typeof bodyCountry === 'string' ? bodyCountry : undefined,
  });
  const finalArticleLanguage = locale.languageCode;
  const country = locale.countryCode;

  // Org-wide AI budget — block before the SSE stream starts (plain JSON 429, not an SSE frame).
  const orgId = await resolveOrgId(req, res);
  const over = await orgBudgetBlocked(orgId);
  if (over) return res.status(429).json(over);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.status(200);
  flushHeaders(res);
  res.write(':ok\n\n');

  // New-content keyword mode runs the SAME deep-analysis pipeline as URL import —
  // just without a page to fetch. The sidecar skips fetch_page/classify_content
  // when the url is empty, so SERP competitors, semantic terms and AI search are
  // still gathered from the keyword, and the modal-selected keywords are folded
  // into the term list below.

  const articleIdSql = await getArticleIdSql();
  const keyword = (keywords as string[])[0] || '';
  let articleId: number;

  // ── Create or reuse article skeleton ──────────────────────────────
  if (existingArticleId) {
    articleId = existingArticleId;
    await db.query(
      `UPDATE articles SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [existingArticleId] },
    );
  } else {
    try {
      // Already verified to belong to the caller's workspace in the guard above.
      const domainId = resolvedDomainId!;
      const language = finalArticleLanguage;
      // Keyword mode has no page: title = keyword, no slug/meta_url. URL mode
      // seeds title/slug/meta_url from the page URL (enriched later by fetch_page).
      const skeletonTitle = isKeywordMode ? keyword : url;
      const skeletonSlug = isKeywordMode ? '' : url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 60);
      const skeletonMetaUrl = isKeywordMode ? '' : url;

      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING ${articleIdSql} AS id`,
          { replacements: [domainId, skeletonTitle, skeletonSlug, skeletonMetaUrl, keyword, language], type: QueryTypes.SELECT },
        );
        articleId = rows[0]?.id;
      } else {
        const [newId] = await db.query(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          { replacements: [domainId, skeletonTitle, skeletonSlug, skeletonMetaUrl, keyword, language], type: QueryTypes.INSERT },
        );
        articleId = newId as unknown as number;
      }
      sse(res, 'created', { articleId });
    } catch (err) {
      console.error('[deep-analysis] skeleton insert failed:', getErrorMessage(err));
      sse(res, 'error', { step: 'save', message: 'Failed to initialize analysis' });
      return res.end();
    }
  }

  // ── Create analysis job ───────────────────────────────────────────
  // Supersede any in-flight jobs for this article (orphaned after refresh / sidecar reload).
  try {
    await db.query(
      `UPDATE analysis_jobs
       SET status = 'failed', error = 'superseded', updated_at = CURRENT_TIMESTAMP
       WHERE article_id = ? AND job_type = 'deep_analysis' AND status IN ('running', 'queued')`,
      { replacements: [articleId] },
    );
  } catch (err) {
    console.warn('[deep-analysis] supersede stale jobs failed (non-fatal):', getErrorMessage(err));
  }

  const jobId = `job_${articleId}_${Date.now()}`;
  let pipelineKeyword = resolveAnalysisSeedKeyword({
    candidate: keyword || (keywords as string[]).find((k) => k?.trim()) || '',
    pageUrl: url,
    userKeywords: (keywords as string[]) || [],
  });

  // Resolve SERP seed before sidecar when still empty.
  if (!pipelineKeyword && url) {
    try {
      const artRow = await db.query<{ domain_id: number | null }>(
        `SELECT domain_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        { replacements: [articleId], type: QueryTypes.SELECT },
      );
      let workspaceDomain = '';
      if (artRow[0]?.domain_id) {
        const dom = await db.query<{ domain: string | null }>(
          `SELECT domain FROM domain WHERE "ID" = ? LIMIT 1`,
          { replacements: [artRow[0].domain_id], type: QueryTypes.SELECT },
        );
        workspaceDomain = dom[0]?.domain || '';
      }
      const pre = await discoverRankingKeywords({
        pageUrl: url,
        workspaceDomain,
        userKeywords: (keywords as string[]) || [],
        country,
        languageCode: finalArticleLanguage,
      });
      if (pre.primaryKeyword) pipelineKeyword = pre.primaryKeyword;
    } catch {
      pipelineKeyword = keywordFromUrl(url) || pipelineKeyword;
    }
  }

  const pipelineKeywords = pipelineKeyword
    ? [...new Set([pipelineKeyword, ...(keywords as string[]).map((k) => k.trim()).filter(Boolean)])]
    : (keywords as string[]).map((k) => k.trim()).filter(Boolean);
  const payload = {
    url,
    keyword: pipelineKeyword,
    keywords: pipelineKeywords,
    language: finalArticleLanguage,
    tone: 'professional',
  };

  try {
    await db.query(
      `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'deep_analysis', 'queued', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: [jobId, articleId, JSON.stringify(payload)] },
    );
    sse(res, 'created', { articleId, jobId });
  } catch (err) {
    console.error('[deep-analysis] job insert failed:', getErrorMessage(err));
    sse(res, 'error', { step: 'save', message: 'Failed to create analysis job' });
    return res.end();
  }

  // ── Claim job (status → running, lock + attempts increment) ──────
  try {
    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           locked_at = CURRENT_TIMESTAMP,
           locked_by = ?,
           attempts = attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'queued' AND attempts < max_attempts`,
      { replacements: [`nextjs_${process.pid || 'unknown'}`, jobId] },
    );
    // Verify row was actually claimed (SELECT is dialect-safe vs. UPDATE result inspection)
    const claimedRows = await db.query<{ status: string; attempts: number }>(
      `SELECT status, attempts FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    if (!claimedRows.length || claimedRows[0].status !== 'running') {
      sse(res, 'error', { step: 'save', message: 'Job already claimed or max attempts reached' });
      return res.end();
    }
    await db.query(
      `UPDATE analysis_jobs
       SET current_stage = 'fetch_page', progress_message = 'Starting analysis...', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      { replacements: [jobId] },
    );
  } catch (err) {
    console.error('[deep-analysis] job claim failed:', getErrorMessage(err));
    sse(res, 'error', { step: 'save', message: 'Failed to claim analysis job' });
    return res.end();
  }

  // ── Call sidecar, await result, write back to job row ─────────────
  const sidecarUrl = sidecarBase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
    let sidecarResp: Response;

    console.log('[deep-analysis] calling sidecar', `${sidecarUrl}/pipeline/deep-analysis`, jobId);

    const heartbeat = setInterval(() => {
      void db.query(
        `UPDATE analysis_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`,
        { replacements: [jobId] },
      ).catch(() => {});
    }, 25_000);

    try {
      sidecarResp = await fetch(`${sidecarUrl}/pipeline/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
        body: JSON.stringify({ jobId, payload, nextjsUrl: nextjsUrl() }),
        signal: controller.signal,
      });
    } finally {
      clearInterval(heartbeat);
      clearTimeout(timeout);
    }

    if (!sidecarResp.ok) {
      const errText = await sidecarResp.text();
      if (await abortIfSuperseded(res, articleId, jobId)) return;
      await db.query(
        `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [errText, jobId] },
      );
      await db.query(
        `UPDATE articles SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [articleId] },
      );
      sse(res, 'error', { step: 'pipeline', message: errText });
      return res.end();
    }

    const sidecarData = await sidecarResp.json();
    const result = sidecarData.result || {};
    if (await abortIfSuperseded(res, articleId, jobId)) return;

    // Store pipeline result but keep job running — post-processing (coverage, AI visibility)
    // still runs in Node. Marking done here caused the frontend to reload before
    // ai_info_to_cover was persisted.
    await db.query(
      `UPDATE analysis_jobs
       SET result = ?, current_stage = 'finalizing', progress_message = 'Saving analysis results...', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      { replacements: [JSON.stringify(result), jobId] },
    );

    // ── Extract data from pipeline result ───────────────────────────
    const fetchPage = result.fetch_page || {};
    const serp = result.scrape_serp || {};
    const classify = result.classify_content || {};
    const terms = result.extract_terms || {};
    const score = result.score_ranking || {};
    console.log(
      `[deep-analysis] scrape_serp: ${(serp.competitors || []).length} competitors, `
      + `${(serp.terms || []).length} serp terms, keyword=${pipelineKeyword}`,
    );

    // Terms come from competitor CONTENT only (sidecar scrape_serp + extract_terms),
    // like Surfer's "important terms". We deliberately do NOT layer DataForSEO keyword
    // ideas: for brand keywords they flood the list with irrelevant suggestions
    // (maps, translate, minecraft…) the article never contains, which tanks the score.
    const rawTerms = [
      ...(serp.terms || []),
      ...(terms.terms || []),
    ];
    const allTerms = mapSerpTerms(rawTerms);

    const plainTextEarly = (fetchPage.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let serpCompetitors: SerpCompetitor[] = serp.competitors || [];
    let competitorDomains = serpCompetitors
      .map((c: { domain?: string; url?: string }) => (c.domain || '').replace(/^www\./, '') || (() => {
        try { return new URL(c.url || '').hostname.replace(/^www\./, ''); } catch { return ''; }
      })())
      .filter(Boolean);
    let cachedOutlinePayload: { competitors?: unknown[] } | null = null;

    // When scrape_serp dropped URLs (all page fetches failed), recover via outline fetch
    // before keyword discovery so DFS can use competitor domains.
    if (!competitorDomains.length && pipelineKeyword) {
      try {
        const earlyOutlineRes = await fetch(`${sidecarUrl}/competitor-outlines`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '',
          },
          body: JSON.stringify({
            keyword: pipelineKeyword,
            language: finalArticleLanguage,
            num: 5,
          }),
        });
        if (earlyOutlineRes.ok) {
          const earlyOutline = await earlyOutlineRes.json() as { competitors?: Array<{
            url?: string; domain?: string; title?: string; serp_title?: string; snippet?: string;
          }> };
          const outlines = earlyOutline?.competitors || [];
          if (outlines.length) {
            cachedOutlinePayload = earlyOutline;
            serpCompetitors = outlines.map((c) => ({
              url: c.url || '',
              domain: c.domain || '',
              title: c.serp_title || c.title || '',
              snippet: c.snippet || '',
            })).filter((c) => c.url);
            competitorDomains = serpCompetitors
              .map((c) => (c.domain || '').replace(/^www\./, ''))
              .filter(Boolean);
            console.log(`[deep-analysis] early outline recovery: ${serpCompetitors.length} competitors for keyword discovery`);
          }
        }
      } catch (err) {
        console.warn('[deep-analysis] early competitor outline recovery failed (non-fatal):', getErrorMessage(err));
      }
    }

    // Discover real ranking keywords (GSC page + DataForSEO) — fixes thin 3-token lists.
    let resolvedKeyword = pipelineKeyword || keyword || '';
    try {
      const artRow = await db.query<{ domain_id: number | null }>(
        `SELECT domain_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        { replacements: [articleId], type: QueryTypes.SELECT },
      );
      let workspaceDomain = '';
      if (artRow[0]?.domain_id) {
        const dom = await db.query<{ domain: string | null }>(
          `SELECT domain FROM domain WHERE "ID" = ? LIMIT 1`,
          { replacements: [artRow[0].domain_id], type: QueryTypes.SELECT },
        );
        workspaceDomain = dom[0]?.domain || '';
      }
      const discovered = await discoverRankingKeywords({
        pageUrl: url,
        workspaceDomain,
        userKeywords: pipelineKeywords,
        country,
        languageCode: finalArticleLanguage,
        competitorDomains,
      });
      if (discovered.keywords.length) {
        if (await abortIfSuperseded(res, articleId, jobId)) return;
        await saveArticleKeywords(articleId, discovered.keywords, discovered.primaryKeyword, plainTextEarly);
      }
      const userSeed = (pipelineKeywords[0] || keyword || '').trim();
      if (discovered.primaryKeyword) {
        if (await abortIfSuperseded(res, articleId, jobId)) return;
        resolvedKeyword = resolveAnalysisSeedKeyword({
          candidate: discovered.primaryKeyword,
          pageUrl: url,
          userKeywords: pipelineKeywords,
        });
        // Sacred import keyword: never overwrite the user's main seed with discovery.
        if (userSeed) {
          resolvedKeyword = userSeed;
          if (discovered.primaryKeyword.trim().toLowerCase() !== userSeed.toLowerCase()) {
            console.log(
              `[deep-analysis] keeping user target_keyword=${JSON.stringify(userSeed)} `
              + `(discovery wanted ${JSON.stringify(discovered.primaryKeyword)})`,
            );
          }
          // Heal DB if a previous run stored a truncated/discovery keyword.
          await db.query(
            `UPDATE articles SET target_keyword = ? WHERE ${articleIdSql} = ?`,
            { replacements: [userSeed, articleId] },
          );
        } else {
          await db.query(
            `UPDATE articles SET target_keyword = ? WHERE ${articleIdSql} = ?`,
            { replacements: [resolvedKeyword, articleId] },
          );
        }
      }
    } catch (err) {
      console.log('[deep-analysis] keyword discovery failed (non-fatal):', getErrorMessage(err));
    }

    const enrichedTerms = await enrichNlpTermsIfNeeded({
      terms: filterUsefulNlpTerms(allTerms),
      primaryKeyword: resolvedKeyword,
      country,
      languageCode: finalArticleLanguage,
      competitorDomains,
      ownDomain: hostFromUrl(url),
      plainText: plainTextEarly,
    });
    const normalizeMergedTerms = (terms: NlpTerm[]) => terms.map((t) => ({
      ...t,
      suggested_min: t.suggested_min ?? Math.max(1, Math.round((t.target_count || 1) * 0.7)),
      suggested_max: t.suggested_max ?? Math.max(t.suggested_min ?? 1, Math.round((t.target_count || 1) * 1.5)),
      current_count: t.current_count ?? countOccurrences(plainTextEarly, t.term),
    }));
    let mergedTerms = normalizeMergedTerms(mergeNlpTerms(
      filterUsefulNlpTerms(allTerms),
      filterUsefulNlpTerms(enrichedTerms),
    ));
    console.log(
      `[deep-analysis] terms before filter: ${mergedTerms.length} `
      + `(serp raw=${allTerms.length}, enriched=${enrichedTerms.length})`,
    );

    let competitorBenchmarks: Awaited<ReturnType<typeof buildCompetitorBenchmarks>> = null;
    try {
      competitorBenchmarks = await buildCompetitorBenchmarks(
        resolvedKeyword || keyword || '',
        url,
        serpCompetitors,
        mergedTerms,
      );
      if (competitorBenchmarks?.real.terms?.length) {
        mergedTerms = normalizeMergedTerms(competitorBenchmarks.real.terms);
      }
    } catch (err) {
      console.log('[deep-analysis] competitor benchmarks failed (non-fatal):', getErrorMessage(err));
    }

    mergedTerms = normalizeMergedTerms(filterNlpTermsForAnalysis(
      filterUsefulNlpTerms(mergedTerms),
      resolvedKeyword || keyword || '',
    ));
    console.log(
      `[deep-analysis] terms after filter: ${mergedTerms.length} `
      + `(keyword: ${resolvedKeyword || keyword || ''}; sample: ${
        mergedTerms.slice(0, 8).map((t) => t.term).join(', ')
      })`,
    );

    if (!hasMinCompetitorDomains(competitorDomains)) {
      console.warn('[deep-analysis] fewer than 3 distinct competitor domains — term ranges may be less reliable');
    }

    const corpusTexts = competitorBenchmarks?.corpusTexts ?? [];
    const corpusHtmls = competitorBenchmarks?.corpusHtmls ?? [];
    if (corpusTexts.length) {
      mergedTerms = normalizeMergedTerms(calibrateTermRangesFromCorpus(mergedTerms, corpusTexts));
    }

    const contentTargets = competitorBenchmarks?.targets ?? {
      avgWords: serp.words_target || 2200,
      avgHeadings: serp.headings_target || 15,
      avgPs: serp.paragraphs_target || 20,
    };

    const pageContentEarly = fetchPage.html || '';
    const resolvedKw = resolvedKeyword || keyword || '';
    let auditResult: ReturnType<typeof buildAuditResult> | undefined;
    let seoScoreFromAudit: number | undefined;
    let competitorWordSpread: { min: number; max: number } | undefined;

    if (pageContentEarly && competitorBenchmarks?.real) {
      try {
        const internalLinks = await findInternalLinkOpportunities(url, resolvedKw);
        const timing = {
          ttfbMs: fetchPage.ttfb_ms ?? fetchPage.ttfbMs ?? 200,
          loadMs: fetchPage.load_ms ?? fetchPage.loadMs ?? 1200,
        };
        auditResult = buildAuditResult(
          pageContentEarly,
          url,
          resolvedKw,
          timing,
          { ...competitorBenchmarks.real, terms: mergedTerms },
          internalLinks ?? undefined,
        );
        seoScoreFromAudit = computeSeoScoreFromAudit(auditResult);
        const bodyWords = competitorBenchmarks.real.competitors.map((c) => c.values.word_count_body || 0).filter((n) => n > 0);
        if (bodyWords.length) {
          competitorWordSpread = { min: Math.min(...bodyWords), max: Math.max(...bodyWords) };
        }
      } catch (err) {
        console.log('[deep-analysis] audit result failed (non-fatal):', getErrorMessage(err));
      }
    }

    const scoreData = buildScoreData(serp, mergedTerms, serpCompetitors.length, {
      scoringModel: competitorBenchmarks ? 'competitor' : 'legacy',
      contentTargets,
      auditResult,
      seoScore: seoScoreFromAudit,
      competitorWordSpread,
    });

    const rankingScore = score.ranking_score ?? null;
    const rankingSignals = score.ranking_signals ? JSON.stringify(score.ranking_signals) : null;

    // Use rule_base from ranking_signals as content_score fallback.
    // COALESCE preserves existing content_score if rankingScore is NULL
    // (e.g. when pipeline runs without DEEPSEEK_API_KEY).
    const ruleBase = score.ranking_signals?.rule_base ?? null;

    // Build dynamic SET clause — use enriched fetch_page fields
    const articleTitle = fetchPage.title || url;
    const metaTitle = fetchPage.meta_title || '';
    const metaDescription = fetchPage.meta_description || '';
    const headingCount = fetchPage.heading_count ?? 0;
    const paragraphCount = fetchPage.paragraph_count ?? 0;
    const imageIssueCount = fetchPage.images_without_alt ?? 0;

    const pageContent = fetchPage.html || '';
    const featuredImage = fetchPage.featured_image || '';

    // Compute _computed_score so the gauge shows a value on load.
    // Also store it in the content_score column so list and panel always match.
    const plainText = pageContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    mergedTerms = normalizeMergedTerms(scaleTermRangesToWordCount(mergedTerms, wordCount, contentTargets.avgWords));
    if (corpusHtmls.length) {
      mergedTerms = normalizeMergedTerms(enrichTermsWithSalience(mergedTerms, corpusHtmls));
    }
    // Keyword mode: the modal-selected keywords are the intent of this cluster —
    // fold them into the term list (main keyword is already the target_keyword).
    if (isKeywordMode) {
      mergedTerms = normalizeMergedTerms(addSelectedKeywordTerms(mergedTerms, keywords as string[], plainText));
    }
    scoreData.terms = mergedTerms;

    scoreData._heading_count = headingCount;
    scoreData._paragraph_count = paragraphCount;
    const seoScore = seoScoreFromAudit ?? computeContentScore(
      plainText, wordCount, headingCount, scoreData, paragraphCount, undefined,
      pageContent, resolvedKeyword || '',
    );
    // Keyword mode creates an EMPTY draft — a score computed on empty content is a
    // misleading 0 that the editor panel would prefer over its live computation.
    // Leave the numeric scores unset so the gauge scores the generated content.
    if (!isKeywordMode) {
      scoreData.seo_score = seoScore;
      scoreData._computed_score = seoScore;
      scoreData._content_score = seoScore;
    }

    // Baseline content-effort estimate (heuristic). LLM refine is available in Pre-Publish.
    {
      const { heuristicContentEffort } = await import('../../../lib/contentEffort');
      const effort = heuristicContentEffort({
        html: pageContent || '',
        plainText,
        keyword: resolvedKeyword || '',
        paaQuestions: scoreData.paa_questions,
      });
      const prev = scoreData.content_effort;
      scoreData.content_effort = {
        score: effort.score,
        reasons: effort.reasons,
        source: 'heuristic',
        at: effort.at,
        history: [
          ...(Array.isArray(prev?.history) ? prev.history : []),
          ...(prev?.score != null && prev.at
            ? [{ score: prev.score, at: prev.at, source: prev.source }]
            : []),
        ].slice(-11),
      };
    }

    const setClauses: string[] = [
      `title = COALESCE(NULLIF(?, ''), title)`,
      `meta_title = COALESCE(NULLIF(?, ''), meta_title)`,
      `meta_description = COALESCE(NULLIF(?, ''), meta_description)`,
      `content = COALESCE(NULLIF(?, ''), content)`,
      `featured_image = COALESCE(NULLIF(?, ''), featured_image)`,
      `word_count = ?`,
      `score_data = ?`,
      `content_score = COALESCE(?, content_score)`,
      `updated_at = CURRENT_TIMESTAMP`,
    ];
    const replacements: unknown[] = [
      articleTitle,
      metaTitle,
      metaDescription,
      pageContent,
      featuredImage,
      wordCount || classify.word_count_estimate || 0,
      JSON.stringify(scoreData),
      isKeywordMode ? null : (seoScore || ruleBase),
    ];

    if (rankingScore !== null) {
      setClauses.push(`ranking_score = ?`);
      replacements.push(rankingScore);
    }
    if (rankingSignals !== null) {
      setClauses.push(`ranking_signals = ?`);
      replacements.push(rankingSignals);
    }
    replacements.push(articleId);

    if (await abortIfSuperseded(res, articleId, jobId)) return;
    await db.query(
      `UPDATE articles SET ${setClauses.join(', ')} WHERE ${articleIdSql} = ?`,
      { replacements },
    );

    // Save SERP competitors (+ outline fallback when scrape_serp dropped URLs)
    const outlineKeyword = resolvedKeyword || pipelineKeyword || keyword || '';
    let competitorsToSave: SerpCompetitor[] = serpCompetitors;

    if (outlineKeyword && !cachedOutlinePayload) {
      try {
        const outlineRes = await fetch(`${sidecarUrl}/competitor-outlines`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '',
          },
          body: JSON.stringify({
            keyword: outlineKeyword,
            language: finalArticleLanguage,
            num: 5,
          }),
        });
        if (outlineRes.ok) {
          const outlineData = await outlineRes.json() as { competitors?: Array<{
            url?: string; domain?: string; title?: string; serp_title?: string; snippet?: string;
          }> };
          const outlines = outlineData?.competitors || [];
          if (outlines.length) {
            cachedOutlinePayload = outlineData;
            if (await abortIfSuperseded(res, articleId, jobId)) return;
            await db.query(
              `UPDATE articles SET competitor_outlines_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
              { replacements: [JSON.stringify(outlineData), articleId] },
            );
            console.log(`[deep-analysis] cached ${outlines.length} competitor outlines`);
          }
          if (!competitorsToSave.length && outlines.length) {
            competitorsToSave = outlines.map((c) => ({
              url: c.url || '',
              domain: c.domain || '',
              title: c.serp_title || c.title || '',
              snippet: c.snippet || '',
            })).filter((c) => c.url);
            console.log(`[deep-analysis] SERP scrape had 0 competitors — recovered ${competitorsToSave.length} from outlines`);
          }
        }
      } catch (err) {
        console.warn('[deep-analysis] competitor outlines cache failed (non-fatal):', getErrorMessage(err));
      }
    } else if (cachedOutlinePayload?.competitors?.length) {
      if (await abortIfSuperseded(res, articleId, jobId)) return;
      await db.query(
        `UPDATE articles SET competitor_outlines_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(cachedOutlinePayload), articleId] },
      );
      console.log(`[deep-analysis] cached ${cachedOutlinePayload.competitors.length} competitor outlines (early fetch)`);
    }

    if (competitorsToSave.length) {
      if (await abortIfSuperseded(res, articleId, jobId)) return;
      await replaceCompetitors(articleId, competitorsToSave);
    } else {
      console.warn(`[deep-analysis] no competitors saved for article ${articleId} (keyword: ${outlineKeyword || pipelineKeyword})`);
    }

    // Save terms
    if (await abortIfSuperseded(res, articleId, jobId)) return;
    await replaceArticleTerms(articleId, mergedTerms, plainText);

    if (await abortIfSuperseded(res, articleId, jobId)) return;

    // AI Search facts pipeline — SERP corpus + LLM (Option B), merged with PAA/sidecar.
    let articleFacts: ArticleFact[] = [];
    let aiVisibilitySummary: AiVisibilitySummary | null = null;
    const factKeyword = resolveFactKeyword({
      keyword: resolvedKeyword || keyword || '',
      articleText: plainText,
      title: classify.title || fetchPage.title || '',
      pageUrl: url,
    });
    try {
      let ownDomain = '';
      try { ownDomain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
      const sidecarSummary = summaryFromSidecar(result.ai_search);
      const pipelineResult = await runArticleAiPipeline({
        keyword: factKeyword,
        resolvedKeyword: factKeyword,
        articleText: plainText,
        corpusTexts,
        title: classify.title || fetchPage.title || '',
        pageUrl: url,
        country,
        languageCode: finalArticleLanguage,
        ownDomain,
        sidecarSummary,
      });
      articleFacts = pipelineResult.facts;
      aiVisibilitySummary = pipelineResult.summary;
      if (aiVisibilitySummary?.citations?.length) {
        console.log(`[deep-analysis] AI facts pipeline: ${articleFacts.length} facts, ${aiVisibilitySummary.prompts_cited}/${aiVisibilitySummary.prompts_total} covered`);
      } else {
        console.warn('[deep-analysis] AI search: no citations from facts pipeline or PAA');
      }
    } catch (err) {
      console.warn('[deep-analysis] AI facts pipeline failed (non-fatal):', getErrorMessage(err));
    }

    // Coverage snapshot — builds CoverageItems from PAA + intro-intent + article_terms
    // (entity/fact), judges the judgeable subset, and persists ai_info_to_cover so the
    // Content Score gauge has a real coverage breakdown ready without a manual run.
    // Never blocks or fails deep-analysis; the gauge falls back to the AI-visibility
    // path (computeAiSearchScore) if this throws.
    let coverageSnapshot = null;
    let coverageTokens = 0;
    try {
      const coverageUsage = orgId != null ? await getOrgUsage5h(orgId) : null;
      if (coverageUsage?.over) {
        console.warn('[coverage] org over 5h token budget — skipping coverage compute');
      } else {
        const paaFromSerp = dedupePaaQuestions(
          (scoreData.paa_questions ?? []).map((q) => ({ question: q })),
        );

        let outlinesCache: string | null = null;
        if (cachedOutlinePayload) {
          outlinesCache = JSON.stringify(cachedOutlinePayload);
        } else {
          try {
            const outlineRows = await db.query<{ competitor_outlines_cache: string | null }>(
              `SELECT competitor_outlines_cache FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
              { replacements: [articleId], type: QueryTypes.SELECT },
            );
            outlinesCache = outlineRows[0]?.competitor_outlines_cache ?? null;
          } catch {
            outlinesCache = null;
          }
        }

        const harvest = await harvestAiCoverage({
          keyword: factKeyword,
          country,
          languageCode: finalArticleLanguage,
          paaQuestions: paaFromSerp,
          competitorOutlinesCache: outlinesCache,
        });
        console.log(
          `[coverage] harvest: unique=${harvest.stats.uniqueQuestions} topics=${harvest.stats.topicsAfterBudget}`
          + ` median=${harvest.stats.medianQuestionsPerTopic} latency=${JSON.stringify(harvest.stats.providerLatency)}`,
        );

        let llmQuestions = harvest.llmQuestions;
        let paaQuestions: Array<{ question: string }> = [];

        // When harvest is thin, seed from sidecar AI-visibility citations.
        if (harvest.stats.uniqueQuestions < 6 && aiVisibilitySummary?.citations?.length) {
          const seen = new Set(llmQuestions.map((q) => q.question.toLowerCase()));
          for (const c of aiVisibilitySummary.citations) {
            const q = (c.prompt || '').replace(/\s+/g, ' ').trim();
            if (!q || q.length < 10) continue;
            const key = q.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            paaQuestions.push({ question: q });
          }
          console.log(`[coverage] seeded ${paaQuestions.length} questions from sidecar AI visibility`);
        }
        // Templates only when unique harvested questions < 6 (after sidecar seed still empty).
        if (harvest.stats.uniqueQuestions < 6 && !llmQuestions.length && !paaQuestions.length && factKeyword) {
          paaQuestions = [
            `Co to jest ${factKeyword}?`,
            `Jak sprawdzić ${factKeyword}?`,
            `Jakie są najważniejsze sygnały dla: ${factKeyword}?`,
            `Co zrobić krok po kroku w temacie: ${factKeyword}?`,
            `Jakie źródła najlepiej wyjaśniają temat: ${factKeyword}?`,
          ].map((question) => ({ question }));
          console.log(`[coverage] seeded ${paaQuestions.length} fallback prompts for ${JSON.stringify(factKeyword)}`);
        }

        const graded = await buildGradedCoverageSnapshot({
          keyword: factKeyword,
          plainText,
          html: pageContent,
          paaQuestions,
          llmQuestions,
          languageCode: finalArticleLanguage,
          harvestTopics: harvest.topics,
        });
        coverageSnapshot = graded.snapshot;
        coverageTokens += graded.introTokens + graded.judgeTokens;

        if (await abortIfSuperseded(res, articleId, jobId)) return;
        await db.query(
          `UPDATE articles SET ai_info_to_cover = ? WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(coverageSnapshot), articleId] },
        );

        await persistCoverageFeatureRun({
          snapshot: coverageSnapshot,
          articleId,
          domainId: resolvedDomainId,
          keyword: factKeyword,
        }).catch((err: unknown) => {
          console.warn('[coverage] feature store persist failed (non-fatal):', getErrorMessage(err));
        });

        const intentBucket = coverageSnapshot.buckets.find((b) => b.key === 'intent');
        const aiScore = articleFacts.length
          ? computeAiSearchScoreV2({
            facts: articleFacts,
            articleText: plainText,
            intentScore: intentBucket?.score,
            answersMainQuestionEarly: coverageSnapshot.answersMainQuestionEarly,
          })
          : 0;
        const contentScore = computeOverallContentScore(seoScore, aiScore);
        // Keyword mode: empty draft — don't persist content-based scores (see above).
        // The ai_info_to_cover snapshot is already saved; scores stay live in the editor.
        if (!isKeywordMode) {
          scoreData.seo_score = seoScore;
          scoreData.ai_score = aiScore;
          scoreData._computed_score = contentScore;
          scoreData._content_score = contentScore;
          if (await abortIfSuperseded(res, articleId, jobId)) return;
          await db.query(
            `UPDATE articles SET score_data = ?, content_score = ? WHERE ${articleIdSql} = ?`,
            { replacements: [JSON.stringify(scoreData), contentScore, articleId] },
          );
        }

        if (aiVisibilitySummary?.citations?.length) {
          await persistAiVisibilityRun(
            articleId,
            factKeyword,
            aiVisibilitySummary,
            aiScore,
          );
        }
      }
    } catch (err) {
      console.warn('[coverage] deep-analysis snapshot compute failed', err);
      if (!isKeywordMode && aiVisibilitySummary?.citations?.length && articleFacts.length) {
        const fallbackAi = computeAiSearchScoreV2({ facts: articleFacts, articleText: plainText });
        const contentScore = computeOverallContentScore(seoScore, fallbackAi);
        scoreData.ai_score = fallbackAi;
        scoreData._content_score = contentScore;
        scoreData._computed_score = contentScore;
        if (await abortIfSuperseded(res, articleId, jobId)) return;
        await db.query(
          `UPDATE articles SET score_data = ?, content_score = ? WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(scoreData), contentScore, articleId] },
        ).catch(() => {});
        await persistAiVisibilityRun(
          articleId,
          resolvedKeyword || keyword || '',
          aiVisibilitySummary,
          fallbackAi,
        ).catch(() => {});
      }
      // never block deep-analysis on coverage errors; the gauge falls back to computeAiSearchScore
    } finally {
      // Record tokens actually spent even if a later step (buildSnapshot/UPDATE) throws,
      // so the org's 5h budget isn't silently undercounted by a partial failure.
      if (orgId != null && coverageTokens > 0) {
        await recordAiTokens(orgId, coverageTokens);
      }
    }

    if (await abortIfSuperseded(res, articleId, jobId)) return;

    const rankingSources = buildRankingSourcesPayload({
      competitors: serp.competitors || [],
      aiSummary: aiVisibilitySummary,
    });
    if (rankingSources.google.length || rankingSources.ai.length) {
      await db.query(
        `UPDATE articles SET ranking_sources = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(rankingSources), articleId] },
      ).catch((err) => {
        console.warn('[deep-analysis] ranking_sources persist failed (non-fatal):', getErrorMessage(err));
      });
    }

    await db.query(
      `UPDATE analysis_jobs
       SET status = 'done', current_stage = 'done', progress_message = 'Analysis complete', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      { replacements: [jobId] },
    );

    // v7 pipeline bridge (fire-and-forget; after competitors + AI visibility settled)
    try {
      const { enqueueFromDeepAnalysis, enqueueVisibilityFromDeepAnalysis } = await import(
        '../../../lib/pipeline/enqueueFromDeepAnalysis'
      );
      const bridgeUserId = await getCurrentUserId(req, res);
      const workspaceId = String(bridgeUserId || resolvedDomainId || '0');
      const paaRaw = Array.isArray(serp.paa_questions) ? serp.paa_questions : [];
      const docsFromCompetitors = (serpCompetitors || []).map((c) => ({
        url: c.url || '',
        domain: c.domain,
        title: c.title,
        snippet: c.snippet,
      }));
      void enqueueFromDeepAnalysis({
        workspaceId,
        articleId,
        domainId: resolvedDomainId,
        keyword: pipelineKeyword,
        language: finalArticleLanguage,
        competitors: docsFromCompetitors,
        terms: allTerms,
        paaQuestions: paaRaw as Array<string | { question: string }>,
        citedCount: aiVisibilitySummary?.prompts_cited,
        promptCount: aiVisibilitySummary?.prompts_total,
      }).catch((err) => {
        console.warn('[deep-analysis] v7 enqueue failed (non-fatal):', getErrorMessage(err));
      });
      void enqueueVisibilityFromDeepAnalysis({
        workspaceId,
        articleId,
        keyword: pipelineKeyword,
        language: finalArticleLanguage,
        citedCount: aiVisibilitySummary?.prompts_cited,
        promptCount: aiVisibilitySummary?.prompts_total,
      }).catch(() => undefined);
    } catch (err) {
      console.warn('[deep-analysis] v7 enqueue import failed (non-fatal):', getErrorMessage(err));
    }

    await db.query(
      `UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [articleId] },
    );

    sse(res, 'done', {
      articleId,
      rankingScore,
      ai_info_to_cover: coverageSnapshot,
      ai_coverage_score: coverageSnapshot?.overall ?? null,
    });
    return res.end();

  } catch (err) {
    const e = err as { name?: string };
    const errorMessage = e.name === 'AbortError' ? 'Pipeline timed out after 180s' : getErrorMessage(err);
    console.error('[deep-analysis] sidecar error:', errorMessage);
    if (!(await deepAnalysisJobIsCurrent(articleId, jobId).catch(() => false))) {
      sse(res, 'error', { step: 'pipeline', message: 'Analysis superseded by a newer run' });
      return res.end();
    }
    await db.query(
      `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [errorMessage, jobId] },
    ).catch(() => {});
    await db.query(
      `UPDATE articles SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [articleId] },
    ).catch(() => {});
    sse(res, 'error', { step: 'pipeline', message: errorMessage });
    return res.end();
  }
}
