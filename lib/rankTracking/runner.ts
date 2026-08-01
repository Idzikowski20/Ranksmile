import { getErrorMessage } from '../errors';
import type { RankTrackingConfigRow, RankTrackingKeywordRow } from '../types/rankTracking';
import { KEYWORDS_PER_BATCH, MAX_RUN_ATTEMPTS } from './cost';
import { KEYWORD_MAX_ATTEMPTS } from './constants';
import { tryAcquireConfigLock, releaseConfigLock } from './advisoryLock';
import {
  claimRun,
  countSnapshotsForRun,
  devicesForConfig,
  getActiveRun,
  listKeywords,
  listPendingSnapshotWork,
  updateKeywordStatus,
  updateRun,
  upsertSnapshot,
} from './repository';
import { fetchRankCheckSerpLive } from './serpRankCheck';
import { refreshMetricsForKeys } from './keywordMetricsCache';
import { completeRunWithSummary } from './summaryStore';

function isRetryableError(e: unknown): boolean {
  const m = getErrorMessage(e).toLowerCase();
  return (
    m.includes('429')
    || m.includes('timeout')
    || m.includes('econnreset')
    || m.includes('quota')
    || m.includes('rate limit')
    || m.includes('503')
    || m.includes('502')
  );
}

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
): Promise<{ processed: number; completed: boolean; locked?: boolean }> {
  const gotLock = await tryAcquireConfigLock(config.id);
  if (!gotLock) {
    console.info(`[rank-tracking] lock skip configId=${config.id}`);
    return { processed: 0, completed: false, locked: false };
  }

  try {
    return await processRankCheckChunkLocked(config, domainHost, timeBudgetMs);
  } finally {
    await releaseConfigLock(config.id);
  }
}

async function processRankCheckChunkLocked(
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
    await updateRun(run.id, {
      status: 'failed',
      last_error: 'Max attempts exceeded',
      finished_at: new Date().toISOString(),
    });
    return { processed: 0, completed: true };
  }

  const keywords = await listKeywords(config.id);
  const devices = devicesForConfig(config);
  const work = await keywordsNeedingSnapshot(run.id, keywords, devices);

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const { kw, device } of work) {
    if (Date.now() - started > timeBudgetMs - 2000) break;

    await updateKeywordStatus(kw.id, {
      status: 'running',
      last_attempt_at: new Date().toISOString(),
    });

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
        locationCode: config.location_code,
      });
      await updateKeywordStatus(kw.id, {
        status: 'active',
        last_error: null,
        attempt_count: 0,
        next_retry_at: null,
      });
      processed += 1;
      success += 1;
    } catch (e) {
      const msg = getErrorMessage(e);
      const attempts = (kw.attempt_count ?? 0) + 1;
      if (isRetryableError(e) && attempts < KEYWORD_MAX_ATTEMPTS) {
        const nextRetry = new Date(Date.now() + attempts * 60_000).toISOString();
        await updateKeywordStatus(kw.id, {
          status: 'queued',
          last_error: msg,
          attempt_count: attempts,
          next_retry_at: nextRetry,
        });
        await updateRun(run.id, { last_error: msg, status: 'partial' });
      } else {
        await updateKeywordStatus(kw.id, {
          status: 'failed',
          last_error: msg,
          attempt_count: attempts,
        });
        console.info('[rank-tracking] tracking_keyword_failed', JSON.stringify({
          configId: config.id,
          keywordId: kw.id,
          error: msg,
        }));
        failed += 1;
        await updateRun(run.id, { last_error: msg, status: 'partial' });
      }
    }
  }

  const checked = await countSnapshotsForRun(run.id);
  const expected = keywords.length * devices.length;
  await updateRun(run.id, {
    keywords_checked: checked,
    keywords_success: (run.keywords_success ?? 0) + success,
    keywords_failed: (run.keywords_failed ?? 0) + failed,
  });

  if (checked >= expected && expected > 0) {
    await completeRunWithSummary({
      config,
      runId: run.id,
      keywordsChecked: checked,
      keywordsSuccess: (run.keywords_success ?? 0) + success,
      keywordsFailed: (run.keywords_failed ?? 0) + failed,
      startedAt: run.started_at,
    });
    await refreshMetricsForKeys(
      keywords.map((k) => ({
        keyword: k.keyword,
        locationCode: config.location_code,
        languageCode: config.language_code,
      })),
    );
    console.info(
      `[rank-tracking] run completed configId=${config.id} runId=${run.id} checked=${checked} success=${success} failed=${failed}`,
    );
    return { processed, completed: true };
  }

  if (expected === 0) {
    await updateRun(run.id, {
      status: 'completed',
      finished_at: new Date().toISOString(),
      keywords_checked: 0,
    });
    return { processed: 0, completed: true };
  }

  await updateRun(run.id, { status: 'partial' });
  return { processed, completed: false };
}
