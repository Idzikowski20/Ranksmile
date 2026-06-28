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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await ensureArticlesTables();
  const { keyword, language = 'pl', num = 5, articleId } = req.body;
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  // ── Return from DB cache if available ─────────────────────────────
  if (articleId) {
    try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(
        `SELECT competitor_outlines_cache FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        { replacements: [articleId] },
      );
      const cached = (rows as any[])[0]?.competitor_outlines_cache;
      if (cached) {
        console.log(`[competitor-outlines] serving cache for article ${articleId}`);
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e: any) {
      console.warn('[competitor-outlines] cache read failed:', e.message);
    }
  }

  // ── Fetch fresh from sidecar ───────────────────────────────────────
  try {
    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    const sidecarRes = await axios.post(
      `${sidecarUrl}/competitor-outlines`,
      { keyword, language, num },
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
      } catch (e: any) {
        console.warn('[competitor-outlines] cache write failed:', e.message);
      }
    }

    return res.status(200).json(result);
  } catch (error: any) {
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
