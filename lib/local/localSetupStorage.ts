import type { LocalSetupState } from './types';
import { DEFAULT_AI_REPLIES } from './types';
import { resolveMrtStatus } from './localSetupJobs';

const STORAGE_PREFIX = 'serpbear-local-setup:';
const GBP_STORAGE_PREFIX = 'serpbear-local-setup-gbp:';

export const INITIAL_SETUP_STATE: LocalSetupState = {
  step: 'search',
  selectedPlace: null,
  selectedGbpId: null,
  gbpAccountId: null,
  gbpLocationId: null,
  businessDetails: null,
  googleAccountEmail: null,
  completedAt: null,
  userRole: null,
  aiReplies: DEFAULT_AI_REPLIES,
  mapRankKeywords: [],
  setupJobs: null,
  locationCreatedAt: null,
  growthActionsDay: null,
  growthActionsCompletedIds: [],
  growthActionsLog: [],
};

function storageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

function gbpStorageKey(slug: string, gbpId: string): string {
  return `${GBP_STORAGE_PREFIX}${slug}:${gbpId}`;
}

function normalizeSetup(parsed: LocalSetupState): LocalSetupState {
  const merged: LocalSetupState = {
    ...INITIAL_SETUP_STATE,
    ...parsed,
    gbpAccountId: parsed.gbpAccountId ?? null,
    gbpLocationId: parsed.gbpLocationId ?? null,
    aiReplies: { ...DEFAULT_AI_REPLIES, ...parsed.aiReplies },
    growthActionsCompletedIds: parsed.growthActionsCompletedIds ?? [],
    growthActionsLog: parsed.growthActionsLog ?? [],
    growthActionsDay: parsed.growthActionsDay ?? null,
  };
  if (merged.setupJobs) {
    merged.setupJobs = resolveMrtStatus(merged.setupJobs);
  }
  return merged;
}

function readRaw(key: string): LocalSetupState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return normalizeSetup(JSON.parse(raw) as LocalSetupState);
  } catch {
    return null;
  }
}

export function loadLocalSetup(slug: string): LocalSetupState {
  return readRaw(storageKey(slug)) ?? INITIAL_SETUP_STATE;
}

export function saveLocalSetup(slug: string, state: LocalSetupState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(slug), JSON.stringify(state));
  if (state.selectedGbpId) {
    window.localStorage.setItem(gbpStorageKey(slug, state.selectedGbpId), JSON.stringify(state));
  }
}

export function loadLocalSetupByGbp(slug: string, gbpId: string): LocalSetupState | null {
  const byGbp = readRaw(gbpStorageKey(slug, gbpId));
  if (byGbp) return byGbp;

  const active = readRaw(storageKey(slug));
  if (active?.selectedGbpId === gbpId) return active;
  return null;
}

export function isGbpConfigured(slug: string, gbpId: string): boolean {
  const state = loadLocalSetupByGbp(slug, gbpId);
  return Boolean(state && isLocalSetupComplete(state));
}

export function isLocalSetupComplete(state: LocalSetupState): boolean {
  return state.step === 'complete' && state.businessDetails !== null;
}
