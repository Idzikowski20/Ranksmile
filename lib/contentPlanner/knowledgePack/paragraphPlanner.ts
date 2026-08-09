import type { ContentBlockType, ExecutionPlanSection } from '../types';
import type { ParagraphGoal, ParagraphPlan } from './types';

const SPECIAL_BLOCKS: ContentBlockType[] = ['checklist', 'steps', 'faq'];

function mapBlockToGoal(block: ContentBlockType): ParagraphGoal {
  switch (block) {
    case 'checklist':
      return 'checklist';
    case 'steps':
      return 'steps';
    case 'faq':
      return 'faq';
    case 'definition':
      return 'definition';
    case 'example':
      return 'example';
    case 'warning':
      return 'warning';
    case 'comparison':
    case 'table':
      return 'comparison';
    case 'summary':
      return 'summary';
    default:
      return 'intro';
  }
}

function hasOnlySpecialBlocks(blocks: ContentBlockType[]): boolean {
  return blocks.length > 0 && blocks.every((b) => SPECIAL_BLOCKS.includes(b));
}

// ponytail: cap of 2 structured blocks per mixed section — a section that requested
// more (say checklist + steps + comparison) loses the overflow. Upgrade path: scale the
// cap by expectedWords so a long section may carry more blocks.
const MAX_STRUCTURED_BLOCKS = 2;

/**
 * Blocks a section can render as visible structure, in the order they appear in
 * `section.blocks`. The reference article's recurring shape is: intro paragraph →
 * bold-labelled bullet list(s) → closing paragraph — its guidelines count every list
 * item as a paragraph, which is why its "paragraphs" range starts at 93 while a
 * paragraphs-only article of the same length has 21.
 */
const STRUCTURED_BLOCKS: ContentBlockType[] = ['checklist', 'steps', 'comparison', 'table', 'faq'];

/**
 * Words below which a paragraph instruction stops being writable.
 *
 * A section budgeted 80 words and split across intro + checklist + steps + summary asks
 * for 20 words per paragraph. No model writes a 20-word bulleted block with a bold label,
 * so it ignores the number entirely — article 18 was planned at 920 words and shipped
 * 3812, 3.6x its own budget. Fewer, writable paragraphs beat four unwritable ones.
 */
const MIN_PARAGRAPH_WORDS = 55;

/**
 * Drop structured blocks until every remaining paragraph can hold MIN_PARAGRAPH_WORDS.
 * The opening always survives; the closing summary is the first thing sacrificed, and
 * only once the section cannot afford two paragraphs at all.
 */
export function fitToWordBudget(goals: ParagraphGoal[], expectedWords: number): ParagraphGoal[] {
  if (expectedWords <= 0 || goals.length <= 1) return goals;
  const affordable = Math.max(1, Math.floor(expectedWords / MIN_PARAGRAPH_WORDS));
  if (goals.length <= affordable) return goals;

  const head = goals[0];
  const tail = goals[goals.length - 1];
  const middle = goals.slice(1, -1);
  if (affordable === 1) return [head];
  // `affordable - 2` middles, plus the opening and the closing.
  return [head, ...middle.slice(0, Math.max(0, affordable - 2)), tail];
}

export function planParagraphs(section: ExecutionPlanSection): ParagraphPlan[] {
  if (section.blocks.length === 0 && section.expectedWords === 0) {
    return [];
  }

  // Mixed-block sections used to collapse to three plain paragraphs: the special-blocks
  // branch fired only when a section carried nothing BUT special blocks, and the planner
  // assigns `example, checklist, steps, pro_tip` to nearly every section — so
  // `style.list` never lit and whole articles rendered as walls of <p>.
  // Deduped after mapping: outlineBuilder gives cost/koszt sections both `table` and
  // `comparison`, and mapBlockToGoal sends both to the same goal — the writer then
  // emitted two parallel tables for one section.
  // Sorted before the cut, not after. The outline appends its guaranteed table last, so
  // taking the first two in document order kept checklist+steps and dropped the very
  // block the benchmark asked for — article 18 planned a table and rendered none. A
  // comparison is also the rarest and least substitutable of the three.
  const structured = [...new Set(
    section.blocks
      .filter((b) => STRUCTURED_BLOCKS.includes(b))
      .map(mapBlockToGoal),
  )]
    .sort((a, b) => Number(b === 'comparison') - Number(a === 'comparison'))
    .slice(0, MAX_STRUCTURED_BLOCKS);
  const planned: ParagraphGoal[] = hasOnlySpecialBlocks(section.blocks)
    ? section.blocks.map(mapBlockToGoal)
    : ['intro', ...(structured.length ? structured : ['definition' as ParagraphGoal]), 'summary'];
  const goals = fitToWordBudget(planned, section.expectedWords);

  const totalWords = section.expectedWords;
  const baseWords = Math.floor(totalWords / goals.length);
  const remainder = totalWords - baseWords * goals.length;

  const paragraphs: ParagraphPlan[] = [];
  for (let i = 0; i < goals.length; i += 1) {
    const goal = goals[i];
    const id = `${section.id}-p${i}`;
    const expectedWords = baseWords + (i < remainder ? 1 : 0);
    const dependsOnParagraphs = i === 0 ? [] : [paragraphs[0].id];

    const style: { list?: boolean; ordered?: boolean; table?: boolean; boldTerms?: boolean } = {};
    if (goal === 'checklist' || goal === 'steps' || goal === 'faq') {
      style.list = true;
    }
    // A process is an ordered list. Rendering it as bullets is why articles carried no
    // <ol> at all while the reference article numbers its six-step engagement flow.
    if (goal === 'steps') {
      style.ordered = true;
    }
    if (goal === 'comparison') {
      style.table = true;
    }

    paragraphs.push({
      id,
      sectionId: section.id,
      goal,
      expectedWords,
      dependsOnParagraphs,
      claims: [],
      facts: [],
      entities: [],
      questions: [],
      keywords: [],
      examples: [],
      sources: [],
      style,
      constraints: [],
    });
  }

  return paragraphs;
}
