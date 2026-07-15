import type { AiRepliesSettings, LocalSetupJobs } from './types';

const MRT_MIN_MS = 2 * 60 * 1000;
const MRT_MAX_MS = 5 * 60 * 1000;

export function randomMrtDurationMs(): number {
  return MRT_MIN_MS + Math.floor(Math.random() * (MRT_MAX_MS - MRT_MIN_MS + 1));
}

export function createInitialJobs(aiReplies: AiRepliesSettings, mrtKeywords: string[]): LocalSetupJobs {
  const reviewsEnabled = !aiReplies.skipped && (aiReplies.positiveEnabled || aiReplies.negativeEnabled);
  const mrtSkipped = mrtKeywords.length === 0;

  return {
    listingsStatus: 'running',
    mrtStatus: mrtSkipped ? 'skipped' : 'running',
    reviewsStatus: reviewsEnabled ? 'enabled' : 'skipped',
    mrtStartedAt: mrtSkipped ? null : new Date().toISOString(),
    mrtDurationMs: mrtSkipped ? 0 : randomMrtDurationMs(),
    mrtCompletedAt: null,
  };
}

export function resolveMrtStatus(jobs: LocalSetupJobs, now = Date.now()): LocalSetupJobs {
  if (jobs.mrtStatus !== 'running' || !jobs.mrtStartedAt) return jobs;

  const started = new Date(jobs.mrtStartedAt).getTime();
  if (now - started >= jobs.mrtDurationMs) {
    return {
      ...jobs,
      mrtStatus: 'done',
      mrtCompletedAt: new Date(started + jobs.mrtDurationMs).toISOString(),
    };
  }
  return jobs;
}

export function mrtRemainingMs(jobs: LocalSetupJobs, now = Date.now()): number | null {
  if (jobs.mrtStatus !== 'running' || !jobs.mrtStartedAt) return null;
  const started = new Date(jobs.mrtStartedAt).getTime();
  const remaining = jobs.mrtDurationMs - (now - started);
  return remaining > 0 ? remaining : 0;
}

export function formatMrtEta(remainingMs: number): string {
  const mins = Math.ceil(remainingMs / 60000);
  if (mins <= 1) return '1 min';
  return `${mins} mins`;
}
