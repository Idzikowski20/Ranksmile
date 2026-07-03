# AI Visibility — Compare Overview Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the AI Visibility Overview to SurferSEO's competitor-centric model — a competitor-ranking chart plus a Compare mode (you vs any competitor across every metric) and a bar↔line trend — all on one primitive: a per-domain snapshot.

**Architecture:** `snapshotForDomain(rows, domain)` is the single source of truth. `buildSnapshotsForScan` computes every domain's snapshot for a scan ONCE (normalized keys); `rankCompetitors` sorts them. The `overview` response embeds **full snapshots for the top-5 competitors** so choosing a competitor is a pure React state change — no extra request (a long-tail picker choice falls back to `?competitor=`). Competitor snapshots ship **without `sources`** (Compare never renders competitor sources; keeps the payload bounded). Frontend: competitor bars (hand-rolled SVG) + Compare picker (all competitors) + `react-chartjs-2` trend.

**Tech Stack:** Next.js 12 pages API, Sequelize raw SQL (`lib/db/query`), react-query v3, `react-chartjs-2` + `chart.js` (existing deps), Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-ai-visibility-compare-overview-design.md`.
- **Depends on PR #18** (`feature/ai-visibility-cyclic-tracking`): `computeDelta`, `/history`, jsonb `parseCitations` fix, `ResultRow`/`buildSnapshot`. **Cut the branch from `main` after #18 merges** (or from `feature/ai-visibility-cyclic-tracking`).
- `snapshotForDomain` is the ONLY public per-domain metrics entry; `computeOverview`/`aggregateSources` are internal (not exported). `buildOverview` is **removed** (callers use `snapshotForDomain(await loadScanResultRows(id), domain)`).
- Endpoints return whole snapshots. Compare is instant for the top 5 (embedded), a request only for the long tail.
- Domains are normalized ONCE (`norm` = lowercase + strip leading `www.`); endpoints don't re-normalize ad hoc.
- No new TypeScript `any`. API returns `domain` only; favicons built client-side (`https://www.google.com/s2/favicons?domain=<d>&sz=32`). Chart = top 5; picker = all. Compare auto-selects `competitors[0]`.
- Inline styles (per repo CLAUDE.md); font `var(--font-family-primary)`; tokens brand `#783AFB`, success `#1AB25E`, error `#FF6F77`, content `#18181B`, muted `#52525C`, card border `#F4F4F5`, panel border `#E4E4E7`.
- Commit after each task. Do NOT push/merge unless asked.

---

## File structure

| File | Responsibility |
|------|----------------|
| `lib/aiVisibilityMetrics.ts` (modify) | `ResultRow`+topic/text; `DomainSnapshot`; `snapshotForDomain`; private `computeOverview`/`aggregateSources`; `buildSnapshot` alias; `COMPETITOR_NOISE`; `buildSnapshotsForScan`; `RankedCompetitor`; `rankCompetitors` |
| `lib/aiVisibilityRead.ts` (modify) | `loadScanResultRows` joins topic/text; remove `buildOverview` |
| `pages/api/ai-visibility/[slug]/data.ts` (modify) | `overview` → `snapshot` + `competitors`(top5 w/ snapshot) + `competitorsAll` + optional `compare` |
| `pages/api/ai-visibility/[slug]/history.ts` (modify) | optional `?competitor=` → `series` per scan |
| `services/aiVisibility.tsx` (modify) | `useAiVisOverview`, `useAiVisHistory` |
| `components/aiVisibility/CompetitorBarChart.tsx` (create) | Top-5 bars, click→compare |
| `components/aiVisibility/TrendLineChart.tsx` (create) | You + competitor over time (chart.js) |
| `components/aiVisibility/CompetitorPicker.tsx` (create) | Search over ALL competitors |
| `pages/sites/[domain]/ai-visibility/overview.tsx` (modify) | Compare state (local-first), bar↔line toggle, "vs" |
| `__tests__/lib/aiVisibilityMetrics.test.ts` / `aiVisibilityRead.test.ts` (modify) | pure-fn tests |

---

## Phase A — data primitive

