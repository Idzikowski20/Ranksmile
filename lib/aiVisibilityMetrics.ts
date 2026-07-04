/**
 * Pure aggregation for AI Visibility — shared by the scan runner and the read API.
 *
 * Scoring (locked so UI and API agree):
 *   pairScore(prompt,model) = cited@pos1 → 100; pos p → max(0, 100-(p-1)*15); not cited → 0
 *   visibilityScore = round(mean of pairScore over all (prompt,model) pairs)
 *   mentionRate     = % of pairs where the brand was cited
 *   avgPosition     = mean own_position over cited pairs (1 dp); null if never cited
 *   directCitations = count of own-domain citation entries; pages = distinct own URLs
 */
import type { LlmCitation } from './dataforseoLlm';

export type BrandMention = { brand: string, domain: string, sentiment: 'positive' | 'neutral' | 'negative' | 'mixed', pos: number, quotes: string[] };

export type ResultRow = {
   promptId: number,
   model: string,
   ownCited: boolean,
   ownPosition: number | null,
   citations: LlmCitation[],
   topic: string,
   text: string,
   brands: BrandMention[],
   fanOutQueries?: string[], // sub-queries the engine generated (DataForSEO fan_out_queries); runtime always sets it, optional only so test fixtures needn't
};

export type SourceBrand = { brand: string, domain: string };
export type SourceDetailBrand = { pos: number, brand: string, sentiment: BrandMention['sentiment'], quotes: string[] };
export type GapCard = { brand: string, gap: number, shared: number, you: number };

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

export function ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null {
   const own = norm(ownDomain);
   if (!own) return null;
   const idx = citations.findIndex((c) => norm(c.domain) === own || norm(c.domain).endsWith(`.${own}`));
   return idx === -1 ? null : idx + 1;
}

const pairScore = (r: ResultRow): number => (
   r.ownCited && r.ownPosition ? Math.max(0, 100 - (r.ownPosition - 1) * 15) : 0
);

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeOverview(rows: ResultRow[]) {
   const perModelMap = new Map<string, number[]>();
   for (const r of rows) {
      const list = perModelMap.get(r.model) ?? [];
      list.push(pairScore(r));
      perModelMap.set(r.model, list);
   }
   const scores = rows.map(pairScore);
   const cited = rows.filter((r) => r.ownCited && r.ownPosition);

   // Own URL/citation counting derives from ownPosition (the citation at that
   // 1-based index is the brand's), NOT from re-matching domains.
   const ownUrls = new Set<string>();
   let directCitations = 0;
   for (const r of rows) {
      if (!r.ownCited || !r.ownPosition) continue;
      const c = r.citations[r.ownPosition - 1];
      if (c) { directCitations += 1; ownUrls.add(c.url); }
   }

   return {
      visibilityScore: Math.round(mean(scores)),
      mentionRate: rows.length ? Math.round((cited.length / rows.length) * 100) : 0,
      avgPosition: cited.length ? Math.round(mean(cited.map((r) => r.ownPosition as number)) * 10) / 10 : null,
      directCitations,
      pages: ownUrls.size,
      perModel: Array.from(perModelMap.entries()).map(([model, list]) => ({ model, score: Math.round(mean(list)) })),
   };
}

const brandEq = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const answerHasBrand = (r: ResultRow, b: string): boolean => r.brands.some((x) => brandEq(x.brand, b));

