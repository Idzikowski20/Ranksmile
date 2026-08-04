import type { ExecutionPlanSection } from '../types';
import type { KnowledgePack, ParagraphPlan } from './types';

export function buildKnowledgePack(
  section: ExecutionPlanSection,
  paragraphs: ParagraphPlan[],
): KnowledgePack {
  return {
    id: section.id,
    sectionId: section.id,
    heading: section.heading,
    objective: section.objective,
    priority: section.priority,
    expectedWords: section.expectedWords,
    paragraphPlanIds: paragraphs.map((p) => p.id),
    sectionClaimIds: section.claims.map((c) => c.id),
    sectionFactIds: section.claims.map((c) => `fact-${c.id}`),
    sectionEntityIds: section.entities.map((_, i) => `entity-${section.id}-${i}`),
    sectionQuestionIds: [
      ...section.questions.map((_, i) => `q-${section.id}-q${i}`),
      ...section.mustAnswer.map((_, i) => `q-${section.id}-m${i}`),
    ],
    sectionSourceIds: [],
    sectionExampleIds: [],
    sectionConstraints: [],
    sectionTransitions: {
      fromPrevious: null,
      toNext: null,
    },
  };
}
