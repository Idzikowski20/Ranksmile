import { buildAdaptiveOutline, improveOutline } from '../../../lib/contentPlanner/outlineBuilder';
import { buildIntentBlueprint } from '../../../lib/contentPlanner/intentBlueprint';
import { buildReaderModel } from '../../../lib/contentPlanner/readerModel';
import { buildArticleBlueprint } from '../../../lib/contentPlanner/budgetEngine';
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

/**
 * improveOutline runs only on the repair path — an outline that passes validation first
 * time never reaches it, which article 18's did. The guarantee has to hold where every
 * outline goes through.
 */
describe('buildAdaptiveOutline plans the table itself', () => {
  function outlineFor(averageTables: number) {
    const intent = buildIntentBlueprint({ keyword: 'prywatny detektyw warszawa', language: 'pl', year: 2026 });
    const reader = buildReaderModel({ intent, language: 'pl' });
    const emptyKg = { claims: [], questions: [], entities: [] } as unknown as TargetKnowledgeGraph;
    const bp = buildArticleBlueprint({
      benchmark: {
        competitorCount: 5,
        averageWords: 1080,
        medianWords: 1080,
        targetWords: 1080,
        averageH2: 12,
        targetH2: 12,
        averageParagraphs: 24,
        averageLists: 14,
        averageTables,
        averageImages: 2,
        averageFaq: 5,
        averageExamples: 4,
        averageClaims: 10,
        averageQuestions: 5,
        commonHeadings: [],
        commonClaims: [],
        commonQuestions: [],
      },
      kg: emptyKg,
      intent,
      reader,
    });
    return buildAdaptiveOutline({ blueprint: bp, kg: emptyKg, reader, intent, commonHeadings: [] });
  }

  it('gives a table to an outline the benchmark measured one for', () => {
    const planned = outlineFor(1);
    expect(planned.sections.filter((s) => s.requiredBlocks.includes('table'))).toHaveLength(1);
  });

  it('never plans a second table when a cost section already brings one', () => {
    // A hiring query gets "Cennik i wycena", and blocksForRole gives /cost|koszt/ its own
    // table — the back-fill must recognise that rather than add a competing one.
    const planned = outlineFor(1);
    const hosts = planned.sections.filter((s) => s.requiredBlocks.includes('table'));

    expect(hosts).toHaveLength(1);
    expect(hosts[0].sectionBudget.tables).toBeGreaterThan(0);
  });
});
