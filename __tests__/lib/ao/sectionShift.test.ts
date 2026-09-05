/**
 * Section ids hash (index, heading). Inserting a section shifts every later index, so
 * after the first restored section the remaining steps could not find theirs and were
 * dropped without a trace — and the review diff paired old/new sections by index,
 * flagging eight untouched sections as changed.
 */
import { runPrecisionOptimizeV4 } from '@/src/infrastructure/ao/runPrecisionOptimize';
import { buildArticleSectionDiffEvents } from '@/src/infrastructure/ao/optimizeSectionEvents';
import { buildSectionBundleSteps } from '@/src/infrastructure/ao/editPlan';
import { makeCandidate } from '@/src/core/domain/optimize/editCandidate';
import { ENRICHMENT_EDIT_BUDGET } from '@/src/core/domain/optimize/editBudget';
import type { ScoreData } from '@/src/infrastructure/articles/contentScore';

const sec = (h: string, body: string) => `<h2>${h}</h2><p>${body.repeat(12)}</p>`;
const H = {
  first: 'Nieuczciwy najemca nie płaci czynszu — co może zrobić właściciel?',
  missingA: 'Prawa właściciela mieszkania a niepłacący najemca — dozwolone działania',
  mid: 'Wezwanie do zapłaty czynszu — co powinno zawierać',
  missingB: 'Weryfikacja najemcy a zaległości z czynszem',
  last: 'Studium przypadku: zaległy czynsz, kaucja i odpowiedzialność najemcy',
};
const html = [
  '<h1>Najemca nie płaci czynszu</h1><p>Gdy lokator przestaje płacić, właściciel ma kilka legalnych dróg. </p>',
  sec(H.first, 'Właściciel dokumentuje zaległość i wzywa do zapłaty. '),
  sec(H.mid, 'Wezwanie zawiera kwotę, termin i rachunek. '),
  sec(H.last, 'Kaucja rozlicza część długu, resztę dochodzi się pozwem. '),
].join('\n');

describe('restoring two planned sections in one run', () => {
  it('finds the second anchor after the first insertion shifted the ids', async () => {
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData: { terms: [] } as unknown as ScoreData,
      keyword: 'najemca nie płaci czynszu',
      plannedHeadings: [H.first, H.missingA, H.mid, H.missingB, H.last],
      targetSeo: 90,
      targetAi: 85,
      llmEdit: async (prompt) => {
        const heading = (prompt.match(/Start with <h2>(.*?)<\/h2>/) || [])[1] || 'Nowa sekcja';
        return { html: `<h2>${heading}</h2><p>${'Konkretna, rzeczowa treść sekcji o najmie i czynszu. '.repeat(6)}</p>`, tokens: 10 };
      },
      scoreHtml: (h) => ({ scores: { seo: 99, ai: 85, content: 90 + (h.match(/<h2/g) || []).length }, aiAvailability: 'available' }),
    });
    const order = [...r.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1]);
    expect(order).toEqual([H.first, H.missingA, H.mid, H.missingB, H.last]);
    expect(r.rejected).toBe(0);
  });
});

describe('review diff pairs sections by heading, not by index', () => {
  it('reports one new section and leaves the shifted ones unchanged', () => {
    const before = [sec(H.first, 'a '), sec(H.mid, 'b '), sec(H.last, 'c ')].join('\n');
    const after = [sec(H.first, 'a '), sec(H.missingA, 'nowa '), sec(H.mid, 'b '), sec(H.last, 'c ')].join('\n');
    const events = buildArticleSectionDiffEvents(before, after);
    const changed = events.filter((e) => e.changed);
    expect(changed).toHaveLength(1);
    expect(changed[0].headingText).toBe(H.missingA);
    expect(changed[0].oldHtml).toBe('');
    expect(events.map((e) => e.headingText)).toEqual([H.first, H.missingA, H.mid, H.last]);
  });

  it('still reports a removed section', () => {
    const before = [sec(H.first, 'a '), sec(H.mid, 'b '), sec(H.last, 'c ')].join('\n');
    const after = [sec(H.first, 'a '), sec(H.last, 'c ')].join('\n');
    const removed = buildArticleSectionDiffEvents(before, after).filter((e) => e.changed);
    expect(removed).toHaveLength(1);
    expect(removed[0].headingText).toBe(H.mid);
    expect(removed[0].newHtml).toBe('');
  });
});

describe('bundle size is bounded so the model cannot double a section', () => {
  it('caps facts and objectives and allows a bundle-scale change ratio', () => {
    const cands = [
      ...Array.from({ length: 9 }, (_, i) => makeCandidate({
        id: `cov-${i}`,
        gapId: `coverage:item:${i}`,
        source: 'ai_coverage',
        targetSectionId: 's',
        targetGap: `Pytanie numer ${i}?`,
        priority: 'recommended',
        intentFit: 0.6,
        suggestedAction: 'improve_direct_answer',
      })),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate({
        id: `q-${i}`,
        gapId: `section:quality:${i}`,
        source: 'section_quality',
        targetSectionId: 's',
        targetGap: `Cel ${i}`,
        priority: 'optional',
        intentFit: 0.6,
        suggestedAction: 'expand_section',
      })),
    ];
    const [step] = buildSectionBundleSteps({
      candidates: cands, sections: [{ id: 's', index: 1, headingText: 'S' }], baseBudget: ENRICHMENT_EDIT_BUDGET,
    });
    expect(step.bundle!.facts.length).toBeLessThanOrEqual(4);
    expect(step.bundle!.objectives.length).toBeLessThanOrEqual(2);
    expect(step.budget.maxChangeRatio).toBeGreaterThanOrEqual(0.85);
    expect(step.maxNewWords).toBeLessThanOrEqual(300);
  });
});

describe('a bundle that overshoots its word budget is trimmed once, not thrown away', () => {
  it('retries with a shorten instruction and accepts the fitted edit', async () => {
    const body = 'Właściciel dokumentuje zaległość i wzywa do zapłaty. ';
    const article = `<h2>${H.first}</h2><p>${body.repeat(12)}</p>`;
    const prompts: string[] = [];
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html: article,
      ctx: null,
      scoreData: { terms: [{ term: 'kaucja', target_count: 2 }] } as unknown as ScoreData,
      keyword: 'najemca nie płaci czynszu',
      targetSeo: 90,
      targetAi: 85,
      llmEdit: async (prompt) => {
        prompts.push(prompt);
        const long = `<h2>${H.first}</h2><p>${body.repeat(12)} Kaucja zabezpiecza dług. ${'Dodatkowe zdanie o najmie. '.repeat(120)}</p>`;
        const fitted = `<h2>${H.first}</h2><p>${body.repeat(12)} Kaucja zabezpiecza dług.</p>`;
        return { html: prompts.length === 1 ? long : fitted, tokens: 10 };
      },
      scoreHtml: (h) => ({ scores: { seo: 40 + (h.includes('Kaucja') ? 20 : 0), ai: 50, content: 45 }, aiAvailability: 'available' }),
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/shorten|at most \d+ words/i);
    expect(r.bodyAccepted).toBe(1);
    expect(r.html).toContain('Kaucja zabezpiecza dług.');
    expect(r.html).not.toContain('Dodatkowe zdanie');
  });
});
