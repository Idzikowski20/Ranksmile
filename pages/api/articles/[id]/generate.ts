// POST /api/articles/[id]/generate
// Generates article content INTO an existing article (created by deep-analysis),
// reusing its target keyword + analysis. Calls the Python sidecar /generate and
// writes the result back to the same article row.
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
import { getErrorMessage } from '../../../../lib/errors';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getCurrentUserId(req, res);
  const articleIdNum = parseInt((req.query.id ?? req.query.articleId) as string, 10);
  if (!(await assertArticleAccess(userId, articleIdNum))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Org-wide AI budget: full-article generation is expensive.
  const orgId = await resolveOrgId(req, res);
  const over = await orgBudgetBlocked(orgId);
  if (over) return res.status(429).json(over);

  const articleId = req.query.id;
  const {
    language = 'pl', tone = 'professional',
    contentType, instructions = '', voiceId = 'serp',
    internalLinks = true, externalLinks = true, reviewOutline = false,
  } = req.body || {};

  try {
    const articleIdSql = await getArticleIdSql();

    // 1. Load the existing article (keyword + domain + analysed language)
    const articleRows = await db.query<{ target_keyword: string; domain_id: number; language: string }>(
      `SELECT target_keyword, domain_id, language FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const article = articleRows[0];
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const keyword = article.target_keyword;
    if (!keyword) return res.status(400).json({ error: 'Article has no target keyword' });
    const lang = article.language || language;

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

    // 5. Build the sidecar payload (snake_case keys match the sidecar GenerateRequest).
    const sidecarPayload = {
      url: `https://${domainName}`, keyword, language: lang, tone, existing_articles: domainArticles,
      content_type: contentType, instructions, internal_links: internalLinks, external_links: externalLinks, review_outline: reviewOutline,
      brand_knowledge: brandKnowledge, voice_tone: voiceTone,
    };

    // 6. Async: enqueue a job, mark the article 'generating', and kick off the sidecar in
    // the background. The sidecar POSTs the result to /api/articles/job-progress (which
    // writes it back to THIS article), so this function returns in seconds — not the
    // ~minute the LLM takes, which would exceed Vercel's function limit.
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

    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    const nextjsUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTJS_URL || '';
    try {
      await axios.post(`${sidecarUrl}/pipeline/generate`,
        { jobId, payload: sidecarPayload, nextjsUrl },
        { timeout: 15000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } });
    } catch (kickoffErr) {
      const e = kickoffErr as { response?: { data?: unknown }; message?: string };
      const detail = e?.response?.data || e?.message || 'sidecar unavailable';
      console.error('[articles/[id]/generate] kickoff failed:', detail);
      // Couldn't start the job — fail it and roll the article back so the UI doesn't poll forever.
      await db.query(`UPDATE analysis_jobs SET status = 'failed', error = ? WHERE id = ?`, { replacements: [String(detail).slice(0, 500), jobId] });
      await db.query(`UPDATE articles SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`, { replacements: [articleId] });
      return res.status(502).json({ error: 'Generation service unavailable', detail });
    }

    return res.status(202).json({ jobId, articleId });
  } catch (error) {
    console.error('[articles/[id]/generate] error:', error);
    return res.status(500).json({ error: getErrorMessage(error) || 'Generation failed' });
  }
}
