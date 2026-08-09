import { planParagraphs } from '../../../lib/contentPlanner/knowledgePack/paragraphPlanner';
import type { ExecutionPlanSection } from '../../../lib/contentPlanner/types';

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
