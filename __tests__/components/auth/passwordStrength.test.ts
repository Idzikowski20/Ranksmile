import {
  calculateStrength,
  PASSWORD_STRENGTH_MAX_SCORE,
} from '../../../components/auth/passwordStrength';

describe('calculateStrength', () => {
  it('returns empty for blank password', () => {
    const r = calculateStrength('');
    expect(r.score).toBe(0);
    expect(r.level).toBe('empty');
  });

  it('marks short lowercase-only as weak', () => {
    const r = calculateStrength('abc');
    expect(r.level).toBe('weak');
    expect(r.checks.minLength).toBe(false);
  });

  it('scores variety and length toward very-strong', () => {
    const r = calculateStrength('Abcdef1!');
    expect(r.score).toBe(PASSWORD_STRENGTH_MAX_SCORE - 1); // length>8 false (exactly 8)
    expect(r.level).toBe('strong');
    expect(r.checks.minLength).toBe(true);
    expect(r.checks.uppercase).toBe(true);
    expect(r.checks.lowercase).toBe(true);
    expect(r.checks.number).toBe(true);
    expect(r.checks.special).toBe(true);
  });

  it('reaches very-strong when length > 8 and all variety rules pass', () => {
    const r = calculateStrength('Abcdefg1!');
    expect(r.score).toBe(PASSWORD_STRENGTH_MAX_SCORE);
    expect(r.level).toBe('very-strong');
  });
});
