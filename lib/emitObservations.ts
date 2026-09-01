import type { Observation } from './primitives/types';
import { makeDomainEvent } from './primitives/events';
import { getErrorMessage } from './errors';

/** Append observations; never throws to callers (logs warn). */
export async function emitObservations(
  observations: Observation[],
  scope?: { domainId?: number; articleId?: number },
): Promise<void> {
  if (!observations.length) return;
  try {
    if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
      void makeDomainEvent(
        'ObservationRecorded',
        { count: observations.length },
        { domainId: scope?.domainId, articleId: scope?.articleId },
      );
      return;
    }
    const { getFeatureStore } = await import('./featureStore');
    const store = getFeatureStore();
    await store.appendObservations(observations, scope);
    try {
      const { persistDomainEvent } = await import('./growthMetaStore');
      await persistDomainEvent(
        'ObservationRecorded',
        { count: observations.length, sources: [...new Set(observations.map((o) => o.source))] },
        { domainId: scope?.domainId, articleId: scope?.articleId },
      );
    } catch {
      void makeDomainEvent(
        'ObservationRecorded',
        { count: observations.length },
        { domainId: scope?.domainId, articleId: scope?.articleId },
      );
    }
  } catch (err: unknown) {
    console.warn('[observations] emit failed (non-fatal):', getErrorMessage(err));
  }
}

export function observationBase(
  partial: Pick<Observation, 'id' | 'kind' | 'source' | 'title'> & Partial<Observation>,
): Observation {
  return {
    observedAt: new Date().toISOString(),
    confidence: 0.7,
    ...partial,
    id: partial.id,
    kind: partial.kind,
    source: partial.source,
    title: partial.title,
  };
}

/** GSC pages/keywords with enough impressions and low CTR. */
export function observationsFromGscLowCtr(
  rows: Array<{
    page?: string;
    keyword?: string;
    impressions: number;
    clicks: number;
    ctr?: number;
    position?: number;
  }>,
  opts: { domainId: number; minImpressions?: number; maxCtr?: number; limit?: number },
): Observation[] {
  const minImp = opts.minImpressions ?? 50;
  const maxCtr = opts.maxCtr ?? 0.02;
  const limit = opts.limit ?? 25;
  const out: Observation[] = [];
  for (const row of rows) {
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;
    if (impressions < minImp) continue;
    const ctr = row.ctr != null ? Number(row.ctr) : impressions > 0 ? clicks / impressions : 0;
    if (ctr > maxCtr) continue;
    const label = row.keyword || row.page || 'page';
    out.push(
      observationBase({
        id: `obs-gsc-ctr-${opts.domainId}-${encodeURIComponent(label).slice(0, 80)}`,
        kind: 'low_ctr',
        source: 'gsc',
        title: `Low CTR: ${label}`,
        detail: `CTR ${(ctr * 100).toFixed(2)}% with ${impressions} impressions`,
        severity: ctr < 0.01 ? 'high' : 'medium',
        score: Math.round(ctr * 1000) / 10,
        domainId: opts.domainId,
        payload: {
          page: row.page,
          keyword: row.keyword,
          impressions,
          clicks,
          ctr,
          position: row.position,
        },
      }),
    );
    if (out.length >= limit) break;
  }
  return out;
}

export function observationsFromAuditIssues(
  issues: Array<{ id?: string; label: string; severity?: string; count?: number; urls?: string[] }>,
  opts: { domainId: number; limit?: number },
): Observation[] {
  const limit = opts.limit ?? 40;
  return issues.slice(0, limit).map((issue, i) =>
    observationBase({
      id: `obs-audit-${opts.domainId}-${issue.id || i}`,
      kind: 'audit_issue',
      source: 'audit',
      title: `${issue.severity || 'issue'}: ${issue.label}`,
      detail: issue.count != null ? `${issue.count} URLs` : undefined,
      severity: issue.severity === 'critical' || issue.severity === 'error' ? 'high' : issue.severity === 'warn' ? 'medium' : 'low',
      domainId: opts.domainId,
      payload: { issueId: issue.id, count: issue.count, urls: issue.urls?.slice(0, 10) },
    }),
  );
}

export function observationsFromVisibilityDelta(
  delta: { visibilityScore?: number; mentionRate?: number },
  opts: { domainId: number; scanId?: number; prevScanId?: number },
): Observation[] {
  const score = delta.visibilityScore;
  if (score == null || score >= 0) return [];
  return [
    observationBase({
      id: `obs-vis-drop-${opts.domainId}-${opts.scanId ?? Date.now()}`,
      kind: 'visibility_drop',
      source: 'ai_visibility',
      title: `Visibility ${score}% (scan)`,
      detail: delta.mentionRate != null ? `Mention rate Δ ${delta.mentionRate}` : undefined,
      severity: score <= -10 ? 'high' : 'medium',
      score,
      domainId: opts.domainId,
      payload: { ...delta, scanId: opts.scanId, prevScanId: opts.prevScanId },
    }),
  ];
}

/** After AI Vis scan completes — compare to previous completed scan. */
export async function emitAiVisibilityScanObservations(
  scanId: number,
  ownDomain: string,
): Promise<void> {
  const { queryOne } = await import('./db/query');
  const { buildSnapshotsForScan, computeDelta } = await import('./aiVisibilityMetrics');
  const { loadScanResultRows } = await import('./aiVisibilityRead');

  const meta = await queryOne<{ domain_id: number; config_id: number }>(
    `SELECT c.domain_id, s.config_id
     FROM ai_vis_scans s
     JOIN ai_vis_configs c ON c.id = s.config_id
     WHERE s.id = ? LIMIT 1`,
    [scanId],
  );
  if (!meta?.domain_id) return;

  const prev = await queryOne<{ id: number }>(
    `SELECT id FROM ai_vis_scans
     WHERE config_id = ? AND status = 'completed' AND id <> ?
     ORDER BY finished_at DESC LIMIT 1`,
    [meta.config_id, scanId],
  );
  if (!prev?.id) return;

  const [curRows, prevRows] = await Promise.all([
    loadScanResultRows(scanId),
    loadScanResultRows(prev.id),
  ]);
  if (!curRows.length || !prevRows.length) return;

  const curMap = buildSnapshotsForScan(curRows, ownDomain);
  const prevMap = buildSnapshotsForScan(prevRows, ownDomain);
  const host = ownDomain.replace(/^www\./, '').toLowerCase();
  const current = curMap.get(host) || [...curMap.values()][0];
  const previous = prevMap.get(host) || [...prevMap.values()][0];
  if (!current || !previous) return;

  const d = computeDelta(current, previous);
  await emitObservations(
    observationsFromVisibilityDelta(
      {
        visibilityScore: d.visibilityScore.delta,
        mentionRate: d.mentionRate.delta,
      },
      { domainId: meta.domain_id, scanId, prevScanId: prev.id },
    ),
    { domainId: meta.domain_id },
  );
}
