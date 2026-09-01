import { brandSections } from '@/src/core/domain/contentPlanner/sectionLabels';
import { buildArticleBlueprint } from '@/src/core/domain/contentPlanner/budgetEngine';
import type { CompetitorBenchmark, IntentBlueprint, ReaderModel, TargetKnowledgeGraph } from '@/src/core/domain/contentPlanner/types';

const reader = {
  keyword: 'szantaż emocjonalny',
  language: 'pl',
  readerPersona: 'osoba doświadczająca presji',
  goal: 'zrozumieć i zareagować',
  tone: 'wspierający',
  fears: [],
  timeBudgetMinutes: 8,
} as unknown as ReaderModel;

const benchmark = {
  targetWords: 2200,
  targetH2: 12,
  bestWords: 2400,
  averageQuestions: 4,
  averageParagraphs: 60,
  averageLists: 6,
  averageTables: 1,
  averageImages: 4,
  averageClaims: 10,
  averageExamples: 4,
  averageFaq: 4,
} as unknown as CompetitorBenchmark;

const kg = { claims: [], questions: [], entities: [] } as unknown as TargetKnowledgeGraph;
const intent = { keyword: 'szantaż emocjonalny', articleType: 'guide', yearHint: '' } as unknown as IntentBlueprint;

describe('brand sections in the blueprint', () => {
  it('adds services + case-study sections before the FAQ tail', () => {
    const bp = buildArticleBlueprint({ benchmark, kg, intent, reader, brandName: 'ProDetektyw' });
    const sections = bp.requiredSections;
    const services = sections.findIndex((h) => h.includes('ProDetektyw'));
    const faq = sections.findIndex((h) => /faq/i.test(h));

    expect(services).toBeGreaterThanOrEqual(0);
    expect(sections.some((h) => /studium przypadku/i.test(h))).toBe(true);
    expect(faq).toBeGreaterThan(services);
  });

  it('adds nothing without a brand name', () => {
    const bp = buildArticleBlueprint({ benchmark, kg, intent, reader });
    expect(bp.requiredSections.some((h) => /studium przypadku/i.test(h))).toBe(false);
    expect(brandSections('', 'pl')).toEqual([]);
  });
});
