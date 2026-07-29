import { makeCandidate } from '../../../lib/ao/editCandidate';
import { buildIntentProfile } from '../../../lib/ao/intentProfile';
import { filterCandidatesByIntent, validatePlanStepAction } from '../../../lib/ao/intentGuard';
import { buildPrecisionEditPlan } from '../../../lib/ao/editPlan';
import { DEFAULT_EDIT_BUDGET } from '../../../lib/ao/editBudget';
import { runEditSafetyGate, countWords } from '../../../lib/ao/editSafetyGate';
import {
  coverageStateFromQuality,
  isAdequatelyCovered,
  livePresenceQualityCap,
} from '../../../lib/ao/coverageState';
import { faqBudgetForWordCount, selectFaqQuestions } from '../../../lib/aoFaqSection';
import { shouldSkipOptimize, TARGET_AI, TARGET_SEO } from '../../../lib/optimizeMode';
import { resolveOptimizationStrategy } from '../../../lib/ao/runPrecisionOptimize';
import { buildEditCandidates } from '../../../lib/ao/buildCandidates';

describe('EditCandidate', () => {
  it('has WHAT/WHY fields and no action', () => {
    const c = makeCandidate({
      id: '1',
      source: 'seo_term',
      targetGap: 'include term X',
      priority: 'recommended',
    });
    expect(c.targetGap).toBeTruthy();
    expect(c).not.toHaveProperty('action');
  });
});

describe('IntentGuard', () => {
  const profile = buildIntentProfile({
    keyword: 'cuckolding',
    title: 'Cuckolding — definicja',
    headings: ['Co to jest cuckolding', 'Psychologia'],
    plainText: 'Cuckolding to praktyka seksualna związana z konsensualną zdradą w związku.',
    paaQuestions: ['Czym jest cuckolding?'],
  });

  it('filters commercial drift candidates (Guard #1)', () => {
    const ok = makeCandidate({
      id: 'ok',
      source: 'paa',
      targetGap: 'Czym jest cuckolding psychologicznie?',
      priority: 'recommended',
      intentFit: 0.7,
    });
    const bad = makeCandidate({
      id: 'bad',
      source: 'ai_coverage',
      targetGap: 'Jak wynająć detektywa do sprawdzenia partnera',
      priority: 'critical',
      intentFit: 0.9,
      commercialDrift: 0.2,
    });
    const filtered = filterCandidatesByIntent([ok, bad], profile);
    expect(filtered.map((c) => c.id)).toEqual(['ok']);
  });

  it('rejects add_faq for seo_term (Guard #2)', () => {
    const candidate = makeCandidate({
      id: 't1',
      source: 'seo_term',
      targetGap: 'cuckolding',
      priority: 'optional',
      intentFit: 0.6,
    });
    const step = buildPrecisionEditPlan({
      candidates: [candidate],
      profile,
      defaultSectionId: 's0',
    }).steps[0];
    // Force mismatched action
    const mismatched = { ...step, action: 'add_faq' as const };
    expect(validatePlanStepAction(mismatched, candidate, profile).ok).toBe(false);
  });
});

