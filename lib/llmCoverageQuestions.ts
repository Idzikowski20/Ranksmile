/**
 * LLM-sourced questions for AI Search coverage — only from allowed engines:
 * ai_overview, chat_gpt, gemini, perplexity, reddit.
 *
 * Claude / Facebook are out of scope: DataForSEO has no Claude engine; Facebook
 * is filtered as corpus noise (not an LLM citation source).
 */
import { cached, TTL } from './cache/fileCache';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from './dataforseo';
import { runModelPrompt, type AiModel } from './dataforseoLlm';
import { isUsefulCitationPrompt } from './citationPrompts';
import { isKeywordOnTopic } from './topicRelevance';
import { normalizeTerm } from './termUtils';

export type LlmCoverageSource = 'ai_overview' | 'chat_gpt' | 'gemini' | 'perplexity' | 'reddit';

export type LlmCoverageQuestion = {
  question: string;
  sources: LlmCoverageSource[];
};

const PRIMARY_MODELS: AiModel[] = ['ai_overview', 'ai_mode', 'chat_gpt', 'gemini', 'perplexity'];
const EXPANSION_MODELS: AiModel[] = ['chat_gpt', 'gemini', 'ai_mode'];
const EXPANSION_SEED_MAX = 6;

function modelToSource(model: AiModel): LlmCoverageSource | null {
  if (model === 'ai_overview' || model === 'ai_mode') return 'ai_overview';
  if (model === 'chat_gpt') return 'chat_gpt';
  if (model === 'gemini') return 'gemini';
  if (model === 'perplexity') return 'perplexity';
  return null;
}

/** Ask engines for questions — fan_out_queries alone are often empty (esp. ChatGPT/Perplexity). */
export function coverageQuestionPrompt(seed: string): string {
  const s = seed.replace(/\s+/g, ' ').trim().slice(0, 200);
  return `List 6-8 short search questions people ask about: ${s}. One question per line, each ending with ?. No numbering, no answers, no intro.`;
}

/** Pull question lines from LLM answer text when fan_out_queries is empty. */
export function extractQuestionsFromText(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n|(?<=[?？])\s+/)) {
    let line = raw.replace(/^\s*[-*•\d.)]+\s*/, '').replace(/\s+/g, ' ').trim();
    if (!line.includes('?') && !line.includes('？')) continue;
    if (!/[?？]\s*$/.test(line)) {
      const m = line.match(/^(.+?[?？])/);
      if (!m) continue;
      line = m[1].trim();
    }
    if (line.length < 10 || line.length > 180) continue;
    const key = normalizeTerm(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

type Acc = { text: string; sources: Set<LlmCoverageSource> };

function addQuestion(
  map: Map<string, Acc>,
  raw: string,
  source: LlmCoverageSource | null,
  keyword: string,
): void {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 10 || !isUsefulCitationPrompt(text, keyword)) return;
  const key = normalizeTerm(text);
  const prev = map.get(key);
  if (prev) {
    if (source) prev.sources.add(source);
    return;
  }
  map.set(key, { text, sources: new Set(source ? [source] : []) });
}

/** Build extra LLM prompt seeds from PAA + related searches (Ranksmile-style fan-out). */
export function buildExpansionSeeds(
  keyword: string,
  paaQuestions: Array<{ question: string }>,
  related: string[],
  max = EXPANSION_SEED_MAX,
): string[] {
  const seen = new Set<string>([normalizeTerm(keyword)]);
  const out: string[] = [];

  const push = (raw: string) => {
    const s = raw.replace(/\s+/g, ' ').trim();
    const key = normalizeTerm(s);
    if (!s || s.length < 8 || seen.has(key)) return;
    if (!isUsefulCitationPrompt(s, keyword) && !isKeywordOnTopic(s, keyword)) return;
    seen.add(key);
    out.push(s);
  };

  for (const q of paaQuestions.slice(0, 5)) push(q.question);
  for (const r of related.slice(0, 5)) push(r);

  return out.slice(0, max);
}

async function collectFanOutFromModels(
  map: Map<string, Acc>,
  seed: string,
  keyword: string,
  countryIso: string,
  languageCode: string,
  models: AiModel[],
): Promise<void> {
  const prompt = coverageQuestionPrompt(seed);
  await Promise.all(models.map(async (model) => {
    const source = modelToSource(model);
    if (!source) return;
    try {
      const ans = await runModelPrompt(model, prompt, countryIso, languageCode);
      const fromFanOut = ans.fanOutQueries;
      const fromText = extractQuestionsFromText(ans.text);
      // Prefer explicit fan-outs; always merge parsed answer lines (ChatGPT/Perplexity often omit fan_out).
      const queries = fromFanOut.length ? [...fromFanOut, ...fromText] : fromText;
      for (const q of queries) addQuestion(map, q, source, keyword);
    } catch {
      /* non-fatal per engine */
    }
  }));
}

async function fetchUncached(opts: {
  keyword: string;
  country?: string;
  languageCode?: string;
}): Promise<LlmCoverageQuestion[]> {
  const keyword = opts.keyword.trim();
  if (!keyword || !isDataForSeoConfigured()) return [];

  const countryIso = (opts.country || 'PL').toUpperCase();
  const languageCode = (opts.languageCode || 'pl').toLowerCase().slice(0, 2);
  const map = new Map<string, Acc>();

  let paaQuestions: Array<{ question: string; domain?: string }> = [];
  let relatedSearches: string[] = [];
  try {
    const paa = await getPeopleAlsoAsk({
      keyword,
      country: opts.country || 'PL',
      languageCode: opts.languageCode || 'pl',
    });
    paaQuestions = paa.questions;
    relatedSearches = paa.related;
    for (const q of paa.questions) {
      if (!q.question || !isKeywordOnTopic(q.question, keyword)) continue;
      // Only Reddit gets engine provenance here — plain PAA is not AI Overviews.
      if (/reddit\.com/i.test(q.domain ?? '')) {
        addQuestion(map, q.question, 'reddit', keyword);
      } else {
        addQuestion(map, q.question, null, keyword);
      }
    }
    for (const related of paa.related) {
      addQuestion(map, related, null, keyword);
    }
  } catch {
    /* non-fatal */
  }

  await collectFanOutFromModels(map, keyword, keyword, countryIso, languageCode, PRIMARY_MODELS);

  const expansionSeeds = buildExpansionSeeds(keyword, paaQuestions, relatedSearches);
  for (const seed of expansionSeeds) {
    await collectFanOutFromModels(map, seed, keyword, countryIso, languageCode, EXPANSION_MODELS);
  }

  return Array.from(map.values()).map((row) => ({
    question: row.text,
    sources: Array.from(row.sources),
  }));
}

/** Fetch deduped LLM coverage questions for a keyword (cached). */
export async function fetchLlmCoverageQuestions(opts: {
  keyword: string;
  country?: string;
  languageCode?: string;
}): Promise<LlmCoverageQuestion[]> {
  const keyword = opts.keyword.trim();
  if (!keyword) return [];

  return cached({
    namespace: 'llm-coverage-questions',
    // v3: question-list prompt + parse answer text (not fan_out only); no fake ai_overview on PAA
    key: [keyword.toLowerCase(), opts.country || 'PL', opts.languageCode || 'pl', 'v3'],
    ttlMs: TTL.SERP,
    producer: () => fetchUncached(opts),
  });
}
