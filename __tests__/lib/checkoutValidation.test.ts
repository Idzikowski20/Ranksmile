import {
  validateCompanyFields,
  validateTaxId,
  isValidPolishNip,
  hasFieldErrors,
  hasRequiredBillingAddressFields,
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

  it('accepts empty optional invoice fields when address is complete', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: '' },
      {
        name: 'Ada Lovelace',
        address: {
          line1: '1 Main St',
          line2: null,
          city: 'Warsaw',
          state: '',
          postal_code: '00-001',
          country: 'PL',
        },
      },
      true,
    );
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it('requires complete billing address for payment', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: '' },
      null,
      false,
    );
    expect(errors.address).toBeTruthy();
  });

  it('accepts tax ID when billing address is complete', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: 'PL5270103391' },
      {
        name: 'Ada Lovelace',
        address: {
          line1: '1 Main St',
          line2: null,
          city: 'Warsaw',
          state: '',
          postal_code: '00-001',
          country: 'PL',
        },
      },
      true,
    );
    expect(errors.address).toBeUndefined();
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it('validates Polish NIP checksum', () => {
    expect(isValidPolishNip('5270103391')).toBe(true);
    expect(isValidPolishNip('1234567890')).toBe(false);
  });

  it('rejects address marked complete when street/city/postal are missing', () => {
    const errors = validateCompanyFields(
      { billingEmail: '', taxId: '' },
      {
        name: 'Ada',
        address: {
          line1: '',
          line2: null,
          city: '',
          state: '',
          postal_code: '',
          country: 'DE',
        },
      },
      true,
    );
    expect(errors.address).toMatch(/street|city|postal/i);
  });

  it('hasRequiredBillingAddressFields requires line1, city, postal, country', () => {
    expect(hasRequiredBillingAddressFields({
      name: 'A',
      address: {
        line1: 'Street 1',
        line2: null,
        city: 'Berlin',
        state: '',
        postal_code: '10115',
        country: 'DE',
      },
    })).toBe(true);
    expect(hasRequiredBillingAddressFields({
      name: 'A',
      address: {
        line1: 'Street 1',
        line2: null,
        city: '',
        state: '',
        postal_code: '10115',
        country: 'DE',
      },
    })).toBe(false);
  });
});
