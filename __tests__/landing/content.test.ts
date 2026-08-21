import { buildJsonLd, FAQ, PLANS, PUBLIC_ROUTES } from '../../components/landing/content';

describe('landing structured data', () => {
  const nodes = buildJsonLd();
  const byType = (type: string) => nodes.find((n) => n['@type'] === type);

  it('ships Organization, WebSite, SoftwareApplication and FAQPage nodes', () => {
    expect(nodes.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']);
    nodes.forEach((n) => expect(n['@context']).toBe('https://schema.org'));
  });

  it('mirrors every FAQ entry into FAQPage', () => {
    const faq = byType('FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    expect(faq.mainEntity[0].name).toBe(FAQ[0].q);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(FAQ[0].a);
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
