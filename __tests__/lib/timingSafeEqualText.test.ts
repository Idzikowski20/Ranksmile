import { timingSafeEqualText } from '@/src/infrastructure/crypto/timingSafeEqualText';

describe('timingSafeEqualText', () => {
  it('accepts equal strings of any length', () => {
    expect(timingSafeEqualText('sekret', 'sekret')).toBe(true);
    expect(timingSafeEqualText('', '')).toBe(true);
  });

  it('rejects a matching prefix or a different length', () => {
    expect(timingSafeEqualText('sekret', 'sekre')).toBe(false);
    expect(timingSafeEqualText('sekret', 'sekretx')).toBe(false);
    expect(timingSafeEqualText('a', 'b')).toBe(false);
  });
});
