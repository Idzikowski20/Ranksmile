import {
  getConfirmMissingFields,
  getConfirmMissingLabels,
  isConfirmStepComplete,
} from '../../lib/local/confirmBusinessDetails';
import type { BusinessDetails } from '../../lib/local/types';

const baseDetails: BusinessDetails = {
  name: 'Bloom Flowers',
  address: 'Cybernetyki 15, Warszawa',
  phone: '+48 123 456 789',
  website: '',
  description: '',
  hideAddress: false,
  deliversLocally: false,
  serviceAreas: [],
  googleCategories: [],
  directoryCategories: [],
  photoUrls: [],
  hours: [],
};

describe('confirmBusinessDetails', () => {
  it('flags missing directory categories from Serper import', () => {
    const missing = getConfirmMissingFields(baseDetails);
    expect(missing).toEqual(['directoryCategories']);
    expect(isConfirmStepComplete(baseDetails)).toBe(false);
  });

  it('is complete when required general fields and categories are set', () => {
    const complete = {
      ...baseDetails,
      directoryCategories: ['Florist'],
    };
    expect(getConfirmMissingFields(complete)).toEqual([]);
    expect(isConfirmStepComplete(complete)).toBe(true);
  });

  it('returns human-readable missing labels', () => {
    expect(getConfirmMissingLabels({ ...baseDetails, name: '', phone: '' })).toEqual([
      'Business name',
      'Phone number',
      'Business categories for other directories',
    ]);
  });
});
