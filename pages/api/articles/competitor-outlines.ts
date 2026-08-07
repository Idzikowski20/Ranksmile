// POST /api/articles/competitor-outlines
// Proxy to Python sidecar — returns heading structure of competitor pages.
// Caches result in DB (competitor_outlines_cache) keyed by articleId so
// repeated panel opens don't re-scrape.
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import verifyUser from '../../../utils/verifyUser';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne, ArticleRow } from '../../../lib/db/query';
import { getCurrentUserId } from '../../../utils/getUser';
import { resolveContentLocale } from '../../../lib/domainLanguage';
import { assertArticleAccess } from '../../../lib/tenancy';
import { sidecarUrl } from '../../../lib/serviceUrls';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await ensureArticlesTables();
  const { keyword, language, num = 5, articleId } = req.body;
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  const locale = await resolveContentLocale({
    articleId: articleId ? Number(articleId) : undefined,
    bodyLanguage: language,
  });
  const resolvedLanguage = locale.languageCode;

  if (articleId) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  // ── Return from DB cache if available ─────────────────────────────
  if (articleId) {
    try {
      const articleIdSql = await getArticleIdSql();
      const row = await queryOne<Pick<ArticleRow, 'competitor_outlines_cache'>>(
        `SELECT competitor_outlines_cache FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        [articleId],
      );
      const cached = row?.competitor_outlines_cache;
      if (cached) {
        console.log(`[competitor-outlines] serving cache for article ${articleId}`);
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('[competitor-outlines] cache read failed:', getErrorMessage(e));
    }
  }

  // ── Fetch fresh from sidecar ───────────────────────────────────────
  try {
    const base = sidecarUrl();
    const sidecarRes = await axios.post(
      `${base}/competitor-outlines`,
      { keyword, language: resolvedLanguage, num },
      { timeout: 60000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } },
    );
    const result = sidecarRes.data;

    // ── Persist to DB cache ──────────────────────────────────────────
    if (articleId && result.competitors?.length) {
      try {
        const articleIdSql = await getArticleIdSql();
        await db.query(
          `UPDATE articles SET competitor_outlines_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(result), articleId] },
        );
        console.log(`[competitor-outlines] cached ${result.competitors.length} competitors for article ${articleId}`);
      } catch (e) {
        console.warn('[competitor-outlines] cache write failed:', getErrorMessage(e));
      }
    }

    return res.status(200).json(result);
  } catch (rawError) {
    const error = rawError as {
      message?: string;
      code?: string;
      response?: { status?: number; data?: { detail?: string } };
      config?: { url?: string };
    };
    console.error('[competitor-outlines] raw error:', {
      message: error?.message,
      code: error?.code,
      responseStatus: error?.response?.status,
      responseData: error?.response?.data,
      requestUrl: error?.config?.url,
    });
    const detail = error?.response?.data?.detail || error?.message || 'Competitor outlines fetch failed';
    console.error('[competitor-outlines] detail:', detail);
    return res.status(200).json({ competitors: [], _warning: detail });
  }
}

export default withOrgPaymentAccess(handler);
