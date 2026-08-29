import { collectScoreSlots } from '@/src/infrastructure/articles/contentScore';
import type { ScoreData } from '@/src/infrastructure/articles/contentScore';

const base: ScoreData = {
  terms: [],
  words_target: 800,
  words_min: 500,
  words_max: 1200,
  headings_target: 8,
  headings_min: 3,
  headings_max: 12,
};

it('grades image frequency against the cohort target', () => {
  const html = '<h1>T</h1><p>tekst</p><img src="a.jpg" alt="a"><img src="b.jpg" alt="b">';
  const slots = collectScoreSlots('tekst', 100, 2, { ...base, images_target: 4 }, 3, html, 'kw');
  const images = slots.find((s) => s.key === 'images');
  expect(images).toBeDefined();
  expect(images!.max).toBe(4);
  expect(images!.earned).toBeCloseTo(2, 5); // 2 of 4 → half of the 4-point slot
});

it('skips the slot when the cohort carries no images', () => {
  const slots = collectScoreSlots('tekst', 100, 2, base, 3, '<h1>T</h1><p>tekst</p>', 'kw');
  expect(slots.find((s) => s.key === 'images')).toBeUndefined();
});
