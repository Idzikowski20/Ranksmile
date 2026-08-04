import { buildNarrativePlan } from '../../../lib/wie/narrativePlanner';
import { bundleToExplainability } from '../../../lib/wie/explainability';
import { pickDnaAbPattern } from '../../../lib/wie/dnaAb';
import { formatBoundedCoverageForPrompt } from '../../../lib/wie/writerContext';
import { addCorpusEntry, listCorpus, removeCorpusEntry } from '../../../lib/wie/goldBadCorpus';
import type { WritingPattern } from '../../../lib/wie/patternStore';
import type { PolicyBundle } from '../../../lib/wie/policyResolver';
import type { CompetitorSynthesis } from '../../../lib/wie/competitorSynthesis';
import { evaluateRxQualityGate } from '../../../lib/wie/rxQualityGate';

function pat(partial: Partial<WritingPattern> & Pick<WritingPattern, 'id' | 'pattern'>): WritingPattern {
  return {
    principle_id: 'answer_user_problem_first',
    reason: 't',
    conditions: {},
    layer: 'industry',
    weight: 0.9,
    confidence: 0.8,
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence: 1,
    source: 'test',
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: 1,
    ...partial,
  };
}

describe('WIE narrativePlanner', () => {
  it('builds problem-first arc with faq when synthesis has faq', () => {
    const plan = buildNarrativePlan({
      readerBrief: {
        keyword: 'szantaż',
        searchIntent: 'informational',
        emotion: 'high',
        desiredOutcome: 'x',
      },
      synthesis: {
        critical: ['a'],
        important: [],
        optional: [],
        opening_style: { problem_first: true },
        section_patterns: ['problem', 'faq'],
        expert_claims: [],
        storytelling: [],
        examples: ['Messenger'],
        cta: {},
        faq: { q1: 'a' },
        information_gain: [],
      },
    });
    expect(plan.openingMove).toBe('problem_first');
    expect(plan.beats.some((b) => b.role === 'example')).toBe(true);
    expect(plan.beats.some((b) => b.role === 'faq')).toBe(true);
    expect(plan.ctaPlacement).toBe('last_10_percent');
  });
});

describe('WIE explainability', () => {
  it('maps policy decisions to III.10 shape', () => {
    const bundle: PolicyBundle = {
      dna_version: 3,
      patternIdsUsed: ['p1'],
      decisions: [{
        id: 'opening',
        value: 'problem_first',
        confidence: 0.91,
        effectiveness: 0.89,
        source_layer: 'industry',
        principle_id: 'answer_user_problem_first',
        pattern_id: 'p1',
        reason: 'test',
        dna_version: 3,
      }],
    };
    const rows = bundleToExplainability(bundle, {
      keyword: 'x',
      industry: 'Legal',
      emotion: 'high',
      searchIntent: 'informational',
    }, 'A');
    expect(rows[0].decision).toBe('opening:problem_first');
    expect(rows[0].matched_conditions.industry).toBe('Legal');
    expect(rows[0].variant).toBe('A');
    expect(rows[0].principle_id).toBe('answer_user_problem_first');
  });
});

describe('WIE DNA A/B', () => {
  it('gates by effectiveness when both have samples', () => {
    const a = {
      pattern: pat({
        id: 'a',
        pattern: 'Problem before definition',
        effectiveness: { used: 5, success_rate: 0.8 },
      }),
      score: 0.5,
    };
    const b = {
      pattern: pat({
        id: 'b',
        pattern: 'Definition first',
        effectiveness: { used: 5, success_rate: 0.4 },
      }),
      score: 0.9,
    };
    const pick = pickDnaAbPattern(a, b);
    expect(pick.winner.id).toBe('a');
    expect(pick.reason).toMatch(/effectiveness/);
  });
});

describe('WIE bounded coverage + IG gate', () => {
  it('formats critical>important>optional', () => {
    const synth: CompetitorSynthesis = {
      critical: ['must'],
      important: ['should'],
      optional: ['maybe'],
      opening_style: {},
      section_patterns: [],
      expert_claims: [],
      storytelling: [],
      examples: [],
      cta: {},
      faq: {},
      information_gain: [],
    };
    const s = formatBoundedCoverageForPrompt(synth);
    expect(s).toContain('CRITICAL');
    expect(s).toContain('OPTIONAL');
  });

  it('vetoes low information gain restating critical labels', () => {
    const long = `<p>${'słowo '.repeat(100)} must should</p>`;
    const r = evaluateRxQualityGate({
      afterHtml: long,
      action: 'rewrite_section',
      synthesis: {
        critical: ['must', 'should'],
        important: [],
        optional: [],
        opening_style: {},
        section_patterns: [],
        expert_claims: [],
        storytelling: [],
        examples: [],
        cta: {},
        faq: {},
        information_gain: [],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low_information_gain');
  });
});

describe('WIE GOLD/BAD corpus', () => {
  it('adds and lists entries', async () => {
    const entry = await addCorpusEntry({
      kind: 'gold',
      url: 'https://example.com/gold-article',
      title: 'Gold',
      industry: 'Legal',
    });
    const list = await listCorpus('gold');
    expect(list.some((e) => e.id === entry.id)).toBe(true);
    await removeCorpusEntry(entry.id);
  });
});
