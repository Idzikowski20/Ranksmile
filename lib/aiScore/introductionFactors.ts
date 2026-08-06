import type { FactorName, ScoreFactor } from './factors';

/** Surfer judges the opening hard; only the first few sentences count as introduction. */
const INTRO_SENTENCE_LIMIT = 6;

function introSentences(html: string): string[] {
  const withoutHeadings = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  const text = withoutHeadings.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, INTRO_SENTENCE_LIMIT);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** First sentence containing the most terms; the span is returned verbatim. */
function findSpan(sentences: string[], terms: string[]): { span?: string; hits: number } {
  const wanted = terms.map(normalize).filter(Boolean);
  if (!wanted.length) return { hits: 0 };
  let best: { span: string; hits: number } | null = null;
  for (const sentence of sentences) {
    const haystack = normalize(sentence);
    const hits = wanted.filter((term) => haystack.includes(term)).length;
    if (hits && (!best || hits > best.hits)) best = { span: sentence, hits };
  }
  return best ? { span: best.span, hits: best.hits } : { hits: 0 };
}

function factor(name: FactorName, span: string | undefined, score: number): ScoreFactor {
  if (!span) return { name, found: false, score: 0 };
  return { name, found: true, score: Math.min(1, score), textSpan: span };
}

// eslint-disable-next-line import/prefer-default-export
export function scoreIntroduction(opts: {
  html: string;
  keyword: string;
  coveredTopics: string[];
  audienceTerms: string[];
}): ScoreFactor[] {
  const sentences = introSentences(opts.html);
  const keywordTerms = opts.keyword.split(/\s+/).filter((word) => word.length > 2);

  const topics = findSpan(sentences, opts.coveredTopics);
  const audience = findSpan(sentences, opts.audienceTerms);
  // "Early" means the first two sentences: the answer has to be up front.
  const early = findSpan(sentences.slice(0, 2), keywordTerms);
  const relevance = findSpan(sentences, keywordTerms);

  return [
    factor(
      'INTRODUCTION_COVERED_TOPICS',
      topics.span,
      opts.coveredTopics.length ? topics.hits / opts.coveredTopics.length : 0,
    ),
    factor(
      'INTRODUCTION_TARGET_AUDIENCE',
      audience.span,
      opts.audienceTerms.length ? audience.hits / opts.audienceTerms.length : 0,
    ),
    factor(
      'INTRODUCTION_EARLY_QUERY_ANSWER',
      early.span,
      keywordTerms.length ? early.hits / keywordTerms.length : 0,
    ),
    factor(
      'INTRODUCTION_TOPIC_RELEVANCE',
      relevance.span,
      keywordTerms.length ? relevance.hits / keywordTerms.length : 0,
    ),
  ];
}
