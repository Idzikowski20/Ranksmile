/**
 * Why Auto-Optimize moved the AI Search score by ≤5 points while Surfer moves it 59→100:
 * live scoring froze every fact item until an LLM regrade, credited answers only when
 * written as FAQ headings, downgraded judge-covered answers it could not find as a
 * heading, and treated quality 4 as "done". Facts woven into body prose — Surfer's whole
 * mechanism — never registered.
 */
import { liveCoverageItems } from '@/src/infrastructure/coverage/liveCoverage';
import type { CoverageItem } from '@/src/core/domain/coverage/aiCoverage';
import { buildEditCandidates } from '@/src/infrastructure/ao/buildCandidates';
import { buildIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { sectionGrowthAllowance } from '@/src/core/domain/optimize/lengthBudget';
import { buildSectionBundleSteps, buildPrecisionStepPrompt } from '@/src/infrastructure/ao/editPlan';
import { makeCandidate } from '@/src/core/domain/optimize/editCandidate';
import { ENRICHMENT_EDIT_BUDGET } from '@/src/core/domain/optimize/editBudget';

const item = (o: Partial<CoverageItem> & Pick<CoverageItem, 'id' | 'type'>): CoverageItem => ({
  label: o.id, category: 'knowledge', importance: 'recommended', source: 'manual', covered: false, quality: 0, ...o,
});

describe('live coverage credits a fact woven into body prose', () => {
  const fact = item({ id: 'f1', type: 'fact', label: 'Karanie ciszą jest popularną formą szantażu emocjonalnego.' });

  it('marks the fact covered when the article states it (inflected forms count)', () => {
    const text = 'Szantaż emocjonalny przybiera różne formy. Karanie ciszą to jedna z popularnych form szantażu emocjonalnego w związku.';
    const [out] = liveCoverageItems([fact], text, `<p>${text}</p>`);
    expect(out.covered).toBe(true);
    expect(out.quality).toBeGreaterThanOrEqual(3);
  });

  it('leaves an absent fact uncovered', () => {
    const text = 'Artykuł o zupełnie innym temacie: rozliczenie kaucji przy najmie mieszkania.';
    const [out] = liveCoverageItems([fact], text, `<p>${text}</p>`);
    expect(out.covered).toBe(false);
  });

  it('never lowers a judge verdict on a fact', () => {
    const graded = { ...fact, covered: true, quality: 5 };
    const text = 'Artykuł o zupełnie innym temacie: rozliczenie kaucji przy najmie mieszkania.';
    const [out] = liveCoverageItems([graded], text, `<p>${text}</p>`);
    expect(out.covered).toBe(true);
    expect(out.quality).toBe(5);
  });
});

describe('live coverage does not downgrade a judge-covered answer it cannot find as a heading', () => {
  it('keeps covered:true when the judge graded a body answer the heading check misses', () => {
    const paa = item({
      id: 'q1',
      type: 'paa',
      category: 'intent',
      importance: 'critical',
      label: 'Jak nie dać się zmanipulować emocjonalnie?',
      covered: true,
      quality: 3,
    });
    const text = 'Obrona przed manipulacją wymaga granic i asertywności; nazwanie sytuacji odbiera manipulatorowi siłę.';
    const [out] = liveCoverageItems([paa], text, `<h2>Obrona</h2><p>${text}</p>`);
    expect(out.covered).toBe(true);
    expect(out.quality).toBe(3);
  });
});

describe('AO deepens quality-4 items while the AI score is weak', () => {
  const profile = buildIntentProfile({ keyword: 'szantaż emocjonalny', plainText: 'szantaż emocjonalny manipulacja' });
  const shallow = item({ id: 'f-fog', type: 'fact', label: 'Mechanizm FOG: strach, obowiązek, poczucie winy', covered: true, quality: 4 });
  const missing = item({
    id: 'f-cisza',
    type: 'fact',
    label: 'Karanie ciszą jest formą szantażu',
    covered: false,
    quality: 0,
    importance: 'critical',
  });

  it('emits a candidate for a covered quality-4 fact when aiWeak', () => {
    const cands = buildEditCandidates({ profile, coverageItems: [shallow], aiWeak: true });
    expect(cands.some((c) => c.id === 'cov-f-fog')).toBe(true);
  });

  it('does not touch a quality-5 fact', () => {
    const cands = buildEditCandidates({ profile, coverageItems: [{ ...shallow, quality: 5 }], aiWeak: true });
    expect(cands.some((c) => c.id === 'cov-f-fog')).toBe(false);
  });

  it('orders uncovered items before shallow ones', () => {
    const cands = buildEditCandidates({ profile, coverageItems: [shallow, missing], aiWeak: true });
    const ids = cands.map((c) => c.id);
    expect(ids.indexOf('cov-f-cisza')).toBeLessThan(ids.indexOf('cov-f-fog'));
  });
});

describe('article length steers every section edit', () => {
  it('shares the headroom to the target across the sections being edited', () => {
    expect(sectionGrowthAllowance({ current: 1080, target: 1542, max: 2679, sections: 4 })).toBe(133);
  });

  it('allows only weaving room when the article already meets its target', () => {
    expect(sectionGrowthAllowance({ current: 1949, target: 1692, max: 5648, sections: 6 })).toBeLessThanOrEqual(60);
  });

  it('allows next to nothing at the SERP maximum', () => {
    expect(sectionGrowthAllowance({ current: 2700, target: 1542, max: 2679, sections: 3 })).toBeLessThanOrEqual(20);
  });

  it('caps the bundle budget by the allowance and tells the model the article target', () => {
    const cands = Array.from({ length: 6 }, (_, i) => makeCandidate({
      id: `cov-${i}`,
      gapId: `coverage:item:${i}`,
      source: 'ai_coverage',
      targetSectionId: 's',
      targetGap: `Fakt ${i}`,
      priority: 'recommended',
      intentFit: 0.6,
      suggestedAction: 'add_facts',
    }));
    const [step] = buildSectionBundleSteps({
      candidates: cands,
      sections: [{ id: 's', index: 1, headingText: 'S' }],
      baseBudget: ENRICHMENT_EDIT_BUDGET,
      articleWords: { current: 1949, target: 1692, max: 5648 },
    });
    expect(step.maxNewWords).toBeLessThanOrEqual(60);
    const p = buildPrecisionStepPrompt(step, '<h2>S</h2><p>x</p>');
    expect(p).toMatch(/ARTICLE LENGTH[\s\S]*1692/);
    expect(p).toMatch(/1949/);
  });
});
