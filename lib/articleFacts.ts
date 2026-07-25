/**
 * Ranksmile-style Facts pipeline — factual statements from DataForSEO People Also Ask.
 * No synthetic citation templates ("X czy warto?") — only real SERP questions + answers.
 */
import { getPeopleAlsoAsk, isDataForSeoConfigured } from './dataforseo';
import { hashId, type CoverageItem } from './aiCoverage';
import { cached, TTL } from './cache/fileCache';
import { isCorpusNoiseSentence } from './corpusNoiseFilter';
import { resolveFactKeyword } from './resolveFactKeyword';
import { isKeywordOnTopic, seedTokens } from './topicRelevance';
import { isDictionaryQueryNoise } from './termUtils';
import { factReadinessScore } from './factReadiness';
import type { AiCitation, AiVisibilitySummary } from './aiSearchScore';
import type { ArticleFact } from './articleFactTypes';

export type { ArticleFact, FactSourceKind } from './articleFactTypes';
export { factReadinessScore } from './factReadiness';

export function splitFactSentences(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 220);
}

function normKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function mergeFact(
  map: Map<string, ArticleFact>,
  text: string,
  source: ArticleFact['sources'][0],
): void {
  const t = text.trim();
  if (t.length < 20) return;
  const key = normKey(t);
  const prev = map.get(key);
  if (prev) {
    prev.sourceFrequency += 1;
    const sk = `${source.kind}:${source.url || source.domain || ''}`;
    if (!prev.sources.some((s) => `${s.kind}:${s.url || s.domain || ''}` === sk)) {
      prev.sources.push(source);
    }
    return;
  }
  map.set(key, {
    id: `fact-${hashId(t)}`,
    text: t,
    sourceFrequency: 1,
    sources: [source],
  });
}

/** Fetch facts from DataForSEO PAA answers for the resolved keyword. */
export async function fetchArticleFacts(opts: {
  keyword: string;
  corpusTexts?: string[];
  articleText?: string;
  title?: string;
  pageUrl?: string;
  country?: string;
  languageCode?: string;
  /** When set, skip resolveFactKeyword (caller already resolved). */
  resolvedKeyword?: string;
}): Promise<ArticleFact[]> {
  const articleText = opts.articleText || opts.corpusTexts?.join(' ') || '';
  const keyword = opts.resolvedKeyword ?? resolveFactKeyword({
    keyword: opts.keyword,
    articleText,
    title: opts.title,
    pageUrl: opts.pageUrl,
  });
  if (!keyword.trim()) return [];

  return cached({
    namespace: 'article-facts',
    key: [keyword.toLowerCase(), opts.country || 'PL', opts.languageCode || 'pl', hashId(articleText)],
    ttlMs: TTL.SERP,
    producer: () => fetchArticleFactsUncached({ ...opts, keyword, articleText }),
  });
}

function factMatchesArticle(factText: string, keyword: string, articleText: string): boolean {
  if (isCorpusNoiseSentence(factText)) return false;
  if (isDictionaryQueryNoise(factText)) return false;
  if (isKeywordOnTopic(factText, keyword)) return true;
  if (factReadinessScore(articleText, factText) >= 35) return true;
  const seeds = seedTokens(keyword);
  const low = factText.toLowerCase();
  return seeds.filter((s) => low.includes(s)).length >= 2;
}

function paaQuestionPasses(question: string, keyword: string): boolean {
  const q = question.trim();
  if (q.length < 10 || isDictionaryQueryNoise(q)) return false;
  return isKeywordOnTopic(q, keyword);
}

async function fetchArticleFactsUncached(opts: {
  keyword: string;
  corpusTexts?: string[];
  articleText?: string;
  country?: string;
  languageCode?: string;
}): Promise<ArticleFact[]> {
  const map = new Map<string, ArticleFact>();
  const keyword = opts.keyword.trim();
  const country = opts.country || 'PL';
  const languageCode = opts.languageCode || 'pl';
  const articleText = opts.articleText || opts.corpusTexts?.join(' ') || '';

  if (!keyword || !isDataForSeoConfigured()) {
    return [];
  }

  const paa = await getPeopleAlsoAsk({
    keyword,
    country,
    languageCode,
  }).catch(() => ({ questions: [] as Array<{ question: string; answer: string; domain: string; url: string }>, related: [] as string[] }));

  for (const q of paa.questions) {
    if (!paaQuestionPasses(q.question, keyword)) continue;
    const source = { kind: 'paa' as const, url: q.url, domain: q.domain };
    for (const sentence of splitFactSentences(q.answer || '')) {
      if (!factMatchesArticle(sentence, keyword, articleText)) continue;
      mergeFact(map, sentence, source);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.sourceFrequency - a.sourceFrequency)
    .slice(0, 30);
}

/** Map PAA answer facts → AiVisibilitySummary (prompts come from getAiSearchInfo merge). */
export function factsToVisibilitySummary(
  facts: ArticleFact[],
  articleText: string,
): AiVisibilitySummary {
  const citations: AiCitation[] = facts
    .filter((f) => !isCorpusNoiseSentence(f.text))
    .filter((f) => !f.text.includes('?'))
    .map((f) => {
      const readiness = factReadinessScore(articleText, f.text);
      const src = f.sources[0];
      return {
        prompt: f.text,
        answer: f.text,
        cited_url: src?.url || '',
        cited_domain: src?.domain || '',
        is_own_domain: false,
        is_competitor: !!src?.domain,
        answer_readiness_score: readiness,
      };
    });
  const cited = citations.filter((c) => (c.answer_readiness_score ?? 0) >= 60).length;
  const avg = citations.length
    ? Math.round(citations.reduce((s, c) => s + (c.answer_readiness_score ?? 0), 0) / citations.length)
    : 0;
  return {
    prompts_total: citations.length,
    prompts_cited: cited,
    competitor_citations: citations.filter((c) => c.is_competitor).length,
    extractability_score: avg,
    citations,
  };
}

/** Map PAA facts to coverage items for deep-analysis snapshot. */
export function factsToCoverageItems(facts: ArticleFact[]): CoverageItem[] {
  return facts
    .filter((f) => !f.text.trim().endsWith('?'))
    .map((f) => ({
      id: f.id,
      label: f.text,
      type: 'fact' as const,
      category: 'knowledge' as const,
      importance: f.sourceFrequency >= 2 ? 'critical' as const : 'recommended' as const,
      source: 'paa' as const,
      covered: false,
      quality: 0,
    }));
}

/** Merge primary (PAA facts) with secondary (PAA questions / sidecar) visibility summaries. */
export function mergeVisibilitySummaries(
  primary: AiVisibilitySummary,
  secondary: AiVisibilitySummary | null,
): AiVisibilitySummary {
  if (!secondary?.citations?.length) return primary;
  const seen = new Set(primary.citations.map((c) => normKey(c.prompt)));
  const merged = [...primary.citations];
  for (const c of secondary.citations) {
    const k = normKey(c.prompt);
    if (c.prompt && !seen.has(k)) {
      seen.add(k);
      merged.push(c);
    }
  }
  return {
    ...primary,
    prompts_total: merged.length,
    citations: merged,
    prompts_cited: merged.filter((c) => (c.answer_readiness_score ?? 0) >= 60).length,
    competitor_citations: merged.filter((c) => c.is_competitor).length,
  };
}