export function aggregateSources(rows: ResultRow[], ownBrand = '') {
   const byUrl = new Map<string, { url: string, domain: string, timesShown: number, models: Set<string>, mentioned: boolean, brands: Map<string, { brand: string, domain: string, n: number }> }>();
   for (const r of rows) {
      for (const c of r.citations) {
         const entry = byUrl.get(c.url) ?? { url: c.url, domain: norm(c.domain), timesShown: 0, models: new Set<string>(), mentioned: false, brands: new Map() };
         entry.timesShown += 1;
         entry.models.add(r.model);
         if (ownBrand && answerHasBrand(r, ownBrand)) entry.mentioned = true;
         for (const b of r.brands) {
            if (ownBrand && brandEq(b.brand, ownBrand)) continue; // own brand isn't a "brand" chip
            const key = b.brand.toLowerCase();
            const be = entry.brands.get(key) ?? { brand: b.brand, domain: b.domain, n: 0 };
            be.n += 1; if (!be.domain && b.domain) be.domain = b.domain;
            entry.brands.set(key, be);
         }
         byUrl.set(c.url, entry);
      }
   }
   return Array.from(byUrl.values())
      .sort((a, b) => b.timesShown - a.timesShown)
      .map((e) => ({
         url: e.url, domain: e.domain, timesShown: e.timesShown, models: Array.from(e.models),
         mentioned: e.mentioned,
         brands: Array.from(e.brands.values()).sort((a, b) => b.n - a.n).map((b) => ({ brand: b.brand, domain: b.domain })) as SourceBrand[],
      }));
}

export function mentionGap(rows: ResultRow[], brand: string, ownBrand: string): GapCard {
   let gap = 0; let shared = 0; let you = 0;
   for (const r of rows) {
      const hasBrand = answerHasBrand(r, brand);
      const hasOwn = !!ownBrand && answerHasBrand(r, ownBrand);
      if (hasBrand && hasOwn) shared += 1;
      else if (hasBrand) gap += 1;
      else if (hasOwn) you += 1;
   }
   return { brand, gap, shared, you };
}

export function gapBrandCandidates(rows: ResultRow[], ownBrand: string): string[] {
   const counts = new Map<string, { brand: string, n: number }>();
   for (const r of rows) for (const b of r.brands) {
      if (ownBrand && brandEq(b.brand, ownBrand)) continue;
      const key = b.brand.toLowerCase();
      const e = counts.get(key) ?? { brand: b.brand, n: 0 };
      e.n += 1; counts.set(key, e);
   }
   return Array.from(counts.values()).sort((a, b) => b.n - a.n).map((e) => e.brand);
}

export function brandsForSource(rows: ResultRow[], url: string): SourceDetailBrand[] {
   const byBrand = new Map<string, { brand: string, pos: number, sentiments: string[], quotes: Set<string> }>();
   for (const r of rows) {
      if (!r.citations.some((c) => c.url === url)) continue;
      for (const b of r.brands) {
         const key = b.brand.toLowerCase();
         const e = byBrand.get(key) ?? { brand: b.brand, pos: b.pos, sentiments: [], quotes: new Set<string>() };
         e.pos = Math.min(e.pos, b.pos);
         e.sentiments.push(b.sentiment);
         b.quotes.forEach((q) => e.quotes.add(q));
         byBrand.set(key, e);
      }
   }
   const dominant = (ss: string[]): SourceDetailBrand['sentiment'] => {
      const c: Record<string, number> = {}; ss.forEach((s) => { c[s] = (c[s] || 0) + 1; });
      const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
      return top.length > 1 && top.every((t) => t[1] === top[0][1]) ? 'mixed' : (top[0]?.[0] as SourceDetailBrand['sentiment']) || 'neutral';
   };
   return Array.from(byBrand.values())
      .map((e) => ({ pos: e.pos, brand: e.brand, sentiment: dominant(e.sentiments), quotes: Array.from(e.quotes).slice(0, 3) }))
      .sort((a, b) => a.pos - b.pos);
}

export function aggregateCompetitors(rows: ResultRow[], ownDomain: string) {
   const own = norm(ownDomain);
   const byDomain = new Map<string, number>();
   let total = 0;
   for (const r of rows) {
      for (const c of r.citations) {
         const d = norm(c.domain);
         if (!d || d === own || d.endsWith(`.${own}`)) continue;
         byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
         total += 1;
      }
   }
   return Array.from(byDomain.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain, mentions]) => ({ domain, mentions, share: total ? Math.round((mentions / total) * 100) : 0 }));
}

