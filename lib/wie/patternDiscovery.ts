/**
 * WIE Pattern Discovery — Candidate → Validate → Accept → Store.
 */
import {
  readPatternStore,
  writePatternStore,
  type PatternLayer,
  type WritingPattern,
} from './patternStore';
import { getPrinciple } from './principles';

export type CandidatePattern = {
  pattern: string;
  principle_id: string;
  reason: string;
  conditions: WritingPattern['conditions'];
  layer: PatternLayer;
  industry?: string;
  source: string;
  evidence?: number;
};

export type DiscoveryResult =
  | { ok: true; pattern: WritingPattern }
  | { ok: false; reason: string };

function slugId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || `pat_${Date.now()}`;
}

/** Validate candidate against principles + min evidence; upsert into store. */
export async function discoverAndAcceptPattern(candidate: CandidatePattern): Promise<DiscoveryResult> {
  if (!candidate.pattern.trim() || candidate.pattern.length < 8) {
    return { ok: false, reason: 'pattern_too_short' };
  }
  if (!getPrinciple(candidate.principle_id)) {
    return { ok: false, reason: 'unknown_principle' };
  }
  if (!candidate.reason.trim()) {
    return { ok: false, reason: 'missing_reason' };
  }
  const evidence = candidate.evidence ?? 1;
  if (evidence < 1) return { ok: false, reason: 'insufficient_evidence' };

  const store = await readPatternStore();
  const id = slugId(`${candidate.layer}_${candidate.industry || 'x'}_${candidate.pattern}`);
  const existing = store.patterns.find(
    (p) => p.id === id || (p.pattern === candidate.pattern && p.layer === candidate.layer && p.source === candidate.source),
  );

  if (existing) {
    existing.evidence += evidence;
    existing.frequency += 1;
    existing.confidence = Math.min(0.99, existing.confidence + 0.01);
    existing.last_seen = new Date().toISOString().slice(0, 10);
    existing.reason = candidate.reason || existing.reason;
    await writePatternStore(store);
    return { ok: true, pattern: existing };
  }

  const pattern: WritingPattern = {
    id,
    pattern: candidate.pattern.trim(),
    principle_id: candidate.principle_id,
    reason: candidate.reason.trim(),
    conditions: candidate.conditions || {},
    layer: candidate.layer,
    industry: candidate.industry,
    weight: 0.8,
    confidence: Math.min(0.85, 0.5 + evidence * 0.05),
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence,
    source: candidate.source,
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: store.dna_version,
  };
  store.patterns.push(pattern);
  await writePatternStore(store);
  return { ok: true, pattern };
}

/** Pull candidate patterns from Competitor Synthesis (non-destructive). */
export async function discoverFromSynthesis(opts: {
  industry: string;
  emotion: string;
  searchIntent: string;
  openingProblemFirst?: boolean;
  expertClaims?: string[];
  examples?: string[];
  source?: string;
}): Promise<number> {
  let accepted = 0;
  if (opts.openingProblemFirst) {
    const r = await discoverAndAcceptPattern({
      pattern: 'Problem before definition',
      principle_id: 'answer_user_problem_first',
      reason: 'Observed problem-first opening in competitor synthesis',
      conditions: {
        search_intent: [opts.searchIntent],
        industry: [opts.industry],
        emotion: [opts.emotion],
      },
      layer: 'industry',
      industry: opts.industry,
      source: opts.source || 'competitor_synthesis',
      evidence: 1,
    });
    if (r.ok) accepted += 1;
  }
  if (opts.examples?.length) {
    const r = await discoverAndAcceptPattern({
      pattern: 'One concrete example in practical sections',
      principle_id: 'concrete_over_abstract',
      reason: 'Synthesis listed concrete examples',
      conditions: { search_intent: [opts.searchIntent], emotion: [opts.emotion] },
      layer: 'global',
      source: opts.source || 'competitor_synthesis',
      evidence: Math.min(5, opts.examples.length),
    });
    if (r.ok) accepted += 1;
  }
  if (opts.expertClaims?.length) {
    const r = await discoverAndAcceptPattern({
      pattern: 'Expert voice markers (w praktyce / najczęściej)',
      principle_id: 'concrete_over_abstract',
      reason: 'Synthesis contained expert-style claims',
      conditions: {
        industry: [opts.industry],
        emotion: [opts.emotion],
      },
      layer: 'industry',
      industry: opts.industry,
      source: opts.source || 'competitor_synthesis',
      evidence: Math.min(5, opts.expertClaims.length),
    });
    if (r.ok) accepted += 1;
  }
  return accepted;
}
