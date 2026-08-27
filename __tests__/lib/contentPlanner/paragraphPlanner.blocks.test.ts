import { planParagraphs } from '../../../lib/contentPlanner/knowledgePack/paragraphPlanner';
import type { ExecutionPlanSection } from '@/src/core/domain/contentPlanner/types';

function section(blocks: string[]): ExecutionPlanSection {
  return {
    id: 'sec-1',
    heading: 'Jak wyglada wspolpraca',
    expectedWords: 240,
    blocks,
  } as unknown as ExecutionPlanSection;
}

describe('planParagraphs block styles', () => {
  it('marks a steps paragraph as an ordered list', () => {
    // The reference article numbers its six-step engagement flow; ours rendered bullets.
    const steps = planParagraphs(section(['steps'])).find((p) => p.goal === 'steps');

    expect(steps?.style.list).toBe(true);
    expect(steps?.style.ordered).toBe(true);
  });

  it('leaves a checklist unordered', () => {
    const checklist = planParagraphs(section(['checklist'])).find((p) => p.goal === 'checklist');

    expect(checklist?.style.list).toBe(true);
    expect(checklist?.style.ordered).toBeUndefined();
  });

  it('marks a table block as a table, not a list', () => {
    const comparison = planParagraphs(section(['table'])).find((p) => p.goal === 'comparison');

    expect(comparison?.style.table).toBe(true);
    expect(comparison?.style.list).toBeUndefined();
  });
});

/**
 * Article 18 was planned at 920 words and shipped 3812 — 3.6x its own budget. Its
 * sections were budgeted 80 words and split across intro + checklist + steps + summary,
 * asking for 20 words a paragraph. Nothing writes a 20-word bulleted block with a bold
 * label, so the number was ignored outright.
 */
describe('planParagraphs word budget', () => {
  function budgeted(words: number): ExecutionPlanSection {
    return {
      id: 'sec-1',
      heading: 'Zakres uslug',
      expectedWords: words,
      blocks: ['example', 'checklist', 'steps', 'pro_tip'],
    } as unknown as ExecutionPlanSection;
  }

  it('does not split an 80-word section into four unwritable paragraphs', () => {
    const paragraphs = planParagraphs(budgeted(80));

    expect(paragraphs.length).toBeLessThanOrEqual(2);
    for (const p of paragraphs) expect(p.expectedWords).toBeGreaterThanOrEqual(35);
  });

  it('keeps the full shape once the section can afford it', () => {
    const paragraphs = planParagraphs(budgeted(400));

    expect(paragraphs.length).toBeGreaterThan(2);
    expect(paragraphs[0].goal).toBe('intro');
    expect(paragraphs[paragraphs.length - 1].goal).toBe('summary');
  });

  it('always keeps the opening, and the closing whenever two fit', () => {
    const paragraphs = planParagraphs(budgeted(120));

    expect(paragraphs[0].goal).toBe('intro');
    expect(paragraphs[paragraphs.length - 1].goal).toBe('summary');
  });

  it('never returns nothing for a tiny section', () => {
    expect(planParagraphs(budgeted(30)).length).toBe(1);
  });
});

/**
 * The outline appends its guaranteed table last, so a first-two-in-order cut kept
 * checklist+steps and dropped the very block the benchmark asked for. Article 18 planned
 * targetTables: 1 and rendered none.
 */
describe('planParagraphs keeps the comparison block', () => {
  it('does not let checklist and steps crowd out the table', () => {
    const section = {
      id: 'sec-1',
      heading: 'Dlaczego warto',
      expectedWords: 400,
      blocks: ['example', 'checklist', 'steps', 'pro_tip', 'table'],
    } as unknown as ExecutionPlanSection;

    const goals = planParagraphs(section).map((p) => p.goal);

    expect(goals).toContain('comparison');
    expect(planParagraphs(section).find((p) => p.goal === 'comparison')?.style.table).toBe(true);
  });
});
