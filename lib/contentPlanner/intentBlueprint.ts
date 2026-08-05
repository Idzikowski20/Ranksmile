/**
 * Intent Blueprint — search intent before competitor scrape.
 */
import type { ArticleType, IntentBlueprint } from './types';

// Stem through inflection (PL: cennika, porównanie) — Unicode letter boundary, not \b after stem.
const HOWTO_RE = /(?:^|[^\p{L}])(?:jak|how\s+to|guide|przewodnik|krok)\p{L}*/iu;
const PRICE_RE = /(?:^|[^\p{L}])(?:cena|koszt|cennik|price|ile\s+kosztuje)\p{L}*/iu;
const COMPARE_RE = /(?:^|[^\p{L}])(?:vs|versus|porówn|alternatyw|best)\p{L}*/iu;

function detectKeywordLang(keyword: string, languageHint?: string): 'pl' | 'en' {
  const hint = (languageHint || '').toLowerCase();
  if (hint.startsWith('pl')) return 'pl';
  if (hint.startsWith('en')) return 'en';
  if (/[ąćęłńóśźż]/i.test(keyword)) return 'pl';
  if (/\b(jak|ile|czy|koszt|cena|porówn|przewodnik|krok)\b/i.test(keyword)) return 'pl';
  if (/\b(how|what|why|best|price|cost|guide|vs)\b/i.test(keyword)) return 'en';
  // Bare Latin token without English cues → prefer PL when not explicitly EN
  // (ASCII-folded Polish queries like "szantaz").
  if (!/\s/.test(keyword.trim()) && !/\b(the|and|for|with|your)\b/i.test(keyword)) {
    return 'pl';
  }
  return 'en';
}

/** Crisis / help-seeking queries → step-by-step even without "jak". */
const HELP_RE = /(?:^|[^\p{L}])(?:szanta[zż]|blackmail|ofiar|pomoc|policj|zg[łl]osz|gro[zź]b|wymuszen)\p{L}*/iu;

function first60sForLang(keyword: string, lang: 'pl' | 'en'): string[] {
  if (lang === 'en') {
    return [
      `How do I start with ${keyword}?`,
      'How long does it take?',
      'Can I do this myself?',
      'How much does it cost?',
    ];
  }
  return [
    `Jak zacząć: ${keyword}?`,
    'Ile to trwa?',
    'Czy mogę zrobić to sam?',
    'Ile to kosztuje?',
  ];
}

export function buildIntentBlueprint(opts: {
  keyword: string;
  year?: number;
  allowBrandNiche?: boolean;
  /** Article/domain language — fixes bare ASCII keywords like "szantaz". */
  language?: string;
}): IntentBlueprint {
  const keyword = opts.keyword.trim();
  const year = opts.year ?? new Date().getFullYear();
  let articleType: ArticleType = 'guide';
  let narrativePreference: IntentBlueprint['narrativePreference'] = 'problem_solution';
  let primaryIntent: IntentBlueprint['primaryIntent'] = 'informational';

  if (PRICE_RE.test(keyword)) {
    primaryIntent = 'commercial';
    articleType = 'comparison';
  } else if (COMPARE_RE.test(keyword)) {
    primaryIntent = 'commercial';
    articleType = 'comparison';
  } else if (HOWTO_RE.test(keyword) || HELP_RE.test(keyword)) {
    articleType = 'step-by-step';
    narrativePreference = 'step_by_step';
  }

  const lang = detectKeywordLang(keyword, opts.language);
  const first60sQuestions = first60sForLang(keyword, lang);

  return {
    keyword,
    primaryIntent,
    articleType,
    first60sQuestions,
    narrativePreference,
    allowBrandNiche: opts.allowBrandNiche === true,
    yearHint: year,
  };
}
