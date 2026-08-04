/**
 * WIE Layer 2 — Competitor Synthesis (Source A).
 * Small JSON brief from Top-N competitor bodies — never dump full HTML into Writer.
 */
import { safeJsonParse } from '../safeJson';

export type CompetitorSynthesis = {
  critical: string[];
  important: string[];
  optional: string[];
  opening_style: {
    problem_first?: boolean;
    definition_first?: boolean;
    emotion?: 'high' | 'medium' | 'low' | string;
  };
  section_patterns: string[];
  expert_claims: string[];
  storytelling: string[];
  examples: string[];
  cta: { tone?: string; location?: string };
  faq: Record<string, unknown>;
  information_gain: string[];
  meta?: {
    keyword?: string;
    captured_at?: string;
    competitor_count?: number;
  };
};

const MAX_EXCERPT_CHARS = 1200;
const MAX_CORPUS_DOCS = 5;
const MAX_PROMPT_CHARS = 1000;

function asStringArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 280))
    .slice(0, max);
}

/** Narrow parse — never throws; returns null if unusable. */
export function parseCompetitorSynthesis(raw: unknown): CompetitorSynthesis | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const critical = asStringArray(o.critical);
  const important = asStringArray(o.important);
  const optional = asStringArray(o.optional);
  if (!critical.length && !important.length && !asStringArray(o.examples).length) {
    return null;
  }
  const openingRaw = o.opening_style;
  const opening =
    openingRaw && typeof openingRaw === 'object' && !Array.isArray(openingRaw)
      ? (openingRaw as CompetitorSynthesis['opening_style'])
      : {};
  const ctaRaw = o.cta;
  const cta =
    ctaRaw && typeof ctaRaw === 'object' && !Array.isArray(ctaRaw)
      ? (ctaRaw as CompetitorSynthesis['cta'])
      : {};
  const faqRaw = o.faq;
  const faq =
    faqRaw && typeof faqRaw === 'object' && !Array.isArray(faqRaw)
      ? (faqRaw as Record<string, unknown>)
      : {};

  return {
    critical,
    important,
    optional,
    opening_style: {
      problem_first: !!opening.problem_first,
      definition_first: !!opening.definition_first,
      emotion: typeof opening.emotion === 'string' ? opening.emotion : undefined,
    },
    section_patterns: asStringArray(o.section_patterns, 10),
    expert_claims: asStringArray(o.expert_claims, 8),
    storytelling: asStringArray(o.storytelling, 6),
    examples: asStringArray(o.examples, 10),
    cta,
    faq,
    information_gain: asStringArray(o.information_gain, 10),
    meta:
      o.meta && typeof o.meta === 'object' && !Array.isArray(o.meta)
        ? {
          keyword: typeof (o.meta as Record<string, unknown>).keyword === 'string'
            ? String((o.meta as Record<string, unknown>).keyword)
            : undefined,
          captured_at: typeof (o.meta as Record<string, unknown>).captured_at === 'string'
            ? String((o.meta as Record<string, unknown>).captured_at)
            : undefined,
          competitor_count: typeof (o.meta as Record<string, unknown>).competitor_count === 'number'
            ? Number((o.meta as Record<string, unknown>).competitor_count)
            : undefined,
        }
        : undefined,
  };
}

/** Compact prompt block (≤ ~1k chars). Prefer critical > important > examples. */
export function formatCompetitorSynthesisForPrompt(s: CompetitorSynthesis | null | undefined): string {
  if (!s) return '';
  const lines: string[] = ['COMPETITOR SYNTHESIS (use for depth — do not invent from thin air):'];
  if (s.opening_style.problem_first) lines.push('- Opening: problem-first (not dictionary definition).');
  if (s.opening_style.definition_first && !s.opening_style.problem_first) {
    lines.push('- Opening: definition / technical-first is OK for this SERP.');
  }
  if (s.critical.length) lines.push(`- Critical to cover: ${s.critical.slice(0, 5).join(' | ')}`);
  if (s.important.length) lines.push(`- Important: ${s.important.slice(0, 4).join(' | ')}`);
  if (s.examples.length) lines.push(`- Concrete examples: ${s.examples.slice(0, 5).join(', ')}`);
  if (s.expert_claims.length) lines.push(`- Expert voice cues: ${s.expert_claims.slice(0, 3).join(' | ')}`);
  if (s.information_gain.length) lines.push(`- Information gain: ${s.information_gain.slice(0, 4).join(' | ')}`);
  lines.push('- Prefer depth on critical items; do not pad FAQ/type lists only for score.');
  const out = lines.join('\n');
  return out.length > MAX_PROMPT_CHARS ? `${out.slice(0, MAX_PROMPT_CHARS - 1)}…` : out;
}

