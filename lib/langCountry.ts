/** Map article/UI language code to DataForSEO country code. */
const LANG_TO_COUNTRY: Record<string, string> = {
  pl: 'PL',
  en: 'US',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  nl: 'NL',
  pt: 'PT',
};

export function countryForLanguage(language?: string | null): string {
  const lang = (language || 'en').toLowerCase().split(/[-_]/)[0];
  return LANG_TO_COUNTRY[lang] || 'US';
}

export function languageForCountry(country?: string | null): string {
  const map: Record<string, string> = {
    PL: 'pl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl', PT: 'pt',
    US: 'en', GB: 'en',
  };
  return map[(country || 'US').toUpperCase()] || 'en';
}
