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
  headings?: string[] | number;
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
  const rawList =
    (Array.isArray(o.competitors) && o.competitors)
    || (Array.isArray(o.serp_competitors) && o.serp_competitors)
    || (Array.isArray(o.ranking_competitors) && o.ranking_competitors)
    || [];

  return (rawList as LooseCompetitor[])
    .map((c, i) => {
      const values = c.values && typeof c.values === 'object' ? c.values : {};
      const url = c.url || (c.domain ? `https://${c.domain}` : '');
      if (!url) return null;
      const headingsArr = Array.isArray(c.headings) ? c.headings : [];
      const entities = asStringList(c.entities).length
        ? asStringList(c.entities)
        : asStringList(c.terms);
      return {
        url,
        position: c.position ?? i + 1,
        wordCount: c.wordCount ?? c.word_count ?? values.word_count_body ?? 0,
        paragraphs: c.paragraphs ?? c.p_count ?? values.p_count ?? 0,
        headings: typeof c.headings === 'number'
          ? c.headings
          : (c.h2_count ?? values.h2_h6_count ?? headingsArr.length),
        lists: c.lists ?? values.ul_ol_count ?? 0,
        tables: c.tables ?? values.table_count ?? 0,
        images: c.images ?? values.img_count ?? 0,
        faq: c.faq ?? 0,
        claims: asStringList(c.claims),
        questions: asStringList(c.questions),
        entities,
        openingPattern: 'unknown' as const,
      };
    })
    .filter((x): x is CompetitorRawInput => !!x);
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
  const claims = asStringList(parsed.expert_claims).concat(asStringList(parsed.critical));
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
      claims: [...claims, ...infoGain],
      questions: faqKeys,
      examples: examples.length,
      entities: asStringList(parsed.important).slice(0, 20),
    }];
  }

  return competitors.map((c, i) => ({
    ...c,
    claims: c.claims.length ? c.claims : (i === 0 ? [...claims, ...infoGain] : c.claims),
    questions: c.questions.length ? c.questions : (i === 0 ? faqKeys : c.questions),
    examples: c.examples || (i === 0 ? examples.length : 0),
  }));
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
