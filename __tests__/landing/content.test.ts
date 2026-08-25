import { buildJsonLd, FAQ, PLANS, PUBLIC_ROUTES } from '../../components/landing/content';

describe('landing structured data', () => {
  const nodes = buildJsonLd();
  const byType = (type: string) => nodes.find((n) => n['@type'] === type);

  it('ships Organization, WebSite and SoftwareApplication nodes', () => {
    expect(nodes.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    nodes.forEach((n) => expect(n['@context']).toBe('https://schema.org'));
  });

  // FAQPage markup is only valid when the Q&A is visible on the page; the landing
  // follows the reference layout (no FAQ section), so the answers ship in llms.txt only.
  it('keeps FAQ content out of JSON-LD but available for llms.txt', () => {
    expect(byType('FAQPage')).toBeUndefined();
    expect(FAQ.length).toBeGreaterThan(0);
  });

  it('lists one EUR offer per sellable plan, priced from the billing source of truth', () => {
    const app = byType('SoftwareApplication') as { offers: Array<{ price: number; priceCurrency: string }> };
    expect(app.offers).toHaveLength(PLANS.length);
    PLANS.forEach((plan, i) => {
      expect(app.offers[i].price).toBe(plan.priceMonthly);
      expect(app.offers[i].priceCurrency).toBe('EUR');
    });
  });

  it('keeps the landing at the root of the public route list', () => {
    expect(PUBLIC_ROUTES[0]).toBe('/');
  });
});
