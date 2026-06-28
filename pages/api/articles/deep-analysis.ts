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
import { computeContentScore } from '../../../lib/contentScore';
import { getAiSearchInfo } from '../../../lib/seo/keywordData';
import { persistAiVisibilityRun } from '../../../lib/aiVisibilityStore';
import { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { callSidecar, sidecarBase } from '../../../lib/sidecar';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { verifyDomainOwnershipById, firstAccessibleDomainId } from '../../../utils/verifyDomainOwnership';

/** Map an ISO country code to the SERP analysis language the sidecar supports. */
function langForCountry(country: string): string {
  const map: Record<string, string> = {
    PL: 'pl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl', PT: 'pt',
    US: 'en', GB: 'en',
  };
  return map[(country || '').toUpperCase()] || 'en';
}

function sse(res: NextApiResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

/** Build the article score_data target ranges from a sidecar SERP result. */
function buildScoreData(serp: any, terms: any[], competitorCount: number) {
  return {
    terms,
    words_target: serp.words_target || 2200,
    words_min: serp.words_min || 1500,
    words_max: serp.words_max || 3000,
    headings_target: serp.headings_target || 15,
    headings_min: serp.headings_min || 10,
    headings_max: serp.headings_max || 25,
    paragraphs_target: serp.paragraphs_target || 20,
    paragraphs_min: serp.paragraphs_min || 10,
    paragraphs_max: serp.paragraphs_max || 40,
    competitor_count: competitorCount,
    paa_questions: serp.paa_questions || [],
  };
}

/** Replace an article's stored SERP competitors with a single batched insert. */
async function replaceCompetitors(articleId: number, competitors: any[]): Promise<void> {
  await db.query('DELETE FROM article_competitors WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
  const rows = (competitors || []).slice(0, 50);
  if (!rows.length) return;
  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
  const replacements = rows.flatMap((c) => [articleId, c.url || '', c.domain || '', c.title || '', c.snippet || '']);
  await db.query(
    `INSERT INTO article_competitors (article_id, url, domain, title, snippet, created_at) VALUES ${placeholders}`,
    { replacements },
  ).catch(() => {});
}

/**
 * New-content path (no URL): gather the ranking content (SERP) for a keyword via
 * the sidecar /analyze-serp, create the draft article, store competitors + a
 * ranking_sources payload (Google Search + AI-cited), and stream SSE progress so
 * the deep-analysis screen animates and then advances to content-type.
 */
async function runKeywordMode(
  res: NextApiResponse,
  opts: { keyword: string; country: string; domainId: number },
) {
  const { keyword, country, domainId } = opts;
  const articleIdSql = await getArticleIdSql();
  const language = langForCountry(country);

  // 1. Create the draft article (no content yet — body is written at generation).
  let articleId: number;
  try {
    if (process.env.DATABASE_URL) {
      const rows = await db.query<{ id: number }>(
        `INSERT INTO articles (domain_id, title, content, target_keyword, language, status, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING ${articleIdSql} AS id`,
        { replacements: [domainId, keyword, keyword, language], type: QueryTypes.SELECT },
      );
      articleId = rows[0]?.id;
    } else {
      const [newId] = await db.query(
        `INSERT INTO articles (domain_id, title, content, target_keyword, language, status, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        { replacements: [domainId, keyword, keyword, language], type: QueryTypes.INSERT },
      );
      articleId = newId as unknown as number;
    }
  } catch (err: any) {
    console.error('[deep-analysis:keyword] skeleton insert failed:', err.message);
    sse(res, 'error', { step: 'save', message: 'Failed to initialize analysis' });
    return;
  }
  sse(res, 'created', { articleId });

  // URL-only steps don't apply — mark them done so the UI doesn't stall.
  for (const k of ['fetch', 'metadata', 'structure']) sse(res, 'progress', { step: k, status: 'done' });
  sse(res, 'progress', { step: 'serp', status: 'running' });

  // 2. Gather SERP for the keyword (no page fetch needed).
  let serp: any = {};
  try {
    serp = await callSidecar('/analyze-serp', { keyword, language });
  } catch (err: any) {
    console.log('[deep-analysis:keyword] analyze-serp failed (non-fatal):', err?.message);
  }
  sse(res, 'progress', { step: 'serp', status: 'done' });

  const competitors: any[] = serp.competitors || [];

  // 3. Store competitors → article_competitors (same store the editor reads).
  await replaceCompetitors(articleId, competitors);
  sse(res, 'progress', { step: 'nlp', status: 'done' });

  // 4. Terms come from competitor CONTENT (sidecar extract_semantic_terms) — like
  //    Surfer's "important terms". We deliberately do NOT layer DataForSEO keyword
  //    ideas here: for brand keywords (e.g. containing "google") they flood the list
  //    with irrelevant suggestions (google maps, translate, minecraft…) that tank the
  //    NLP-terms score because the article never naturally contains them.
  const terms: any[] = serp.terms || [];

  // 5. AI-cited sources (People-Also-Ask) for the "Cited by AI models" tab.
  const aiSources: Array<{ domain: string; url: string; title: string }> = [];
  try {
    const ai = await getAiSearchInfo({ keyword, articleText: '', country, languageCode: language });
    if (ai && ai.citations) {
      // Keep each cited page (Surfer lists 16–20, same domain can appear more than
      // once) — dedupe by URL, not domain, capped at 20.
      const seen = new Set<string>();
      for (const c of ai.citations) {
        const d = (c.cited_domain || '').replace(/^www\./, '');
        if (!d) continue;
        const key = c.cited_url || `${d}|${c.prompt || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        aiSources.push({ domain: d, url: c.cited_url || '', title: c.prompt || '' });
        if (aiSources.length >= 20) break;
      }
    }
  } catch { /* non-fatal */ }
  sse(res, 'progress', { step: 'score', status: 'done' });

  // 6. Persist score_data + ranking_sources on the article.
  const scoreData = buildScoreData(serp, terms, competitors.length);
  const rankingSources = {
    google: competitors.map((c, i) => ({ rank: i + 1, domain: (c.domain || '').replace(/^www\./, ''), url: c.url || '', title: c.title || '' })),
    ai: aiSources,
  };
  try {
    await db.query(
      `UPDATE articles SET score_data = ?, ranking_sources = ?, status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [JSON.stringify(scoreData), JSON.stringify(rankingSources), articleId] },
    );
  } catch { /* non-fatal */ }

  for (const k of ['image', 'save']) sse(res, 'progress', { step: k, status: 'done' });
  sse(res, 'done', { articleId });
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

  const { url, keywords = [], country = 'US', articleId: existingArticleId, domainId: reqDomainId } = req.body;
  const primaryKeyword = (keywords as string[])[0] || '';
  const isKeywordMode = !url && !!primaryKeyword && !!reqDomainId;
  if (!url && !isKeywordMode) return res.status(400).json({ error: 'url or (keywords + domainId) is required' });

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

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.status(200);
  if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
  res.write(':ok\n\n');

  // New-content keyword mode: gather SERP (no URL fetch), create draft, store
  // competitors + ranking_sources, then signal done → wizard goes to content-type.
  if (isKeywordMode) {
    await runKeywordMode(res, { keyword: primaryKeyword, country, domainId: resolvedDomainId! });
    return res.end();
  }

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
      const skeletonSlug = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 60);
      const language = langForCountry(country);

      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING ${articleIdSql} AS id`,
          { replacements: [domainId, url, skeletonSlug, url, keyword, language], type: QueryTypes.SELECT },
        );
        articleId = rows[0]?.id;
      } else {
        const [newId] = await db.query(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, language, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          { replacements: [domainId, url, skeletonSlug, url, keyword, language], type: QueryTypes.INSERT },
        );
        articleId = newId as unknown as number;
      }
      sse(res, 'created', { articleId });
    } catch (err: any) {
      console.error('[deep-analysis] skeleton insert failed:', err.message);
      sse(res, 'error', { step: 'save', message: 'Failed to initialize analysis' });
      return res.end();
    }
  }

  // ── Create analysis job ───────────────────────────────────────────
  const jobId = `job_${articleId}_${Date.now()}`;
  const payload = { url, keyword, keywords, language: langForCountry(country), tone: 'professional' };

  try {
    await db.query(
      `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'deep_analysis', 'queued', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: [jobId, articleId, JSON.stringify(payload)] },
    );
    sse(res, 'created', { articleId, jobId });
  } catch (err: any) {
    console.error('[deep-analysis] job insert failed:', err.message);
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
  } catch (err: any) {
    console.error('[deep-analysis] job claim failed:', err.message);
    sse(res, 'error', { step: 'save', message: 'Failed to claim analysis job' });
    return res.end();
  }

  // ── Call sidecar, await result, write back to job row ─────────────
  const sidecarUrl = sidecarBase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
    let sidecarResp: Response;

    try {
      sidecarResp = await fetch(`${sidecarUrl}/pipeline/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
        body: JSON.stringify({ jobId, payload }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!sidecarResp.ok) {
      const errText = await sidecarResp.text();
      await db.query(
        `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [errText, jobId] },
      );
      await db.query(
        `UPDATE articles SET status = 'error', content = ? WHERE ${articleIdSql} = ?`,
        { replacements: [errText, articleId] },
      );
      sse(res, 'error', { step: 'pipeline', message: errText });
      return res.end();
    }

    const sidecarData = await sidecarResp.json();
    const result = sidecarData.result || {};

    // Write done status + result to job row
    await db.query(
      `UPDATE analysis_jobs SET status = 'done', result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [JSON.stringify(result), jobId] },
    );

    // ── Extract data from pipeline result ───────────────────────────
    const fetchPage = result.fetch_page || {};
    const serp = result.scrape_serp || {};
    const classify = result.classify_content || {};
    const terms = result.extract_terms || {};
    const score = result.score_ranking || {};

    // Terms come from competitor CONTENT only (sidecar scrape_serp + extract_terms),
    // like Surfer's "important terms". We deliberately do NOT layer DataForSEO keyword
    // ideas: for brand keywords they flood the list with irrelevant suggestions
    // (maps, translate, minecraft…) the article never contains, which tanks the score.
    const allTerms = [
      ...(serp.terms || []),
      ...(terms.terms || []),
    ];

    const scoreData = buildScoreData(serp, allTerms, (serp.competitors || []).length);

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
    (scoreData as any)._heading_count = headingCount;
    (scoreData as any)._paragraph_count = paragraphCount;
    const computedScore = computeContentScore(
      plainText, wordCount, headingCount, scoreData, paragraphCount, undefined,
      pageContent, keyword || '',
    );
    (scoreData as any)._computed_score = computedScore;

    const setClauses: string[] = [
      `title = COALESCE(NULLIF(?, ''), title)`,
      `meta_title = COALESCE(NULLIF(?, ''), meta_title)`,
      `meta_description = COALESCE(NULLIF(?, ''), meta_description)`,
      `content = COALESCE(NULLIF(?, ''), content)`,
      `featured_image = COALESCE(NULLIF(?, ''), featured_image)`,
      `word_count = ?`,
      `score_data = ?`,
      `content_score = COALESCE(?, content_score)`,
      `status = 'draft'`,
      `updated_at = CURRENT_TIMESTAMP`,
    ];
    const replacements: any[] = [
      articleTitle,
      metaTitle,
      metaDescription,
      pageContent,
      featuredImage,
      wordCount || classify.word_count_estimate || 0,
      JSON.stringify(scoreData),
      computedScore || ruleBase,
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

    await db.query(
      `UPDATE articles SET ${setClauses.join(', ')} WHERE ${articleIdSql} = ?`,
      { replacements },
    );

    // Save SERP competitors
    if (serp.competitors?.length) {
      await replaceCompetitors(articleId, serp.competitors);
    }

    // Save terms
    if (allTerms.length) {
      await db.query('DELETE FROM article_terms WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
      for (const t of allTerms) {
        await db.query(
          `INSERT INTO article_terms (article_id, term, term_type, source, current_count, target_min, target_max, importance, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          { replacements: [articleId, t.term, t.type || 'topic', 'serp', 0, Math.max(1, Math.round(t.target_count * 0.7)), Math.max(1, Math.round(t.target_count * 1.5)), t.target_count || 1] },
        ).catch(() => {});
      }
    }

    // AI Search "info to cover" — prefer DataForSEO People Also Ask; fall back to
    // the sidecar (serper) result. Persisted so the editor list is ready without a
    // manual run. Non-fatal — the article is already saved.
    try {
      let ownDomain = '';
      try { ownDomain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
      let summary: AiVisibilitySummary | null = await getAiSearchInfo({
        keyword: keyword || '', articleText: plainText, ownDomain, country, languageCode: langForCountry(country),
      });
      const aiSearch = result.ai_search;
      if (!summary && aiSearch && Array.isArray(aiSearch.citations)) {
        summary = {
          prompts_total: aiSearch.prompts_total || 0,
          prompts_cited: aiSearch.prompts_cited || 0,
          competitor_citations: aiSearch.competitor_citations || 0,
          extractability_score: aiSearch.extractability_score || 0,
          citations: aiSearch.citations || [],
        };
      }
      if (summary && summary.citations.length) {
        await persistAiVisibilityRun(articleId, keyword || '', summary);
        console.log(`[deep-analysis] AI search stored: ${summary.prompts_cited}/${summary.prompts_total} covered`);
      }
    } catch (err: any) {
      console.log('[deep-analysis] AI search persist failed (non-fatal):', err?.message);
    }

    sse(res, 'done', { articleId, rankingScore });
    return res.end();

  } catch (err: any) {
    const errorMessage = err.name === 'AbortError' ? 'Pipeline timed out after 180s' : err.message;
    console.error('[deep-analysis] sidecar error:', errorMessage);
    await db.query(
      `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [errorMessage, jobId] },
    ).catch(() => {});
    await db.query(
      `UPDATE articles SET status = 'error', content = ? WHERE ${articleIdSql} = ?`,
      { replacements: [errorMessage, articleId] },
    ).catch(() => {});
    sse(res, 'error', { step: 'pipeline', message: errorMessage });
    return res.end();
  }
}
