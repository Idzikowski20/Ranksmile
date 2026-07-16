/**
 * Topic Research (More tools › Topic Research) — Surfer "Topic Explorer" parity.
 * One run per (domain, seed, country). The full result is serialized into
 * topic_research_runs.result_json; a small summary is mirrored into stats_json so
 * the list cards render without parsing the (large) result.
 *
 * Shape: a run has named topic CLUSTERS; each cluster holds IDEAS; each idea is a
 * head keyword ("main") plus the long-tail KEYWORDS grouped under it.
 */

export type TopicResearchStatus = 'queued' | 'running' | 'completed' | 'failed';

/** A single keyword with its metrics (DataForSEO volume/KD + own-domain SERP position). */
export interface TopicKeyword {
   keyword: string;
   volume: number | null;
   kd: number | null;
   position: number | null;
}

/** A content idea: a head keyword and the keywords grouped under it ("incl. N keywords"). */
export interface TopicIdea {
   main: string;
   volume: number | null;
   kd: number | null;
   position: number | null;
   keywords: TopicKeyword[];
   /** Opportunity score 0–10 (high volume, low KD, not yet covered). */
   score: number;
   recommended: boolean;
   clusterIndex: number;
}

export interface TopicCluster {
   index: number;
   title: string;
   summary: string;
   kd: number;
   volume: number;
   covered: number;
   total: number;
   ideas: TopicIdea[];
}

export interface TopicResearchStats {
   topicalAuthority: number;
   coveredIdeas: number;
   totalIdeas: number;
   kwTop3: number;
   kwTop10: number;
   kwTop50: number;
   searchVolume: number;
   clusterCount: number;
   recommendationCount: number;
   /** 0–1 topical focus (dominant cluster share, radius-adjusted). */
   siteFocusScore?: number;
   /** 0–1 topical spread across clusters (higher = more diffuse). */
   siteRadius?: number;
}

export interface TopicResearchResult {
   seed: string;
   country: string;
   clusters: TopicCluster[];
   stats: TopicResearchStats;
}

/** Row shown on the list page — mirrors AuditCardDTO. */
export interface TopicResearchCardDTO {
   id: number;
   seed: string;
   country: string | null;
   status: TopicResearchStatus;
   totalIdeas: number | null;
   searchVolume: number | null;
   createdAt: string | null;
   finishedAt: string | null;
}
