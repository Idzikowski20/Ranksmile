/**
 * Surfer-style Facts pipeline — extract factual statements from competitor corpus
 * + LLM answers (ai_overview, chat_gpt), weighted by source frequency.
 */
import { isDataForSeoConfigured } from './dataforseo';
import { runModelPrompt } from './dataforseoLlm';
import { hashId, type CoverageItem } from './aiCoverage';
import { cached } from './cache/fileCache';
import type { AiCitation, AiVisibilitySummary } from './aiSearchScore';
import type { ArticleFact, FactSourceKind } from './articleFactTypes';
import { factReadinessScore } from './factReadiness';

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

function extractFromCorpus(corpusTexts: string[], map: Map<string, ArticleFact>): void {
  for (const raw of corpusTexts) {
    const plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    for (const sentence of splitFactSentences(plain)) {
      mergeFact(map, sentence, { kind: 'serp' });
    }
  }
}

/** Fetch facts from competitor corpus + DataForSEO LLM engines (Option B). */
export async function fetchArticleFacts(opts: {
  keyword: string;
  corpusTexts?: string[];
  country?: string;
}): Promise<ArticleFact[]> {
  const keyword = opts.keyword.trim();
  if (!keyword) return [];

  return cached({
    namespace: 'article-facts',
    key: [keyword.toLowerCase(), opts.country || 'PL', (opts.corpusTexts || []).length],
    ttlMs: 24 * 60 * 60 * 1000,
    producer: () => fetchArticleFactsUncached(opts),
  });
}

async function fetchArticleFactsUncached(opts: {
  keyword: string;
  corpusTexts?: string[];
  country?: string;
}): Promise<ArticleFact[]> {
  const map = new Map<string, ArticleFact>();
  const corpus = (opts.corpusTexts || []).filter(Boolean).slice(0, 20);
  extractFromCorpus(corpus, map);

  const keyword = opts.keyword.trim();
  const country = opts.country || 'PL';

  if (keyword && isDataForSeoConfigured()) {
    const prompts = [
      keyword,
      `Jakie są najważniejsze informacje o: ${keyword}?`,
    ];
    const models = ['ai_overview', 'chat_gpt'] as const;
    const tasks: Promise<void>[] = [];
    for (const model of models) {
      for (const prompt of prompts) {
        tasks.push(
          runModelPrompt(model, prompt, country)
            .then((ans) => {
              for (const sentence of splitFactSentences(ans.text)) {
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
    .slice(0, 45);
}

/** Map facts → AiVisibilitySummary citations for editor UI + legacy store. */
export function factsToVisibilitySummary(
  facts: ArticleFact[],
  articleText: string,
): AiVisibilitySummary {
  const citations: AiCitation[] = facts.map((f) => {
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
  return facts.map((f) => ({
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
