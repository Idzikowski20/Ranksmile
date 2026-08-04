/**
 * WIE Evolution Loop — format / convention signals → Candidate Patterns.
 * Not SERP keyword Top5 dump: reacts to structural shifts (FAQ blocks, story arcs, checklists).
 */
import type { CompetitorSynthesis } from './competitorSynthesis';
import { discoverAndAcceptPattern } from './patternDiscovery';
import { bumpDnaVersion, readPatternStore } from './patternStore';

export type EvolutionRunResult = {
  candidatesTried: number;
  accepted: number;
  dna_version: number;
  signals: string[];
};

function hasFaqSignal(synth: CompetitorSynthesis): boolean {
  const keys = Object.keys(synth.faq || {});
  if (keys.length >= 2) return true;
  return synth.section_patterns.some((s) => /faq|pytania/i.test(s));
}

function hasChecklistSignal(synth: CompetitorSynthesis): boolean {
  return synth.section_patterns.some((s) => /checklist|kroki|steps|how.?to|co robić/i.test(s));
}

function hasStorySignal(synth: CompetitorSynthesis): boolean {
  return (synth.storytelling?.length ?? 0) >= 2
    || synth.section_patterns.some((s) => /story|historia|case/i.test(s));
}

function hasAioStyleSignal(synth: CompetitorSynthesis): boolean {
  // Short critical bullets + definition-first often mirrors AIO answer blocks
  return synth.critical.length >= 3 && !!synth.opening_style.definition_first;
}

/**
 * Propose evolution candidates from one Competitor Synthesis brief.
 * Principles unchanged; only Patterns may gain evidence / new entries.
 */
export async function evolveFromSynthesis(opts: {
  synthesis: CompetitorSynthesis;
  industry: string;
  emotion: string;
  searchIntent: string;
  /** When true and any pattern accepted, bump DNA once */
  bumpDna?: boolean;
}): Promise<EvolutionRunResult> {
  const { synthesis: synth, industry, emotion, searchIntent } = opts;
  const signals: string[] = [];
  let accepted = 0;
  let candidatesTried = 0;
  const source = 'evolution:synthesis';

  if (hasFaqSignal(synth)) {
    signals.push('faq_block');
    candidatesTried += 1;
    const r = await discoverAndAcceptPattern({
      pattern: 'Dedicated FAQ block for secondary intents',
      principle_id: 'depth_over_checklist',
      reason: 'Evolution: FAQ / Q&A structure observed in competitor synthesis',
      conditions: {
        search_intent: [searchIntent],
        industry: [industry],
        emotion: [emotion],
      },
      layer: 'industry',
      industry,
      source,
      evidence: 1,
    });
    if (r.ok) accepted += 1;
  }

  if (hasChecklistSignal(synth)) {
    signals.push('checklist_steps');
    candidatesTried += 1;
    const r = await discoverAndAcceptPattern({
      pattern: 'Actionable step list after problem framing',
      principle_id: 'answer_user_problem_first',
      reason: 'Evolution: checklist / steps section pattern rising in SERP shapes',
      conditions: {
        search_intent: [searchIntent],
        industry: [industry],
        emotion: [emotion],
        content_shape: ['howto'],
      },
      layer: 'industry',
      industry,
      source,
      evidence: 1,
    });
    if (r.ok) accepted += 1;
  }

  if (hasStorySignal(synth)) {
    signals.push('storytelling');
    candidatesTried += 1;
    const r = await discoverAndAcceptPattern({
      pattern: 'Short case vignette before advice',
      principle_id: 'concrete_over_abstract',
      reason: 'Evolution: storytelling / case blocks present in synthesis',
      conditions: {
        search_intent: [searchIntent],
        emotion: [emotion],
      },
      layer: 'global',
      source,
      evidence: 1,
    });
    if (r.ok) accepted += 1;
  }

  if (hasAioStyleSignal(synth)) {
    signals.push('aio_answer_block');
    candidatesTried += 1;
    const r = await discoverAndAcceptPattern({
      pattern: 'Lead with compact answer bullets then depth',
      principle_id: 'answer_user_problem_first',
      reason: 'Evolution: AIO-style critical bullets + definition-first opening',
      conditions: {
        search_intent: [searchIntent],
        industry: [industry],
        emotion: ['low', 'medium'],
      },
      layer: 'industry',
      industry,
      source,
      evidence: 1,
    });
    if (r.ok) accepted += 1;
  }

  let store = await readPatternStore();
  if (opts.bumpDna && accepted > 0) {
    store = await bumpDnaVersion(`evolution:${signals.join('+') || 'signals'}`);
  }

  return {
    candidatesTried,
    accepted,
    dna_version: store.dna_version,
    signals,
  };
}

/** Pure helpers exported for tests */
export const __evolutionSignals = {
  hasFaqSignal,
  hasChecklistSignal,
  hasStorySignal,
  hasAioStyleSignal,
};
