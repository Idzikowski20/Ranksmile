import {
  evaluatePasswordRules,
  passwordRulesComplete,
  passwordRulesPassed,
} from '../../components/koala/forms/PasswordStrength';

describe('evaluatePasswordRules', () => {
  it('requires length, special, and number', () => {
    expect(evaluatePasswordRules('short')).toEqual({
      minLength: false,
      special: false,
      number: false,
    });
    expect(evaluatePasswordRules('longenough')).toEqual({
      minLength: true,
      special: false,
      number: false,
    });
    expect(evaluatePasswordRules('longenough!')).toEqual({
      minLength: true,
      special: true,
      number: false,
    });
    const ok = evaluatePasswordRules('longenough!1');
    expect(ok).toEqual({ minLength: true, special: true, number: true });
    expect(passwordRulesComplete(ok)).toBe(true);
    expect(passwordRulesPassed(ok)).toBe(3);
  });
});
