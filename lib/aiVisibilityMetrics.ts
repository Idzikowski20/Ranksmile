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

export function aggregateSources(rows: ResultRow[]) {
   const byUrl = new Map<string, { url: string, domain: string, timesShown: number, models: Set<string> }>();
   for (const r of rows) {
      for (const c of r.citations) {
         const entry = byUrl.get(c.url) ?? { url: c.url, domain: norm(c.domain), timesShown: 0, models: new Set<string>() };
         entry.timesShown += 1;
         entry.models.add(r.model);
         byUrl.set(c.url, entry);
      }
   }
   return Array.from(byUrl.values())
      .sort((a, b) => b.timesShown - a.timesShown)
      .map((e) => ({ url: e.url, domain: e.domain, timesShown: e.timesShown, models: Array.from(e.models) }));
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
   const domains = new Set<string>([norm(ownDomain)]);
   for (const r of rows) for (const c of r.citations) {
      const d = norm(c.domain);
      if (d && !NOISE.has(d)) domains.add(d);
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
      .filter(([domain]) => domain !== own)
      .map(([domain, snapshot]) => ({ domain, snapshot }))
      .sort((a, b) => b.snapshot.overview.visibilityScore - a.snapshot.overview.visibilityScore);
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
