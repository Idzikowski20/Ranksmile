/**
 * Closing the last gaps to Surfer: bundles generated in parallel (a 6-section run took
 * 150 s sequentially), a second pass over what the first left open, and a SERP word
 * maximum that cannot be an outlier (5648 for a 1692-word target).
 */
import { runPrecisionOptimizeV4 } from '@/src/infrastructure/ao/runPrecisionOptimize';
import { articleWordsFromScoreData } from '@/src/core/domain/optimize/lengthBudget';
import type { ScoreData } from '@/src/infrastructure/articles/contentScore';

const sec = (h: string, body: string) => `<h2>${h}</h2><p>${body.repeat(12)}</p>`;
const html = [
  sec('Wstęp do najmu', 'Najem mieszkania rządzi się umową. '),
  sec('Eksmisja lokatora', 'Eksmisja wymaga wyroku i komornika. '),
  sec('Wezwanie do zapłaty', 'Wezwanie wskazuje kwotę i termin. '),
].join('\n');
const TERMS = ['kaucja', 'zaległość', 'komornik', 'wypowiedzenie'];
const scoreData = { terms: TERMS.map((term) => ({ term, target_count: 2 })), words_target: 2000, words_max: 6000 } as unknown as ScoreData;
const sleep = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

/** Adds the first bundle term it is asked for, one per call. */
function weaveOne(prompt: string): string {
  const section = prompt.slice(prompt.lastIndexOf('SECTION HTML:') + 'SECTION HTML:'.length).trim();
  const terms = prompt.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
  const add = terms.find((t) => TERMS.includes(t) && !section.includes(t));
  return add ? section.replace('</p>', ` Ważna jest też ${add}.</p>`) : section;
}

const scoreHtml = (h: string) => {
  const n = TERMS.filter((t) => h.includes(t)).length;
  return { scores: { seo: 40 + n * 15, ai: 90, content: 60 + n * 10 }, aiAvailability: 'available' as const };
};

describe('bundle edits are generated in parallel', () => {
  it('has more than one model call in flight at a time', async () => {
    let inFlight = 0;
    let peak = 0;
    await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData,
      keyword: 'najem',
      targetSeo: 100,
      targetAi: 85,
      maxPasses: 1,
      llmEdit: async (prompt) => {
        inFlight += 1; peak = Math.max(peak, inFlight);
        await sleep(30);
        inFlight -= 1;
        return { html: weaveOne(prompt), tokens: 5 };
      },
      scoreHtml,
    });
    expect(peak).toBeGreaterThan(1);
  });
});

describe('a second pass closes what the first left open', () => {
  it('re-plans on the edited article and keeps weaving until the target or the plan is exhausted', async () => {
    const calls: string[] = [];
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData,
      keyword: 'najem',
      targetSeo: 100,
      targetAi: 85,
      maxPasses: 2,
      llmEdit: async (prompt) => { calls.push(prompt); return { html: weaveOne(prompt), tokens: 5 }; },
      scoreHtml,
    });
    const present = TERMS.filter((t) => r.html.includes(t)).length;
    expect(present).toBeGreaterThanOrEqual(3);
    expect(r.trace.events.some((e) => e.step === 'edit_plan' && e.metadata?.pass === 2)).toBe(true);
    // The run's targeting numbers cover every pass, not just the first plan.
    const plans = r.trace.events.filter((e) => e.step === 'edit_plan');
    const assigned = plans.reduce((n, e) => n + Number((e.metadata?.targeting as { assigned?: number } | undefined)?.assigned ?? 0), 0);
    expect(r.targeting.assigned).toBe(assigned);
    expect(plans.length).toBeGreaterThan(1);
  });

  it('stops after one pass when asked to', async () => {
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData,
      keyword: 'najem',
      targetSeo: 100,
      targetAi: 85,
      maxPasses: 1,
      llmEdit: async (prompt) => ({ html: weaveOne(prompt), tokens: 5 }),
      scoreHtml,
    });
    expect(r.trace.events.some((e) => e.step === 'edit_plan' && e.metadata?.pass === 2)).toBe(false);
  });
});

describe('the SERP word maximum is bounded by the target', () => {
  it('clamps an outlier max to 1.5× the target', () => {
    expect(articleWordsFromScoreData({ words_target: 1692, words_max: 5648 }, 1949)).toEqual({ current: 1949, target: 1692, max: 2538 });
  });

  it('keeps a sane max as is', () => {
    expect(articleWordsFromScoreData({ words_target: 1542, words_max: 2000 }, 1080)).toEqual({ current: 1080, target: 1542, max: 2000 });
  });

  it('returns null without a target', () => {
    expect(articleWordsFromScoreData({}, 500)).toBeNull();
  });
});

describe('a bundle is sized by the words it may add', () => {
  const { buildSectionBundleSteps } = jest.requireActual<typeof import('@/src/infrastructure/ao/editPlan')>('@/src/infrastructure/ao/editPlan');
  const { makeCandidate } = jest.requireActual<typeof import('@/src/core/domain/optimize/editCandidate')>('@/src/core/domain/optimize/editCandidate');
  const { ENRICHMENT_EDIT_BUDGET } = jest.requireActual<typeof import('@/src/core/domain/optimize/editBudget')>(
    '@/src/core/domain/optimize/editBudget',
  );
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

  it('asks for fewer items when the section may only grow by ~90 words', () => {
    const [step] = buildSectionBundleSteps({
      candidates: cands,
      sections: [{ id: 's', index: 1, headingText: 'S' }],
      baseBudget: ENRICHMENT_EDIT_BUDGET,
      // headroom 77 words × 1.15 ≈ 89 for this one section
      articleWords: { current: 1080, target: 1157, max: 1735 },
    });
    const items = step.bundle!.terms.length + step.bundle!.facts.length;
    expect(items).toBeLessThanOrEqual(4);
    expect(items).toBeGreaterThanOrEqual(2);
  });

  it('lets the gate accept a small overshoot the prompt ceiling did not promise', () => {
    const [step] = buildSectionBundleSteps({
      candidates: cands,
      sections: [{ id: 's', index: 1, headingText: 'S' }],
      baseBudget: ENRICHMENT_EDIT_BUDGET,
      articleWords: { current: 1080, target: 1157, max: 1735 },
    });
    expect(step.budget.maxNewWords).toBeGreaterThan(step.maxNewWords);
    expect(step.budget.maxNewWords).toBeLessThanOrEqual(Math.ceil(step.maxNewWords * 1.2));
  });
});
