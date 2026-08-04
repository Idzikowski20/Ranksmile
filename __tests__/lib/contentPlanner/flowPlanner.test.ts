import { planFlow } from '../../../lib/contentPlanner/knowledgePack/flowPlanner';
import type {
  KnowledgePack,
  ParagraphPlan,
} from '../../../lib/contentPlanner/knowledgePack/types';

function makeParagraph(partial: Partial<ParagraphPlan> & { id: string; sectionId: string; goal: ParagraphPlan['goal'] }): ParagraphPlan {
  return {
    id: partial.id,
    sectionId: partial.sectionId,
    goal: partial.goal,
    expectedWords: partial.expectedWords ?? 100,
    dependsOnParagraphs: partial.dependsOnParagraphs ?? [],
    claims: partial.claims ?? [],
    facts: partial.facts ?? [],
    entities: partial.entities ?? [],
    questions: partial.questions ?? [],
    keywords: partial.keywords ?? [],
    examples: partial.examples ?? [],
    sources: partial.sources ?? [],
    style: partial.style ?? {},
    constraints: partial.constraints ?? [],
    transitionFrom: partial.transitionFrom,
    transitionTo: partial.transitionTo,
  };
}

function makePack(partial: Partial<KnowledgePack> & { sectionId: string; heading: string }): KnowledgePack {
  return {
    id: partial.sectionId,
    sectionId: partial.sectionId,
    heading: partial.heading,
    objective: partial.objective ?? '',
    priority: partial.priority ?? 'medium',
    expectedWords: partial.expectedWords ?? 300,
    paragraphPlanIds: partial.paragraphPlanIds ?? [],
    sectionClaimIds: partial.sectionClaimIds ?? [],
    sectionFactIds: partial.sectionFactIds ?? [],
    sectionEntityIds: partial.sectionEntityIds ?? [],
    sectionQuestionIds: partial.sectionQuestionIds ?? [],
    sectionSourceIds: partial.sectionSourceIds ?? [],
    sectionExampleIds: partial.sectionExampleIds ?? [],
    sectionConstraints: partial.sectionConstraints ?? [],
    sectionTransitions: partial.sectionTransitions ?? { fromPrevious: null, toNext: null },
  };
}

