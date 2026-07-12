/**
 * Surfer-style Facts pipeline — extract factual statements from competitor corpus
 * + LLM answers (ai_overview, chat_gpt), weighted by source frequency.
 */
import { isDataForSeoConfigured } from './dataforseo';
import { runModelPrompt } from './dataforseoLlm';
import { hashId, type CoverageItem } from './aiCoverage';
import { cached } from './cache/fileCache';
import { buildCitationPrompts } from './citationPrompts';
import { isCorpusNoiseSentence } from './corpusNoiseFilter';
import { resolveFactKeyword } from './resolveFactKeyword';
import { isKeywordOnTopic, seedTokens } from './topicRelevance';
import { factReadinessScore } from './factReadiness';
import type { AiCitation, AiVisibilitySummary } from './aiSearchScore';
import type { ArticleFact, FactSourceKind } from './articleFactTypes';

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

/** Fetch citation prompts + LLM answers for AI visibility scoring. */
export async function fetchArticleFacts(opts: {
  keyword: string;
  corpusTexts?: string[];
  articleText?: string;
  title?: string;
  pageUrl?: string;
  country?: string;
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
    key: [keyword.toLowerCase(), opts.country || 'PL', articleText.length],
    ttlMs: 24 * 60 * 60 * 1000,
    producer: () => fetchArticleFactsUncached({ ...opts, keyword, articleText }),
  });
}

function factMatchesArticle(factText: string, keyword: string, articleText: string): boolean {
  if (isCorpusNoiseSentence(factText)) return false;
  if (isKeywordOnTopic(factText, keyword)) return true;
  if (factReadinessScore(articleText, factText) >= 28) return true;
  const seeds = seedTokens(keyword);
  const low = factText.toLowerCase();
  return seeds.some((s) => low.includes(s));
}

async function fetchArticleFactsUncached(opts: {
  keyword: string;
  corpusTexts?: string[];
  articleText?: string;
  title?: string;
  pageUrl?: string;
  country?: string;
}): Promise<ArticleFact[]> {
  const map = new Map<string, ArticleFact>();
  const keyword = opts.keyword.trim();
  const country = opts.country || 'PL';
  const articleText = opts.articleText || opts.corpusTexts?.join(' ') || '';

  const citationPrompts = buildCitationPrompts(keyword, [], 12);

  if (keyword && isDataForSeoConfigured()) {
    const models = ['ai_overview', 'chat_gpt'] as const;
    const tasks: Promise<void>[] = [];
    for (const model of models) {
      for (const prompt of citationPrompts.slice(0, 5)) {
        tasks.push(
          runModelPrompt(model, prompt, country)
            .then((ans) => {
              for (const sentence of splitFactSentences(ans.text)) {
                if (!factMatchesArticle(sentence, keyword, articleText)) continue;
                const cite = ans.citations[0];
                mergeFact(map, sentence, {
                  kind: model,
                  url: cite?.url,
                  domain: cite?.domain,
                });
              }
            })
            .catch(() => { /* non-fatal */ }),
        );
      }
    }
    await Promise.all(tasks);
  }

  return Array.from(map.values())
    .sort((a, b) => b.sourceFrequency - a.sourceFrequency)
    .slice(0, 30);
}

/** Map facts → AiVisibilitySummary citations for editor UI + legacy store. */
export function factsToVisibilitySummary(
  facts: ArticleFact[],
  articleText: string,
): AiVisibilitySummary {
  const citations: AiCitation[] = facts
    .filter((f) => !isCorpusNoiseSentence(f.text))
    .filter((f) => f.text.includes('?') || /^(czy|jak|ile|polecany|najlepsz)/i.test(f.text))
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

/** Map LLM/SERP facts to coverage items for deep-analysis snapshot. */
export function factsToCoverageItems(facts: ArticleFact[]): CoverageItem[] {
  return facts
    .filter((f) => !f.text.trim().endsWith('?') || f.sources.some((s) => s.kind === 'chat_gpt' || s.kind === 'ai_overview'))
    .map((f) => ({
    id: f.id,
    label: f.text,
    type: 'fact' as const,
    category: 'knowledge' as const,
    importance: f.sourceFrequency >= 2 ? 'critical' as const : 'recommended' as const,
    source: 'llm' as const,
    covered: false,
    quality: 0,
  }));
}

/** Merge primary (facts/LLM) with secondary (PAA/sidecar) visibility summaries. */
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