/** Re-derive each row's ownCited/ownPosition for an ARBITRARY domain, so the same
 *  scan rows can be scored from any competitor's point of view. */
function projectRows(rows: ResultRow[], domain: string): ResultRow[] {
   return rows.map((r) => {
      const pos = ownDomainPosition(r.citations, domain);
      return { ...r, ownCited: pos !== null, ownPosition: pos };
   });
}

function promptsFor(projected: ResultRow[]): Array<{ promptId: number, topic: string, text: string, score: number }> {
   const byPrompt = new Map<number, { promptId: number, topic: string, text: string, scores: number[] }>();
   for (const r of projected) {
      const e = byPrompt.get(r.promptId) ?? { promptId: r.promptId, topic: r.topic, text: r.text, scores: [] };
      e.scores.push(pairScore(r));
      byPrompt.set(r.promptId, e);
   }
   return Array.from(byPrompt.values())
      .map((p) => ({ promptId: p.promptId, topic: p.topic, text: p.text, score: Math.round(mean(p.scores)) }))
      .sort((a, b) => b.score - a.score);
}

function topicsFor(prompts: ReturnType<typeof promptsFor>): Array<{ topic: string, score: number }> {
   const byTopic = new Map<string, number[]>();
   for (const p of prompts) { const l = byTopic.get(p.topic) ?? []; l.push(p.score); byTopic.set(p.topic, l); }
   return Array.from(byTopic.entries()).map(([topic, s]) => ({ topic, score: Math.round(mean(s)) })).sort((a, b) => b.score - a.score);
}

export type DomainSnapshot = {
   overview: ReturnType<typeof computeOverview>;
   sources: ReturnType<typeof aggregateSources>;
   prompts: Array<{ promptId: number, topic: string, text: string, score: number }>;
   topics: Array<{ topic: string, score: number }>;
   citedPromptIds: number[]; // prompts where the domain was cited in ≥1 model
};

/** THE primitive: a full snapshot for ANY domain. Every view (overview, compare,
 *  trend, future export) reads this one shape. Pure — the DB wrapper that loads
 *  the rows lives in lib/aiVisibilityRead.ts. */
export function snapshotForDomain(rows: ResultRow[], domain: string): DomainSnapshot {
   const projected = projectRows(rows, domain);
   const prompts = promptsFor(projected);
   return {
      overview: computeOverview(projected),
      sources: aggregateSources(projected),
      prompts,
      topics: topicsFor(prompts),
      citedPromptIds: Array.from(new Set(projected.filter((r) => r.ownCited).map((r) => r.promptId))).sort((a, b) => a - b),
   };
}

/** Alias kept for existing callers that pass the tracked domain. */
export function buildSnapshot(rows: ResultRow[], ownDomain: string): DomainSnapshot {
   return snapshotForDomain(rows, ownDomain);
}

// AI grounding / redirect proxies, not real competitors — excluded from the ranking.
export const COMPETITOR_NOISE: string[] = [
   'vertexaisearch.cloud.google.com', 'googleusercontent.com', 'google.com',
   'gstatic.com', 'bing.com', 'duckduckgo.com',
];
const NOISE = new Set(COMPETITOR_NOISE);

export type RankedCompetitor = { domain: string, snapshot: DomainSnapshot };

/** Snapshot for the tracked domain + every distinct cited domain (minus noise),
 *  computed ONCE. Keys are normalized (norm). Shared by ranking, compare, history. */
export function buildSnapshotsForScan(rows: ResultRow[], ownDomain: string): Map<string, DomainSnapshot> {
   const own = norm(ownDomain);
   const domains = new Set<string>([own]);
   for (const r of rows) for (const c of r.citations) {
      const d = norm(c.domain);
      // Own domain and its subdomains (e.g. blog.example.com) are not competitors.
      if (d && d !== own && !d.endsWith(`.${own}`) && !NOISE.has(d)) domains.add(d);
   }
   const map = new Map<string, DomainSnapshot>();
   for (const d of domains) map.set(d, snapshotForDomain(rows, d));
   return map;
}

