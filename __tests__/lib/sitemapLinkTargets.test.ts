import { pickLinkTargets, titleFromSlug } from '../../lib/sitemapLinkTargets';

const KEYWORD = 'prywatny detektyw warszawa';

// The reference article's nine internal links all point at pages like these.
const SITEMAP = [
  'https://prodetektyw.pl/',
  'https://prodetektyw.pl/uslugi-detektywistyczne/',
  'https://prodetektyw.pl/zdrada-malzenska-objawy-dowody-zdrady/',
  'https://prodetektyw.pl/polityka-prywatnosci/',
  'https://prodetektyw.pl/detektyw-warszawa-cennik.html',
  'https://prodetektyw.pl/regulamin/',
];

describe('titleFromSlug', () => {
  it.each([
    ['https://a.pl/zdrada-malzenska-objawy/', 'zdrada malzenska objawy'],
    ['https://a.pl/detektyw-warszawa-cennik.html', 'detektyw warszawa cennik'],
    ['https://a.pl/blog/wywiad_gospodarczy', 'wywiad gospodarczy'],
  ])('reads %s as a title', (url, expected) => {
    expect(titleFromSlug(url)).toBe(expected);
  });

  it('returns nothing for a malformed URL', () => {
    expect(titleFromSlug('not a url')).toBe('');
  });
});

describe('pickLinkTargets', () => {
  it('keeps only pages whose slug shares the keyword, strongest first', () => {
    const picked = pickLinkTargets({ urls: SITEMAP, keyword: KEYWORD });
    const urls = picked.map((t) => t.url);

    expect(urls).toContain('https://prodetektyw.pl/detektyw-warszawa-cennik.html');
    // The prompt shows only a handful of these, so the privacy policy must never
    // occupy one of the slots.
    expect(urls).not.toContain('https://prodetektyw.pl/polityka-prywatnosci/');
    expect(urls).not.toContain('https://prodetektyw.pl/regulamin/');
    expect(picked[0].url).toBe('https://prodetektyw.pl/detektyw-warszawa-cennik.html');
  });

  it('drops the homepage — it is navigation, not a topical link', () => {
    expect(pickLinkTargets({ urls: ['https://prodetektyw.pl/'], keyword: 'prywatny detektyw' })).toEqual([]);
  });

  it('never offers the article its own URL', () => {
    const self = 'https://prodetektyw.pl/detektyw-warszawa-cennik.html';
    const picked = pickLinkTargets({ urls: SITEMAP, keyword: KEYWORD, selfUrl: self });
    expect(picked.map((t) => t.url)).not.toContain(self);
  });

  it('ignores query strings and fragments when deduping', () => {
    const picked = pickLinkTargets({
      urls: [
        'https://prodetektyw.pl/detektyw-warszawa/',
        'https://prodetektyw.pl/detektyw-warszawa/?utm_source=fb',
        'https://prodetektyw.pl/detektyw-warszawa/#kontakt',
      ],
      keyword: KEYWORD,
    });
    expect(picked).toHaveLength(1);
  });

  it('respects the limit and returns nothing for an empty keyword', () => {
    expect(pickLinkTargets({ urls: SITEMAP, keyword: KEYWORD, limit: 1 })).toHaveLength(1);
    expect(pickLinkTargets({ urls: SITEMAP, keyword: '' })).toEqual([]);
  });
});

/**
 * Ranking on keyword tokens alone found exactly one page on the client's site for
 * "prywatny detektyw", so a real article linked that page five times where the reference
 * article linked nine different ones. None of those nine share a token with the keyword.
 */
describe('pickLinkTargets topical ranking', () => {
  const SITE = [
    'https://prodetektyw.pl/',
    'https://prodetektyw.pl/prywatny-detektyw/',
    'https://prodetektyw.pl/zdrada-malzenska-objawy-dowody-zdrady/',
    'https://prodetektyw.pl/osint-bialy-wywiad/',
    'https://prodetektyw.pl/windykacja-naleznosci-terenowa/',
    'https://prodetektyw.pl/polityka-prywatnosci/',
  ];
  const TERMS = ['wykrywanie zdrad', 'osint bialy wywiad', 'windykacja naleznosci'];

  it('finds the topical pages the keyword alone could never match', () => {
    const urls = pickLinkTargets({ urls: SITE, keyword: 'prywatny detektyw', terms: TERMS })
      .map((t) => t.url);

    expect(urls).toContain('https://prodetektyw.pl/osint-bialy-wywiad/');
    expect(urls).toContain('https://prodetektyw.pl/windykacja-naleznosci-terenowa/');
    expect(urls.length).toBeGreaterThan(1);
  });

  it('still ranks the page named after the keyword first', () => {
    const picked = pickLinkTargets({ urls: SITE, keyword: 'prywatny detektyw', terms: TERMS });
    expect(picked[0].url).toBe('https://prodetektyw.pl/prywatny-detektyw/');
  });

  it('never offers a legal or navigational page', () => {
    const urls = pickLinkTargets({
      urls: SITE,
      keyword: 'prywatny detektyw',
      terms: [...TERMS, 'polityka prywatnosci', 'kontakt'],
    }).map((t) => t.url);

    expect(urls).not.toContain('https://prodetektyw.pl/polityka-prywatnosci/');
  });

  it('works from terms alone when the keyword shares nothing', () => {
    const urls = pickLinkTargets({ urls: SITE, keyword: 'xyz', terms: TERMS }).map((t) => t.url);
    expect(urls).toContain('https://prodetektyw.pl/osint-bialy-wywiad/');
  });
});
