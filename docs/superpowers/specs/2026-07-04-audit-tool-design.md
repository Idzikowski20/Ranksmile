# Audit Tool — Design Spec

**Date:** 2026-07-04
**Status:** Approved (approach + stub strategy confirmed by user)

## Goal

A standalone **Audit** tool under the sidebar "More tools" group — a SurferSEO/Peec-style
content audit. User enters a URL + one or more keywords; each keyword produces one audit
that runs in the background and, when done, opens a detailed view: a **Content Score** bar
chart, an **Internal links** table, a **Terms to Use** (NLP) table, and ~10 **factor charts**
(amCharts) comparing the audited page ("You") against ranked Google competitors and a
suggested range.

This is **phase 1 (UI-first)**: the full UI ships now. The **"You" column is real**
(computed offline from the fetched page HTML via `lib/contentScore.ts` + cheerio). The
**competitor columns and suggested ranges are a visible, clearly-labelled placeholder**
("przykładowe dane" / dimmed) until phase 2 wires real DataForSEO SERP scraping.

## Non-goals (phase 1)

- No real competitor SERP scraping / DataForSEO calls.
- No real NLP term extraction (Terms-to-Use is placeholder-populated from the page's own
  prominent terms where cheaply available, else empty-state).
- Reuses none of the GSC-based `content-audit.tsx` (articles+GSC) — this is separate.

## Architecture (mirrors AI-Visibility conventions)

### Routing / nav
- List:   `pages/sites/[domain]/audit-tool.tsx`
- Detail: `pages/sites/[domain]/audit-tool/[id].tsx`
- Sidebar: repoint the existing "More tools › Audit" item to the domain-scoped list route
  (built like the SEO-group hrefs, using the active domain slug).

### Data model — `lib/ensureAuditTables.ts` (idempotent, mirrors `ensureAiVisibilityTables.ts`)
```
audit_runs
  id            PK
  domain_id     INTEGER NOT NULL
  url           TEXT NOT NULL
  keyword       TEXT NOT NULL
  status        TEXT DEFAULT 'queued'   -- queued | running | completed | failed
  content_score INTEGER
  result_json   JSONB/TEXT              -- serialized AuditResult (below)
  progress_done INTEGER DEFAULT 0
  progress_total INTEGER DEFAULT 0
  error         TEXT
  started_at    TIMESTAMP               -- staleness heartbeat
  finished_at   TIMESTAMP
  created_at    TIMESTAMP DEFAULT now
index idx_audit_runs_domain ON (domain_id)
```
One row per (url, keyword). `AuditRunRow` type added to `lib/db/query.ts`.

### Shared contract — `lib/auditTypes.ts`
```ts
export type AuditStatus = 'queued' | 'running' | 'completed' | 'failed';

// One bar-chart factor. `you` is real; `competitors`/`range` are placeholder in phase 1.
export interface AuditFactor {
  key: string;                 // 'word_count_body', 'h2_h6_words', 'ttfb', ...
  section: string;             // group heading e.g. 'Word count'
  label: string;               // 'X words in body'
  you: number;
  competitors: { label: string; rank: number; value: number }[]; // stub in phase 1
  suggestedMin: number | null; // stub in phase 1
  suggestedMax: number | null; // stub in phase 1
  unit?: string;
  verdict: 'ok' | 'warn' | 'info';   // green / yellow / blue info-only
  message: string;
  placeholder: boolean;        // true ⇒ competitor bars are sample data (dim + label)
}

export interface AuditInternalLink { url: string; linked: boolean; }

export interface AuditTerm {
  term: string; forms: number; you: number;
  suggested: string; relevance: number; searchVolume: number | null;
  action: 'add' | 'remove' | 'ok'; nlp: boolean;
}

export interface AuditResult {
  url: string;
  keyword: string;
  contentScore: number;                          // real
  contentScoreCompetitors: { label: string; rank: number; value: number }[]; // stub
  factors: AuditFactor[];                        // real 'you', stub competitors/range
  internalLinks: AuditInternalLink[];            // real (from page HTML)
  terms: AuditTerm[];                            // stub/empty in phase 1
  generatedAt: string;
}
```

### Compute — `lib/auditCompute.ts`
`computeAudit(url, keyword): Promise<AuditResult>`:
1. `assertPublicUrl(url)` (SSRF), then `fetch` measuring TTFB + total load ms.
2. `cheerio.load(html)` → extract title, meta description, h1 count, h2–h6 count/words,
   paragraph count/words, body word count, image count, strong/b count/words, internal
   `<a>` (same-registrable-domain).
3. Keyword metrics via `lib/contentScore.ts` `countOccurrences` (exact) + partial.
4. Content Score via `computeContentScore(...)`.
5. Build `factors[]` with real `you`; `competitors`/`suggestedMin/Max` = deterministic
   stub derived from `you` (e.g. you×[0.6..1.4] for 3 fake ranks), `placeholder:true`.
6. `internalLinks` real; `terms` empty (phase-1 empty-state) unless article `score_data`
   terms are cheaply available.

### API (mirror `pages/api/ai-visibility/[slug]/*`)
- `POST /api/audit-tool/[slug]/create`  `{ url, keywords: string[] }` → inserts one queued
  run per keyword, fire-and-forget kicks `computeAudit`; returns `{ ids }`.
- `GET  /api/audit-tool/[slug]/list`    → `{ items: AuditCardDTO[] }`.
- `GET  /api/audit-tool/[slug]/status`  → `{ runs: {id,status,progressDone,progressTotal}[] }`
  (polled while any run is queued/running).
- `GET  /api/audit-tool/[slug]/[id]`    → `{ run, result }` (result parsed from result_json).
All: `verifyUser` + `verifyDomainOwnershipBySlug` + `ensureAuditTables()`.

### Services — `services/auditTool.tsx` (react-query)
`useAuditList(slug)`, `useAuditRun(slug,id)`, `useAuditStatus(slug)` (refetchInterval
3s running / 5s queued / false idle, mirrors `useAiVisScanStatus`), `useCreateAudit(slug)`.

### UI (inline styles, design.md tokens, `/frontend-design` before writing)
- **List** — cards reuse the 133px content-editor row idiom (Gauge + status badge +
  progress bar while running) + "Create new Audit" primary button.
- **CreateAuditModal** — URL input + keyword textarea (one keyword per line → N audits).
- **Detail** (`max-width 880`, sticky header per AiVisPageShell idiom) — Content Score
  section, Internal links table, Terms to Use table, then factor sections.
- **AuditFactorChart** — shared amCharts 5 column chart (You / competitors / suggested
  range), `dynamic(() => ..., { ssr:false })` (amCharts is client-only). Placeholder
  competitor bars are dimmed + carry a "przykładowe dane" caption.

## Sequencing (branch `feature/audit-tool`, tsc + jest gate between each)
1. Foundation: `ensureAuditTables` + `AuditRunRow` + `auditTypes.ts`.
2. `auditCompute` + unit tests (real "You" metrics from a fixture HTML).
3. API endpoints + `services/auditTool.tsx`.
4. List page + AuditCard + CreateAuditModal + sidebar nav.
5. Detail page: Content Score / Internal links / Terms sections.
6. `AuditFactorChart` (amCharts) wired across factor sections.
7. Verify (tsc + jest), open PR, wait for cubic before merge.

## Verification
- `npx tsc --noEmit` clean; `npx jest --ci` green (incl. new auditCompute tests).
- No new `any`. Never commit `.env` / `*.pyc`.
