/** Feature flags for gradual rollout — default false in production until verified. */
function envFlag(name: string): boolean {
  const v = process.env[name];
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return false;
}

export function isNewCoverageIdsEnabled(): boolean {
  return envFlag('ENABLE_NEW_COVERAGE_IDS');
}

export function isNewRecommendationsEnabled(): boolean {
  return envFlag('ENABLE_NEW_RECOMMENDATIONS');
}

export function isQueueRunnerEnabled(): boolean {
  return envFlag('ENABLE_QUEUE_RUNNER');
}

export function isRankTrackingUiEnabled(): boolean {
  if (envFlag('ENABLE_RANK_TRACKING_UI')) return true;
  if (process.env.ENABLE_RANK_TRACKING_UI === '0' || process.env.ENABLE_RANK_TRACKING_UI === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

export function isRankTrackingRunnerEnabled(): boolean {
  if (envFlag('ENABLE_RANK_TRACKING_RUNNER')) return true;
  if (process.env.ENABLE_RANK_TRACKING_RUNNER === '0' || process.env.ENABLE_RANK_TRACKING_RUNNER === 'false') return false;
  return process.env.NODE_ENV === 'development';
}
