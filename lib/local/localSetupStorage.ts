import type { LocalSetupState } from './types';
import { DEFAULT_AI_REPLIES } from './types';
import { resolveMrtStatus } from './localSetupJobs';

const STORAGE_PREFIX = 'serpbear-local-setup:';

export const INITIAL_SETUP_STATE: LocalSetupState = {
  step: 'search',
  selectedPlace: null,
  selectedGbpId: null,
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

export function loadLocalSetup(slug: string): LocalSetupState {
  if (typeof window === 'undefined') return INITIAL_SETUP_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return INITIAL_SETUP_STATE;
    const parsed = JSON.parse(raw) as LocalSetupState;
    const merged: LocalSetupState = {
      ...INITIAL_SETUP_STATE,
      ...parsed,
      aiReplies: { ...DEFAULT_AI_REPLIES, ...parsed.aiReplies },
      growthActionsCompletedIds: parsed.growthActionsCompletedIds ?? [],
      growthActionsLog: parsed.growthActionsLog ?? [],
      growthActionsDay: parsed.growthActionsDay ?? null,
    };
    if (merged.setupJobs) {
      merged.setupJobs = resolveMrtStatus(merged.setupJobs);
    }
    return merged;
  } catch {
    return INITIAL_SETUP_STATE;
  }
}

export function saveLocalSetup(slug: string, state: LocalSetupState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(slug), JSON.stringify(state));
}

export function isLocalSetupComplete(state: LocalSetupState): boolean {
  return state.step === 'complete' && state.businessDetails !== null;
}
