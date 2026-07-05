// Shared contract for the standalone Audit tool (SurferSEO-style content audit).
// Phase 1 (UI-first): the `you` column is real (computed offline from the fetched page
// HTML); competitor columns + suggested ranges are a clearly-labelled placeholder
// (placeholder:true) until phase 2 wires real DataForSEO SERP data.

export type AuditStatus = 'queued' | 'running' | 'completed' | 'failed';

/** One competitor's value for a factor (or for the Content Score). */
export interface AuditCompetitor {
   label: string; // domain, e.g. "detektywsigma.pl"
   rank: number; // Google position, e.g. 1
   value: number;
   url?: string; // the competitor's ranking article URL (chart tooltip → clickable link)
}

/** One bar-chart factor row (Word count, Exact keywords, TTFB, …). */
export interface AuditFactor {
   key: string; // stable id, e.g. 'word_count_body'
   section: string; // group heading, e.g. 'Word count'
   label: string; // e.g. '1430 words in body'
   you: number; // real
   competitors: AuditCompetitor[]; // stub in phase 1
   suggestedMin: number | null; // stub in phase 1
   suggestedMax: number | null; // stub in phase 1
   unit?: string; // e.g. 'ms', 'chars'
   verdict: 'ok' | 'warn' | 'info'; // green / yellow / blue info-only
   message: string; // e.g. 'Your web page has 1430 words in body, while…'
   placeholder: boolean; // true ⇒ competitor bars are sample data (dim + caption)
}

export interface AuditInternalLink {
   url: string;
   linked: boolean; // true ⇒ already links to the audited page
}

export interface AuditTerm {
   term: string;
   forms: number;
   you: number;
   suggested: string; // e.g. '1-2'
   relevance: number; // 0-100
   searchVolume: number | null;
   action: 'add' | 'remove' | 'ok';
   nlp: boolean;
}

export interface AuditResult {
   url: string;
   keyword: string;
   contentScore: number; // real (0-100)
   contentScoreCompetitors: AuditCompetitor[]; // stub in phase 1
   contentScoreSuggestedMin: number | null; // stub
   contentScoreSuggestedMax: number | null; // stub
   factors: AuditFactor[]; // real `you`, stub competitors/range
   internalLinks: AuditInternalLink[]; // real (from page HTML)
   terms: AuditTerm[]; // stub/empty in phase 1
   generatedAt: string;
}

/** List-card shape returned by GET /api/audit-tool/[slug]/list. */
export interface AuditCardDTO {
   id: number;
   url: string;
   keyword: string;
   status: AuditStatus;
   contentScore: number | null;
   progressDone: number;
   progressTotal: number;
   createdAt: string | null;
   finishedAt: string | null;
}
