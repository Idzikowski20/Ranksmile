import {
  AI_VISIBILITY_NAV,
  SEO_NAV,
  SITE_SEGMENT_REDIRECTS,
  TOOLS_NAV,
  buildSiteSegmentRedirects,
  resolveSiteNav,
  siteNavigation,
} from '../../lib/navigation';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const routeAliasesCjs = require('../../lib/navigation/routeAliases.cjs') as {
  SITE_SEGMENT_REDIRECTS: ReadonlyArray<readonly [string, string]>;
  buildSiteSegmentRedirects: () => Array<{ source: string; destination: string; permanent: boolean }>;
};

describe('siteNavigation registry', () => {
  it('exposes unique ids per section', () => {
    for (const items of [SEO_NAV, TOOLS_NAV, AI_VISIBILITY_NAV]) {
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps Tools free of Audit URL', () => {
    expect(TOOLS_NAV.map((i) => i.id)).toEqual(['keyword-research', 'topic-research']);
    expect(TOOLS_NAV.some((i) => i.path.includes('audit'))).toBe(false);
  });

  it('points Search Intelligence at canonical path', () => {
    const si = SEO_NAV.find((i) => i.id === 'search-intelligence');
    expect(si?.path).toBe('search-intelligence');
    expect(si?.match).toBe('/search-intelligence');
  });

  it('resolves the same hrefs for desktop/mobile consumers', () => {
    const hrefFn = (p: string) => `/workspace/1${p}`;
    const seo = resolveSiteNav(SEO_NAV, 'example-com', hrefFn);
    expect(seo.map((l) => l.href)).toEqual(
      SEO_NAV.map((i) => `/workspace/1/sites/example-com/${i.path}`),
    );
    expect(siteNavigation.seo).toBe(SEO_NAV);
    expect(siteNavigation.tools).toBe(TOOLS_NAV);
    expect(siteNavigation.aiVisibility).toBe(AI_VISIBILITY_NAV);
  });
});

describe('routeAliases', () => {
  it('matches cjs source used by next.config', () => {
    expect([...SITE_SEGMENT_REDIRECTS]).toEqual([...routeAliasesCjs.SITE_SEGMENT_REDIRECTS]);
  });

  it('redirects rank-tracking → search-intelligence (permanent)', () => {
    const redirects = buildSiteSegmentRedirects();
    const hit = redirects.find((r) => r.source === '/sites/:domain/rank-tracking');
    expect(hit).toEqual({
      source: '/sites/:domain/rank-tracking',
      destination: '/sites/:domain/search-intelligence',
      permanent: true,
    });
    expect(routeAliasesCjs.buildSiteSegmentRedirects()).toEqual(redirects);
  });

  it('covers legacy console/insight/ideas/audit', () => {
    const map = Object.fromEntries(SITE_SEGMENT_REDIRECTS);
    expect(map).toMatchObject({
      console: 'performance',
      insight: 'performance',
      ideas: 'recommendations',
      audit: 'content-audit',
      'rank-tracking': 'search-intelligence',
    });
  });
});
