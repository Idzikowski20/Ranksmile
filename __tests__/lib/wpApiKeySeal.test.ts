import { hashApiKey, isSealedApiKey, sealApiKey, sealedLookupPrefix, unsealApiKey } from '@/src/infrastructure/wordpress/wpApiKeySeal';

describe('wpApiKeySeal', () => {
  const raw = 'a'.repeat(64);
  const OLD = process.env.WP_API_KEY_SECRET;

  beforeEach(() => {
    process.env.WP_API_KEY_SECRET = 'test-wp-key-secret';
  });

  afterEach(() => {
    if (OLD === undefined) delete process.env.WP_API_KEY_SECRET;
    else process.env.WP_API_KEY_SECRET = OLD;
  });

  it('round-trips a key and never stores the raw secret', () => {
    const sealed = sealApiKey(raw);
    expect(isSealedApiKey(sealed)).toBe(true);
    expect(sealed.includes(raw)).toBe(false);
    expect(unsealApiKey(sealed)).toBe(raw);
    expect(sealed.startsWith(sealedLookupPrefix(raw))).toBe(true);
    expect(hashApiKey(raw)).toHaveLength(64);
  });

  it('returns plaintext unchanged for a legacy row', () => {
    expect(unsealApiKey(raw)).toBe(raw);
    expect(isSealedApiKey(raw)).toBe(false);
  });

  it('returns null for a tampered sealed blob', () => {
    const sealed = sealApiKey(raw);
    expect(unsealApiKey(`${sealed}00`)).toBeNull();
  });

  it('returns null for a structurally truncated blob', () => {
    const sealed = sealApiKey(raw);
    expect(unsealApiKey(sealed.split(':').slice(0, 4).join(':'))).toBeNull();
  });

  it('returns null when decrypted with a different secret', () => {
    const sealed = sealApiKey(raw);
    process.env.WP_API_KEY_SECRET = 'other-wp-key-secret';
    expect(unsealApiKey(sealed)).toBeNull();
  });

  it('fails closed when WP_API_KEY_SECRET is missing', () => {
    delete process.env.WP_API_KEY_SECRET;
    expect(() => sealApiKey(raw)).toThrow(/WP_API_KEY_SECRET/);
  });
});
