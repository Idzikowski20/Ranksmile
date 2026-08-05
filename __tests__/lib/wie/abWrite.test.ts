import {
  abVariantBHint,
  pickAbWinner,
  scoreAbVariant,
  scoreRxHeuristics,
  shouldAbWriteStep,
} from '../../../lib/wie/abWrite';

describe('WIE abWrite', () => {
  const working = { seo: 70, content: 70, ai: 70 };

  it('shouldAbWriteStep limits budget and actions', () => {
    expect(shouldAbWriteStep({ action: 'expand_section', stepIndex: 0, abBudgetLeft: 2 })).toBe(true);
    expect(shouldAbWriteStep({ action: 'add_faq', stepIndex: 0, abBudgetLeft: 2 })).toBe(false);
    expect(shouldAbWriteStep({ action: 'expand_section', stepIndex: 0, abBudgetLeft: 0 })).toBe(false);
    expect(shouldAbWriteStep({ action: 'expand_section', stepIndex: 9, abBudgetLeft: 2 })).toBe(false);
  });

  it('prefers RX-ok variant with examples over definition wall', () => {
    const bad = `<p>${'definicja oznacza to słowo '.repeat(20)}</p>`;
    const good = `<p>Na przykład ktoś pisze na Messenger. W praktyce nie płać. ${'krok '.repeat(30)}</p>`;
    const a = scoreAbVariant({
      label: 'A',
      sectionHtml: bad,
      scores: { seo: 80, content: 80, ai: 80 },
      working,
      action: 'expand_section',
      synthesis: { critical: [], important: [], optional: [], opening_style: {}, section_patterns: [], expert_claims: ['W praktyce'], storytelling: [], examples: ['Messenger'], cta: {}, faq: {}, information_gain: [] },
    });
    const b = scoreAbVariant({
      label: 'B',
      sectionHtml: good,
      scores: { seo: 78, content: 78, ai: 78 },
      working,
      action: 'expand_section',
      synthesis: { critical: [], important: [], optional: [], opening_style: {}, section_patterns: [], expert_claims: ['W praktyce'], storytelling: [], examples: ['Messenger'], cta: {}, faq: {}, information_gain: [] },
    });
    const { winner } = pickAbWinner(a, b);
    expect(winner.label).toBe('B');
    expect(winner.rxOk).toBe(true);
  });

  it('scoreRxHeuristics rewards examples and expert markers', () => {
    expect(scoreRxHeuristics('<p>W praktyce Messenger działa.</p>')).toBeGreaterThan(
      scoreRxHeuristics('<p>Definicja oznacza to coś.</p>'),
    );
  });

  it('abVariantBHint differs by opening policy', () => {
    expect(abVariantBHint('definition_first')).toContain('scenario');
    expect(abVariantBHint('problem_first')).toContain('VARIANT B');
  });
});
