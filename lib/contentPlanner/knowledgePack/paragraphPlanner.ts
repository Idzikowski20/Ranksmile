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

export function planParagraphs(section: ExecutionPlanSection): ParagraphPlan[] {
  if (section.blocks.length === 0 && section.expectedWords === 0) {
    return [];
  }

  const goals: ParagraphGoal[] = hasOnlySpecialBlocks(section.blocks)
    ? section.blocks.map(mapBlockToGoal)
    : ['intro', 'definition', 'summary'];

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
    if (goal === 'checklist') {
      style.list = true;
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
