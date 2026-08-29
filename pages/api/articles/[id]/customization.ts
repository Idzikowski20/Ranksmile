// POST /api/articles/[id]/customization — Content Editor customization (Surfer-style).
// { recalcCompetitors: true }        → recompute structure targets + NLP terms from the
//                                      SELECTED competitors (domain_serp_competitors.selected)
// { structure: { words?, headings?, paragraphs? } } → override structure targets
// { addTerm: string } / { removeTerm: string }      → edit the graded term list
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import { assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { getCompetitors } from '@/src/infrastructure/competitors/competitorScan';
import { callSidecar, isSidecarConfigured } from '@/src/infrastructure/http/sidecar';
import { safeJsonParse } from '@/src/core/shared/safeJson';
import { getErrorMessage } from '@/src/core/shared/errors';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import type { NlpTerm } from '@/src/infrastructure/articles/contentScore';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';
import db from '../../../../database/database';

type ArticleRow = {
  id: number;
  domain_id: number | null;
  target_keyword: string | null;
  language: string | null;
  score_data: string | null;
};

/** Same floors the sidecar applies — a hand-picked short cohort must not cap a real article. */
const WORDS_TARGET_FLOOR = 800;
const WORDS_MAX_FLOOR = 1200;
const HEADINGS_TARGET_FLOOR = 8;
const HEADINGS_MAX_FLOOR = 12;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const userId = await getCurrentUserId(req, res);
  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId) || !(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const articleIdSql = await getArticleIdSql();

  try {
    const rows = await db.query<ArticleRow>(
      `SELECT id, domain_id, target_keyword, language, score_data
         FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      { replacements: [articleId], type: QueryTypes.SELECT },
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Article not found' });
    const scoreData = safeJsonParse<Record<string, unknown>>(row.score_data, {}) ?? {};
    const keyword = (row.target_keyword || '').trim();

    if (typeof req.body?.addTerm === 'string' || typeof req.body?.removeTerm === 'string') {
      const terms = Array.isArray(scoreData.terms) ? (scoreData.terms as NlpTerm[]) : [];
      let next = terms;
      const addTerm = (req.body.addTerm || '').trim();
      const removeTerm = (req.body.removeTerm || '').trim().toLowerCase();
      if (addTerm && !terms.some((t) => t.term.toLowerCase() === addTerm.toLowerCase())) {
        next = [{ term: addTerm, target_count: 1, suggested_min: 1, suggested_max: 2 } as NlpTerm, ...terms];
      }
      if (removeTerm) {
        next = next.filter((t) => t.term.toLowerCase() !== removeTerm);
      }
      const updated = { ...scoreData, terms: next };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(updated), articleId] },
      );
      return res.status(200).json({ ok: true, terms: next.length });
    }

    if (req.body?.structure && typeof req.body.structure === 'object') {
      const { words, headings, paragraphs } = req.body.structure as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...scoreData };
      const setTarget = (targetKey: string, maxKey: string, value: unknown, headroom: number) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return;
        updated[targetKey] = Math.round(n);
        // The target is the promise; the max must not sit below it or the score
        // punishes the writer for hitting the number the user just asked for.
        const currentMax = Number(updated[maxKey]) || 0;
        updated[maxKey] = Math.max(currentMax, Math.round(n * headroom));
      };
      setTarget('words_target', 'words_max', words, 1.3);
      setTarget('headings_target', 'headings_max', headings, 1.4);
      setTarget('paragraphs_target', 'paragraphs_max', paragraphs, 1.4);
      updated._customization = { ...(scoreData._customization as object || {}), structureAt: new Date().toISOString() };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(updated), articleId] },
      );
      return res.status(200).json({
        ok: true,
        structure: {
          words_target: updated.words_target,
          headings_target: updated.headings_target,
          paragraphs_target: updated.paragraphs_target,
        },
      });
    }

    if (req.body?.recalcCompetitors) {
      if (!row.domain_id || !keyword) {
        return res.status(400).json({ error: 'Article has no domain or keyword to recalculate from' });
      }
      const competitors = await getCompetitors(row.domain_id, keyword);
      const selected = competitors.filter((c) => c.selected && c.url);
      if (!selected.length) {
        return res.status(400).json({ error: 'Select at least one competitor first' });
      }

      // Structure targets from the picked cohort — same math and floors as the sidecar.
      const wordCounts = selected.map((c) => c.wordCount).filter((n) => n >= 200);
      const headingCounts = selected.map((c) => c.headingCount).filter((n) => n > 0);
      const updated: Record<string, unknown> = { ...scoreData };
      if (wordCounts.length) {
        updated.words_min = Math.min(...wordCounts);
        updated.words_max = Math.max(Math.max(...wordCounts), WORDS_MAX_FLOOR);
        updated.words_target = Math.max(
          Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
          WORDS_TARGET_FLOOR,
        );
      }
      if (headingCounts.length) {
        updated.headings_min = Math.max(3, Math.min(...headingCounts));
        updated.headings_max = Math.max(Math.max(...headingCounts), HEADINGS_MAX_FLOOR);
        updated.headings_target = Math.max(
          Math.round(headingCounts.reduce((a, b) => a + b, 0) / headingCounts.length),
          HEADINGS_TARGET_FLOOR,
        );
      }
      updated.competitor_count = selected.length;

      // Terms re-extracted from the picked pages only — this is the expensive half of
      // Surfer's "recalculate", so it is best-effort: a sidecar outage keeps the old list.
      let termsRefreshed = false;
      if (isSidecarConfigured()) {
        try {
          const out = await callSidecar<{ terms?: NlpTerm[] }>('/extract-terms-from-urls', {
            keyword,
            urls: selected.map((c) => c.url),
            language: row.language || 'pl',
          }, 120_000);
          if (Array.isArray(out.terms) && out.terms.length >= 8) {
            updated.terms = out.terms;
            termsRefreshed = true;
          }
        } catch (err) {
          console.warn('[customization] term recalc failed (keeping old terms):', getErrorMessage(err));
        }
      }
      updated._customization = {
        ...(scoreData._customization as object || {}),
        competitorsAt: new Date().toISOString(),
        selectedUrls: selected.map((c) => c.url),
      };
      await db.query(
        `UPDATE articles SET score_data = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(updated), articleId] },
      );
      return res.status(200).json({
        ok: true,
        termsRefreshed,
        competitorCount: selected.length,
        structure: {
          words_target: updated.words_target,
          headings_target: updated.headings_target,
        },
      });
    }

    return res.status(400).json({ error: 'Nothing to do' });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'Customization failed' });
  }
}

export default withOrgPaymentAccess(handler);
