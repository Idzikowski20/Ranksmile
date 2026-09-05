/**
 * Found by the article-165 end-to-end run: the FAQ merge dropped every section after
 * the article's existing Q&A block, a bundle was allowed to invent an H2, and nine
 * steps were rejected without a word in the trace.
 */
import { mergeFaqHtml } from '@/src/infrastructure/ao/aoFaqSection';
import { buildSectionBundleSteps } from '@/src/infrastructure/ao/editPlan';
import { makeCandidate } from '@/src/core/domain/optimize/editCandidate';
import { PRECISION_SECTION_BUDGET } from '@/src/core/domain/optimize/editBudget';
import { runPrecisionOptimizeV4 } from '@/src/infrastructure/ao/runPrecisionOptimize';

describe('mergeFaqHtml replaces only the existing FAQ section', () => {
  const article = [
    '<h2>Wstęp</h2><p>a</p>',
    '<h2>Pytania i odpowiedzi</h2><h3>Stare?</h3><p>stara odpowiedź</p>',
    '<h2>Co zrobić dalej</h2><p>ważna sekcja po FAQ</p>',
    '<h2>Studium przypadku</h2><p>ostatnia sekcja</p>',
  ].join('\n');
  const faq = '<h2>Najczęściej zadawane pytania</h2><h3>Nowe?</h3><p>nowa odpowiedź</p>';

  it('keeps every section that followed the old FAQ', () => {
    const out = mergeFaqHtml(article, faq);
    expect(out).toContain('ważna sekcja po FAQ');
    expect(out).toContain('ostatnia sekcja');
    expect(out).not.toContain('stara odpowiedź');
    expect(out).toContain('nowa odpowiedź');
  });

  it('keeps the FAQ where the old one was, not at the end', () => {
    const out = mergeFaqHtml(article, faq);
    expect(out.indexOf('nowa odpowiedź')).toBeLessThan(out.indexOf('ważna sekcja po FAQ'));
  });

  it('appends when the article has no FAQ', () => {
    const out = mergeFaqHtml('<h2>A</h2><p>a</p>', faq);
    expect(out.endsWith(faq)).toBe(true);
  });
});

describe('a bundle edits a section, it never invents a heading', () => {
  it('forbids new headings in the bundle budget whatever the strategy allows', () => {
    const c = makeCandidate({
      id: 'seo-x',
      gapId: 'seo:term:x',
      source: 'seo_term',
      targetSectionId: 's',
      phrase: 'x',
      targetGap: 'x',
      priority: 'optional',
      intentFit: 0.6,
      suggestedAction: 'insert_sentence',
    });
    const [step] = buildSectionBundleSteps({
      candidates: [c], sections: [{ id: 's', index: 1, headingText: 'S' }], baseBudget: PRECISION_SECTION_BUDGET,
    });
    expect(PRECISION_SECTION_BUDGET.allowNewHeading).toBe(true);
    expect(step.budget.allowNewHeading).toBe(false);
  });
});

describe('a failed model call is on the record', () => {
  it('traces LLM_ERROR with the message instead of a silent reject', async () => {
    const html = `<h2>A</h2><p>${'najemca nie płaci czynszu. '.repeat(15)}</p>`;
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData: { terms: [{ term: 'kaucja', target_count: 2 }] } as unknown as import('@/src/infrastructure/articles/contentScore').ScoreData,
      keyword: 'najemca nie płaci czynszu',
      llmEdit: async () => { throw new Error('HTTP 429'); },
      scoreHtml: () => ({ scores: { seo: 50, ai: 50, content: 50 }, aiAvailability: 'available' }),
    });
    expect(r.rejected).toBeGreaterThan(0);
    const { reasons } = r.trace.summary();
    expect(reasons.some((x) => x.startsWith('LLM_ERROR') && x.includes('HTTP 429'))).toBe(true);
  });
});
