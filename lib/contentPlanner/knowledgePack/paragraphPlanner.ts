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

export function planParagraphs(section: ExecutionPlanSection): ParagraphPlan[] {
  if (section.blocks.length === 0 && section.expectedWords === 0) {
    return [];
  }

  // Mixed-block sections used to collapse to three plain paragraphs: the special-blocks
  // branch fired only when a section carried nothing BUT special blocks, and the planner
  // assigns `example, checklist, steps, pro_tip` to nearly every section — so
  // `style.list` never lit and whole articles rendered as walls of <p>.
  // Distinct goals, and never two of the same in a row: `comparison` + `table` both map
  // to the comparison goal, and a section carrying both (or two of one) would emit
  // adjacent identical goals, which the compiled-plan validator rejects as
  // `duplicate_consecutive_goal`.
  const structured = section.blocks
    .filter((b) => STRUCTURED_BLOCKS.includes(b))
    .map(mapBlockToGoal)
    .filter((goal, i, arr) => goal !== arr[i - 1])
    .slice(0, MAX_STRUCTURED_BLOCKS);
  const goals: ParagraphGoal[] = hasOnlySpecialBlocks(section.blocks)
    ? section.blocks.map(mapBlockToGoal)
    : ['intro', ...(structured.length ? structured : ['definition' as ParagraphGoal]), 'summary'];

  const totalWords = section.expectedWords;
  const baseWords = Math.floor(totalWords / goals.length);
  const remainder = totalWords - baseWords * goals.length;

  const paragraphs: ParagraphPlan[] = [];
  for (let i = 0; i < goals.length; i += 1) {
    const goal = goals[i];
    const id = `${section.id}-p${i}`;
    const expectedWords = baseWords + (i < remainder ? 1 : 0);
    const dependsOnParagraphs = i === 0 ? [] : [paragraphs[0].id];

    const style: { list?: boolean; table?: boolean; boldTerms?: boolean } = {};
    if (goal === 'checklist' || goal === 'steps' || goal === 'faq') {
      style.list = true;
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
