import { hashApiKey, isSealedApiKey, sealApiKey, sealedLookupPrefix, unsealApiKey } from '@/src/infrastructure/wordpress/wpApiKeySeal';

describe('wpApiKeySeal', () => {
  const raw = 'a'.repeat(64);

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
});