/** All competitors (own excluded), each with its FULL snapshot, sorted by visibility desc.
 *  Callers slice top-N for the chart / instant-compare and use the whole list for the picker. */
export function rankCompetitors(byDomain: Map<string, DomainSnapshot>, ownDomain: string): RankedCompetitor[] {
   const own = norm(ownDomain);
   return Array.from(byDomain.entries())
      .filter(([domain]) => domain !== own && !domain.endsWith(`.${own}`))
      .map(([domain, snapshot]) => ({ domain, snapshot }))
      .sort((a, b) => b.snapshot.overview.visibilityScore - a.snapshot.overview.visibilityScore);
}

export type DomainGapCard = { domain: string, gap: number, shared: number, you: number };

function citedPromptsForDomain(rows: ResultRow[], domain: string): Set<number> {
   const d = norm(domain);
   const s = new Set<number>();
   if (!d) return s;
   for (const r of rows) {
      if (r.citations.some((c) => norm(c.domain) === d || norm(c.domain).endsWith(`.${d}`))) s.add(r.promptId);
   }
   return s;
}

/** Prompt-citation overlap between the tracked domain and a competitor domain:
 *  shared = both cited the prompt, gap = only the competitor, you = only tracked. */
export function domainMentionGap(rows: ResultRow[], competitorDomain: string, ownDomain: string): DomainGapCard {
   const own = citedPromptsForDomain(rows, ownDomain);
   const comp = citedPromptsForDomain(rows, competitorDomain);
   let gap = 0; let shared = 0; let you = 0;
   new Set<number>([...own, ...comp]).forEach((id) => {
      const o = own.has(id); const c = comp.has(id);
      if (o && c) shared += 1; else if (c) gap += 1; else if (o) you += 1;
   });
   return { domain: norm(competitorDomain), gap, shared, you };
}

/** Competitor domains (tracked domain + grounding noise excluded) ranked by gap desc. */
export function domainGapCandidates(rows: ResultRow[], ownDomain: string): string[] {
   const ownN = norm(ownDomain);
   const domains = new Set<string>();
   for (const r of rows) for (const c of r.citations) {
      const d = norm(c.domain);
      if (d && d !== ownN && !d.endsWith(`.${ownN}`) && !NOISE.has(d)) domains.add(d);
   }
   return Array.from(domains)
      .map((d) => ({ d, gap: domainMentionGap(rows, d, ownDomain).gap }))
      .sort((a, b) => b.gap - a.gap)
      .map((x) => x.d);
}

/** Per-URL mention flags for two brands (competitor modal "Mentions" tab): does the
 *  answer citing each source mention brand A (own) / brand B (the competitor). */
export function sourceMentions(rows: ResultRow[], brandA: string, brandB: string): Array<{ url: string, domain: string, timesShown: number, aMentioned: boolean, bMentioned: boolean }> {
   const byUrl = new Map<string, { url: string, domain: string, timesShown: number, aMentioned: boolean, bMentioned: boolean }>();
   for (const r of rows) {
      const a = !!brandA && answerHasBrand(r, brandA);
      const b = !!brandB && answerHasBrand(r, brandB);
      for (const c of r.citations) {
         const e = byUrl.get(c.url) ?? { url: c.url, domain: norm(c.domain), timesShown: 0, aMentioned: false, bMentioned: false };
         e.timesShown += 1;
         if (a) e.aMentioned = true;
         if (b) e.bMentioned = true;
         byUrl.set(c.url, e);
      }
   }
   return Array.from(byUrl.values()).sort((x, y) => y.timesShown - x.timesShown);
}

