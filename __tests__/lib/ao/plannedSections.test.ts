/**
 * The 13 sections the writer produced are the article's contract. Found by the
 * article-165 runs: AO read competitor-scraped headings ("Spis treści", "Rozpocznij
 * podróż w świat wynajmu!") as the plan and restored them as new sections; a copy with
 * three sections cut out was skipped as already_optimal because the stored AI score
 * outranked the live one and the skip gate never looked at structure.
 */
import { plannedHeadingsFromScoreData, missingPlannedHeadings } from '@/src/core/domain/optimize/plannedSections';
import { resolveLiveAiScore } from '@/src/core/domain/optimize/liveAiScore';
import { planPrecisionStepsV4 } from '@/src/infrastructure/ao/runPrecisionOptimize';
import { buildIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { buildCriticalContentMap } from '@/src/core/domain/optimize/criticalContentMap';
import { makeCandidate } from '@/src/core/domain/optimize/editCandidate';
import { splitSections } from '@/src/infrastructure/articles/articleSections';

describe('plannedHeadingsFromScoreData', () => {
  it('reads the headings the writer actually used, not the competitor outline', () => {
    const sd = {
      compiled_write_plan: { knowledgePacks: [{ heading: 'Wezwanie do zapłaty czynszu' }, { heading: 'Pytania i odpowiedzi' }] },
      content_planner_v2: { bundle: { outline: { sections: [{ heading: 'Spis treści' }, { heading: 'Rozpocznij podróż w świat wynajmu!' }] } } },
    };
    expect(plannedHeadingsFromScoreData(sd)).toEqual(['Wezwanie do zapłaty czynszu', 'Pytania i odpowiedzi']);
  });

  it('returns nothing when no compiled plan exists — the outline draft is not a plan', () => {
    const sd = { content_planner_v2: { bundle: { outline: { sections: [{ heading: 'Powiązane wpisy na blogu' }] } } } };
    expect(plannedHeadingsFromScoreData(sd)).toEqual([]);
  });
});

describe('missingPlannedHeadings', () => {
  const planned = [
    'Nieuczciwy najemca nie płaci czynszu — co może zrobić właściciel?',
    'Prawa właściciela mieszkania a niepłacący najemca — dozwolone działania',
    'Wezwanie do zapłaty czynszu — co powinno zawierać',
  ];
  const sec = (h: string) => `<h2>${h}</h2><p>${'tekst o najmie i czynszu. '.repeat(10)}</p>`;

  it('is empty when every planned section has a heading in the article', () => {
    const html = planned.map(sec).join('\n');
    expect(missingPlannedHeadings(planned, splitSections(html))).toEqual([]);
  });

  it('names a section whose heading is gone even if its words survive in the body', () => {
    const html = [
      sec(planned[0]),
      `<h2>${planned[2]}</h2><p>prawa właściciela mieszkania, niepłacący najemca, dozwolone działania — wszystko w jednym akapicie.</p>`,
    ].join('\n');
    expect(missingPlannedHeadings(planned, splitSections(html))).toEqual([planned[1]]);
  });

  it('tolerates a rephrased heading', () => {
    const html = [sec(planned[0]), sec('Prawa właściciela mieszkania wobec niepłacącego najemcy — dozwolone działania'), sec(planned[2])].join('\n');
    expect(missingPlannedHeadings(planned, splitSections(html))).toEqual([]);
  });
});

describe('resolveLiveAiScore', () => {
  it('trusts the live score over a stale stored one', () => {
    expect(resolveLiveAiScore({ live: 81, stored: 85, latest: 85 })).toBe(81);
  });

  it('falls back to stored/latest only when nothing live is available', () => {
    expect(resolveLiveAiScore({ live: 0, stored: 70, latest: 75 })).toBe(75);
    expect(resolveLiveAiScore({ live: null, stored: 70, latest: 0 })).toBe(70);
  });
});

describe('unrelated terms are spread across body sections, not dumped into one', () => {
  const profile = buildIntentProfile({ keyword: 'najem', plainText: 'najem czynsz lokator' });
  const html = [
    '<h2>Wstęp</h2>', `<p>${'wstęp o najmie. '.repeat(30)}</p>`,
    '<h2>Eksmisja</h2>', `<p>${'eksmisja lokatora. '.repeat(30)}</p>`,
    '<h2>Wezwanie</h2>', `<p>${'wezwanie do zapłaty. '.repeat(30)}</p>`,
    '<h2>Kaucja</h2>', `<p>${'kaucja i rozliczenie. '.repeat(30)}</p>`,
  ].join('\n');
  const sections = splitSections(html);
  const critical = buildCriticalContentMap({ html, profile, sectionIds: sections.map((s) => s.id) });
  const cands = Array.from({ length: 16 }, (_, i) => makeCandidate({
    id: `seo-zzz${i}`,
    gapId: `seo:term:zzz${i}`,
    source: 'seo_term',
    phrase: `zzz${i}`,
    targetGap: `Naturally include the term "zzz${i}" once in an existing paragraph.`,
    priority: 'optional',
    intentFit: 0.6,
    suggestedAction: 'insert_sentence',
  }));

  it('gives at least two sections a bundle and caps terms per bundle', () => {
    const { steps } = planPrecisionStepsV4({ candidates: cands, profile, critical, html });
    const bundles = steps.filter((s) => s.bundle);
    expect(bundles.length).toBeGreaterThanOrEqual(2);
    for (const b of bundles) expect(b.bundle!.terms.length).toBeLessThanOrEqual(8);
  });
});
