import { buildGscDigest, DomainDigest } from '../../lib/gscDigestEmail';

const domain: DomainDigest = {
  domain: 'soze.pl',
  summary: { clicks: 80, prevClicks: 100, impressions: 900, prevImpressions: 1000, pagesFell: 2, pagesGrew: 1 },
  tiers: {
    droppedInTop10: [{ page: '/oferta', prevPos: 4, nowPos: 9, clicks: 5, prevClicks: 20 }],
    droppedATier: [],
    outOfIndex: [{ page: '/blog/x', prevPos: 12, nowPos: null, clicks: 0, prevClicks: 3 }],
    growth: [],
  },
};

describe('buildGscDigest', () => {
  it('renders org name, domain, the dropped page and prev->now', () => {
    const html = buildGscDigest({ orgName: 'Idztech', domains: [domain] });
    expect(html).toContain('Idztech');
    expect(html).toContain('soze.pl');
    expect(html).toContain('/oferta');
    expect(html).toContain('4'); expect(html).toContain('9'); // prev -> now
    expect(html).toContain('-20%'); // clicks WoW
    expect(html).toContain('Out of index');
  });
});
