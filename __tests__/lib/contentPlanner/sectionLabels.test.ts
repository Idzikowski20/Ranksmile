import {
  titleizeH1,
  localizedRequiredSections,
  orderSectionsFaqLast,
  isTailSectionRole,
  isSeoMetaHeading,
  namesAnotherBrand,
} from '@/src/core/domain/contentPlanner/sectionLabels';
import { buildAdaptiveOutline } from '@/src/core/domain/contentPlanner/outlineBuilder';
import { buildIntentBlueprint } from '@/src/core/domain/contentPlanner/intentBlueprint';
import { buildReaderModel } from '@/src/core/domain/contentPlanner/readerModel';
import { buildArticleBlueprint } from '@/src/core/domain/contentPlanner/budgetEngine';
import type { TargetKnowledgeGraph } from '@/src/core/domain/contentPlanner/types';

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

  it('no article type carries a forced skeleton — competitor headings drive the outline', () => {
    // Every Surfer content editor in this workspace, for a detective agency, is a topical
    // article: "szantaż emocjonalny", "kradzież z włamaniem" — the brand appears as one
    // section, never a "Kim jesteśmy / Zakres usług / Kontakt" service page. The service
    // branch used to force that CV skeleton and it read as a landing page, not an article.
    // Now hiring intent is driven by the same competitor + PAA headings as everything else,
    // with brandSections adding the single brand-help section.
    expect(localizedRequiredSections('step-by-step', 'pl')).toEqual([]);
    expect(localizedRequiredSections('guide', 'pl')).toEqual([]);
    expect(localizedRequiredSections('service', 'pl')).toEqual([]);
    expect(localizedRequiredSections('service', 'en')).toEqual([]);
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

  it('only treats a whole-word contact/summary as the sign-off', () => {
    const ordered = orderSectionsFaqLast([
      { id: 'c', role: 'body', heading: 'Contactless payments' },
      { id: 'f', role: 'faq', heading: 'FAQ' },
      { id: 'k', role: 'body', heading: 'Dane kontaktowe' },
    ]);

    expect(ordered.sections.map((s) => s.id)).toEqual(['c', 'f', 'k']);
  });

  it('buildAdaptiveOutline for szantaz: titled H1, no SEO meta, topical sections', () => {
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
    // Topical, competitor-driven — no forced FAQ/Podsumowanie scaffolding.
    const headings = outline.sections.map((s) => s.heading.toLowerCase());
    expect(headings.some((h) => h.includes('faq'))).toBe(false);
    expect(headings.some((h) => /podsum|summary/.test(h))).toBe(false);
    expect(headings.some((h) => h.includes('policję') || h.includes('szantażysta'))).toBe(true);
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

  /** A city next to a provider is not a licence to eat every other intent. */
  it.each([
    ['ile kosztuje detektyw w warszawie', 'comparison'],
    ['najlepszy detektyw warszawa vs agencja', 'comparison'],
    ['cennik usług detektywistycznych warszawa', 'comparison'],
    ['jak zostać detektywem w warszawie', 'step-by-step'],
    ['jak otworzyć biuro detektywistyczne w warszawie', 'step-by-step'],
    ['jak studiować prawo w warszawie', 'step-by-step'],
    ['jak wynająć mieszkanie w warszawie', 'step-by-step'],
  ])('does not sell a service page for %s', (keyword, type) => {
    expect(buildIntentBlueprint({ keyword, language: 'pl' }).articleType).toBe(type);
  });

  it('does not force a service-page skeleton — hiring intent still writes a topical article', () => {
    // Intent is still classified 'service' (the query IS commercial), but that no longer
    // pins a "Kim jesteśmy / Zakres usług / Kontakt" CV onto the outline. Those headings
    // read as a landing page; Surfer writes topical articles for this workspace and lets
    // competitor + PAA headings drive, with the brand as one section.
    expect(localizedRequiredSections('service', 'pl')).toEqual([]);
  });

  it('keeps Kontakt after the FAQ', () => {
    const ordered = orderSectionsFaqLast([
      { id: 'c', role: 'kontakt', heading: 'Kontakt' },
      { id: 'f', role: 'faq', heading: 'FAQ' },
      { id: 'b', role: 'services', heading: 'Zakres usług' },
    ]);

    expect(ordered.sections.map((s) => s.id)).toEqual(['b', 'f', 'c']);
  });

  /**
   * "kontakty" is the plural noun — connections, contacts in an industry — not the
   * contact section. A real outline shipped "Szerokie kontakty z wielu branż" AFTER both
   * the FAQ and Kontakt, because the sign-off pattern matched the word anywhere.
   */
  it('does not file a body section as the sign-off just for containing "kontakty"', () => {
    const ordered = orderSectionsFaqLast([
      { id: 'b', role: 'competitor_0', heading: 'Szerokie kontakty z wielu branż' },
      { id: 'f', role: 'faq', heading: 'FAQ' },
      { id: 'c', role: 'kontakt', heading: 'Kontakt' },
    ]);

    expect(ordered.sections.map((s) => s.id)).toEqual(['b', 'f', 'c']);
  });

  it.each([
    ['Kontakt', true],
    ['Dane kontaktowe', true],
    ['Podsumowanie', true],
    ['Szerokie kontakty z wielu branż', false],
    ['Dzięki kontaktom w branży detektywistycznej', false],
    ['Sieć kontaktów w wielu branżach', false],
    ['Praca z kontaktami z rynku', false],
    ['Nasze kontakty w branży detektywistycznej', false],
    ['Zakres usług', false],
  ])('classifies %s as sign-off: %s', (heading, expected) => {
    expect(isTailSectionRole('body', heading)).toBe(expected);
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

  /** Inflected keyword words are still the keyword, not a rival's name. */
  it.each([
    'Cennik usług Detektywa',
    'Prywatny detektyw w Warszawie — zakres',
  ])('keeps the inflected keyword heading %s', (heading) => {
    expect(namesAnotherBrand(heading, KW, 'pl')).toBe(false);
  });

  /** English title case makes every heading look like a proper noun — deliberately off. */
  it('does not run on English headings', () => {
    expect(namesAnotherBrand('Detective Agency Temida', 'private detective', 'en')).toBe(false);
  });
});
