import { callSidecar, isSidecarConfigured } from '@/src/infrastructure/http/sidecar';
import { getErrorMessage } from '@/src/core/shared/errors';
import type { AiSearchIntelInput } from '@/src/core/domain/contentPlanner/knowledgeIntelligence';

type ResearchedFacts = {
  claims: string[];
  sources: Array<{ url: string; label?: string; confidence?: number }>;
};

/**
 * Real cases and statistics with sources, researched on the open web — what separates
 * the reference (Surfer) article from ours: it names the police case and links it, we
 * had a fact sheet with zero sourced claims. Cached in score_data.researched_facts by
 * MUTATING the passed object: both callers spread scoreData into their next persist,
 * so the cache rides along without extra writes. Best-effort — no facts is a valid
 * outcome, never a failure.
 */
export async function getResearchedFacts(opts: {
  keyword: string;
  language?: string | null;
  scoreData: Record<string, unknown>;
}): Promise<ResearchedFacts> {
  const cached = opts.scoreData.researched_facts as ResearchedFacts | undefined;
  if (cached && Array.isArray(cached.claims)) return cached;
  if (!isSidecarConfigured() || !opts.keyword.trim()) return { claims: [], sources: [] };
  try {
    const out = await callSidecar<ResearchedFacts>('/research-facts', {
      keyword: opts.keyword,
      language: opts.language || 'pl',
    }, 30_000);
    const facts: ResearchedFacts = {
      claims: Array.isArray(out.claims) ? out.claims : [],
      sources: Array.isArray(out.sources) ? out.sources : [],
    };
    opts.scoreData.researched_facts = facts;
    return facts;
  } catch (err) {
    console.warn('[fact-research] skipped:', getErrorMessage(err));
    return { claims: [], sources: [] };
  }
}

/** Merge researched facts into the planner's AI intel input. */
export function withResearchedFacts(ai: AiSearchIntelInput, facts: ResearchedFacts): AiSearchIntelInput {
  if (!facts.claims.length) return ai;
  return {
    ...ai,
    claims: [...(ai.claims ?? []), ...facts.claims],
    sources: [...(ai.sources ?? []), ...facts.sources],
  };
}
