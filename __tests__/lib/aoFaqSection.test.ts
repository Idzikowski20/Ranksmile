import {
  collectUncoveredAiQuestions,
  mergeFaqHtml,
  buildFaqSectionPrompt,
  faqBudgetForWordCount,
  selectFaqQuestions,
} from '../../lib/aoFaqSection';
import type { CoverageItem } from '../../lib/aiCoverage';
import { buildIntentProfile } from '../../lib/ao/intentProfile';

const items: CoverageItem[] = [
  { id: '1', label: 'Kiedy można oskarżyć?', category: 'intent', type: 'paa', covered: false, quality: 2, importance: 'critical', source: 'llm' },
  { id: '2', label: 'Done item', category: 'knowledge', type: 'fact', covered: true, quality: 5, importance: 'recommended', source: 'llm' },
];

describe('aoFaqSection', () => {
  it('collects uncovered AI questions', () => {
    const uncovered = collectUncoveredAiQuestions(items);
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0].label).toBe('Kiedy można oskarżyć?');
  });

  it('appends FAQ when none exists', () => {
    const merged = mergeFaqHtml('<h2>Intro</h2><p>Text</p>', '<h2>FAQ</h2><h3>Q?</h3><p>A</p>');
    expect(merged).toContain('<h2>FAQ</h2>');
    expect(merged.indexOf('<h2>Intro</h2>')).toBeLessThan(merged.indexOf('<h2>FAQ</h2>'));
  });

  it('replaces existing FAQ block', () => {
    const merged = mergeFaqHtml('<h2>Body</h2><h2>FAQ</h2><h3>Old</h3>', '<h2>FAQ</h2><h3>New</h3><p>A</p>');
    expect(merged).not.toContain('Old');
    expect(merged).toContain('New');
  });

  it('prompt lists all questions', () => {
    const { systemPrompt, userInstruction } = buildFaqSectionPrompt({
      keyword: 'nękanie',
      questions: ['Q1', 'Q2'],
      articleExcerpt: 'context',
      language: 'pl',
    });
    expect(systemPrompt).toContain('120–350 characters');
    expect(userInstruction).toContain('Q1');
    expect(userInstruction).toContain('Q2');
  });

  it('faqBudgetForWordCount scales with length', () => {
    expect(faqBudgetForWordCount(100)).toBe(2);
    expect(faqBudgetForWordCount(900)).toBe(3);
  });

  it('selectFaqQuestions respects budget', () => {
    const profile = buildIntentProfile({
      keyword: 'nękanie',
      plainText: 'nękanie stalking prawo ofiara',
    });
    const qs = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      label: `Jak zgłosić nękanie przypadek ${i}?`,
    }));
    const selected = selectFaqQuestions({
      questions: qs,
      profile,
      articlePlainText: Array(100).fill('słowo').join(' '),
    });
    expect(selected.length).toBeLessThanOrEqual(2);
  });
});
