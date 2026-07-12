import { parseHttpUrl, normalizeCitationUrl } from '../../lib/safeUrl';

describe('safeUrl', () => {
  it('parses valid http URLs', () => {
    const u = parseHttpUrl('https://example.com/path');
    expect(u?.hostname).toBe('example.com');
  });

  it('rejects non-http schemes', () => {
    expect(parseHttpUrl('javascript:alert(1)')).toBeNull();
  });

  it('normalizes citation URLs', () => {
    expect(normalizeCitationUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(normalizeCitationUrl('not-a-url')).toBeNull();
  });
});
