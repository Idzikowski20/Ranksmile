import {
  evaluateCandidateGateDecision,
  evaluateFinalGateDecision,
  ENRICHMENT_SCORE_GATE_POLICY,
  DEEP_SCORE_GATE_POLICY,
  STRICT_SCORE_GATE_POLICY,
} from '../../../../lib/ao/aoScoreDelta';
import { classifySectionQuality, buildEditCandidates } from '../../../../lib/ao/buildCandidates';
import { sortCandidatesByPriority, makeCandidate } from '../../../../lib/ao/editCandidate';
import {
  chooseStrategyFromDiagnosis,
  resolveOptimizationPolicy,
  assessStructuralHealth,
} from '../../../../lib/ao/optimizationPolicy';
import { budgetForAction, DEEP_EDIT_BUDGET, DEFAULT_EDIT_BUDGET } from '../../../../lib/ao/editBudget';
import { shouldSkipOptimize, TARGET_AI, TARGET_SEO } from '../../../../lib/optimizeMode';
import type { Section } from '../../../../lib/articleSections';
import { buildIntentProfile } from '../../../../lib/ao/intentProfile';

const scores = (seo: number, content: number, ai: number) => ({ seo, content, ai });

describe('v4.1 CandidateGateDecision', () => {
  it('rejects overall regression', () => {
    const d = evaluateCandidateGateDecision(
      scores(60, 50, 40),
      scores(62, 49, 45),
      { policy: DEEP_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('reject_regression');
  });

  it('accepts overall up within SEO tolerance', () => {
    const d = evaluateCandidateGateDecision(
      scores(92, 75, 55),
      scores(91, 78, 65),
      { policy: ENRICHMENT_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('accept');
  });

  it('rejects SEO -10 even if AI and overall up', () => {
    const d = evaluateCandidateGateDecision(
      scores(92, 75, 55),
      scores(82, 80, 75),
      { policy: DEEP_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('reject_metric_tolerance');
  });

  it('rejects flat without verified objective', () => {
    const d = evaluateCandidateGateDecision(
      scores(60, 50, 40),
      scores(60, 50, 40),
      { policy: DEEP_SCORE_GATE_POLICY, verifiedObjective: false },
    );
    expect(d.decision).toBe('reject_non_meaningful');
  });

  it('accepts flat with verified objective', () => {
    const d = evaluateCandidateGateDecision(
      scores(60, 50, 40),
      scores(60, 50, 40),
      { policy: DEEP_SCORE_GATE_POLICY, verifiedObjective: true },
    );
    expect(d.decision).toBe('accept');
  });
});

describe('v4.1 Final Gate', () => {
  it('fails when overall drops vs baseline', () => {
    const d = evaluateFinalGateDecision(
      scores(70, 70, 70),
      scores(72, 69, 72),
      { policy: DEEP_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('reject_regression');
  });

  it('fails when cumulative SEO drop exceeds tolerance vs baseline', () => {
    const d = evaluateFinalGateDecision(
      scores(90, 70, 50),
      scores(86, 72, 70),
      { policy: ENRICHMENT_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('reject_metric_tolerance');
  });

  it('passes when overall up and metrics within tol', () => {
    const d = evaluateFinalGateDecision(
      scores(50, 50, 40),
      scores(55, 59, 50),
      { policy: DEEP_SCORE_GATE_POLICY },
    );
    expect(d.decision).toBe('accept');
  });
});

describe('v4.1 strategy routing', () => {
  it('routes SEO high / AI low to precision', () => {
    expect(chooseStrategyFromDiagnosis({
      scores: scores(92, 75, 55),
      structural: 'acceptable',
      intent: 'strong',
      highValueGaps: 5,
    })).toBe('precision');
  });

  it('does not force deep solely for short word count when structure acceptable', () => {
    const h = assessStructuralHealth('<h2>A</h2><p>' + 'word '.repeat(100) + '</p><h2>B</h2><p>' + 'word '.repeat(100) + '</p>', 2);
    expect(h).not.toBe('weak');
  });

  it('deep policy has real rewrite budget > DEFAULT 70', () => {
    const p = resolveOptimizationPolicy({
      strategy: 'deep_optimize',
      scores: scores(30, 33, 30),
      html: '<h2>A</h2><p>x</p>',
      sectionCount: 6,
      uncoveredCoverage: 8,
    });
    expect(p.editBudget.maxNewWords).toBeGreaterThan(DEFAULT_EDIT_BUDGET.maxNewWords);
    expect(budgetForAction('rewrite_section', p.editBudget).maxNewWords).toBeGreaterThan(70);
    expect(p.maxSteps).toBeGreaterThanOrEqual(12);
  });
});

describe('v4.1 evaluate ≠ generate', () => {
  const profile = buildIntentProfile({ keyword: 'test', plainText: 'test content here' });

  function sec(id: string, words: number, paras = 1): Section {
    const per = Math.max(1, Math.floor(words / paras));
    const chunks = Array.from({ length: paras }, (_, i) => {
      const n = i === paras - 1 ? words - per * (paras - 1) : per;
      return `<p>${Array(Math.max(1, n)).fill('word').join(' ')}</p>`;
    });
    return {
      id,
      index: Number(id.replace(/\D/g, '')) || 0,
      headingText: `H ${id}`,
      html: `<h2>${id}</h2>${chunks.join('')}`,
    };
  }

  it('classifies strong/medium/weak', () => {
    expect(classifySectionQuality(sec('s0', 20))).toBe('weak');
    expect(classifySectionQuality(sec('s1', 80))).toBe('medium');
    expect(classifySectionQuality(sec('s2', 200, 2))).toBe('strong');
  });

  it('does not create section_quality candidates for strong sections', () => {
    const sections = [sec('s0', 20), sec('s1', 80), sec('s2', 200, 2)];
    const cands = buildEditCandidates({
      profile,
      sections,
      strategy: 'deep_optimize',
    });
    const secCands = cands.filter((c) => c.source === 'section_quality');
    expect(secCands.some((c) => c.targetSectionId === 's2')).toBe(false);
    expect(secCands.some((c) => c.suggestedAction === 'rewrite_section')).toBe(true);
  });

  it('sorts P0 before P5', () => {
    const cands = sortCandidatesByPriority([
      makeCandidate({
        id: 'nlp', source: 'seo_term', targetGap: 'term', priority: 'optional', priorityTier: 5,
      }),
      makeCandidate({
        id: 'crit', source: 'critical', targetGap: 'def', priority: 'critical', priorityTier: 0,
      }),
    ]);
    expect(cands[0].id).toBe('crit');
  });
});

describe('v4.1 already_optimal', () => {
  it('skips only at 90/85 AND', () => {
    expect(shouldSkipOptimize(TARGET_SEO, TARGET_AI)).toBe(true);
    expect(shouldSkipOptimize(91, 86)).toBe(true);
    expect(shouldSkipOptimize(92, 55)).toBe(false);
  });
});

describe('v4.1 strict unchanged', () => {
  it('strict policy still rejects -2 overall with minMeaningfulDelta semantics', () => {
    const d = evaluateCandidateGateDecision(
      scores(70, 64, 56),
      scores(70, 62, 56),
      { policy: STRICT_SCORE_GATE_POLICY },
    );
    expect(d.decision).not.toBe('accept');
  });
});

describe('deep budget vs default', () => {
  it('rewrite ceiling is usable under deep budget', () => {
    expect(budgetForAction('rewrite_section', DEEP_EDIT_BUDGET).maxNewWords).toBe(450);
    expect(budgetForAction('rewrite_section', DEEP_EDIT_BUDGET).allowNewHeading).toBe(true);
  });
});
