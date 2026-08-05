// GET  /api/articles/[id]/ccm — latest CCM snapshot + Surfer-like view
// POST /api/articles/[id]/ccm — compile article content → persist → view
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../../../lib/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../../../../utils/getUser';
import { assertArticleAccess } from '../../../../../lib/tenancy';
import { getErrorMessage } from '../../../../../lib/errors';
import { ensureArticlesTables } from '../../../../../lib/ensureArticlesTables';
import { ensureCcmTables } from '../../../../../lib/ensureCcmTables';
import { getArticleIdSql } from '../../../../../lib/articleSql';
import { queryOne } from '../../../../../lib/db/query';
import type { ArticleRow } from '../../../../../lib/db/query';
import { SqlCompileStore } from '../../../../../lib/intelligence/sqlCompileStore';
import {
  compileArticle,
  getCcm,
  projectArticleIntelligence,
} from '../../../../../lib/intelligence/runtimeApi';
import { serializeCcm } from '../../../../../lib/ccm/serialize';

type Body = {
  mode?: 'full' | 'incremental';
  dirtyBlockIds?: string[];
  sourceText?: string;
  sourceHtml?: string;
  persist?: boolean;
  includeSnapshot?: boolean;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'Valid id required' });

  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  await ensureArticlesTables();
  await ensureCcmTables();
  const store = new SqlCompileStore();
  const articleKey = String(articleId);

  try {
    if (req.method === 'GET') {
      const model = await getCcm(articleKey, store);
      if (!model) return res.status(404).json({ error: 'CCM not found' });
      const record = await store.getRecord(articleKey);
      const view = projectArticleIntelligence(model, record?.actionGraph);
      const includeSnapshot = req.query.snapshot === '1';
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<Pick<ArticleRow, 'content'>>(
        `SELECT content FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        [articleId],
      );
      const { isCcmStale } = await import('../../../../../lib/intelligence/compileAfterArticleChange');
      const stale = await isCcmStale({
        articleId,
        contentHtml: article?.content || '',
        store,
      });
      return res.status(200).json({
        articleId,
        ccmId: model.ccmId,
        version: model.version,
        contentHash: model.contentHash,
        deterministicHash: model.compiler.deterministicHash,
        compiledAt: model.compiledAt,
        stale,
        view,
        snapshot: includeSnapshot ? serializeCcm(model) : undefined,
      });
    }

    if (req.method === 'POST') {
      const body =
        req.body && typeof req.body === 'object' ? (req.body as Body) : {};
      const articleIdSql = await getArticleIdSql();
      const article = await queryOne<Pick<ArticleRow, 'content' | 'language'>>(
        `SELECT content, language FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        [articleId],
      );
      if (!article) return res.status(404).json({ error: 'Article not found' });

      const source =
        typeof body.sourceText === 'string' && body.sourceText.trim()
          ? ({ kind: 'plain' as const, text: body.sourceText })
          : typeof body.sourceHtml === 'string' && body.sourceHtml.trim()
            ? ({ kind: 'html' as const, html: body.sourceHtml })
            : ({ kind: 'html' as const, html: article.content || '' });

      const result = await compileArticle({
        articleId: articleKey,
        compiledAt: new Date().toISOString(),
        source,
        mode: body.mode === 'incremental' ? 'incremental' : 'full',
        dirtyBlockIds: Array.isArray(body.dirtyBlockIds)
          ? body.dirtyBlockIds.filter((x) => typeof x === 'string')
          : undefined,
        store,
        persist: body.persist !== false,
        locale: article.language || undefined,
      });

      let model = result.model;
      if (body.persist !== false) {
        try {
          const { applyDaFactEnrichment } = await import(
            '../../../../../lib/intelligence/applyDaFactEnrichment'
          );
          model = await applyDaFactEnrichment({
            articleId,
            model,
            contentHtml: article.content || '',
            store,
            persist: true,
          });
        } catch (err: unknown) {
          console.warn('[ccm] DA fact enrichment failed (non-fatal):', getErrorMessage(err));
        }
        try {
          const { persistCcmCoverageProjection } = await import(
            '../../../../../lib/intelligence/persistCcmCoverageProjection'
          );
          await persistCcmCoverageProjection({
            articleId,
            model,
            createdAt: model.compiledAt,
          });
        } catch (err: unknown) {
          console.warn('[ccm] coverage projection failed (non-fatal):', getErrorMessage(err));
        }
      }

      return res.status(200).json({
        articleId,
        ccmId: model.ccmId,
        version: model.version,
        contentHash: model.contentHash,
        deterministicHash: model.compiler.deterministicHash,
        compiledAt: model.compiledAt,
        noop: result.noop,
        actionCount: result.actionGraph.actions.length,
        view: projectArticleIntelligence(model, result.actionGraph),
        snapshot: body.includeSnapshot ? serializeCcm(model) : undefined,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'CCM error' });
  }
}

export default withOrgPaymentAccess(handler);
