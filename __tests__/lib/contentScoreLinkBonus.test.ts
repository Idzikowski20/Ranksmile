/** @jest-environment node */
/**
 * The internal-link bonus in the competitor scoring branch.
 *
 * Two writers store an article's SEO score — reconcilePostGenerateArticle and the
 * deep-analysis route — and only the first passed a link count. The stored number then
 * sat below what the editor and Auto-Optimize recomputed from identical HTML. These
 * tests pin the bonus so the gap cannot silently reopen from the scorer's side.
 */
import { computeContentScore, type ScoreData } from '@/src/infrastructure/articles/contentScore';

const html = [
  '<h1>Prywatny detektyw Warszawa</h1>',
  '<h2>Zakres usług</h2>',
  '<p>Prywatny detektyw Warszawa prowadzi obserwacje i wywiad gospodarczy dla firm.</p>',
  '<p>Licencjonowani detektywi działają na terenie całej Polski.</p>',
  '<a href="/uslugi">usługi</a><a href="/kontakt">kontakt</a><a href="/cennik">cennik</a>',
].join('');
const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const wordCount = plainText.split(/\s+/).length;
const keyword = 'prywatny detektyw warszawa';

const scoreData = {
  terms: [
    { term: 'prywatny detektyw', target_count: 2, suggested_min: 1, suggested_max: 3 },
    { term: 'wywiad gospodarczy', target_count: 1, suggested_min: 1, suggested_max: 2 },
  ],
  scoring_model: 'competitor',
  content_targets: { avgWords: 40, avgHeadings: 2, avgPs: 2 },
} as unknown as ScoreData;

const score = (links: number | undefined) => computeContentScore(
  plainText, wordCount, 2, scoreData, 2, links, html, keyword,
);

describe('competitor scoring — internal-link bonus', () => {
  it('awards the bonus when a link count is supplied', () => {
    expect(score(3)).toBeGreaterThan(score(undefined));
  });

  it('caps the bonus at two points', () => {
    const none = score(undefined);
    expect(score(1)).toBe(none + 1);
    expect(score(2)).toBe(none + 2);
    expect(score(50)).toBe(none + 2);
  });

  it('treats a linkless article the same as an unmeasured one', () => {
    expect(score(0)).toBe(score(undefined));
  });
});
