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

function sse(res: NextApiResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[deep-analysis] handler invoked', req.method);
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, keywords = [], country = 'US', articleId: existingArticleId, domainId: reqDomainId } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.status(200);
  if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
  res.write(':ok\n\n');

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
      let domainId: number;
      if (reqDomainId) {
        const [domains] = await db.query('SELECT "ID" FROM domain WHERE "ID" = ?', { replacements: [reqDomainId] });
        domainId = (domains as any[])[0]?.ID || 1;
      } else {
        const [domains] = await db.query('SELECT "ID" FROM domain LIMIT 1', { replacements: [] });
        domainId = (domains as any[])[0]?.ID || 1;
      }
      const skeletonSlug = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 60);

      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING ${articleIdSql} AS id`,
          { replacements: [domainId, url, skeletonSlug, url, keyword], type: QueryTypes.SELECT },
        );
        articleId = rows[0]?.id;
      } else {
        const [newId] = await db.query(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          { replacements: [domainId, url, skeletonSlug, url, keyword], type: QueryTypes.INSERT },
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
  const payload = { url, keyword, keywords, language: country === 'PL' ? 'pl' : 'en', tone: 'professional' };

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
  const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
    let sidecarResp: Response;

    try {
      sidecarResp = await fetch(`${sidecarUrl}/pipeline/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    const allTerms = [
      ...(serp.terms || []),
      ...(terms.terms || []),
    ];
    const scoreData = {
      terms: allTerms,
      words_target: serp.words_target || 2200,
      words_min: serp.words_min || 1500,
      words_max: serp.words_max || 3000,
      headings_target: serp.headings_target || 15,
      headings_min: serp.headings_min || 10,
      headings_max: serp.headings_max || 25,
      paragraphs_target: serp.paragraphs_target || 20,
      paragraphs_min: serp.paragraphs_min || 10,
      paragraphs_max: serp.paragraphs_max || 40,
      competitor_count: (serp.competitors || []).length,
      paa_questions: serp.paa_questions || [],
    };

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
      await db.query('DELETE FROM article_competitors WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
      for (const c of serp.competitors) {
        await db.query(
          `INSERT INTO article_competitors (article_id, url, domain, title, snippet, created_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          { replacements: [articleId, c.url || '', c.domain || '', c.title || '', c.snippet || ''] },
        ).catch(() => {});
      }
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
