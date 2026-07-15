import type { BusinessDetails } from './types';

export type ConfirmMissingField = 'name' | 'address' | 'phone' | 'directoryCategories';

const MISSING_LABELS: Record<ConfirmMissingField, string> = {
  name: 'Business name',
  address: 'Address',
  phone: 'Phone number',
  directoryCategories: 'Business categories for other directories',
};

export function getConfirmMissingFields(details: BusinessDetails): ConfirmMissingField[] {
  const missing: ConfirmMissingField[] = [];

  if (!details.name.trim()) missing.push('name');
  if (!details.address.trim()) missing.push('address');
  if (!details.phone.trim()) missing.push('phone');
  if (details.directoryCategories.length === 0) missing.push('directoryCategories');

  return missing;
}

export function isConfirmStepComplete(details: BusinessDetails): boolean {
  return getConfirmMissingFields(details).length === 0;
}

export function getConfirmMissingLabels(details: BusinessDetails): string[] {
  return getConfirmMissingFields(details).map((field) => MISSING_LABELS[field]);
}
