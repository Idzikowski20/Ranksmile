export function looksPolish(text: string): boolean {
  return /[ąćęłńóśźż]/i.test(text);
}

/** Map domain / article language values to DataForSEO `language_code` (ISO 639-1). */
export function toDfsLanguageCode(raw: string | null | undefined, fallback = 'en'): string {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return fallback;

  const NAME_TO_CODE: Record<string, string> = {
    polish: 'pl', polski: 'pl',
    english: 'en',
    german: 'de', deutsch: 'de',
    french: 'fr', français: 'fr', francais: 'fr',
    spanish: 'es', español: 'es', espanol: 'es',
    italian: 'it', italiano: 'it',
    dutch: 'nl', nederlands: 'nl',
    portuguese: 'pt', 'brazilian portuguese': 'pt',
    swedish: 'sv', norwegian: 'no', danish: 'da', finnish: 'fi',
    czech: 'cs', slovak: 'sk', ukrainian: 'uk', romanian: 'ro',
    hungarian: 'hu', turkish: 'tr', greek: 'el', japanese: 'ja',
  };

  if (s.length === 2 && Object.values(NAME_TO_CODE).includes(s)) return s;
  if (NAME_TO_CODE[s]) return NAME_TO_CODE[s];
  if (s.startsWith('pol')) return 'pl';
  if (s.startsWith('eng')) return 'en';
  if (s.startsWith('ger') || s.startsWith('deu')) return 'de';
  return fallback;
}

export function languageInstructionForLlm(languageCode: string): string {
  const names: Record<string, string> = {
    pl: 'Polish (polski)', en: 'English', de: 'German', fr: 'French',
    es: 'Spanish', it: 'Italian', nl: 'Dutch', pt: 'Portuguese',
  };
  const code = languageCode.toLowerCase().slice(0, 2);
  return ` Write ALL topic titles and summaries in ${names[code] || 'English'}.`;
}

const ENGLISH_TOPIC_SIGNAL = /\b(and|or|the|services|threats|harassment|detective|infidelity|cuckolding|warsaw)\b/i;

/** True when stored topic titles look like the wrong language for the domain locale. */
export function topicsNeedLocalization(titles: string[], languageCode: string): boolean {
  if (!titles.length) return false;
  const code = languageCode.toLowerCase().slice(0, 2);
  if (code !== 'pl') return false;
  const englishish = titles.filter((t) => ENGLISH_TOPIC_SIGNAL.test(t) && !looksPolish(t)).length;
  return englishish >= Math.max(1, Math.ceil(titles.length / 2));
}

export function looksLikeLanguage(text: string, languageCode: string): boolean {
  const code = languageCode.toLowerCase().slice(0, 2);
  if (code === 'pl') return looksPolish(text);
  if (code === 'en') return /\b(the|what|how|best|which|worth|cost)\b/i.test(text);
  return true;
}

export function polishPromptTemplates(topic: string): Array<{ text: string; provenance: string[] }> {
  const base = topic.trim();
  return [
    { text: `Jakie są najlepsze rozwiązania w temacie: ${base}?`, provenance: [] },
    { text: `${base} — co warto wiedzieć przed wyborem?`, provenance: [] },
    { text: `Które firmy polecacie w temacie: ${base}?`, provenance: [] },
    { text: `${base}: porównanie opcji i ceny`, provenance: [] },
    { text: `Jak zacząć i na co uważać przy: ${base}?`, provenance: [] },
    { text: `Ile kosztuje ${base} i od czego zależy cena?`, provenance: [] },
    { text: `Czy warto skorzystać z usług związanych z: ${base}?`, provenance: [] },
    { text: `Jak wybrać najlepszą ofertę: ${base}?`, provenance: [] },
  ];
}

export function englishPromptTemplates(topic: string): Array<{ text: string; provenance: string[] }> {
  const base = topic.trim();
  return [
    { text: `What are the best options for ${base}?`, provenance: [] },
    { text: `${base} — what should I know before choosing?`, provenance: [] },
    { text: `Which companies do you recommend for ${base}?`, provenance: [] },
    { text: `${base}: compare options and pricing`, provenance: [] },
    { text: `How to get started with ${base} and what to watch out for?`, provenance: [] },
    { text: `How much does ${base} cost and what affects the price?`, provenance: [] },
    { text: `Is ${base} worth it?`, provenance: [] },
    { text: `How to choose the best ${base} offer?`, provenance: [] },
  ];
}

export function promptTemplatesForLocale(
  languageCode: string,
  topic: string,
): Array<{ text: string; provenance: string[] }> {
  return languageCode.toLowerCase().slice(0, 2) === 'pl'
    ? polishPromptTemplates(topic)
    : englishPromptTemplates(topic);
}