/** Per-prompt average citation position for ANY domain (competitor detail modal).
 *  null position = the domain was never cited for that prompt (renders as "—"). */
export function competitorPrompts(rows: ResultRow[], domain: string): Array<{ promptId: number, topic: string, text: string, avgPosition: number | null }> {
   const projected = projectRows(rows, domain);
   const byPrompt = new Map<number, { promptId: number, topic: string, text: string, positions: number[] }>();
   for (const r of projected) {
      const e = byPrompt.get(r.promptId) ?? { promptId: r.promptId, topic: r.topic, text: r.text, positions: [] };
      if (r.ownCited && r.ownPosition) e.positions.push(r.ownPosition);
      byPrompt.set(r.promptId, e);
   }
   return Array.from(byPrompt.values())
      .map((p) => ({ promptId: p.promptId, topic: p.topic, text: p.text, avgPosition: p.positions.length ? Math.round(mean(p.positions) * 10) / 10 : null }))
      .sort((a, b) => (a.avgPosition ?? Infinity) - (b.avgPosition ?? Infinity));
}

export type Trend = 'up' | 'down' | 'same';
export type MetricDelta = { current: number; previous: number; delta: number; trend: Trend };
export type OverviewDelta = {
   visibilityScore: MetricDelta;
   perModel: Array<{ model: string } & MetricDelta>;
   sources: { added: string[]; removed: string[] };
   prompts: { gained: number[]; lost: number[] };
};

const trendOf = (delta: number): Trend => (delta > 0 ? 'up' : delta < 0 ? 'down' : 'same');
const metricDelta = (current: number, previous: number): MetricDelta => ({ current, previous, delta: current - previous, trend: trendOf(current - previous) });

/** Diff two snapshots. Pure; callers decide what to do when there is no previous
 *  scan (they pass no delta at all — see the data endpoint). */
export function computeDelta(current: DomainSnapshot, previous: DomainSnapshot): OverviewDelta {
   const prevModel = new Map(previous.overview.perModel.map((m) => [m.model, m.score]));
   const perModel = current.overview.perModel.map((m) => ({ model: m.model, ...metricDelta(m.score, prevModel.get(m.model) ?? 0) }));

   const curDomains = new Set(current.sources.map((s) => s.domain));
   const prevDomains = new Set(previous.sources.map((s) => s.domain));
   const added = Array.from(new Set(current.sources.map((s) => s.domain).filter((d) => !prevDomains.has(d))));
   const removed = Array.from(new Set(previous.sources.map((s) => s.domain).filter((d) => !curDomains.has(d))));

   const curCited = new Set(current.citedPromptIds);
   const prevCited = new Set(previous.citedPromptIds);
   const gained = current.citedPromptIds.filter((id) => !prevCited.has(id));
   const lost = previous.citedPromptIds.filter((id) => !curCited.has(id));

   return {
      visibilityScore: metricDelta(current.overview.visibilityScore, previous.overview.visibilityScore),
      perModel,
      sources: { added, removed },
      prompts: { gained, lost },
   };
}

// ── Fan-out queries ────────────────────────────────────────────────────────
// The follow-up search queries an engine generates while answering a prompt
// (DataForSEO fan_out_queries). timesShown = # of (prompt×model) rows producing it.
export type FanoutByQuery = {
   query: string, promptCount: number, models: string[], timesShown: number,
   prompts: Array<{ id: number, text: string, topic: string, timesShown: number }>,
};
export type FanoutByPrompt = {
   id: number, text: string, topic: string, fanoutCount: number, models: string[], timesShown: number,
   queries: Array<{ query: string, models: string[], timesShown: number }>,
};

