// __tests__/lib/blogPaths.test.ts
import { normalizeBlogPaths, matchesBlogPath } from '../../lib/blogPaths';

describe('normalizeBlogPaths', () => {
  it('reduces a prefix to its blog segment, deduped, locale/category-stripped', () => {
    expect(normalizeBlogPaths(['/blog/'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/en/blog/', '/pl/blog'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/category/blog/'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/blog/', '/poradnik/'])).toEqual(['blog', 'poradnik']);
  });
  it('ignores blanks and bare slashes', () => {
    expect(normalizeBlogPaths(['', '   ', '/'])).toEqual([]);
  });
});

describe('matchesBlogPath', () => {
  const paths = ['blog', 'poradnik'];
  it('matches when any URL path segment equals a blog segment', () => {
    expect(matchesBlogPath('https://x.pl/blog/jak-wybrac-hosting', paths)).toBe(true);
    expect(matchesBlogPath('https://x.pl/en/blog/post', paths)).toBe(true);
    expect(matchesBlogPath('https://x.pl/poradnik/seo', paths)).toBe(true);
  });
  it('rejects non-blog and segment-listing URLs', () => {
    expect(matchesBlogPath('https://x.pl/produkty/abc', paths)).toBe(false);
    expect(matchesBlogPath('https://x.pl/blog', paths)).toBe(false); // listing page, no post slug
    expect(matchesBlogPath('https://x.pl/blog/', paths)).toBe(false);
  });
  it('returns false when no paths configured or url is malformed', () => {
    expect(matchesBlogPath('https://x.pl/blog/post', [])).toBe(false);
    expect(matchesBlogPath('not a url', paths)).toBe(false);
  });
});
