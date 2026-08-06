/**
 * Adapt article / score_data competitor blobs into CompetitorRawInput[].
 */
import { safeJsonParse } from '../safeJson';
import type { CompetitorRawInput } from './competitorIntelligence';
import type { AiSearchIntelInput } from './knowledgeIntelligence';

type LooseCompetitor = {
  url?: string;
  domain?: string;
  position?: number;
  title?: string;
  word_count?: number;
  wordCount?: number;
  /** Outlines cache stores `{ level, text }` objects; score_data stores strings or a count. */
  headings?: Array<string | { level?: number; text?: string }> | number;
  heading_count?: number;
  h2_count?: number;
  paragraphs?: number;
  p_count?: number;
  lists?: number;
  tables?: number;
  images?: number;
  faq?: number;
  claims?: string[];
  questions?: string[];
  entities?: string[];
  terms?: Array<string | { term?: string }>;
  values?: Record<string, number>;
};

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x === 'object' && typeof (x as { term?: string }).term === 'string') {
        return String((x as { term: string }).term).trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function competitorsFromScoreData(scoreData: unknown): CompetitorRawInput[] {
  if (!scoreData || typeof scoreData !== 'object') return [];
  const o = scoreData as Record<string, unknown>;
  const candidates = [o.competitors, o.serp_competitors, o.ranking_competitors];
  const rawList = candidates.find((c) => Array.isArray(c) && c.length > 0) || [];
  const out: CompetitorRawInput[] = [];

  (rawList as unknown[]).forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const c = row as LooseCompetitor;
    const values = c.values && typeof c.values === 'object' ? c.values : {};
    const url = typeof c.url === 'string' && c.url
      ? c.url
      : (typeof c.domain === 'string' && c.domain ? `https://${c.domain}` : '');
    if (!url) return;
    // The outlines cache holds `{ level, text }` objects — counting only strings dropped
    // every competitor's structure, so the benchmark reported averageH2: 0 for a SERP
    // whose pages carry 20+ headings.
    const headingsArr = Array.isArray(c.headings)
      ? c.headings.filter((h) => (typeof h === 'string' && h.trim())
        || (!!h && typeof h === 'object' && typeof h.text === 'string' && !!h.text.trim()))
      : [];
    const entities = asStringList(c.entities).length
      ? asStringList(c.entities)
      : asStringList(c.terms);
    out.push({
      url,
      position: typeof c.position === 'number' ? c.position : i + 1,
      wordCount: c.wordCount ?? c.word_count ?? values.word_count_body ?? 0,
      paragraphs: c.paragraphs ?? c.p_count ?? values.p_count ?? 0,
      headings: typeof c.headings === 'number'
        ? c.headings
        : (c.h2_count ?? values.h2_h6_count ?? c.heading_count ?? headingsArr.length),
      lists: c.lists ?? values.ul_ol_count ?? 0,
      tables: c.tables ?? values.table_count ?? 0,
      images: c.images ?? values.img_count ?? 0,
      faq: c.faq ?? 0,
      claims: asStringList(c.claims),
      questions: asStringList(c.questions),
      entities,
      openingPattern: 'unknown',
    });
  });

  return out;
}

/** Enrich raw competitors with WIE expert_claims / faq / examples when structural claims empty. */
export function enrichWithWieSynthesis(
  competitors: CompetitorRawInput[],
  wieSynthesis: unknown,
): CompetitorRawInput[] {
  const parsed = wieSynthesis && typeof wieSynthesis === 'object'
    ? (wieSynthesis as Record<string, unknown>)
    : null;
  if (!parsed) return competitors;
  const wieClaims = asStringList(parsed.expert_claims).concat(asStringList(parsed.critical));
  const examples = asStringList(parsed.examples);
  const faqKeys = parsed.faq && typeof parsed.faq === 'object'
    ? Object.keys(parsed.faq as Record<string, unknown>)
    : [];
  const infoGain = asStringList(parsed.information_gain);

  if (!competitors.length) {
    return [{
      url: 'synthetic://wie-synthesis',
      position: 1,
      wordCount: 3000,
      headings: 12,
      paragraphs: 60,
      lists: 10,
      claims: [...wieClaims, ...infoGain],
      questions: faqKeys,
      examples: examples.length,
      entities: asStringList(parsed.important).slice(0, 20),
    }];
  }

  return competitors.map((c, i) => {
    const claims = c.claims || [];
    const questions = c.questions || [];
    return {
      ...c,
      claims: claims.length ? claims : (i === 0 ? [...wieClaims, ...infoGain] : claims),
      questions: questions.length ? questions : (i === 0 ? faqKeys : questions),
      examples: c.examples || (i === 0 ? examples.length : 0),
    };
  });
}

export function aiIntelFromScoreData(scoreData: unknown): AiSearchIntelInput {
  if (!scoreData || typeof scoreData !== 'object') return {};
  const o = scoreData as Record<string, unknown>;
  const ai = (o.ai_visibility || o.aiVisibility || o.ai_search) as Record<string, unknown> | undefined;
  const citations = Array.isArray(ai?.citations) ? ai!.citations as Array<Record<string, unknown>> : [];
  const claims: string[] = [];
  const questions: string[] = [];
  const sources: AiSearchIntelInput['sources'] = [];
  for (const c of citations) {
    if (typeof c.answer === 'string' && c.answer.trim()) {
      for (const sent of c.answer.split(/(?<=[.!?])\s+/).slice(0, 4)) {
        if (sent.trim().length > 20) claims.push(sent.trim());
      }
    }
    if (typeof c.prompt === 'string' && c.prompt.includes('?')) questions.push(c.prompt.trim());
    if (typeof c.cited_url === 'string') {
      sources.push({
        url: c.cited_url,
        label: typeof c.cited_domain === 'string' ? c.cited_domain : c.cited_url,
      });
    }
  }
  const paa = Array.isArray(o.paa_questions)
    ? (o.paa_questions as unknown[]).filter((q): q is string => typeof q === 'string')
    : [];
  return { claims, questions: [...questions, ...paa], sources };
}

export function parseCompetitorCacheJson(raw: string | null | undefined): CompetitorRawInput[] {
  if (!raw) return [];
  const parsed = safeJsonParse<{ competitors?: LooseCompetitor[] } | LooseCompetitor[]>(raw, []);
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { competitors?: LooseCompetitor[] }).competitors)
      ? (parsed as { competitors: LooseCompetitor[] }).competitors
      : []);
  return competitorsFromScoreData({ competitors: list });
}

/** H2/H3 titles from competitor outlines cache — outline fillers + AI coverage seeds. */
export function competitorHeadingTitles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parsed = safeJsonParse<unknown>(raw, null);
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { competitors?: unknown }).competitors)
      ? (parsed as { competitors: unknown[] }).competitors
      : []);
  const topics: string[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const headings = (c as { headings?: unknown }).headings;
    if (!Array.isArray(headings)) continue;
    for (const h of headings) {
      if (!h || typeof h !== 'object') continue;
      const level = (h as { level?: unknown }).level;
      const text = (h as { text?: unknown }).text;
      if ((level === 2 || level === 3) && typeof text === 'string') {
        const t = text.trim();
        if (t.length < 8 || t.length > 100) continue;
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        topics.push(t);
      }
    }
  }
  return topics.slice(0, 40);
}

