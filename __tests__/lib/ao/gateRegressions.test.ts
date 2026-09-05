/**
 * Gates found rejecting every edit of a real 13-section article (article 165 e2e run):
 * an article-level trait the edit never touched, a rewrite that can never meet a
 * partial-change ratio, and a paragraph budget sized for one gap applied to a bundle.
 */
import { evaluateRxQualityGate } from '@/src/infrastructure/wie/rxQualityGate';
import type { CompetitorSynthesis } from '@/src/infrastructure/wie/competitorSynthesis';
import { budgetForAction, PRECISION_SECTION_BUDGET, DEFAULT_EDIT_BUDGET } from '@/src/core/domain/optimize/editBudget';
import { runEditSafetyGate } from '@/src/core/domain/optimize/editSafetyGate';
import { buildIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { buildSectionBundleSteps } from '@/src/infrastructure/ao/editPlan';
import { makeCandidate } from '@/src/core/domain/optimize/editCandidate';

const synthesis = {
  critical: [],
  important: [],
  optional: [],
  opening_style: {},
  section_patterns: [],
  expert_claims: ['W praktyce właściciele czekają za długo'],
  storytelling: [],
  examples: [],
  cta: {},
  faq: {},
  information_gain: [],
} as unknown as CompetitorSynthesis;

const words = (n: number, w = 'najem') => Array(n).fill(w).join(' ');

describe('rx quality gate judges the edit, not the article it inherited', () => {
  const plainArticle = `<h2>A</h2><p>${words(120)}</p>`;

  it('does not veto an edit for expert markers the article never had', () => {
    const after = `<h2>A</h2><p>${words(120)} dodane zdanie o czynszu.</p>`;
    const r = evaluateRxQualityGate({ afterHtml: after, beforeHtml: plainArticle, action: 'expand_section', synthesis });
    expect(r.ok).toBe(true);
  });

  it('still vetoes an edit that removed the expert voice', () => {
    const before = `<h2>A</h2><p>W praktyce ${words(120)}</p>`;
    const after = `<h2>A</h2><p>${words(120)}</p>`;
    const r = evaluateRxQualityGate({ afterHtml: after, beforeHtml: before, action: 'expand_section', synthesis });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_expert_voice');
  });

  it('keeps the absolute veto when no before-state is given', () => {
    const r = evaluateRxQualityGate({ afterHtml: plainArticle, action: 'expand_section', synthesis });
    expect(r.ok).toBe(false);
  });
});

describe('a rewrite is allowed to rewrite', () => {
  const profile = buildIntentProfile({ keyword: 'najem', plainText: 'najem czynsz' });

  it('rewrite_section budget allows a full change ratio', () => {
    expect(budgetForAction('rewrite_section', PRECISION_SECTION_BUDGET).maxChangeRatio).toBe(1);
    expect(budgetForAction('rewrite_section', DEFAULT_EDIT_BUDGET).maxChangeRatio).toBe(1);
  });

  it('safety gate accepts a bullet intro turned into prose under a rewrite budget', () => {
    const before = `<ul>${Array(6).fill('<li><p>punkt o najmie i czynszu</p></li>').join('')}</ul>`;
    const after = `<p>${words(40, 'czynsz')}</p><p>${words(40, 'najemca')}</p>`;
    const r = runEditSafetyGate({
      beforeHtml: before,
      afterHtml: after,
      profile,
      budget: budgetForAction('rewrite_section', PRECISION_SECTION_BUDGET),
    });
    expect(r.ok).toBe(true);
  });
});

describe('bundle paragraph budget scales with its items', () => {
  it('lets a bundle touch as many paragraphs as it has items', () => {
    const cands = [
      ...Array.from({ length: 6 }, (_, i) => makeCandidate({
        id: `seo-t${i}`,
        gapId: `seo:term:t${i}`,
        source: 'seo_term',
        targetSectionId: 's',
        phrase: `term${i}`,
        targetGap: `term${i}`,
        priority: 'optional',
        intentFit: 0.6,
        suggestedAction: 'insert_sentence',
      })),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate({
        id: `cov-f${i}`,
        gapId: `coverage:item:f${i}`,
        source: 'ai_coverage',
        targetSectionId: 's',
        targetGap: `Fakt numer ${i}`,
        priority: 'recommended',
        intentFit: 0.6,
        suggestedAction: 'add_facts',
      })),
    ];
    const [step] = buildSectionBundleSteps({
      candidates: cands, sections: [{ id: 's', index: 0, headingText: 'S' }], baseBudget: PRECISION_SECTION_BUDGET,
    });
    // Terms are capped per bundle (the rest ride the shared weave list); whatever made
    // it in may each land in its own paragraph.
    const items = step.bundle!.terms.length + step.bundle!.facts.length + step.bundle!.objectives.length;
    expect(items).toBeGreaterThan(PRECISION_SECTION_BUDGET.maxModifiedParagraphs - 1);
    expect(step.budget.maxModifiedParagraphs).toBeGreaterThanOrEqual(items);
  });
});

describe('rx gate: an article already below the bar cannot blame its edit', () => {
  it('passes an edit when the before-state failed the gate for a different reason', () => {
    // before: definition-heavy, no example → no_example; after: adds an example, still no expert voice
    const before = `<h2>A</h2><p>Najem oznacza to umowę. ${words(100)}</p>`;
    const after = `${before}<h2>Nowa sekcja</h2><p>Na przykład właściciel wysyła wezwanie. ${words(60, 'czynsz')}</p>`;
    const r = evaluateRxQualityGate({ afterHtml: after, beforeHtml: before, action: 'add_missing_section', synthesis });
    expect(r.ok).toBe(true);
  });

  it('still vetoes a placeholder the edit introduced', () => {
    const before = `<h2>A</h2><p>Najem oznacza to umowę. ${words(100)}</p>`;
    const after = `${before}<p>[Editor: add source]</p>`;
    const r = evaluateRxQualityGate({ afterHtml: after, beforeHtml: before, action: 'expand_section', synthesis });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('placeholder');
  });
});

describe('semantic gate: only a lost entity counts', () => {
  it('does not veto an edit for a key entity the article never carried', async () => {
    const { runSemanticPreservationGate } = await import('@/src/infrastructure/ao/aoQualityGates');
    const critical = {
      primaryTopic: 'x',
      primaryQuery: 'x',
      definitions: [],
      directAnswers: [],
      importantClaims: [],
      intentSections: [],
      commercialSections: [],
      protectedSectionIds: [],
      keyEntities: [{ id: 'e', sectionId: 's', type: 'entity', text: 'article', importance: 'critical', preservationMode: 'presence', score: 50 }],
    } as unknown as import('@/src/core/domain/optimize/criticalContentMap').CriticalContentMap;
    const before = '<h2>A</h2><p>najem czynsz</p>';
    expect(runSemanticPreservationGate({ beforeHtml: before, afterHtml: `${before}<p>kaucja</p>`, critical }).ok).toBe(true);
    expect(runSemanticPreservationGate({ beforeHtml: '<p>article najem</p>', afterHtml: '<p>najem</p>', critical }).ok).toBe(false);
  });
});