### Task A1: `ResultRow` carries topic + text

**Files:** Modify `lib/aiVisibilityMetrics.ts`, `lib/aiVisibilityRead.ts`; Test `__tests__/lib/aiVisibilityRead.test.ts`.

**Produces:** `ResultRow = { promptId, model, ownCited, ownPosition, citations, topic: string, text: string }`.

- [ ] **Step 1: Extend `ResultRow`** in `lib/aiVisibilityMetrics.ts`:

```ts
export type ResultRow = {
   promptId: number, model: string, ownCited: boolean, ownPosition: number | null,
   citations: LlmCitation[], topic: string, text: string,
};
```

- [ ] **Step 2: Join topic/text + REMOVE `buildOverview`** in `lib/aiVisibilityRead.ts`. Replace `DbResultRow`, `mapDbRowsToResultRows`, `loadScanResultRows`, and delete `buildOverview`:

```ts
import { queryRows } from './db/query';
import { snapshotForDomain, ResultRow } from './aiVisibilityMetrics';
import type { LlmCitation } from './dataforseoLlm';

export type DbResultRow = {
   prompt_id: number; model: string; own_cited: number; own_position: number | null;
   citations: unknown; topic: string; text: string;
};

export const parseCitations = (raw: unknown): LlmCitation[] => {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   return v
      .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof (c as { url?: unknown }).url === 'string')
      .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
};

export const mapDbRowsToResultRows = (dbRows: DbResultRow[]): ResultRow[] => dbRows.map((r) => ({
   promptId: r.prompt_id, model: r.model, ownCited: !!r.own_cited, ownPosition: r.own_position,
   citations: parseCitations(r.citations), topic: r.topic ?? '', text: r.text ?? '',
}));

export async function loadScanResultRows(scanId: number): Promise<ResultRow[]> {
   const dbRows = await queryRows<DbResultRow>(
      `SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, p.topic, p.text
       FROM ai_vis_results r JOIN ai_vis_prompts p ON p.id = r.prompt_id
       WHERE r.scan_id = ? AND r.error IS NULL`,
      [scanId],
   );
   return mapDbRowsToResultRows(dbRows);
}
```

`buildSnapshot`/`OverviewSnapshot` imports here are gone. Callers that used `buildOverview(scanId, domain)` now do `snapshotForDomain(await loadScanResultRows(scanId), domain)` (Phase B).

- [ ] **Step 3: Update the read test** — add `topic`/`text` to the `mapDbRowsToResultRows` fixture rows and assert them (see Task A1 in v1; same, add `topic:'T', text:'Q'` / `'T2','Q2'`).

- [ ] **Step 4: Commit**

```bash
git add lib/aiVisibilityMetrics.ts lib/aiVisibilityRead.ts __tests__/lib/aiVisibilityRead.test.ts
git commit -m "feat(ai-vis): ResultRow topic+text; drop buildOverview wrapper"
```

---

### Task A2: `snapshotForDomain` — the central primitive

**Files:** Modify `lib/aiVisibilityMetrics.ts`; Test `__tests__/lib/aiVisibilityMetrics.test.ts`.

**Produces:** `DomainSnapshot = { overview, sources, prompts: Array<{promptId,topic,text,score}>, topics: Array<{topic,score}>, citedPromptIds: number[] }`; `snapshotForDomain(rows, domain)`; `buildSnapshot(rows, ownDomain)` alias.

- [ ] **Step 1: Write the failing test** (first add `topic:'T', text:'Q'` to every row in the top `rows` fixture, and change existing `buildSnapshot(rowsX)` calls to `buildSnapshot(rowsX, 'idztech.pl')`). Then append:

