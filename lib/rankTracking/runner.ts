import { getErrorMessage } from '../errors';
import type { RankTrackingConfigRow, RankTrackingKeywordRow } from '../types/rankTracking';
import { KEYWORDS_PER_BATCH, MAX_RUN_ATTEMPTS } from './cost';
import {
  claimRun,
  countSnapshotsForRun,
  devicesForConfig,
  getActiveRun,
  listKeywords,
  listPendingSnapshotWork,
  updateRun,
  upsertSnapshot,
} from './repository';
import { fetchRankCheckSerpLive } from './serpRankCheck';
import { refreshMetricsForKeys } from './keywordMetricsCache';

async function keywordsNeedingSnapshot(
  runId: number,
  keywords: RankTrackingKeywordRow[],
  devices: ReturnType<typeof devicesForConfig>,
): Promise<Array<{ kw: RankTrackingKeywordRow; device: 'desktop' | 'mobile' }>> {
  return listPendingSnapshotWork(runId, keywords, devices, KEYWORDS_PER_BATCH);
}

export async function processRankCheckChunk(
  config: RankTrackingConfigRow,
  domainHost: string,
  timeBudgetMs: number,
): Promise<{ processed: number; completed: boolean }> {
  const started = Date.now();
  let run = await getActiveRun(config.id);
  if (!run) {
    run = await claimRun(config.id);
  }
  if (!run) return { processed: 0, completed: false };

  if (run.attempts > MAX_RUN_ATTEMPTS) {
    await updateRun(run.id, { status: 'failed', last_error: 'Max attempts exceeded', finished_at: new Date().toISOString() });
    return { processed: 0, completed: true };
  }

  const keywords = await listKeywords(config.id);
  const devices = devicesForConfig(config);
  const work = await keywordsNeedingSnapshot(run.id, keywords, devices);

  let processed = 0;
  for (const { kw, device } of work) {
    if (Date.now() - started > timeBudgetMs - 2000) break;
    try {
      const result = await fetchRankCheckSerpLive({
        keyword: kw.keyword,
        keywordId: String(kw.id),
        locationCode: config.location_code,
        languageCode: config.language_code,
        locationName: config.location_name,
        device,
        targetDomain: domainHost,
        depth: config.serp_depth,
      });
      await upsertSnapshot({
        configId: config.id,
        runId: run.id,
        trackingKeywordId: kw.id,
        device,
        found: result.found,
        position: result.position,
        rankingUrl: result.url,
        rankingTitle: result.title,
        rankingDescription: result.description,
        rankingDomain: result.domain,
        serpFeatures: result.serpFeatures,
        rawItems: result.rawItems,
      });
      processed += 1;
    } catch (e) {
      await updateRun(run.id, { last_error: getErrorMessage(e), status: 'partial' });
    }
  }

  const checked = await countSnapshotsForRun(run.id);
  const expected = keywords.length * devices.length;
  await updateRun(run.id, { keywords_checked: checked });

  if (checked >= expected) {
    await updateRun(run.id, { status: 'completed', finished_at: new Date().toISOString(), last_error: null });
    await refreshMetricsForKeys(
      keywords.map((k) => ({
        keyword: k.keyword,
        locationCode: config.location_code,
        languageCode: config.language_code,
      })),
    );
    return { processed, completed: true };
  }

  const status = processed > 0 ? 'partial' : 'partial';
  await updateRun(run.id, { status });
  return { processed, completed: false };
}
