import {
  applySuggestedCategories,
  applySuggestedDescription,
  getPrimaryCategory,
  getSuggestedCategories,
  getSuggestedDescription,
  hasCategorySuggestions,
  isPolishDescription,
} from '../../lib/local/growthActions';
import type { BusinessDetails } from '../../lib/local/types';

const AODC_DETAILS: BusinessDetails = {
  name: 'AODC Sp. z o.o.',
  address: 'Działkowa 37, Warszawa, 02-234, PL',
  phone: '+48 22 846 35 15',
  website: 'http://www.aodc.pl/',
  description:
    'AoDC (Art of Data Center) to zespół inżynierów z 20 letnim doświadczeniem w projektowaniu, budowaniu i serwisowaniu obiektów Data Center dla instytucji publicznych i komercyjnych w Polsce.',
  hideAddress: false,
  deliversLocally: true,
  serviceAreas: [],
  googleCategories: ['Siedziba firmy'],
  directoryCategories: [],
  photoUrls: [],
  hours: [],
};

describe('growthActions', () => {
  it('maps primary category to English label', () => {
    expect(getPrimaryCategory(AODC_DETAILS)).toBe('Corporate office');
  });

  it('suggests engineering categories for data center businesses', () => {
    const suggested = getSuggestedCategories(AODC_DETAILS);
    expect(suggested).toContain('Engineering consultant');
    expect(suggested).toContain('HVAC contractor');
    expect(suggested).not.toContain('Corporate office');
  });

  it('generates SEO description in Polish when source is Polish', () => {
    const suggested = getSuggestedDescription(AODC_DETAILS);
    expect(suggested).toContain('AODC Sp. z o.o.');
    expect(suggested).toContain('inżynierów');
    expect(suggested).toContain('jakość');
    expect(suggested).not.toContain('20 years of expertise');
    expect(isPolishDescription(suggested)).toBe(true);
  });

  it('generates SEO description in English when source is English', () => {
    const englishDetails: BusinessDetails = {
      ...AODC_DETAILS,
      description: 'AODC is a team of engineers with 20 years of experience in data centers.',
    };
    const suggested = getSuggestedDescription(englishDetails);
    expect(suggested).toContain('quality and innovation');
    expect(isPolishDescription(suggested)).toBe(false);
  });

  it('persists suggested categories into business details', () => {
    const next = applySuggestedCategories(AODC_DETAILS, ['Engineering consultant', 'HVAC contractor']);
    expect(next.googleCategories).toEqual([
      'Siedziba firmy',
      'Engineering consultant',
      'HVAC contractor',
    ]);
    expect(next.directoryCategories).toContain('Engineering consultant');
  });

  it('persists suggested description into business details', () => {
    const next = applySuggestedDescription(AODC_DETAILS, 'Nowy opis firmy w języku polskim.');
    expect(next.description).toBe('Nowy opis firmy w języku polskim.');
  });

  it('keeps suggesting new categories after earlier saves', () => {
    const firstBatch = getSuggestedCategories(AODC_DETAILS);
    expect(firstBatch.length).toBeGreaterThanOrEqual(3);

    const afterSave = applySuggestedCategories(AODC_DETAILS, firstBatch);
    const secondBatch = getSuggestedCategories(afterSave);

    expect(secondBatch.length).toBeGreaterThan(0);
    expect(secondBatch.some((cat) => !firstBatch.includes(cat))).toBe(true);
    expect(hasCategorySuggestions(afterSave)).toBe(true);
  });
});
