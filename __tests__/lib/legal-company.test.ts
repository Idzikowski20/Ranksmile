import { LEGAL_COMPANY, LEGAL_DOCS } from '../../lib/legal/company';

describe('legal company catalog', () => {
  it('exposes launch docs with unique hrefs', () => {
    expect(LEGAL_DOCS.map((d) => d.id).sort()).toEqual(['cookies', 'dpa', 'privacy', 'terms']);
    const hrefs = LEGAL_DOCS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(LEGAL_COMPANY.lastUpdatedIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_COMPANY.privacyEmail).toContain('@');
  });
});
