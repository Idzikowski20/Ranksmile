import { z } from 'zod';

export interface CheckoutCompanyInput {
  billingEmail: string;
  taxId: string;
}

export interface CheckoutAddressValue {
  name: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

export type CheckoutFieldErrors = Partial<Record<'billingEmail' | 'taxId' | 'address', string>>;

const emailSchema = z.string().email('Enter a valid email address').max(254);

export function normalizeTaxId(value: string): string {
  return value.replace(/[\s.-]/g, '').toUpperCase();
}

/** Poland NIP — 10 digits with optional PL prefix. */
export function isValidPolishNip(value: string): boolean {
  const digits = normalizeTaxId(value).replace(/^PL/, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  return sum % 11 === Number(digits[9]);
}

/** EU VAT — loose check: 2-letter country + 8–12 alphanumeric. */
export function isValidEuVat(value: string): boolean {
  const v = normalizeTaxId(value);
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(v);
}

export function validateTaxId(country: string, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const normalized = normalizeTaxId(value);

  if (country === 'PL') {
    if (isValidPolishNip(normalized) || isValidEuVat(normalized.startsWith('PL') ? normalized : `PL${normalized}`)) {
      return null;
    }
    return 'Enter a valid Polish NIP or VAT number (e.g. PL1234567890)';
  }

  if (isValidEuVat(normalized)) return null;
  if (/^[A-Z0-9-]{5,20}$/i.test(value)) return null;
  return 'Enter a valid tax ID for the selected country';
}

export function validateCompanyFields(
  input: CheckoutCompanyInput,
  address: CheckoutAddressValue | null,
  addressComplete: boolean,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const billingEmail = input.billingEmail.trim();
  const taxId = input.taxId.trim();

  if (billingEmail) {
    const parsed = emailSchema.safeParse(billingEmail);
    if (!parsed.success) errors.billingEmail = parsed.error.errors[0]?.message ?? 'Invalid email';
  }

  const wantsInvoiceDetails = Boolean(billingEmail || taxId);
  const hasAddressData = Boolean(
    address?.address.line1?.trim()
    || address?.address.city?.trim()
    || address?.address.postal_code?.trim(),
  );

  if (taxId) {
    const country = address?.address.country ?? '';
    if (!country) {
      errors.address = 'Select a complete billing address before adding a tax ID';
    } else {
      const taxError = validateTaxId(country, taxId);
      if (taxError) errors.taxId = taxError;
    }
    if (!addressComplete) {
      errors.address = errors.address ?? 'Complete the billing address to add a tax ID';
    }
  }

  if (wantsInvoiceDetails && (hasAddressData || taxId) && !addressComplete) {
    errors.address = errors.address ?? 'Complete all required address fields';
  }

  return errors;
}

export function hasFieldErrors(errors: CheckoutFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function stripeTaxIdType(country: string): 'eu_vat' | 'gb_vat' | 'us_ein' {
  if (country === 'GB') return 'gb_vat';
  if (country === 'US') return 'us_ein';
  return 'eu_vat';
}

export function formatTaxIdForStripe(country: string, raw: string): string {
  const normalized = normalizeTaxId(raw);
  if (stripeTaxIdType(country) === 'eu_vat' && !/^[A-Z]{2}/.test(normalized)) {
    return `${country}${normalized}`;
  }
  return normalized;
}
