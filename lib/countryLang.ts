// Country → SERP language for the Audit tool. The picked country ("Results for …") drives
// the language sent to the sidecar /competitor-outlines + /analyze-serp calls, so the
// competitor SERP + NLP terms match the target market. Codes align with DataForSEO's
// LOCATION_CODES (lib/dataforseo.ts).

export interface AuditCountry { code: string; name: string; flag: string; lang: string; }

export const AUDIT_COUNTRIES: AuditCountry[] = [
   { code: 'PL', name: 'Poland', flag: '🇵🇱', lang: 'pl' },
   { code: 'US', name: 'United States', flag: '🇺🇸', lang: 'en' },
   { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', lang: 'en' },
   { code: 'DE', name: 'Germany', flag: '🇩🇪', lang: 'de' },
   { code: 'FR', name: 'France', flag: '🇫🇷', lang: 'fr' },
   { code: 'ES', name: 'Spain', flag: '🇪🇸', lang: 'es' },
   { code: 'IT', name: 'Italy', flag: '🇮🇹', lang: 'it' },
   { code: 'NL', name: 'Netherlands', flag: '🇳🇱', lang: 'nl' },
   { code: 'PT', name: 'Portugal', flag: '🇵🇹', lang: 'pt' },
];

const BY_CODE = new Map(AUDIT_COUNTRIES.map((c) => [c.code.toUpperCase(), c]));

/** Language for a country code (defaults to English for unknown codes). */
export function langForCountry(code: string | null | undefined): string {
   return BY_CODE.get((code || '').toUpperCase())?.lang || 'en';
}

const BY_LANG = new Map(AUDIT_COUNTRIES.map((c) => [c.lang, c]));

/** Default country for a language code (prefers US for English). */
export function countryForLang(lang: string | null | undefined): string {
   const code = (lang || '').toLowerCase();
   if (code === 'en') return 'US';
   return BY_LANG.get(code)?.code || 'US';
}

export const LANG_OPTIONS = [
   { value: 'pl', label: 'Polski' },
   { value: 'en', label: 'English' },
   { value: 'de', label: 'Deutsch' },
   { value: 'fr', label: 'Français' },
   { value: 'es', label: 'Español' },
   { value: 'it', label: 'Italiano' },
   { value: 'nl', label: 'Nederlands' },
   { value: 'pt', label: 'Português' },
] as const;
