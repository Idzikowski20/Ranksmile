import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '../../../../lib/errors';
import {
  exportOrganic,
  getOrganicObservations,
  isOrganicProviderConfigured,
  loadOrganicDatasetForDomainId,
  viewOrganicTable,
  type OrganicFilters,
  type OrganicSortKey,
  type OrganicTab,
} from '../../../../lib/organicResearch';
import type { ExportFormat } from '../../../../lib/organicResearch/export';
import type { KeywordState, SearchIntent } from '../../../../lib/organicResearch/types';
import { resolveRankTrackingApi } from '../../../../lib/rankTracking/apiAuth';

function numOrNull(v: string | string[] | undefined): number | null {
  if (v == null || Array.isArray(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseList(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap((x) => x.split(',')).map((s) => s.trim()).filter(Boolean);
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseFilters(query: NextApiRequest['query']): OrganicFilters {
  const tab = typeof query.tab === 'string' ? query.tab as OrganicTab : 'all';
  const stateRaw = typeof query.state === 'string' ? query.state : 'all';
  const intents = parseList(query.intents || query.intent).filter(
    (i): i is NonNullable<SearchIntent> =>
      i === 'informational' || i === 'commercial' || i === 'transactional' || i === 'navigational',
  );
  return {
    tab: tab === 'organic' || tab === 'serp_features' ? tab : 'all',
    q: typeof query.q === 'string' ? query.q : undefined,
    positionMin: numOrNull(query.positionMin),
    positionMax: numOrNull(query.positionMax),
    volumeMin: numOrNull(query.volumeMin),
    volumeMax: numOrNull(query.volumeMax),
    kdMin: numOrNull(query.kdMin),
    kdMax: numOrNull(query.kdMax),
    intents,
    serpFeatures: parseList(query.serpFeatures || query.serpFeature),
    state: (stateRaw === 'all' ? 'all' : stateRaw) as KeywordState | 'all',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveRankTrackingApi(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const loaded = await loadOrganicDatasetForDomainId(ctx.domainId, ctx.userId);
    if (!loaded.ok) {
      return res.status(200).json({
        dataset: null,
        observations: [],
        configured: false,
        needsDfs: true,
        needsGsc: false,
        gscConnected: false,
        error: loaded.error || 'DataForSEO is not configured.',
      });
    }

    const dataset = loaded.dataset;
    const filters = parseFilters(req.query);
    const exportFormat = typeof req.query.export === 'string' ? req.query.export as ExportFormat : null;

    if (exportFormat) {
      const exported = exportOrganic(dataset, exportFormat, filters);
      if (!exported.ok) return res.status(400).json({ error: exported.error });
      const filename = `organic-${dataset.domain}.${exportFormat === 'json' ? 'json' : 'csv'}`;
      res.setHeader('Content-Type', exported.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(exported.body);
    }

    const view = typeof req.query.view === 'string' ? req.query.view : 'full';
    const sort = (typeof req.query.sort === 'string' ? req.query.sort : 'traffic') as OrganicSortKey;
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;

    if (view === 'table') {
      const table = viewOrganicTable(dataset, { filters, sort, order, page, pageSize });
      return res.status(200).json({
        meta: dataset.meta,
        metrics: dataset.metrics,
        ...table,
        configured: isOrganicProviderConfigured(),
        needsDfs: false,
        gscConnected: loaded.gscConnected,
      });
    }

    return res.status(200).json({
      dataset,
      observations: getOrganicObservations(dataset, ctx.domainId),
      configured: isOrganicProviderConfigured(),
      needsDfs: false,
      gscConnected: loaded.gscConnected,
    });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
}
