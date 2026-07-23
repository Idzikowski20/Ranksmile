/**
 * Sense-check: does the target keyword match the article's angle?
 * Prevents e.g. military "wojna hybrydowa" harvest on a business-strategy article.
 */
export type KeywordArticleIntentResult = {
  onTopic: boolean;
  sense: string;
  confidence: number;
  suggestedAngle?: string;
  reason?: string;
};

export type KeywordArticleIntentInput = {
  keyword: string;
  articleTitle?: string;
  articleExcerpt?: string;
  outlineTitles?: string[];
};

const MILITARY_TOKENS =
  /\b(wojna|wojenny|militarn|armia|nato|rosja|ukrain|bro[nń]|geopolity|konflikt zbrojn|hybrydow[ae])/gi;
const BUSINESS_TOKENS =
  /\b(firma|firm|biznes|strategi|szkoleni|resilien|zarz[aą]dz|pracownik|organizacj|leadership|change management)/gi;

function countMatches(re: RegExp, text: string): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  return (text.match(r) || []).length;
}

/**
 * Lexical heuristic gate (no LLM required). Returns off-topic when keyword sense
 * and article body clearly diverge (military vs business hybrid-war case).
 */
export function checkKeywordArticleIntent(input: KeywordArticleIntentInput): KeywordArticleIntentResult {
  const keyword = (input.keyword || '').trim();
  if (!keyword) {
    return { onTopic: false, sense: 'unknown', confidence: 0, reason: 'empty keyword' };
  }

  const corpus = [input.articleTitle, input.articleExcerpt, ...(input.outlineTitles || [])]
    .filter(Boolean)
    .join(' \n ');

  if (!corpus.trim()) {
    return { onTopic: true, sense: 'unknown', confidence: 0.4, reason: 'no article context' };
  }

  const kwMilitary = countMatches(MILITARY_TOKENS, keyword) > 0;
  const kwBusiness = countMatches(BUSINESS_TOKENS, keyword) > 0;
  const bodyMilitary = countMatches(MILITARY_TOKENS, corpus);
  const bodyBusiness = countMatches(BUSINESS_TOKENS, corpus);

  // Keyword leans conflict/hybrid-war but article is dominated by business language.
  if (kwMilitary && !kwBusiness && bodyBusiness > bodyMilitary) {
    return {
      onTopic: false,
      sense: 'business_strategy',
      confidence: 0.85,
      suggestedAngle: 'business_strategy',
      reason: 'Keyword leans military/conflict but article is business/strategy oriented',
    };
  }

  if (kwBusiness && !kwMilitary && bodyMilitary > bodyBusiness) {
    return {
      onTopic: false,
      sense: 'military_conflict',
      confidence: 0.8,
      suggestedAngle: 'military_conflict',
      reason: 'Keyword leans business but article is military/conflict oriented',
    };
  }

  return {
    onTopic: true,
    sense: bodyBusiness > bodyMilitary ? 'business' : bodyMilitary > 0 ? 'military' : 'general',
    confidence: 0.7,
  };
}