/** Group rows by distinct fan-out query → which prompts/models produced it. */
export function groupFanoutByQuery(rows: ResultRow[]): FanoutByQuery[] {
   const byQuery = new Map<string, { models: Set<string>, timesShown: number, prompts: Map<number, { text: string, topic: string, timesShown: number }> }>();
   for (const r of rows) {
      // Dedupe within a row: timesShown is per (prompt × model) row, not per array element.
      for (const q of new Set(r.fanOutQueries ?? [])) {
         const e = byQuery.get(q) ?? { models: new Set<string>(), timesShown: 0, prompts: new Map() };
         e.models.add(r.model);
         e.timesShown += 1;
         const p = e.prompts.get(r.promptId) ?? { text: r.text, topic: r.topic, timesShown: 0 };
         p.timesShown += 1;
         e.prompts.set(r.promptId, p);
         byQuery.set(q, e);
      }
   }
   return Array.from(byQuery.entries())
      .map(([query, e]) => ({
         query,
         promptCount: e.prompts.size,
         models: Array.from(e.models),
         timesShown: e.timesShown,
         prompts: Array.from(e.prompts.entries())
            .map(([id, p]) => ({ id, text: p.text, topic: p.topic, timesShown: p.timesShown }))
            .sort((a, b) => b.timesShown - a.timesShown),
      }))
      .sort((a, b) => b.timesShown - a.timesShown || a.query.localeCompare(b.query));
}

/** Group rows by prompt → the fan-out queries it generated. */
export function groupFanoutByPrompt(rows: ResultRow[]): FanoutByPrompt[] {
   const byPrompt = new Map<number, { text: string, topic: string, models: Set<string>, timesShown: number, queries: Map<string, { models: Set<string>, timesShown: number }> }>();
   for (const r of rows) {
      const fo = Array.from(new Set(r.fanOutQueries ?? [])); // dedupe per row (per prompt×model)
      if (!fo.length) continue;
      const e = byPrompt.get(r.promptId) ?? { text: r.text, topic: r.topic, models: new Set<string>(), timesShown: 0, queries: new Map() };
      for (const q of fo) {
         e.models.add(r.model);
         e.timesShown += 1;
         const qq = e.queries.get(q) ?? { models: new Set<string>(), timesShown: 0 };
         qq.models.add(r.model);
         qq.timesShown += 1;
         e.queries.set(q, qq);
      }
      byPrompt.set(r.promptId, e);
   }
   return Array.from(byPrompt.entries())
      .map(([id, e]) => ({
         id, text: e.text, topic: e.topic,
         fanoutCount: e.queries.size,
         models: Array.from(e.models),
         timesShown: e.timesShown,
         queries: Array.from(e.queries.entries())
            .map(([query, q]) => ({ query, models: Array.from(q.models), timesShown: q.timesShown }))
            .sort((a, b) => b.timesShown - a.timesShown),
      }))
      .sort((a, b) => b.timesShown - a.timesShown);
}

/** Frequent 2–5 word phrases across all fan-out strings (document frequency:
 *  # distinct queries containing the phrase). For the "Common phrases" pills. */
export function commonPhrases(rows: ResultRow[], opts: { min?: number, limit?: number } = {}): Array<{ phrase: string, count: number }> {
   const min = opts.min ?? 2;
   const limit = opts.limit ?? 30;
   const queries = new Set<string>();
   for (const r of rows) for (const q of r.fanOutQueries ?? []) { const t = q.toLowerCase().trim(); if (t) queries.add(t); }
   const freq = new Map<string, number>();
   for (const q of queries) {
      const words = q.split(/\s+/).filter(Boolean);
      const seen = new Set<string>();
      for (let n = 2; n <= 5; n += 1) {
         for (let i = 0; i + n <= words.length; i += 1) {
            const gram = words.slice(i, i + n).join(' ');
            if (seen.has(gram)) continue;
            seen.add(gram);
            freq.set(gram, (freq.get(gram) ?? 0) + 1);
         }
      }
   }
   return Array.from(freq.entries())
      .filter(([, c]) => c >= min)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count || b.phrase.length - a.phrase.length)
      .slice(0, limit);
}
