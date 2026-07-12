import {
  validateCompanyFields,
  validateTaxId,
  isValidPolishNip,
  hasFieldErrors,
} from '../../lib/checkoutValidation';

describe('checkoutValidation', () => {
  it('validates billing email format', () => {
    const errors = validateCompanyFields(
      { billingEmail: 'not-an-email', taxId: '' },
      null,
      false,
    );
    expect(errors.billingEmail).toBeTruthy();
  });

  it('accepts empty optional company fields', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: '' },
      null,
      false,
    );
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it('requires complete address when tax ID is provided', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: 'PL5270103391' },
      null,
      false,
    );
    expect(errors.address).toBeTruthy();
  });

  it('validates Polish NIP checksum', () => {
    expect(isValidPolishNip('5270103391')).toBe(true);
    expect(isValidPolishNip('1234567890')).toBe(false);
  });

  it('validates tax ID for Poland', () => {
    expect(validateTaxId('PL', 'PL5270103391')).toBeNull();
    expect(validateTaxId('PL', 'invalid')).toBeTruthy();
  });
});
