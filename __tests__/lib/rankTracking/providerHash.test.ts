import { providerResponseHash, canonicalJson } from '../../../lib/rankTracking/providerHash';

describe('providerResponseHash', () => {
  it('is deterministic for same inputs', () => {
    const a = providerResponseHash({
      provider: 'dataforseo',
      locationCode: 2616,
      device: 'desktop',
      rawItems: [{ url: 'https://a.com', rank: 1 }, { url: 'https://b.com', rank: 2 }],
    });
    const b = providerResponseHash({
      provider: 'dataforseo',
      locationCode: 2616,
      device: 'desktop',
      rawItems: [{ url: 'https://a.com', rank: 1 }, { url: 'https://b.com', rank: 2 }],
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('changes when raw_items change', () => {
    const a = providerResponseHash({
      locationCode: 2616,
      device: 'desktop',
      rawItems: [{ url: 'https://a.com' }],
    });
    const b = providerResponseHash({
      locationCode: 2616,
      device: 'desktop',
      rawItems: [{ url: 'https://b.com' }],
    });
    expect(a).not.toBe(b);
  });

  it('canonicalJson sorts object keys', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
});