```ts
import { snapshotForDomain } from '../../lib/aiVisibilityMetrics';

describe('snapshotForDomain', () => {
   it('equals buildSnapshot when domain === own', () => {
      const snap = snapshotForDomain(rows, 'idztech.pl');
      expect(snap.overview.visibilityScore).toBe(43);
      expect(snap.citedPromptIds).toEqual([1, 2]);
      expect(snap.prompts.find((p) => p.promptId === 1)?.score).toBe(50);
   });
   it('re-projects onto an arbitrary domain (oracle.com)', () => {
      const snap = snapshotForDomain(rows, 'oracle.com');
      expect(snap.overview.visibilityScore).toBeGreaterThan(0);
      expect(snap.overview.mentionRate).toBeGreaterThan(0);
   });
   it('aggregates prompts into topics', () => {
      expect(snapshotForDomain(rows, 'idztech.pl').topics.find((x) => x.topic === 'T')).toBeDefined();
   });
   it('uncited domain → all zero', () => {
      const snap = snapshotForDomain(rows, 'nobody.example');
      expect(snap.overview.visibilityScore).toBe(0);
      expect(snap.citedPromptIds).toEqual([]);
   });
});
```

- [ ] **Step 2: Run → fail** (`npx jest aiVisibilityMetrics -t snapshotForDomain`).

- [ ] **Step 3: Implement.** In `lib/aiVisibilityMetrics.ts`: drop `export` from `computeOverview` and `aggregateSources` (make them `function …` internal). Replace the `OverviewSnapshot` type + `buildSnapshot`:

```ts
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
   citedPromptIds: number[];
};

/** THE primitive: a full snapshot for ANY domain. Every view reads this shape. */
export function snapshotForDomain(rows: ResultRow[], domain: string): DomainSnapshot {
   const projected = projectRows(rows, domain);
   const prompts = promptsFor(projected);
   return {
      overview: computeOverview(projected),
      sources: aggregateSources(projected),
      prompts, topics: topicsFor(prompts),
      citedPromptIds: Array.from(new Set(projected.filter((r) => r.ownCited).map((r) => r.promptId))).sort((a, b) => a - b),
   };
}

export function buildSnapshot(rows: ResultRow[], ownDomain: string): DomainSnapshot {
   return snapshotForDomain(rows, ownDomain);
}
```

Rename `OverviewSnapshot` → `DomainSnapshot` in `computeDelta`'s signature (the fields it reads all still exist).

- [ ] **Step 4: Update metrics tests** — fixture `topic`/`text` + `buildSnapshot(x,'idztech.pl')` (done in Step 1).

- [ ] **Step 5: Run + commit**

```bash
npx jest aiVisibilityMetrics
git add lib/aiVisibilityMetrics.ts __tests__/lib/aiVisibilityMetrics.test.ts
git commit -m "feat(ai-vis): snapshotForDomain primitive (overview+sources+prompts+topics)"
```

---

### Task A3: competitor ranking (full snapshots) + noise + cache

**Files:** Modify `lib/aiVisibilityMetrics.ts`; Test `__tests__/lib/aiVisibilityMetrics.test.ts`.

