import { allocateTerms } from '@/src/infrastructure/contentPlanner/knowledgePack/termAllocator';
import type { KnowledgePack, ParagraphPlan } from '@/src/infrastructure/contentPlanner/knowledgePack/types';

const paragraph = (id: string, sectionId: string): ParagraphPlan => ({
  id,
  sectionId,
  goal: 'explain',
  expectedWords: 120,
  dependsOnParagraphs: [],
  claims: [],
  facts: [],
  entities: [],
  questions: [],
  keywords: [],
  examples: [],
  sources: [],
  style: {},
  constraints: [],
});

const pack = (sectionId: string, heading: string): KnowledgePack => ({
  id: `pack-${sectionId}`,
  sectionId,
  heading,
  objective: '',
  priority: 'high',
  expectedWords: 240,
  paragraphPlanIds: [],
}) as KnowledgePack;

describe('allocateTerms', () => {
  it('sends a term to the section whose heading shares its words', () => {
    const paragraphs = [paragraph('p1', 's1'), paragraph('p2', 's2')];
    const packs = [pack('s1', 'Skutki prawne szantazu'), pack('s2', 'Objawy przemocy psychicznej')];

    const out = allocateTerms(paragraphs, ['objawy przemocy'], packs);

    expect(out[0].keywords).toHaveLength(0);
    expect(out[1].keywords.map((k) => k.term)).toEqual(['objawy przemocy']);
  });

  it('still places a term no section claims', () => {
    const paragraphs = [paragraph('p1', 's1')];
    const out = allocateTerms(paragraphs, ['zupelnie inne slowo'], [pack('s1', 'Wstep')]);

    expect(out[0].keywords.map((k) => k.term)).toEqual(['zupelnie inne slowo']);
  });
});