describe('planFlow', () => {
  it('fills paragraph transitions within a section', () => {
    const paragraphs: ParagraphPlan[] = [
      makeParagraph({ id: 's1-p0', sectionId: 's1', goal: 'intro' }),
      makeParagraph({ id: 's1-p1', sectionId: 's1', goal: 'definition' }),
      makeParagraph({ id: 's1-p2', sectionId: 's1', goal: 'summary' }),
    ];
    const packs: KnowledgePack[] = [makePack({ sectionId: 's1', heading: 'Wstęp' })];

    const { paragraphs: flowed } = planFlow(packs, paragraphs);

    expect(flowed[0].transitionFrom).toBeUndefined();
    expect(flowed[0].transitionTo).toBe('Następnie: definicja');
    expect(flowed[1].transitionFrom).toBe('Po wstęp');
    expect(flowed[1].transitionTo).toBe('Następnie: podsumowanie');
    expect(flowed[2].transitionFrom).toBe('Po definicja');
    expect(flowed[2].transitionTo).toBeUndefined();
  });

  it('fills pack section transitions for middle packs and keeps edges null', () => {
    const packs: KnowledgePack[] = [
      makePack({ sectionId: 's1', heading: 'Wstęp' }),
      makePack({ sectionId: 's2', heading: 'Kroki' }),
      makePack({ sectionId: 's3', heading: 'Podsumowanie' }),
    ];
    const paragraphs: ParagraphPlan[] = [
      makeParagraph({ id: 's1-p0', sectionId: 's1', goal: 'intro' }),
      makeParagraph({ id: 's2-p0', sectionId: 's2', goal: 'steps' }),
      makeParagraph({ id: 's3-p0', sectionId: 's3', goal: 'summary' }),
    ];

    const { packs: flowed } = planFlow(packs, paragraphs);

    expect(flowed[0].sectionTransitions.fromPrevious).toBeNull();
    expect(flowed[0].sectionTransitions.toNext).toBe('Kroki');
    expect(flowed[1].sectionTransitions.fromPrevious).toBe('Wstęp');
    expect(flowed[1].sectionTransitions.toNext).toBe('Podsumowanie');
    expect(flowed[2].sectionTransitions.fromPrevious).toBe('Kroki');
    expect(flowed[2].sectionTransitions.toNext).toBeNull();
  });

  it('crosses section boundaries for first and last paragraph of a pack', () => {
    const packs: KnowledgePack[] = [
      makePack({ sectionId: 's1', heading: 'Wstęp' }),
      makePack({ sectionId: 's2', heading: 'Kroki' }),
    ];
    const paragraphs: ParagraphPlan[] = [
      makeParagraph({ id: 's1-p0', sectionId: 's1', goal: 'intro' }),
      makeParagraph({ id: 's1-p1', sectionId: 's1', goal: 'summary' }),
      makeParagraph({ id: 's2-p0', sectionId: 's2', goal: 'steps' }),
    ];

    const { paragraphs: flowed } = planFlow(packs, paragraphs);

    expect(flowed[1].transitionTo).toBe('Do sekcji Kroki');
    expect(flowed[2].transitionFrom).toBe('Z sekcji Wstęp');
  });

  it('never sets empty transition strings', () => {
    const packs: KnowledgePack[] = [
      makePack({ sectionId: 's1', heading: 'A' }),
      makePack({ sectionId: 's2', heading: 'B' }),
    ];
    const paragraphs: ParagraphPlan[] = [
      makeParagraph({ id: 's1-p0', sectionId: 's1', goal: 'intro' }),
      makeParagraph({ id: 's2-p0', sectionId: 's2', goal: 'summary' }),
    ];

    const { packs: flowedPacks, paragraphs: flowedParagraphs } = planFlow(packs, paragraphs);

    for (const pack of flowedPacks) {
      const { fromPrevious, toNext } = pack.sectionTransitions;
      if (fromPrevious !== null) expect(fromPrevious.length).toBeGreaterThan(0);
      if (toNext !== null) expect(toNext.length).toBeGreaterThan(0);
    }
    for (const paragraph of flowedParagraphs) {
      if (paragraph.transitionFrom !== undefined) expect(paragraph.transitionFrom.length).toBeGreaterThan(0);
      if (paragraph.transitionTo !== undefined) expect(paragraph.transitionTo.length).toBeGreaterThan(0);
    }
  });

  it('fills pack section transitions when paragraphs are empty', () => {
    const packs: KnowledgePack[] = [
      makePack({ sectionId: 's1', heading: 'Wstęp', paragraphPlanIds: [] }),
      makePack({ sectionId: 's2', heading: 'Kroki', paragraphPlanIds: [] }),
      makePack({ sectionId: 's3', heading: 'Podsumowanie', paragraphPlanIds: [] }),
    ];

    const { packs: flowed, paragraphs: flowedParagraphs } = planFlow(packs, []);

    expect(flowedParagraphs).toEqual([]);
    expect(flowed[0].sectionTransitions.fromPrevious).toBeNull();
    expect(flowed[0].sectionTransitions.toNext).toBe('Kroki');
    expect(flowed[1].sectionTransitions.fromPrevious).toBe('Wstęp');
    expect(flowed[1].sectionTransitions.toNext).toBe('Podsumowanie');
    expect(flowed[2].sectionTransitions.fromPrevious).toBe('Kroki');
    expect(flowed[2].sectionTransitions.toNext).toBeNull();
  });

  it('returns empty input unchanged', () => {
    expect(planFlow([], [])).toEqual({ packs: [], paragraphs: [] });
  });
});
