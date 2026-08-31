import { collectScoreSlots, ScoreData } from '@/src/infrastructure/articles/contentScore';

const base: Omit<ScoreData, 'terms'> = {
  words_target: 200, words_min: 100, words_max: 400,
  headings_target: 3, headings_min: 1, headings_max: 8,
} as ScoreData;

describe('heading-terms slot (Surfer in_headings parity)', () => {
  it('rewards a heading-flagged term that lands in an H2', () => {
    const html = '<h1>T</h1><h2>Poczucie winy w relacji</h2><p>tekst o szantazu emocjonalnym i presji</p>';
    const plain = 'Poczucie winy w relacji tekst o szantazu emocjonalnym i presji';
    const scoreData = { ...base, terms: [
      { term: 'poczucie winy', target_count: 3, current_count: 1, in_headings: true },
      { term: 'presji', target_count: 2, current_count: 1 },
    ] } as ScoreData;
    const slots = collectScoreSlots(plain, plain.split(/\s+/).length, 2, scoreData, 1, html, 'szantaz emocjonalny');
    const hs = slots.find((s) => s.key === 'headingTerms');
    expect(hs).toBeTruthy();
    expect(hs!.earned).toBe(5); // 1/1 placed → full
  });

  it('does not add the slot when no term is flagged for headings', () => {
    const html = '<h1>T</h1><h2>Wstep</h2><p>tekst</p>';
    const scoreData = { ...base, terms: [{ term: 'presji', target_count: 2, current_count: 1 }] } as ScoreData;
    const slots = collectScoreSlots('tekst', 1, 1, scoreData, 1, html, 'k');
    expect(slots.find((s) => s.key === 'headingTerms')).toBeUndefined();
  });

  it('scores zero when the flagged term never reaches a heading', () => {
    const html = '<h1>T</h1><h2>Wstep</h2><p>poczucie winy w tekscie</p>';
    const scoreData = { ...base, terms: [
      { term: 'poczucie winy', target_count: 3, current_count: 1, in_headings: true },
    ] } as ScoreData;
    const slots = collectScoreSlots('poczucie winy w tekscie', 4, 1, scoreData, 1, html, 'k');
    const hs = slots.find((s) => s.key === 'headingTerms');
    expect(hs!.earned).toBe(0);
  });
});