describe('EditSafetyGate', () => {
  const profile = buildIntentProfile({ keyword: 'test', plainText: 'test article about widgets' });

  it('rejects +80 words when maxNewWords is 70 (WORD_BUDGET)', () => {
    const before = '<h2>Sec</h2><p>' + Array(120).fill('word').join(' ') + '</p>';
    const after = '<h2>Sec</h2><p>' + Array(200).fill('word').join(' ') + '</p>';
    expect(countWords(after) - countWords(before)).toBe(80);
    const result = runEditSafetyGate({
      beforeHtml: before,
      afterHtml: after,
      budget: { ...DEFAULT_EDIT_BUDGET, maxNewWords: 70 },
      profile,
      stepId: 't',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectReason).toBe('WORD_BUDGET');
  });

  it('rejects unexpected H2', () => {
    const before = '<h2>A</h2><p>Hello world about widgets and things here.</p>';
    const after = '<h2>A</h2><h2>New Topic</h2><p>Hello world about widgets and things here.</p>';
    const result = runEditSafetyGate({
      beforeHtml: before,
      afterHtml: after,
      budget: DEFAULT_EDIT_BUDGET,
      profile,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectReason).toBe('UNEXPECTED_HEADING');
  });

  it('rejects forbidden commercial topic introduction', () => {
    const before = '<h2>A</h2><p>Artykuł o cuckoldingu i psychologii związku między partnerami.</p>';
    const after =
      '<h2>A</h2><p>Artykuł o cuckoldingu. Możesz też wynająć detektywa prywatnego do śledztwa.</p>';
    const psych = buildIntentProfile({
      keyword: 'cuckolding',
      plainText: 'cuckolding psychologia',
    });
    const result = runEditSafetyGate({
      beforeHtml: before,
      afterHtml: after,
      budget: DEFAULT_EDIT_BUDGET,
      profile: psych,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectReason).toBe('FORBIDDEN_TOPIC');
  });
});

describe('FAQ budget + gate', () => {
  it('uses length-based budget', () => {
    expect(faqBudgetForWordCount(500)).toBe(2);
    expect(faqBudgetForWordCount(1000)).toBe(3);
    expect(faqBudgetForWordCount(2000)).toBe(4);
    expect(faqBudgetForWordCount(3000)).toBe(5);
  });

  it('does not dump all uncovered questions', () => {
    const profile = buildIntentProfile({
      keyword: 'cuckolding',
      headings: ['definicja', 'psychologia'],
      plainText: 'cuckolding praktyka konsensualna zdrada fantazja',
    });
    const questions = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      label: `Czym jest cuckolding aspekt ${i} psychologia związku?`,
    }));
    const selected = selectFaqQuestions({
      questions,
      profile,
      articlePlainText: Array(900).fill('słowo').join(' '),
    });
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('filters detective drift from FAQ', () => {
    const profile = buildIntentProfile({
      keyword: 'cuckolding',
      plainText: 'cuckolding definicja',
    });
    const selected = selectFaqQuestions({
      questions: [
        { id: '1', label: 'Jak wynająć detektywa do sprawdzenia partnera?' },
        { id: '2', label: 'Czym jest cuckolding w psychologii?' },
      ],
      profile,
      articlePlainText: 'krótki tekst',
    });
    expect(selected.map((q) => q.id)).toEqual(['2']);
  });
});

describe('CoverageState', () => {
  it('maps quality to states', () => {
    expect(coverageStateFromQuality(0, false)).toBe('missing');
    expect(coverageStateFromQuality(1, true)).toBe('mentioned');
    expect(coverageStateFromQuality(2, true)).toBe('partial');
    expect(coverageStateFromQuality(3, true)).toBe('adequate');
    expect(coverageStateFromQuality(5, true)).toBe('comprehensive');
  });

  it('presence caps never reach adequate', () => {
    expect(livePresenceQualityCap('exact')).toBeLessThan(3);
    expect(isAdequatelyCovered(2, true)).toBe(false);
    expect(isAdequatelyCovered(3, true)).toBe(true);
  });
});

describe('No-op + strategy', () => {
  it('skips when SEO and AI targets met', () => {
    expect(shouldSkipOptimize(TARGET_SEO, TARGET_AI)).toBe(true);
    expect(shouldSkipOptimize(TARGET_SEO - 1, TARGET_AI)).toBe(false);
  });

  it('defaults to precision strategy', () => {
    expect(resolveOptimizationStrategy(undefined)).toBe('precision');
    expect(resolveOptimizationStrategy('whole_article_fallback')).toBe('whole_article_fallback');
  });
});

describe('buildEditCandidates', () => {
  it('builds from term + paa without action field', () => {
    const profile = buildIntentProfile({ keyword: 'widget', plainText: 'widget guide' });
    const cands = buildEditCandidates({
      profile,
      termGaps: [{ term: 'widget', current: 0, target: 3, status: 'missing' }],
      paaQuestions: ['What is a widget used for?'],
    });
    expect(cands.length).toBeGreaterThanOrEqual(2);
    expect(cands.every((c) => !('action' in c))).toBe(true);
  });
});
