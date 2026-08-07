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

/**
 * Someone you hire, or a business that provides it. Stems, so Polish inflection is
 * covered ("detektywa", "kancelarii", "usługi").
 */
const PROVIDER_RE = new RegExp(
  '(?:^|[^\\p{L}])(?:(?:'
  + 'detektyw|adwokat|prawnik|radca|kancelari|notariusz|komornik|'
  + 'agencj|biuro|firma|serwis|warsztat|klinik|gabinet|salon|'
  + 'hydraulik|elektryk|mechanik|ksi[eę]gow|t[łl]umacz|architekt|geodet|'
  + 'lawyer|attorney|agency|contractor|plumber|electrician|accountant|clinic'
  + ')\\p{L}*'
  // "studio" has no stem to grow on — "studiować"/"studia" are not a business.
  + '|studi(?:o|u|em)(?!\\p{L}))',
  'iu',
);

/** Hiring language that carries the same intent without naming a profession. */
const HIRE_RE = /(?:^|[^\p{L}])(?:us[łl]ug|zatrudni|wynaj|zlec|obs[łl]ug|hire|near\s+me|services?)\p{L}*/iu;

/**
 * Becoming the provider, not buying one: "jak zostać detektywem w warszawie" is a career
 * guide, "jak otworzyć biuro detektywistyczne" is a business guide. Both name a provider
 * and a city, and neither wants a sales page.
 */
const SELF_ACTION_RE = /(?:^|[^\p{L}])(?:zosta[cćn]|otworzy|otwarc|za[łl]o[zż]|become|open\s+(?:a|my|your))\p{L}*/iu;

/**
 * A Polish city in the query is the strongest local-service signal there is — nobody
 * appends a city to an informational question. Kept to the largest cities plus the
 * locative forms search actually sees ("w warszawie", "krakowie").
 */
const CITY_RE = new RegExp(
  '(?:^|[^\\p{L}])(?:'
  + 'warszaw|krak[oó]w|krakow|[łl][oó]d[zź]|wroc[łl]aw|pozna[nń]|gda[nń]sk|szczecin|'
  + 'bydgoszcz|lublin|bia[łl]ystok|katowic|gdyni|cz[eę]stochow|radom|torun|toru[nń]|'
  + 'sosnowiec|kielc|rzesz[oó]w|gliwic|zabrz|olsztyn|bielsko|bytom|ruda|tychy|opol'
  + ')\\p{L}*',
  'iu',
);

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

  const isHowTo = HOWTO_RE.test(keyword);
  // A provider plus a city, or explicit hiring language, is someone shopping for a
  // supplier. Checked before the how-to rules: "jak wybrać detektywa w warszawie" is
  // still a hiring query, and answering it with a generic action plan misses what the
  // ranking pages actually are. Two things it is not: becoming the provider yourself,
  // and a how-to that merely happens to use a hiring verb ("jak wynająć mieszkanie…"),
  // where hire+city is the only evidence there is.
  const looksLocalService = !SELF_ACTION_RE.test(keyword) && (
    (PROVIDER_RE.test(keyword) && CITY_RE.test(keyword))
    || (PROVIDER_RE.test(keyword) && HIRE_RE.test(keyword))
    || (!isHowTo && HIRE_RE.test(keyword) && CITY_RE.test(keyword))
  );

  // Price and comparison first: "ile kosztuje detektyw w warszawie" is a commercial
  // question with an answer, not a request for our sales page.
  if (PRICE_RE.test(keyword) || COMPARE_RE.test(keyword)) {
    primaryIntent = 'commercial';
    articleType = 'comparison';
  } else if (looksLocalService) {
    primaryIntent = 'commercial';
    articleType = 'service';
    narrativePreference = 'problem_solution';
  } else if (isHowTo || HELP_RE.test(keyword) || SELF_ACTION_RE.test(keyword)) {
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
