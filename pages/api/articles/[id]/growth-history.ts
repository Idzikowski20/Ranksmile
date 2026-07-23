// GET /api/articles/[id]/growth-history — Observation + Feature version history (append-only)
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { ensureFeatureStoreTables } from '../../../../lib/ensureFeatureStoreTables';
import { getFeatureStore } from '../../../../lib/featureStore';
import { getErrorMessage } from '../../../../lib/errors';
import { getArticleIdSql } from '../../../../lib/articleSql';
import { queryOne } from '../../../../lib/db/query';
import type { Observation } from '../../../../lib/primitives/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureFeatureStoreTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const articleId = parseInt(String(req.query.id), 10);
  if (!Number.isFinite(articleId)) return res.status(400).json({ error: 'Valid id required' });

  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const store = getFeatureStore();
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const featureId = typeof req.query.featureId === 'string' ? req.query.featureId : 'coverage';

    const articleIdSql = await getArticleIdSql();
    const row = await queryOne<{ domain_id: number | null }>(
      `SELECT domain_id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      [articleId],
    );
    const domainId = row?.domain_id != null ? Number(row.domain_id) : undefined;

    const [articleObs, domainObs, features, delta] = await Promise.all([
      store.listObservations({ articleId, since, limit: 100 }),
      domainId != null
        ? store.listObservations({ domainId, since, limit: 100 })
        : Promise.resolve([] as Observation[]),
      store.listFeatures({ articleId, featureId, since, limit: 100 }),
      since
        ? store.featureScoreDelta(featureId, since, { articleId })
        : Promise.resolve(null),
    ]);

    const byId = new Map<string, Observation>();
    for (const o of [...articleObs, ...domainObs]) byId.set(o.id, o);
    const observations = Array.from(byId.values()).sort((a, b) =>
      a.observedAt < b.observedAt ? 1 : -1,
    );

    return res.status(200).json({ observations, features, delta, domainId: domainId ?? null });
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
}
