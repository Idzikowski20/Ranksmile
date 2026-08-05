import { WRITING_PRINCIPLES, getPrinciple } from '../../../lib/wie/principles';
import {
  applyConfidenceDecay,
  scorePatternForContext,
  SEED_PATTERNS,
  type WritingPattern,
} from '../../../lib/wie/patternStore';
import { discoverAndAcceptPattern } from '../../../lib/wie/patternDiscovery';
import {
  buildPolicyContext,
  formatPolicyBundleForPrompt,
  inferIndustry,
  resolvePolicyBundle,
} from '../../../lib/wie/policyResolver';
import { buildHeuristicReaderBrief } from '../../../lib/wie/readerBrief';
import { buildPrecisionEditPlan, buildPrecisionStepPrompt } from '../../../lib/ao/editPlan';
import { makeCandidate } from '../../../lib/ao/editCandidate';
import { buildIntentProfile } from '../../../lib/ao/intentProfile';

describe('WIE principles', () => {
  it('has durable answer_user_problem_first principle', () => {
    expect(getPrinciple('answer_user_problem_first')?.immutableWeight).toBe(1);
    expect(WRITING_PRINCIPLES.length).toBeGreaterThanOrEqual(3);
  });
});

describe('WIE patternStore scoring', () => {
  it('matches Legal high-emotion to problem_before_definition', () => {
    const p = SEED_PATTERNS.find((x) => x.id === 'problem_before_definition')!;
    const score = scorePatternForContext(p, {
      industry: 'Legal',
      emotion: 'high',
      searchIntent: 'informational',
    });
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0.5);
  });

  it('does not match Legal pattern to SeoSaas low emotion', () => {
    const p = SEED_PATTERNS.find((x) => x.id === 'problem_before_definition')!;
    const score = scorePatternForContext(p, {
      industry: 'SeoSaas',
      emotion: 'low',
      searchIntent: 'informational',
      contentShape: 'technical_canonical',
    });
    expect(score).toBeNull();
  });

  it('decays confidence over time', () => {
    const old: WritingPattern = {
      ...SEED_PATTERNS[0],
      confidence: 0.94,
      last_seen: '2024-01-01',
    };
    expect(applyConfidenceDecay(old, new Date('2026-08-02'))).toBeLessThan(0.94);
  });
});

describe('WIE pattern discovery', () => {
  it('rejects unknown principle', async () => {
    const r = await discoverAndAcceptPattern({
      pattern: 'Something long enough',
      principle_id: 'not_a_real_principle',
      reason: 'test',
      conditions: {},
      layer: 'global',
      source: 'test',
    });
    expect(r.ok).toBe(false);
  });

  it('accepts valid candidate', async () => {
    const r = await discoverAndAcceptPattern({
      pattern: `Test pattern unique ${Date.now()}`,
      principle_id: 'concrete_over_abstract',
      reason: 'unit test evidence',
      conditions: { emotion: ['medium'] },
      layer: 'global',
      source: 'unit_test',
      evidence: 2,
    });
    expect(r.ok).toBe(true);
  });
});

describe('WIE policy resolver', () => {
  it('infers Legal industry and resolves problem_first for szantaż', async () => {
    expect(inferIndustry('szantaż co robić')).toBe('Legal');
    const brief = buildHeuristicReaderBrief({ keyword: 'szantaż co robić' });
    const ctx = buildPolicyContext({ keyword: 'szantaż co robić', readerBrief: brief });
    const bundle = await resolvePolicyBundle({
      ctx,
      synthesis: {
        critical: ['a'],
        important: [],
        optional: [],
        opening_style: { problem_first: true, emotion: 'high' },
        section_patterns: [],
        expert_claims: ['W praktyce'],
        storytelling: [],
        examples: ['Messenger'],
        cta: {},
        faq: {},
        information_gain: [],
      },
    });
    const opening = bundle.decisions.find((d) => d.id === 'opening');
    expect(opening?.value).toBe('problem_first');
    expect(formatPolicyBundleForPrompt(bundle)).toContain('POLICY');

    const profile = buildIntentProfile({
      keyword: 'szantaż',
      title: 'Szantaż',
      headings: ['Co robić'],
      plainText: 'x',
      paaQuestions: [],
    });
    const plan = buildPrecisionEditPlan({
      candidates: [
        makeCandidate({
          id: '1',
          source: 'ai_coverage',
          targetGap: 'Jak reagować',
          priority: 'recommended',
          intentFit: 0.9,
          targetSectionId: 's1',
        }),
      ],
      profile,
      defaultSectionId: 's1',
    });
    const prompt = buildPrecisionStepPrompt(plan.steps[0], '<p>x</p>', {
      policy: bundle,
      readerBrief: brief,
    });
    expect(prompt).toContain('POLICY');
    expect(prompt).not.toContain('VOICE:');
  });
});
