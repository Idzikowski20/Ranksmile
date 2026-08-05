import type { SourceKind } from './types';

export const KNOWLEDGE_SCHEMA_VERSION = 1;
export const KNOWLEDGE_CONSENSUS_MIN = 0.75;
export const PLANNER_CLAIMS_FLOOR = 12;
export const CANONICALIZE_SIM_MIN = 0.82;

export const SOURCE_TIER_WEIGHTS: Record<SourceKind, number> = {
  official: 1,
  industry: 0.9,
  competitor: 0.75,
  ai_overview: 0.7,
  paa: 0.6,
};

export const OFFICIAL_DOMAINS = [
  'developers.google.com',
  'schema.org',
  'developer.mozilla.org',
] as const;

export const MAX_CLAIMS_PER_SECTION = 8;
