import type { KnowledgePack, ParagraphGoal, ParagraphPlan } from './types';

type NeighborSummary = {
  goal: ParagraphGoal;
  sectionHeading: string;
};

function goalLabel(goal: ParagraphGoal): string {
  switch (goal) {
    case 'intro':
      return 'wstęp';
    case 'definition':
      return 'definicja';
    case 'context':
      return 'kontekst';
    case 'problem':
      return 'problem';
    case 'symptoms':
      return 'symptomy';
    case 'benefits':
      return 'korzyści';
    case 'comparison':
      return 'porównanie';
    case 'warning':
      return 'ostrzeżenie';
    case 'example':
      return 'przykład';
    case 'steps':
      return 'kroki';
    case 'checklist':
      return 'checklista';
    case 'faq':
      return 'FAQ';
    case 'summary':
      return 'podsumowanie';
    case 'cta':
      return 'wezwanie do działania';
    default:
      return goal;
  }
}

function buildSectionHeadingMap(packs: KnowledgePack[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pack of packs) {
    map.set(pack.sectionId, pack.heading);
  }
  return map;
}

function transitionFromText(previous: NeighborSummary, currentHeading: string): string {
  if (previous.sectionHeading !== currentHeading) {
    return `Z sekcji ${previous.sectionHeading}`;
  }
  return `Po ${goalLabel(previous.goal)}`;
}

function transitionToText(next: NeighborSummary, currentHeading: string): string {
  if (next.sectionHeading !== currentHeading) {
    return `Do sekcji ${next.sectionHeading}`;
  }
  return `Następnie: ${goalLabel(next.goal)}`;
}

function applyPackSectionTransitions(packs: KnowledgePack[]): KnowledgePack[] {
  return packs.map((pack, index) => {
    const fromPrevious = index === 0 ? null : packs[index - 1].heading;
    const toNext = index === packs.length - 1 ? null : packs[index + 1].heading;
    return {
      ...pack,
      sectionTransitions: {
        fromPrevious,
        toNext,
      },
    };
  });
}

export function planFlow(
  packs: KnowledgePack[],
  paragraphs: ParagraphPlan[],
): { packs: KnowledgePack[]; paragraphs: ParagraphPlan[] } {
  if (packs.length === 0) {
    return { packs, paragraphs };
  }

  const flowedPacks = applyPackSectionTransitions(packs);

  if (paragraphs.length === 0) {
    return { packs: flowedPacks, paragraphs };
  }

  const headings = buildSectionHeadingMap(packs);

  const flowedParagraphs: ParagraphPlan[] = paragraphs.map((paragraph, index) => {
    const currentHeading = headings.get(paragraph.sectionId) ?? '';
    let transitionFrom: string | undefined;
    let transitionTo: string | undefined;

    if (index > 0) {
      const previous = paragraphs[index - 1];
      const previousHeading = headings.get(previous.sectionId) ?? '';
      transitionFrom = transitionFromText(
        { goal: previous.goal, sectionHeading: previousHeading },
        currentHeading,
      );
    }

    if (index < paragraphs.length - 1) {
      const next = paragraphs[index + 1];
      const nextHeading = headings.get(next.sectionId) ?? '';
      transitionTo = transitionToText(
        { goal: next.goal, sectionHeading: nextHeading },
        currentHeading,
      );
    }

    return {
      ...paragraph,
      transitionFrom,
      transitionTo,
    };
  });

  return { packs: flowedPacks, paragraphs: flowedParagraphs };
}
