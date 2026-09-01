// __tests__/lib/detectBlogPaths.test.ts
import { rankBlogSegments } from '../../lib/detectBlogPaths';

describe('rankBlogSegments', () => {
  it('ranks segments with many deep slug-like children highest', () => {
    const urls = [
      'https://x.pl/blog/jak-wybrac-hosting-wordpress',
      'https://x.pl/blog/najlepsze-wtyczki-seo-2025',
      'https://x.pl/blog/audyt-tresci-krok-po-kroku',
      'https://x.pl/blog/pozycjonowanie-lokalne',
      'https://x.pl/o-nas',
      'https://x.pl/kontakt',
      'https://x.pl/produkty/abonament',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('blog');
    expect(ranked[0].slugChildren).toBe(4);
  });
  it('ignores single-page segments and the root', () => {
    const urls = ['https://x.pl/', 'https://x.pl/kontakt', 'https://x.pl/o-nas'];
    expect(rankBlogSegments(urls)).toEqual([]);
  });
  it('treats a segment with only short children as a weak candidate', () => {
    const urls = [
      'https://x.pl/sklep/a', 'https://x.pl/sklep/b',
      'https://x.pl/blog/dlugi-tytul-wpisu-blogowego',
      'https://x.pl/blog/inny-dlugi-tytul-wpisu',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('blog'); // longer slugs win
  });
  it('gives a known-blog-segment name the edge on an otherwise equal tie', () => {
    const urls = [
      'https://x.pl/news/pierwszy-wpis-aktualnosci', 'https://x.pl/news/drugi-wpis-aktualnosci',
      'https://x.pl/zxqp/pierwszy-wpis-aktualnosci', 'https://x.pl/zxqp/drugi-wpis-aktualnosci',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('news'); // known name outranks the unknown 'zxqp'
  });
  it('rewards a high share of dated URLs (unknown segment, isolates date signal)', () => {
    const urls = [
      'https://x.pl/kronika/2025/01/styczniowy-wpis', 'https://x.pl/kronika/2025/02/lutowy-wpis',
      'https://x.pl/oferta/pakiet-rozszerzony-firmowy', 'https://x.pl/oferta/pakiet-podstawowy-maly',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('kronika'); // both unknown + equal count; date-share breaks the tie
  });
});
