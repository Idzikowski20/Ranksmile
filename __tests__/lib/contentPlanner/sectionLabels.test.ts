import {
  titleizeH1,
  localizedRequiredSections,
  orderSectionsFaqLast,
  isSeoMetaHeading,
  namesAnotherBrand,
} from '../../../lib/contentPlanner/sectionLabels';
import { buildAdaptiveOutline } from '../../../lib/contentPlanner/outlineBuilder';
import { buildIntentBlueprint } from '../../../lib/contentPlanner/intentBlueprint';
import { buildReaderModel } from '../../../lib/contentPlanner/readerModel';
import { buildArticleBlueprint } from '../../../lib/contentPlanner/budgetEngine';
import type { TargetKnowledgeGraph } from '../../../lib/contentPlanner/types';

const emptyKg: TargetKnowledgeGraph = {
  claims: [],
  questions: [],
  entities: [],
  mustCoverClaimIds: [],
  mustAnswerQuestionIds: [],
};

describe('sectionLabels + outline fixes', () => {
  it('titleizeH1 does not return raw keyword', () => {
    const h1 = titleizeH1({ keyword: 'szantaz', lang: 'pl', year: 2026 });
    expect(h1.toLowerCase()).not.toBe('szantaz');
    expect(h1).toMatch(/szantaz/i);
    expect(h1.length).toBeGreaterThan(10);
  });

  it('localized required sections have no SEO meta H2s', () => {
    const secs = localizedRequiredSections('step-by-step', 'pl');
    expect(secs.some(isSeoMetaHeading)).toBe(false);
    expect(secs.filter((s) => /faq/i.test(s)).length).toBe(1);
    expect(secs[secs.length - 1]).toMatch(/podsum/i);
  });

  it('orderSectionsFaqLast puts FAQ and Summary at end', () => {
    const sections = [
      { id: '1', role: 'faq', heading: 'FAQ' },
      { id: '2', role: 'foundation', heading: 'Podstawy' },
      { id: '3', role: 'summary', heading: 'Podsumowanie' },
      { id: '4', role: 'action', heading: 'Pierwsze kroki' },
    ];
    const { narrativeOrder, sections: ordered } = orderSectionsFaqLast(sections);
    expect(ordered.map((s) => s.heading)).toEqual([
      'Podstawy',
      'Pierwsze kroki',
      'FAQ',
      'Podsumowanie',
    ]);
    expect(narrativeOrder[narrativeOrder.length - 2]).toBe('1');
    expect(narrativeOrder[narrativeOrder.length - 1]).toBe('3');
  });

  it('buildAdaptiveOutline for szantaz: titled H1, no SEO meta, FAQ last', () => {
    const intent = buildIntentBlueprint({ keyword: 'szantaz', language: 'pl', year: 2026 });
    const reader = buildReaderModel({ intent, language: 'pl' });
    expect(intent.articleType).toBe('step-by-step');
    const blueprint = buildArticleBlueprint({
      benchmark: {
        competitorCount: 3,
        averageWords: 1500,
        medianWords: 1500,
        targetWords: 1600,
        averageH2: 8,
        targetH2: 8,
        averageParagraphs: 40,
        averageLists: 5,
        averageTables: 0,
        averageImages: 2,
        averageFaq: 4,
        averageExamples: 3,
        averageClaims: 10,
        averageQuestions: 5,
        commonHeadings: ['Co robić gdy szantażysta grozi', 'Jak zgłosić na policję', 'Sextortion — pierwsze kroki'],
        commonClaims: [],
        commonQuestions: [],
      },
      kg: emptyKg,
      intent,
      reader,
    });
    expect(blueprint.requiredSections.some(isSeoMetaHeading)).toBe(false);
    const outline = buildAdaptiveOutline({
      blueprint,
      kg: emptyKg,
      reader,
      intent,
      commonHeadings: blueprint ? ['Co robić gdy szantażysta grozi', 'Jak zgłosić na policję'] : [],
    });
    expect(outline.h1.toLowerCase()).not.toBe('szantaz');
    expect(outline.sections.every((s) => !isSeoMetaHeading(s.heading))).toBe(true);
    const lastTwo = outline.sections.slice(-2).map((s) => s.heading.toLowerCase());
    expect(lastTwo.some((h) => h.includes('faq'))).toBe(true);
    expect(lastTwo.some((h) => /podsum|summary/.test(h))).toBe(true);
  });
});

/**
 * "prywatny detektyw warszawa" is hiring intent: the pages that rank are service pages,
 * not tutorials. Planned as a guide it came back with "Szybka odpowiedź / Pierwsze kroki
 * / Plan działania" — an action plan for doing the job yourself.
 */
describe('service-page skeleton for hiring intent', () => {
  it.each([
    ['prywatny detektyw warszawa'],
    ['adwokat rozwodowy kraków'],
    ['usługi hydrauliczne wrocław'],
  ])('treats %s as a commercial service query', (keyword) => {
    const intent = buildIntentBlueprint({ keyword, language: 'pl' });
    expect(intent.primaryIntent).toBe('commercial');
    expect(intent.articleType).toBe('service');
  });

  it.each([
    ['jak wykryć zdradę', 'step-by-step'],
    ['ile kosztuje detektyw', 'comparison'],
  ])('leaves %s alone', (keyword, type) => {
    expect(buildIntentBlueprint({ keyword, language: 'pl' }).articleType).toBe(type);
  });

  it('plans a service page instead of a tutorial', () => {
    const sections = localizedRequiredSections('service', 'pl');

    expect(sections).toEqual([
      'Kim jesteśmy', 'Komu pomagamy', 'Zakres usług', 'Jak wygląda współpraca',
      'Dlaczego my', 'FAQ', 'Kontakt',
    ]);
    expect(sections).not.toContain('Pierwsze kroki');
  });

  it('keeps Kontakt after the FAQ', () => {
    const ordered = orderSectionsFaqLast([
      { id: 'c', role: 'kontakt', heading: 'Kontakt' },
      { id: 'f', role: 'faq', heading: 'FAQ' },
      { id: 'b', role: 'services', heading: 'Zakres usług' },
    ]);

    expect(ordered.sections.map((s) => s.id)).toEqual(['b', 'f', 'c']);
  });
});

/**
 * Competitor headings pad the outline when the planner is short of sections. Real runs
 * shipped a rival agency's name as our H2, which tells the writer to write our article
 * about somebody else's company.
 */
describe('namesAnotherBrand', () => {
  const KW = 'prywatny detektyw warszawa';

  it.each([
    'Detektyw Warszawa Agencja Temida.',
    'Prywatny Detektyw Temida – Warszawa',
    'Jak działają specjaliści Agencji Temida?',
    'Zakres usług agencji Temida.',
  ])('rejects %s', (heading) => {
    expect(namesAnotherBrand(heading, KW, 'pl')).toBe(true);
  });

  it.each([
    'Wykrywanie podsłuchów i lokalizatorów GPS',
    'Ile kosztuje obserwacja w warszawie',
    'Sprawy rozwodowe i alimentacyjne',
  ])('keeps the topical heading %s', (heading) => {
    expect(namesAnotherBrand(heading, KW, 'pl')).toBe(false);
  });

  /** English title case makes every heading look like a proper noun — deliberately off. */
  it('does not run on English headings', () => {
    expect(namesAnotherBrand('Detective Agency Temida', 'private detective', 'en')).toBe(false);
  });
});
