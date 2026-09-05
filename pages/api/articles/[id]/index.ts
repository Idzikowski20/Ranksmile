// GET    /api/articles/[id]  — pobierz artykuł
// PUT    /api/articles/[id]  — zaktualizuj artykuł (zapis edytora)
// DELETE /api/articles/[id]  — usuń artykuł
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { getErrorMessage } from '@/src/core/shared/errors';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import type { ArticleRow } from '@/src/infrastructure/db/query';
import type { AiVisibilitySummary } from '@/src/core/domain/aiScore/aiSearchScore';
import { computeAiSearchScore } from '@/src/core/domain/aiScore/aiSearchScore';
import {
  buildAiRankingSources,
  buildGoogleRankingSourcesFromRows,
  parseRankingSources,
} from '@/src/infrastructure/articles/rankingSources';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { isReviewOutlineHtml } from '@/src/infrastructure/contentPlanner/reviewOutline';
import { isWrittenArticleHtml } from '@/src/infrastructure/articles/outlineReviewState';
import { parseSnapshot } from '@/src/infrastructure/coverage/coverageStore';
import { getCurrentUserId } from '../../../../utils/getUser';
import verifyUser from '../../../../utils/verifyUser';
import db from '../../../../database/database';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Valid id required' });

  const userId = await getCurrentUserId(req, res);
  const articleId = parseInt((req.query.id ?? req.query.articleId) as string, 10);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  if (req.method === 'GET') return getArticle(id, res);
  if (req.method === 'PUT') return updateArticle(id, req, res);
  if (req.method === 'DELETE') return deleteArticle(id, res, userId);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getArticle(id: string, res: NextApiResponse) {
  try {
    const articleIdSql = await getArticleIdSql();
    const article = await queryOne<ArticleRow & { ai_visibility_summary?: unknown }>(
      `SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      [id],
    );
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const latestVisibility = await queryOne<{ summary_json: string | null; score: number | null }>(
      `SELECT summary_json, score
          FROM ai_visibility_runs
          WHERE article_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
      [id],
    );
    if (latestVisibility?.summary_json) {
      try {
        const summary = JSON.parse(latestVisibility.summary_json) as AiVisibilitySummary;
        const recomputed = computeAiSearchScore(summary);
        article.ai_visibility_summary = {
          ...summary,
          score: Math.max(latestVisibility.score ?? 0, recomputed),
        };
      } catch {
        article.ai_visibility_summary = null;
      }
    }

    const parsed = parseRankingSources(article.ranking_sources);
    let { google } = parsed;
    let { ai } = parsed;

    if (!google.length) {
      const competitorRows = await queryRows<{ url: string; domain: string; title: string; snippet: string | null }>(
        'SELECT url, domain, title, snippet FROM article_competitors WHERE article_id = ? ORDER BY id ASC LIMIT 20',
        [id],
      );
      google = buildGoogleRankingSourcesFromRows(competitorRows);
    }

    if (!ai.length && article.ai_visibility_summary) {
      ai = buildAiRankingSources(article.ai_visibility_summary as AiVisibilitySummary);
    }

    if (google.length || ai.length) {
      article.ranking_sources = JSON.stringify({ google, ai });
    }

    return res.status(200).json({ article });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

/** Editor-computed scores travel inside score_data under these keys. */
const CONTENT_SCORE_KEY = '_content_score' as const;
const COMPUTED_SCORE_KEY = '_computed_score' as const;

async function updateArticle(id: string, req: NextApiRequest, res: NextApiResponse) {
  const {
    title, content: requestedContent, status, target_keyword, meta_title, meta_description, meta_url,
    word_count, score_data, featured_image, internal_links_cache, version_type, score_override,
    coverage_snapshot,
  } = req.body;
  // A coverage snapshot Auto-Optimize regraded on the body being saved. Only with the
  // body: a snapshot for text that is not being stored would grade the wrong article.
  // Cleared again below when the body is refused.
  let coverageSnapshotJson = typeof requestedContent === 'string' && parseSnapshot(coverage_snapshot)
    ? JSON.stringify(coverage_snapshot)
    : null;
  // Reassigned below when the body is refused; every later use reads this one. Typed
  // here because a `let` loses its narrowing inside the fire-and-forget closures below.
  let content: string | undefined = typeof requestedContent === 'string' ? requestedContent : undefined;
  let contentKept = false;

  // Extract content score from score_data
  let contentScore = 0;
  let scoreDataObj: Record<string, unknown> | null = null;
  try {
    if (score_data) {
      scoreDataObj = typeof score_data === 'string'
        ? JSON.parse(score_data) as Record<string, unknown>
        : (score_data as Record<string, unknown>);
      contentScore = Number(scoreDataObj[CONTENT_SCORE_KEY] ?? scoreDataObj[COMPUTED_SCORE_KEY] ?? 0) || 0;
    }
  } catch {
    contentScore = 0;
    scoreDataObj = null;
  }

  // CIE: coverage overlay + AO plan patch on HTML save (non-fatal)
  if (
    scoreDataObj
     && typeof content === 'string'
     && content.trim().length > 80
     && scoreDataObj.knowledge_graph
  ) {
    try {
      const { applyKnowledgeCoverageOverlay } = await import('@/src/infrastructure/knowledgeEngine/index');
      const overlay = await applyKnowledgeCoverageOverlay(scoreDataObj, content);
      scoreDataObj = overlay.scoreData;
    } catch (err: unknown) {
      console.warn('[articles/[id]] CIE coverage overlay failed (non-fatal):', getErrorMessage(err));
    }
  }

  try {
    const articleIdSql = await getArticleIdSql();
    let beforeScore: number | undefined;
    let storedScoreData: Record<string, unknown> | null = null;
    let storedContent: string | null = null;
    try {
      const prev = await queryOne<{ content_score: number | null; score_data: string | null; content: string | null }>(
        `SELECT content_score, score_data, content FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        [id],
      );
      if (prev?.content_score != null) beforeScore = Number(prev.content_score);
      storedScoreData = prev?.score_data ? JSON.parse(prev.score_data) as Record<string, unknown> : null;
      storedContent = prev?.content ?? null;
    } catch {
      beforeScore = undefined;
    }

    // A written article never regresses to its plan. The outline is a document the
    // editor renders while reviewing; whichever client path lets it reach autosave —
    // article 166 arrived here through a stale ?reviewOutline=1 — the stored body wins.
    // Everything else in the save (meta, scores, image) still lands.
    if (typeof content === 'string' && isReviewOutlineHtml(content) && isWrittenArticleHtml(storedContent)) {
      console.warn(`[articles/[id]] refused to overwrite article ${id} with its outline — body kept`);
      content = undefined;
      contentKept = true;
      coverageSnapshotJson = null;
    }

    // Merge ONTO the stored blob, never replace it. The editor loads its score_data
    // copy when the page opens; the post-generation finalize then enriches the stored
    // one (ai_factors, regraded coverage, researched_facts, failure markers) — and the
    // first autosave used to ship the stale client copy wholesale, wiping all of it.
    // Article 75: finalize wrote at 10:35:06, autosave clobbered it at 10:36:34.
    // Spread order keeps client-owned keys (terms, counts) winning while server-only
    // keys survive by absence from the client copy.
    if (scoreDataObj && storedScoreData) {
      scoreDataObj = { ...storedScoreData, ...scoreDataObj };
      // Server-authoritative keys: the client never edits these through this route,
      // it only holds possibly-stale copies — the stored value always wins.
      for (const key of [
        'ai_factors', 'ai_score', 'researched_facts', '_reconcile_error', '_regrade_error',
        'content_planner_v2', 'compiled_write_plan', 'knowledge_graph',
        'structural_benchmark', 'competitor_claims', 'competitor_synthesis', 'cie_gate',
      ]) {
        if (storedScoreData[key] !== undefined) scoreDataObj[key] = storedScoreData[key];
      }
    }
    // Explicit fresh editor scores (the number the gauge shows). Applied AFTER the
    // authoritative restore so they may update seo_score/ai_score/content_score — this is
    // the one route allowed to refresh the otherwise server-owned ai_score, and it ships
    // the resolved value (>= stored), so it cannot regress finalize's score. A score-only
    // refresh sends just this (no content/meta/image), so it never rewrites the article.
    if (score_override && typeof score_override === 'object') {
      const so = score_override as { seo?: unknown; ai?: unknown; overall?: unknown };
      // Accept only real numbers — never coerce null/booleans/strings into a score.
      const clamp01 = (v: unknown): number | null =>
        (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);
      scoreDataObj = { ...(scoreDataObj ?? storedScoreData ?? {}) };
      const seoOv = clamp01(so.seo);
      const aiOv = clamp01(so.ai);
      const overallOv = clamp01(so.overall);
      if (seoOv != null) scoreDataObj.seo_score = seoOv;
      if (aiOv != null) {
        // ai_score is server-authoritative; the override only RAISES it (the panel ships
        // max(stored, resolved)), so a stale/lowball client can never regress finalize.
        const storedAi = Number(storedScoreData?.ai_score);
        scoreDataObj.ai_score = Number.isFinite(storedAi) ? Math.max(storedAi, aiOv) : aiOv;
      }
      if (overallOv != null) {
        scoreDataObj[CONTENT_SCORE_KEY] = overallOv;
        scoreDataObj[COMPUTED_SCORE_KEY] = overallOv;
      }
      // Never zero content_score on a partial override (only seo/ai sent): recompute it
      // from the merged blob / prior value. A finite 0 is a real score — keep it (|| would
      // discard it and desync content_score from score_data).
      const merged = Number(scoreDataObj[CONTENT_SCORE_KEY] ?? scoreDataObj[COMPUTED_SCORE_KEY] ?? beforeScore);
      if (Number.isFinite(merged)) contentScore = merged;
    }

    let scoreDataJson: string | null = null;
    if (scoreDataObj) scoreDataJson = JSON.stringify(scoreDataObj);
    else if (score_data) scoreDataJson = JSON.stringify(score_data);
    if (version_type && content !== undefined) {
      await db.query(
        `INSERT INTO article_versions (article_id, version_type, content, score_data, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        {
          replacements: [
            id,
            version_type,
            content ?? '',
            scoreDataJson,
          ],
        },
      );
    }
    await db.query(
      `UPDATE articles
          SET title = COALESCE(?, title),
              content = COALESCE(?, content),
              status = COALESCE(?, status),
              target_keyword = COALESCE(?, target_keyword),
              meta_title = COALESCE(?, meta_title),
              meta_description = COALESCE(?, meta_description),
              meta_url = COALESCE(?, meta_url),
              word_count = COALESCE(?, word_count),
              score_data = COALESCE(?, score_data),
              content_score = CASE WHEN ? IS NOT NULL THEN ? ELSE content_score END,
              featured_image = CASE WHEN ? IS NOT NULL THEN ? ELSE featured_image END,
              internal_links_cache = CASE WHEN ? IS NOT NULL THEN ? ELSE internal_links_cache END,
              ai_info_to_cover = COALESCE(?, ai_info_to_cover),
              updated_at = CURRENT_TIMESTAMP
          WHERE ${articleIdSql} = ?`,
      {
        replacements: [
          title ?? null,
          content ?? null,
          status ?? null,
          target_keyword ?? null,
          meta_title ?? null,
          meta_description ?? null,
          meta_url ?? null,
          word_count ?? null,
          scoreDataJson,
          // Only (re)write content_score when score_data was sent — a partial save (title/status/
          // meta only) must NOT zero the previously-computed score.
          scoreDataJson ? contentScore : null,
          scoreDataJson ? contentScore : null,
          featured_image !== undefined ? featured_image : null,
          featured_image !== undefined ? featured_image : null,
          internal_links_cache !== undefined ? JSON.stringify(internal_links_cache) : null,
          internal_links_cache !== undefined ? JSON.stringify(internal_links_cache) : null,
          coverageSnapshotJson,
          id,
        ],
      },
    );

    // v7 live_score queue on content save (fire-and-forget)
    if (content && scoreDataJson) {
      try {
        const { enqueueLiveScoreOnSave } = await import('@/src/infrastructure/pipeline/enqueueFromDeepAnalysis');
        const { recordScoreFeedback } = await import('@/src/infrastructure/learning/scoreFeedback');
        const userId = await getCurrentUserId(req, res);
        const sd = scoreDataObj || {};
        const after = Number(
          (sd && typeof sd === 'object' && (sd as { _content_score?: number })[CONTENT_SCORE_KEY])
              ?? contentScore
              ?? 0,
        );
        enqueueLiveScoreOnSave({
          workspaceId: String(userId || '0'),
          articleId: Number(id),
          keyword: String(target_keyword || ''),
          html: String(content),
          scoreData: (sd && typeof sd === 'object' ? sd : {}) as Record<string, unknown>,
        }).catch(() => undefined);
        recordScoreFeedback({
          workspaceId: String(userId || '0'),
          articleId: Number(id),
          changeType: 'article_save',
          beforeScore,
          afterScore: after,
        }).catch(() => undefined);
      } catch {
        /* non-fatal */
      }
    }

    // CIA: refresh CCM if content drifted (07-runtime editor save) — non-fatal, no UI
    if (typeof content === 'string' && content.trim().length > 80) {
      import('@/src/core/intelligence/compileAfterArticleChange')
        .then((m) =>
          m.compileIfStale({
            articleId: Number(id),
            compiledAt: new Date().toISOString(),
            contentHtml: content,
            mode: 'full',
          }),
        )
        .then((r) => {
          if (!r.ok) console.warn('[ccm] compile on article save skipped:', r.error);
        })
        .catch((err: unknown) => {
          console.warn('[ccm] compile on article save failed (non-fatal):', getErrorMessage(err));
        });
    }

    return res.status(200).json({ updated: true, ...(contentKept ? { contentKept: true } : {}) });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

async function deleteArticle(id: string, res: NextApiResponse, userId: string | null) {
  try {
    const articleIdSql = await getArticleIdSql();
    const article = await queryOne<Pick<ArticleRow, 'domain_id'>>(
      `SELECT domain_id FROM articles WHERE ${articleIdSql} = ?`,
      [id],
    );
    if (!article) return res.status(404).json({ error: 'Article not found' });
    const { getOrgIdForDomain, ensureOrgQuotaBalances, adjustActiveUsage } = await import('@/src/infrastructure/quota/index');
    const orgId = await getOrgIdForDomain(article.domain_id);
    await db.transaction(async (tx) => {
      await db.query(`DELETE FROM articles WHERE ${articleIdSql} = ?`, { replacements: [id], transaction: tx });
      if (orgId) {
        await ensureOrgQuotaBalances(orgId, { transaction: tx });
        await adjustActiveUsage(
          {
            orgId,
            meter: 'documents',
            delta: -1,
            idempotencyKey: `doc-delete:${id}`,
            ref: { type: 'article', id: String(id) },
            userId,
          },
          { transaction: tx },
        );
      }
    });
    return res.status(200).json({ deleted: true });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
  }
}

export default withOrgPaymentAccess(handler);
