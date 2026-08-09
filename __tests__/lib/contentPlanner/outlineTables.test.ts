import { improveOutline } from '../../../lib/contentPlanner/outlineBuilder';
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  TargetKnowledgeGraph,
} from '../../../lib/contentPlanner/types';

function outline(): AdaptiveOutline {
  const mk = (id: string, role: string, heading: string, words: number) => ({
    id,
    role,
    heading,
    importance: 6,
    assignedClaimIds: [],
    assignedQuestionIds: [],
    // No cost section anywhere, which is the usual case: blocksForRole only ever asks
    // for a table on /cost|koszt/, and "Koszty i opcje" appears only under cost fear.
    requiredBlocks: ['example', 'checklist'],
    expectedWords: words,
    evidenceNeeds: ['example'],
    freshnessNotes: [],
    sectionBudget: {
      words,
claims: 2,
entities: 2,
questions: 1,
examples: 1,
      lists: 1,
tables: 0,
images: 1,
faq: 0,
citations: 1,
    },
  });
  return {
    h1: 'Prywatny detektyw',
    sections: [
      mk('s1', 'pierwsze_kroki', 'Pierwsze kroki', 120),
      mk('s2', 'dlaczego_my', 'Dlaczego warto', 300),
      mk('s3', 'faq', 'FAQ', 100),
      mk('s4', 'podsumowanie', 'Podsumowanie', 90),
    ],
    narrativeOrder: ['s1', 's2', 's3', 's4'],
  } as unknown as AdaptiveOutline;
}

const blueprint = (targetTables: number) => ({
  targetWords: 1400,
targetH2: 4,
targetClaims: 8,
targetQuestions: 4,
  targetExamples: 2,
targetChecklists: 2,
targetLists: 4,
targetTables,
  targetFaqs: 4,
freshness: 'low',
requiredSections: [],
} as unknown as ArticleBlueprint);

const kg = { claims: [], questions: [] } as unknown as TargetKnowledgeGraph;

describe('improveOutline table back-fill', () => {
  it('gives the outline a table when the benchmark measured one', () => {
    const improved = improveOutline(outline(), blueprint(1), kg);
    const withTable = improved.sections.filter((s) => s.requiredBlocks.includes('table'));

    expect(withTable).toHaveLength(1);
    expect(withTable[0].sectionBudget.tables).toBeGreaterThan(0);
  });

  it('puts it in the largest body section, never in FAQ or the sign-off', () => {
    const improved = improveOutline(outline(), blueprint(1), kg);
    const host = improved.sections.find((s) => s.requiredBlocks.includes('table'));

    expect(host?.id).toBe('s2');
  });

  it('adds nothing when the benchmark measured no tables', () => {
    const improved = improveOutline(outline(), blueprint(0), kg);

    expect(improved.sections.some((s) => s.requiredBlocks.includes('table'))).toBe(false);
  });

  it('does not add a second table when one is already planned', () => {
    const base = outline();
    base.sections[0].requiredBlocks.push('table');
    const improved = improveOutline(base, blueprint(1), kg);

    expect(improved.sections.filter((s) => s.requiredBlocks.includes('table'))).toHaveLength(1);
  });
});