**Produces:** `COMPETITOR_NOISE: string[]`; `RankedCompetitor = { domain: string, snapshot: DomainSnapshot }`; `buildSnapshotsForScan(rows, ownDomain): Map<string, DomainSnapshot>`; `rankCompetitors(byDomain, ownDomain): RankedCompetitor[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildSnapshotsForScan, rankCompetitors, COMPETITOR_NOISE } from '../../lib/aiVisibilityMetrics';

describe('competitor ranking', () => {
   const rowsWithNoise: ResultRow[] = [
      { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', citations: [cit('vertexaisearch.cloud.google.com'), cit('oracle.com', 'https://oracle.com/a')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', citations: [cit('oracle.com', 'https://oracle.com/b')] },
   ];
   it('COMPETITOR_NOISE lists the grounding proxy', () => {
      expect(COMPETITOR_NOISE).toContain('vertexaisearch.cloud.google.com');
   });
   it('buildSnapshotsForScan: entry per own + cited domain, minus noise', () => {
      const map = buildSnapshotsForScan(rowsWithNoise, 'idztech.pl');
      expect(map.has('idztech.pl')).toBe(true);
      expect(map.has('oracle.com')).toBe(true);
      expect(map.has('vertexaisearch.cloud.google.com')).toBe(false);
   });
   it('rankCompetitors: full snapshots, sorted desc, own excluded', () => {
      const ranked = rankCompetitors(buildSnapshotsForScan(rowsWithNoise, 'idztech.pl'), 'idztech.pl');
      expect(ranked.find((c) => c.domain === 'idztech.pl')).toBeUndefined();
      expect(ranked[0].domain).toBe('oracle.com');
      expect(ranked[0].snapshot.overview.visibilityScore).toBeGreaterThan(0);
      expect(ranked[0].snapshot.prompts.length).toBeGreaterThan(0); // full snapshot embedded
   });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (append to `lib/aiVisibilityMetrics.ts`):

```ts
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
```

- [ ] **Step 4: Run + commit**

```bash
npx jest aiVisibilityMetrics -t "competitor ranking"
git add lib/aiVisibilityMetrics.ts __tests__/lib/aiVisibilityMetrics.test.ts
git commit -m "feat(ai-vis): rankCompetitors with embedded snapshots + buildSnapshotsForScan + noise"
```

---

## Phase B — endpoints

### Task B1: `data.ts` overview → snapshot + competitors(top5 snapshot) + all + compare-fallback

**Files:** Modify `pages/api/ai-visibility/[slug]/data.ts`.

**Produces:** `GET data?view=overview[&competitor=<domain>]` → `{ scanId, finishedAt, snapshot, competitors, competitorsAll, compare?, delta, previousScanAt, nextRefreshAt, daysUntilRefresh }`. Competitor snapshots ship WITHOUT `sources`.

- [ ] **Step 1: Add a small serializer + rewrite the `overview` branch.** Above the handler add:

```ts
// Compare never renders a competitor's Sources → drop them to bound the payload.
const withoutSources = (s: import('../../../../lib/aiVisibilityMetrics').DomainSnapshot) => ({ ...s, sources: [] as never[] });
const NORM = (d: string) => d.toLowerCase().replace(/^www\./, '');
```

Replace the `if (view === 'overview')` block with:

```ts
      if (view === 'overview') {
         const own = domain.domain;
         const ownKey = NORM(own);
         const byDomain = buildSnapshotsForScan(rows, own);
         const ownSnap = byDomain.get(ownKey) ?? snapshotForDomain(rows, own);
         const ranked = rankCompetitors(byDomain, own);

         const competitors = ranked.slice(0, 5).map((c) => ({ domain: c.domain, snapshot: withoutSources(c.snapshot) }));
         const competitorsAll = ranked.map((c) => ({ domain: c.domain, visibilityScore: c.snapshot.overview.visibilityScore }));

         // Long-tail: a picker choice outside the top-5. Reuse the already-computed map.
         const wanted = typeof req.query.competitor === 'string' ? NORM(req.query.competitor) : '';
         const compare = wanted && byDomain.has(wanted) && !competitors.some((c) => c.domain === wanted)
            ? { competitorDomain: wanted, snapshot: withoutSources(byDomain.get(wanted)!) } : null;

         const prev = scan.finished_at ? await queryOne<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s
             JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' AND s.finished_at < ?
             ORDER BY s.finished_at DESC LIMIT 1`,
            [domain.ID, scan.finished_at],
         ) : undefined;
         const delta = prev ? computeDelta(ownSnap, snapshotForDomain(await loadScanResultRows(prev.id), own)) : null;

         const nextRefreshAt = scan.finished_at
            ? new Date(new Date(scan.finished_at).getTime() + AI_VIS_SETTINGS.REFRESH_INTERVAL_DAYS * 86_400_000).toISOString() : null;
         const daysUntilRefresh = nextRefreshAt ? Math.max(0, Math.ceil((new Date(nextRefreshAt).getTime() - Date.now()) / 86_400_000)) : null;

         return res.status(200).json({
            scanId: scan.id, finishedAt: scan.finished_at,
            snapshot: ownSnap, competitors, competitorsAll, compare,
            delta, previousScanAt: prev ? prev.finished_at : null, nextRefreshAt, daysUntilRefresh,
         });
      }
```

- [ ] **Step 2: Imports.** `import { buildSnapshotsForScan, rankCompetitors, snapshotForDomain, computeDelta, aggregateSources, aggregateCompetitors, ResultRow } from '../../../../lib/aiVisibilityMetrics';` (drop `buildSnapshot`; keep `aggregateSources`/`aggregateCompetitors` for the untouched sources/competitors/prompts view branches). `loadScanResultRows` stays imported.

- [ ] **Step 3: Type-check + manual.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0. Manual: `?view=overview` → `snapshot`, `competitors` (≤5, each `.snapshot` sans sources), `competitorsAll` (all, `{domain,visibilityScore}`), `compare:null`. `&competitor=<non-top5 domain>` → `compare.snapshot`.

- [ ] **Step 4: Commit**

```bash
git add "pages/api/ai-visibility/[slug]/data.ts"
git commit -m "feat(ai-vis): overview embeds top-5 competitor snapshots (instant compare)"
```

---

### Task B2: `history.ts` → `series` per scan

**Files:** Modify `pages/api/ai-visibility/[slug]/history.ts`.

**Produces:** `GET /history[?competitor=<domain>]` → `{ scans: Array<{ scanId, finishedAt, series: { you: overview|null, competitor?: overview } }> }`.

- [ ] **Step 1: Rewrite the loop** (use `loadScanResultRows` + `buildSnapshotsForScan`; `buildOverview` is gone):

```ts
      const wanted = typeof req.query.competitor === 'string' ? req.query.competitor.toLowerCase().replace(/^www\./, '') : '';
      const ownKey = domain.domain.toLowerCase().replace(/^www\./, '');
      const out = [] as Array<{ scanId: number, finishedAt: string | null, series: { you: unknown, competitor?: unknown } }>;
      for (const s of scans) {
         const byDomain = buildSnapshotsForScan(await loadScanResultRows(s.id), domain.domain);
         const series: { you: unknown, competitor?: unknown } = { you: byDomain.get(ownKey)?.overview ?? null };
         if (wanted && byDomain.has(wanted)) series.competitor = byDomain.get(wanted)!.overview;
         out.push({ scanId: s.id, finishedAt: s.finished_at, series });
      }
      return res.status(200).json({ scans: out });
```

Update imports to `loadScanResultRows` + `buildSnapshotsForScan` (drop `buildOverview`). Keep `HISTORY_LIMIT`.

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
git add "pages/api/ai-visibility/[slug]/history.ts"
git commit -m "feat(ai-vis): history returns you(+competitor) overview series per scan"
```

---

## Phase C — Compare frontend

### Task C1: services hooks + DTOs

**Files:** Modify `services/aiVisibility.tsx`.

- [ ] **Step 1: Add typed hooks** (append):

```tsx
export type DomainOverview = { visibilityScore: number; mentionRate: number; avgPosition: number | null; directCitations: number; pages: number; perModel: Array<{ model: string; score: number }> };
export type DomainSnapshotDTO = { overview: DomainOverview; sources: Array<{ url: string; domain: string; timesShown: number; models: string[] }>; prompts: Array<{ promptId: number; topic: string; text: string; score: number }>; topics: Array<{ topic: string; score: number }>; citedPromptIds: number[] };
export type OverviewPayload = {
   pending?: boolean; scanId?: number; finishedAt?: string | null;
   snapshot?: DomainSnapshotDTO;
   competitors?: Array<{ domain: string; snapshot: DomainSnapshotDTO }>;   // top-5, sources emptied
   competitorsAll?: Array<{ domain: string; visibilityScore: number }>;     // all, for the picker
   compare?: { competitorDomain: string; snapshot: DomainSnapshotDTO } | null; // long-tail fallback
   delta?: unknown; nextRefreshAt?: string | null; daysUntilRefresh?: number | null;
};

export function useAiVisOverview(slug: string | undefined, competitor?: string) {
   const q = competitor ? `&competitor=${encodeURIComponent(competitor)}` : '';
   return useQuery<OverviewPayload>(['ai-vis-overview', slug, competitor || ''],
      () => fetchJson<OverviewPayload>(`/api/ai-visibility/${slug}/data?view=overview${q}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}

export type HistoryPayload = { scans: Array<{ scanId: number; finishedAt: string | null; series: { you: DomainOverview | null; competitor?: DomainOverview | null } }> };
export function useAiVisHistory(slug: string | undefined, competitor?: string) {
   const q = competitor ? `?competitor=${encodeURIComponent(competitor)}` : '';
   return useQuery<HistoryPayload>(['ai-vis-history', slug, competitor || ''],
      () => fetchJson<HistoryPayload>(`/api/ai-visibility/${slug}/history${q}`),
      { enabled: !!slug, staleTime: 60_000, keepPreviousData: true });
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
git add services/aiVisibility.tsx
git commit -m "feat(ai-vis): useAiVisOverview + useAiVisHistory hooks"
```

---

### Task C2: `CompetitorBarChart` (create)

Same component as v1 (`components/aiVisibility/CompetitorBarChart.tsx`), typed to `{ domain, overview: { visibilityScore } }[]` — the page passes `competitors.map(c => ({ domain: c.domain, overview: c.snapshot.overview }))`. Full code:

```tsx
import React from 'react';
const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
type Ranked = { domain: string; overview: { visibilityScore: number } };
const CompetitorBarChart = ({ competitors, selected, onSelect }: { competitors: Ranked[]; selected: string | null; onSelect: (d: string) => void }) => {
   const shown = competitors.slice(0, 5);
   if (!shown.length) return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: FONT }}>No competitors cited yet.</div>;
   return (
      <div style={{ display: 'flex', height: 300, width: '100%' }}>
         {shown.map((c) => {
            const score = c.overview.visibilityScore; const isSel = c.domain === selected;
            return (
               <button key={c.domain} type="button" onClick={() => onSelect(c.domain)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{score}</span>
                  <div style={{ width: 64, height: `${Math.max(2, score)}%`, borderRadius: '8px 8px 0 0', background: isSel ? '#783AFB' : '#C9B8FD', transition: 'background 150ms ease' }} />
                  <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '8px 0', maxWidth: '100%' }}>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                     <span title={c.domain} style={{ fontSize: 12, color: '#52525C', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                  </span>
               </button>
            );
         })}
      </div>
   );
};
export default CompetitorBarChart;
```

Commit: `feat(ai-vis): CompetitorBarChart`.

---

### Task C3: `CompetitorPicker` (create)

Same as v1 (`components/aiVisibility/CompetitorPicker.tsx`), prop `competitors: Array<{ domain: string }>` fed from `competitorsAll`. (Full code identical to v1 Task C3.) Commit: `feat(ai-vis): CompetitorPicker over all competitors`.

---

### Task C4: wire Compare (local-first) into Overview

**Files:** Modify `pages/sites/[domain]/ai-visibility/overview.tsx`.

- [ ] **Step 1: State + local-first compare resolution.** In `AiVisibilityOverview`, use a **base** query (own + top-5 competitors, no competitor param) plus a **second** query that fires ONLY when the chosen competitor is not one of the embedded top-5. Different query keys → the top-5 case never refetches.

```tsx
   const [compareDomain, setCompareDomain] = useState<string | null>(null);

   const baseQ = useAiVisOverview(slug);                 // key ['ai-vis-overview', slug, ''] — no competitor param
   const ov = baseQ.data;
   const competitors = ov?.competitors || [];            // top-5, each with embedded snapshot (sources emptied)
   const competitorsAll = ov?.competitorsAll || [];      // all domains, for the picker
   useEffect(() => { if (!compareDomain && competitors.length) setCompareDomain(competitors[0].domain); }, [competitors, compareDomain]);

   const embeddedSnap = compareDomain ? (competitors.find((c) => c.domain === compareDomain)?.snapshot ?? null) : null;
   const isLongTail = !!compareDomain && !embeddedSnap;
   const longTailQ = useAiVisOverview(slug, isLongTail ? (compareDomain as string) : undefined); // fires only for long-tail
   const compareSnap = embeddedSnap ?? (isLongTail ? (longTailQ.data?.compare?.snapshot ?? null) : null);

   const own = ov?.snapshot?.overview;
   const comp = compareSnap?.overview ?? null;
   const pending = baseQ.isLoading || ov?.pending || !ov?.snapshot;
```

- [ ] **Step 2: Chart + header.** Visibility panel: `title` shows `own.visibilityScore` + (`comp` ? `vs {comp.visibilityScore}`); `action` = `<CompetitorPicker competitors={competitorsAll} selected={compareDomain} onSelect={setCompareDomain} />`; body = `<CompetitorBarChart competitors={competitors.map((c) => ({ domain: c.domain, overview: c.snapshot.overview }))} selected={compareDomain} onSelect={setCompareDomain} />`.

- [ ] **Step 3: Stats + Topics&Prompts "vs".** Stat cards read `own` (+ `comp` for the "vs 16%"/"vs 5.6" suffix). Topics & Prompts read `ov.snapshot.prompts`/`ov.snapshot.topics` (own) zipped by `promptId`/`topic` with `compareSnap?.prompts`/`compareSnap?.topics` for the `vs` value. Drop the old separate `prompts`/`sources` `useAiVisData` queries; Sources reads `ov.snapshot.sources`.

- [ ] **Step 4: tsc + manual + commit.** `npx tsc --noEmit` → 0. Manual: bars, Compare auto-#1 (instant), picker (all; long-tail loads), "vs" everywhere.

```bash
git add "pages/sites/[domain]/ai-visibility/overview.tsx"
git commit -m "feat(ai-vis): competitor bar chart + local-first Compare on Overview"
```

---

## Phase D — trend line

### Task D1: `TrendLineChart` (create)

`components/aiVisibility/TrendLineChart.tsx` — reads the `series` shape:

```tsx
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
type Point = { finishedAt: string | null; series: { you: { visibilityScore: number } | null; competitor?: { visibilityScore: number } | null } };
const TrendLineChart = ({ scans, competitorDomain }: { scans: Point[]; competitorDomain: string | null }) => {
   const labels = scans.map((s) => (s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : ''));
   const datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string; tension: number }> = [
      { label: 'You', data: scans.map((s) => s.series.you?.visibilityScore ?? 0), borderColor: '#783AFB', backgroundColor: '#783AFB', tension: 0.3 },
   ];
   if (competitorDomain) datasets.push({ label: competitorDomain, data: scans.map((s) => s.series.competitor?.visibilityScore ?? 0), borderColor: '#9F9FA9', backgroundColor: '#9F9FA9', tension: 0.3 });
   return <div style={{ height: 300 }}><Line data={{ labels, datasets }} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { position: 'bottom' } } }} /></div>;
};
export default TrendLineChart;
```

Commit: `feat(ai-vis): TrendLineChart (you + competitor over time)`.

---

### Task D2: bar↔line toggle on Overview

**Files:** Modify `pages/sites/[domain]/ai-visibility/overview.tsx`.

- [ ] Add `const [chartMode, setChartMode] = useState<'bar'|'line'>('bar');` + `const historyQ = useAiVisHistory(slug, compareDomain || undefined);`. In the Visibility panel `action`, prepend a two-button toggle (reuse existing inline-SVG bar/line icons from the codebase). Body: `chartMode === 'bar' ? <CompetitorBarChart .../> : <TrendLineChart scans={historyQ.data?.scans || []} competitorDomain={compareDomain} />`.
- [ ] tsc → 0; manual: toggle switches views; commit `feat(ai-vis): bar↔line chart toggle`.

---

## Task E: Final sweep
- [ ] `npx tsc --noEmit` → 0. `npx jest aiVisibility` → all pass. `npx eslint` touched files (house-style max-len OK). Manual end-to-end: bars, Compare (instant top-5 / long-tail load), picker all, "vs", bar↔line, Sources populated. Commit sweep fixes.

## Deferred / out of scope
- Domain→brand-name mapping/logos; per-model as an "All models" view; Export/PDF (snapshot model makes them cheap); migrating dedicated sources/competitors/prompts sub-pages to `snapshot` (still on legacy view branches); per-competitor delta/trend beyond visibility score.
