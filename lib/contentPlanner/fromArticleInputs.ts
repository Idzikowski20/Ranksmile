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

/** Host + path, no scheme/www/trailing slash — the corpus and the outlines cache disagree on all three. */
function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    // Hostnames are case-insensitive; paths are not. Lower-casing the whole key made
    // `/Uslugi` and `/uslugi` the same competitor, so one page's claims could be filed
    // under another — and claim frequency is exactly what decides a core claim from an
    // information gap.
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return `${host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    // Same contract for a malformed or scheme-less URL: host case-folded, path kept.
    // Diverging here would silently miss claims for exactly the rows most likely to be
    // written by hand.
    const [head, ...rest] = raw.trim().split('/');
    return [head.toLowerCase(), ...rest].join('/');
  }
}

/**
 * Attach the claims deep-analysis extracted from each competitor's body.
 *
 * Runs before `enrichWithWieSynthesis` so the synthesis stays what it was meant to be —
 * a fallback for competitors we could not read — instead of the sole source. Matching is
 * by URL: the corpus skips competitors whose fetch came back empty, so pairing by index
 * would file one competitor's claims under another and corrupt the gain frequency this
 * whole function exists to feed.
 */
export function enrichWithCorpusClaims(
  competitors: CompetitorRawInput[],
  rawClaims: unknown,
): CompetitorRawInput[] {
  if (!rawClaims || typeof rawClaims !== 'object' || Array.isArray(rawClaims)) return competitors;
  const byKey = new Map<string, string[]>();
  for (const [url, claims] of Object.entries(rawClaims as Record<string, unknown>)) {
    const list = asStringList(claims);
    if (list.length) byKey.set(urlKey(url), list);
  }
  if (!byKey.size) return competitors;

  return competitors.map((c) => {
    if (c.claims?.length) return c;
    const claims = byKey.get(urlKey(c.url));
    return claims ? { ...c, claims } : c;
  });
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

export type PlannerInputGap = {
  code: 'analysis_running' | 'no_analysis' | 'competitors_unreadable' | 'thin_topic';
  message: string;
};

/**
 * Why the planner had too little to work with.
 *
 * These three failures need three different actions and used to share one message
 * ("re-run the article analysis"), which is actively wrong for the first case — there is
 * nothing to re-run — and unhelpful for the second, where re-running repeats the same
 * blocked fetches. The distinguishing evidence is which artifacts deep-analysis managed
 * to persist: competitors at all, then anything read from their bodies.
 */
export function diagnosePlannerInputs(opts: {
  scoreData: Record<string, unknown> | null | undefined;
  competitorCount: number;
  claimCount: number;
  /** A deep analysis for this article is queued or running right now. */
  analysisRunning?: boolean;
}): PlannerInputGap {
  const {
    scoreData, competitorCount, claimCount, analysisRunning,
  } = opts;
  // Checked first: mid-run the article legitimately has no competitors yet, and telling
  // the reader to start an analysis that is already running sends them to a button that
  // refuses to fire.
  if (analysisRunning) {
    return {
      code: 'analysis_running',
      message: 'The competitor analysis for this article is still running. The outline will be ready once it finishes.',
    };
  }
  if (!scoreData || competitorCount === 0) {
    return {
      code: 'no_analysis',
      message: 'This article has no competitor analysis yet. Run the article analysis first, then generate the outline.',
    };
  }
  const readCompetitorBodies = Boolean(scoreData.competitor_claims) || Boolean(scoreData.competitor_synthesis);
  if (!readCompetitorBodies) {
    return {
      code: 'competitors_unreadable',
      message: `The analysis found ${competitorCount} competitors but could not read any of their pages, `
        + 'so there is nothing to plan from. Re-run the analysis — if it keeps failing, those sites are '
        + 'blocking our crawler and you will need to write the outline by hand.',
    };
  }
  return {
    code: 'thin_topic',
    message: `Competitor pages were read but yielded only ${claimCount} usable claims, and the planner needs 5. `
      + 'This keyword may be too narrow, or the pages that rank for it are too thin to model.',
  };
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

