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
  it('renders performance-report layout with CID images, no org label or deep-link CTA', () => {
    const html = buildGscDigest({ orgName: 'Idztech', domains: [domain] });
    expect(html).not.toContain('Idztech');
    expect(html).not.toContain("View this week's report");
    expect(html).toContain('Weekly Ranksmile Performance for soze.pl');
    expect(html).toContain('Total Impressions');
    expect(html).toContain('Total Clicks');
    expect(html).toContain('/oferta');
    expect(html).toContain('-5');
    expect(html).toContain('-20');
    expect(html).toContain('Deindexed pages');
    expect(html).toContain('Dropped in ranking');
    expect(html).toContain('https://ranksmile.pl/email/ranksmile-logo.png');
    expect(html).toContain('https://ranksmile.pl/email/eye.png');
    expect(html).toContain('https://ranksmile.pl/email/cursor-arrow-rays.png');
    expect(html).not.toContain('cid:');
    expect(html).not.toContain('Weekly search report');
  });
});
