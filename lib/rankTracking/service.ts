import { isRankTrackingRunnerEnabled } from '../featureFlags';
import type { ComparePeriod, RankRunTrigger, ScheduleInterval } from '../types/rankTracking';
import { ensureDefaultConfigForDomain } from './defaultConfig';
import { estimateRankCheckCostUsd } from './cost';
import {
  addKeywords,
  advanceNextCheck,
  archiveConfig,
  claimRun,
  countSnapshotsForRun,
  createConfig,
  createRun,
  getActiveRun,
  getConfig,
  getDomainHost,
  getDueConfigs,
  listConfigs,
  listKeywords,
  removeKeywords,
  updateConfig,
  updateRun,
} from './repository';
import { processRankCheckChunk } from './runner';
import { buildRankResultsPage } from './results';
import { buildAnalyticsSummary, listSummaryChartPoints } from './analytics';

export async function getConfigsForDomain(domainId: number) {
  return ensureDefaultConfigForDomain(domainId);
}

export async function createConfigForDomain(domainId: number, input: {
  label?: string;
  locationCode: number;
  languageCode: string;
  devices: 'desktop' | 'mobile' | 'both';
  serpDepth?: number;
  scheduleInterval?: ScheduleInterval;
  scheduleEveryNDays?: number | null;
  locationName?: string | null;
}) {
  return createConfig({
    domainId,
    label: input.label,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
    devices: input.devices,
    serpDepth: input.serpDepth ?? 40,
    scheduleInterval: input.scheduleInterval ?? 'weekly',
    scheduleEveryNDays: input.scheduleEveryNDays,
    locationName: input.locationName,
  });
}

export async function triggerManualCheck(domainId: number, configId: number) {
  if (!isRankTrackingRunnerEnabled()) {
    throw new Error('Rank tracking runner is disabled');
  }
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  const active = await getActiveRun(configId);
  if (active) return { ok: false as const, reason: 'already_running' as const, runId: active.id };

  const keywords = await listKeywords(configId);
  const runId = await createRun(configId, 'manual', keywords.length);
  return { ok: true as const, runId };
}

export async function enqueueScheduledChecks(): Promise<number> {
  if (!isRankTrackingRunnerEnabled()) return 0;
  const due = await getDueConfigs();
  let enqueued = 0;
  for (const config of due) {
    const active = await getActiveRun(config.id);
    if (active) continue;
    const keywords = await listKeywords(config.id);
    if (!keywords.length) {
      await advanceNextCheck(config);
      continue;
    }
    await createRun(config.id, 'scheduled', keywords.length);
    await advanceNextCheck(config);
    enqueued += 1;
  }
  return enqueued;
}

export async function processRunChunk(domainId: number, configId: number, timeBudgetMs = 45000) {
  if (!isRankTrackingRunnerEnabled()) return { processed: 0 };
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  const domainHost = await getDomainHost(domainId);
  return processRankCheckChunk(config, domainHost, timeBudgetMs);
}

export async function getResults(
  domainId: number,
  configId: number,
  opts: {
    comparePeriod?: ComparePeriod;
    search?: string;
    cursor?: string | null;
    page?: number;
    pageSize?: number;
    sort?: 'keyword' | 'position' | 'volume' | 'kd' | 'cpc';
    order?: 'asc' | 'desc';
  },
) {
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  return buildRankResultsPage({
    config,
    comparePeriod: opts.comparePeriod ?? '7d',
    search: opts.search,
    cursor: opts.cursor,
    page: opts.page,
    pageSize: opts.pageSize,
    sort: opts.sort,
    order: opts.order,
  });
}

export async function getAnalytics(domainId: number, configId: number, comparePeriod: ComparePeriod) {
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  return buildAnalyticsSummary(config, comparePeriod);
}

export async function getAnalyticsChart(domainId: number, configId: number, limit = 90) {
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  return listSummaryChartPoints(configId, limit);
}

export async function estimateCost(domainId: number, configId: number) {
  const config = await getConfig(configId, domainId);
  if (!config) throw new Error('Config not found');
  const count = (await listKeywords(configId)).length;
  return {
    costUsd: estimateRankCheckCostUsd(count, config.devices, config.serp_depth, 'live'),
    keywordCount: count,
  };
}

export {
  addKeywords,
  archiveConfig,
  claimRun,
  countSnapshotsForRun,
  getActiveRun,
  getConfig,
  listKeywords,
  removeKeywords,
  updateConfig,
  updateRun,
};