function truncateCorpus(texts: string[]): string[] {
  return texts
    .filter((t) => typeof t === 'string' && t.trim().length > 80)
    .slice(0, MAX_CORPUS_DOCS)
    .map((t) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS));
}

/** Offline / no-key fallback from corpus excerpts. */
export function heuristicCompetitorSynthesis(opts: {
  keyword: string;
  corpusTexts: string[];
}): CompetitorSynthesis {
  const joined = truncateCorpus(opts.corpusTexts).join('\n');
  const lower = joined.toLowerCase();
  const problemFirst = /ofiar|strach|co robić|padł|how to|nie płać|zgłoś|problem/i.test(joined);
  const examples: string[] = [];
  for (const token of ['Messenger', 'Facebook', 'Bitcoin', 'WhatsApp', 'e-mail', 'HR', 'policja']) {
    if (joined.includes(token) || lower.includes(token.toLowerCase())) examples.push(token);
  }
  const sentences = joined.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && s.length < 220);
  const critical = sentences.slice(0, 4);
  const expert = sentences.filter((s) => /w praktyce|najczęściej|z doświadczenia|usually|in practice/i.test(s)).slice(0, 3);

  return {
    critical: critical.length ? critical : [`Cover practical answer for: ${opts.keyword}`],
    important: sentences.slice(4, 7),
    optional: [],
    opening_style: {
      problem_first: problemFirst,
      definition_first: !problemFirst,
      emotion: problemFirst ? 'high' : 'low',
    },
    section_patterns: problemFirst
      ? ['problem', 'consequences', 'solution', 'examples', 'faq']
      : ['definition', 'how_it_works', 'examples', 'faq'],
    expert_claims: expert,
    storytelling: [],
    examples,
    cta: { tone: 'soft', location: 'last_10_percent' },
    faq: {},
    information_gain: expert.slice(0, 2),
    meta: {
      keyword: opts.keyword,
      captured_at: new Date().toISOString(),
      competitor_count: Math.min(opts.corpusTexts.length, MAX_CORPUS_DOCS),
    },
  };
}

/**
 * Build synthesis via LLM on capped excerpts; falls back to heuristic on failure / no key.
 */
export async function buildCompetitorSynthesisFromCorpus(opts: {
  keyword: string;
  corpusTexts: string[];
  signal?: AbortSignal;
}): Promise<CompetitorSynthesis | null> {
  const excerpts = truncateCorpus(opts.corpusTexts);
  if (!excerpts.length) return null;

  const fallback = heuristicCompetitorSynthesis({
    keyword: opts.keyword,
    corpusTexts: excerpts,
  });

  const { chatLlm } = await import('../ai/deepseek');
  const llm = chatLlm();
  if (!llm.apiKey) return fallback;

  const system =
    'You synthesize competitor SEO articles into a compact JSON brief for a writer. '
    + 'Reply ONLY with JSON. Do not copy long passages. Prefer concrete examples and information gain.';
  const user =
    `Keyword: "${opts.keyword}"\n\n`
    + 'Return JSON with keys: critical (string[]), important (string[]), optional (string[]), '
    + 'opening_style {problem_first, definition_first, emotion}, section_patterns (string[]), '
    + 'expert_claims (string[]), storytelling (string[]), examples (string[]), '
    + 'cta {tone, location}, faq (object), information_gain (string[]).\n'
    + 'critical = must-cover insights (max 5 short bullets). examples = concrete scenarios/names.\n\n'
    + excerpts.map((t, i) => `=== DOC ${i + 1} ===\n${t}`).join('\n\n');

  try {
    const res = await fetch(llm.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: opts.signal ?? AbortSignal.timeout(45_000),
    });
    if (!res.ok) return fallback;
    const data = await res.json().catch(() => ({} as { choices?: Array<{ message?: { content?: string } }> }));
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseCompetitorSynthesis(safeJsonParse<unknown>(content, null));
    if (!parsed) return fallback;
    return {
      ...parsed,
      meta: {
        keyword: opts.keyword,
        captured_at: new Date().toISOString(),
        competitor_count: excerpts.length,
        ...parsed.meta,
      },
    };
  } catch {
    return fallback;
  }
}
