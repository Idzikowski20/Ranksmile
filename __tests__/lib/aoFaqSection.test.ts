import {
  collectUncoveredAiQuestions,
  mergeFaqHtml,
  buildFaqSectionPrompt,
  faqBudgetForWordCount,
  selectFaqQuestions,
  validateFaqHtmlStructure,
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

  it('validateFaqHtmlStructure accepts proper PL FAQ', () => {
    const html =
      '<h2>Najczęściej zadawane pytania</h2>'
      + '<h3>Czym jest cuckolding?</h3>'
      + '<p>Cuckolding to konsensualna praktyka seksualna, w której partnerzy świadomie ustalają zasady.</p>';
    expect(validateFaqHtmlStructure(html, { language: 'pl', expectedQuestionCount: 1 })).toEqual({
      ok: true,
      questionCount: 1,
    });
  });

  it('validateFaqHtmlStructure rejects wall-of-text without H3', () => {
    const wall = `<h2>FAQ</h2><p>${'x'.repeat(650)}</p>`;
    const r = validateFaqHtmlStructure(wall, { language: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wall_of_text');
  });

  it('validateFaqHtmlStructure rejects H3 without answer paragraph', () => {
    const html = '<h2>FAQ</h2><h3>What is it?</h3><h3>Another?</h3><p>Only second gets answer text that is long enough here.</p>';
    const r = validateFaqHtmlStructure(html, { language: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('h3_without_p');
  });
});
