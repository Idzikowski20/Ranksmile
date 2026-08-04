/**
 * Intent Blueprint — search intent before competitor scrape.
 */
import type { ArticleType, IntentBlueprint } from './types';

const HOWTO_RE = /\b(jak|how to|guide|przewodnik|krok)\b/i;
const PRICE_RE = /\b(cena|koszt|price|ile kosztuje|cennik)\b/i;
const COMPARE_RE = /\b(vs|versus|porówn|alternatyw|best)\b/i;

export function buildIntentBlueprint(opts: {
  keyword: string;
  year?: number;
  allowBrandNiche?: boolean;
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
  } else if (HOWTO_RE.test(keyword)) {
    articleType = 'step-by-step';
    narrativePreference = 'step_by_step';
  }

  const first60sQuestions = [
    `Jak zacząć: ${keyword}?`,
    'Ile to trwa?',
    'Czy mogę zrobić to sam?',
    'Ile to kosztuje?',
  ];

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
