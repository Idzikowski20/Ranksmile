# AI Visibility — Cyclic Tracking & Cost Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound ongoing AI Visibility cost by scanning every 14 days (not on demand) and surface what changed between scans — keeping all 50 prompts × 5 engines every scan.

**Architecture:** The always-on python-sidecar owns cadence: a startup `asyncio` loop polls a new Next `due-scans` endpoint every 6h and drives due scans through the existing durable worker. Change detection is pure computation over the two most recent completed scans. A manual-refresh guard returns `409 needsConfirm` under a 7-day cooldown. A `/history` endpoint exposes completed-scan scores for future trend charts.

**Tech Stack:** Next.js 12 (pages API), Sequelize raw SQL via `lib/db/query` (`queryOne`/`queryRows`), react-query v3, FastAPI + httpx (python-sidecar), Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-ai-visibility-cyclic-tracking-design.md`.
- Do NOT rebuild the step-2 durable worker (`runScanChunk`, `kickAiVisScan`, `run-chunk` endpoint, sidecar `run_scan_loop` + `/ai-visibility/run-scan`, `/scan` hand-off). Build on it.
- No new TypeScript `any`; prefer precise types / `unknown` + narrowing.
- Dialect portability: branch on `const isPg = !!process.env.DATABASE_URL` for date math (Postgres `INTERVAL` vs SQLite `datetime(...)`), mirroring the stale-reclaim in `enqueueAiVisScan`.
- Interpolate ONLY non-user constants into SQL (`REFRESH_INTERVAL_DAYS`, `SCHEDULER_BATCH_LIMIT`); everything else uses `?` replacements.
- Internal machine endpoints authenticate with `x-internal-token === process.env.INTERNAL_PIPELINE_TOKEN` only (no user session). User-facing endpoints use `verifyUser` + `verifyDomainOwnershipBySlug`.
- Cost of a full scan ≈ $4 — the manual guard exists to prevent accidental spend. Never trigger a full scan from a test.
- Commit after each task. Do NOT push (user pushes on request).
- New AI Visibility cadence values live in the `AI_VIS_SETTINGS` constants object (Task 1).

---

## File structure

| File | Responsibility |
|------|----------------|
| `lib/aiVisibility.ts` (modify) | Add `AI_VIS_SETTINGS` cadence constants object |
| `lib/aiVisibilityMetrics.ts` (modify) | Add pure `OverviewSnapshot`, `buildSnapshot`, `computeDelta` |
| `lib/aiVisibilityRead.ts` (create) | DB → snapshot: `parseCitations`, `mapDbRowsToResultRows`, `loadScanResultRows`, `buildOverview` |
| `lib/aiVisibilityScan.ts` (modify) | Add `findDueConfigIds` |
| `pages/api/ai-visibility/[slug]/data.ts` (modify) | Attach `delta` + `previousScanAt` to `overview` view |
| `pages/api/ai-visibility/[slug]/history.ts` (create) | Completed scans + visibilityScore, newest-first |
| `pages/api/ai-visibility/[slug]/scan.ts` (modify) | Manual-refresh 409 guard |
| `pages/api/ai-visibility/internal/due-scans.ts` (create) | Find due configs, enqueue, return scanIds |
| `python-sidecar/pipeline/ai_vis_scheduler.py` (create) | `asyncio.Lock`-guarded tick loop |
| `python-sidecar/main.py` (modify) | Startup hook launching the scheduler |
| `services/aiVisibility.tsx` (modify) | `useStartAiVisScan` force + 409 handling |
| `pages/sites/[domain]/ai-visibility/overview.tsx` (modify) | Delta badges, "last updated", Refresh button + confirm modal |
| `__tests__/lib/aiVisibilityMetrics.test.ts` (modify) | Tests for `buildSnapshot` + `computeDelta` |
| `__tests__/lib/aiVisibilityRead.test.ts` (create) | Tests for `parseCitations` + `mapDbRowsToResultRows` |
| `__tests__/lib/aiVisibilityDue.test.ts` (create) | Tests for `findDueConfigIds` SQL shape |

---

## Task 1: `AI_VIS_SETTINGS` cadence constants

**Files:**
- Modify: `lib/aiVisibility.ts` (after line 30, the runner-tuning block)

**Interfaces:**
- Produces: `export const AI_VIS_SETTINGS = { REFRESH_INTERVAL_DAYS: 14, MANUAL_REFRESH_COOLDOWN_DAYS: 7, SCHEDULER_TICK_HOURS: 6, SCHEDULER_BATCH_LIMIT: 5 } as const`

- [ ] **Step 1: Add the constants object**

In `lib/aiVisibility.ts`, immediately after the line `export const AI_VIS_SCAN_STALE_MS = 10 * 60 * 1000; // a \`running\` scan older than this is dead`, add:

```ts
/** Cyclic-tracking tunables — one home so cadence, cooldown, scheduler tick, and
 *  batch size are all findable together. SCHEDULER_TICK_HOURS is mirrored in
 *  python-sidecar/pipeline/ai_vis_scheduler.py (Python can't import TS). */
export const AI_VIS_SETTINGS = {
   REFRESH_INTERVAL_DAYS: 14,       // auto re-scan cadence, measured from finished_at
   MANUAL_REFRESH_COOLDOWN_DAYS: 7, // below this a manual scan asks for confirmation
   SCHEDULER_TICK_HOURS: 6,         // sidecar scheduler tick
   SCHEDULER_BATCH_LIMIT: 5,        // max scans enqueued per due-scans tick (oldest first)
} as const;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (0 total, matching current baseline).

- [ ] **Step 3: Commit**

```bash
git add lib/aiVisibility.ts
git commit -m "feat(ai-vis): add AI_VIS cadence constants"
```

---

## Task 2: `buildSnapshot` + `OverviewSnapshot` (pure)

**Files:**
- Modify: `lib/aiVisibilityMetrics.ts` (append after `aggregateCompetitors`)
- Test: `__tests__/lib/aiVisibilityMetrics.test.ts`

**Interfaces:**
- Consumes: `computeOverview`, `aggregateSources`, `ResultRow` (existing in this file).
- Produces:
  - `export type OverviewSnapshot = { overview: ReturnType<typeof computeOverview>; sources: ReturnType<typeof aggregateSources>; citedPromptIds: number[] }`
  - `export function buildSnapshot(rows: ResultRow[]): OverviewSnapshot`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/aiVisibilityMetrics.test.ts`:

```ts
import { buildSnapshot } from '../../lib/aiVisibilityMetrics';

describe('buildSnapshot', () => {
   it('bundles overview, sources, and the set of prompts where own was cited', () => {
      const snap = buildSnapshot(rows);
      expect(snap.overview.visibilityScore).toBe(43);
      expect(snap.sources.find((s) => s.domain === 'oracle.com')?.timesShown).toBe(3);
      // prompt 1 (chat_gpt cited) and prompt 2 (chat_gpt cited) → both cited; unique + sorted
      expect(snap.citedPromptIds).toEqual([1, 2]);
   });
   it('empty rows → empty citedPromptIds', () => {
      expect(buildSnapshot([]).citedPromptIds).toEqual([]);
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest aiVisibilityMetrics -t buildSnapshot`
Expected: FAIL — `buildSnapshot is not a function` / import error.

- [ ] **Step 3: Implement `buildSnapshot`**

Append to `lib/aiVisibilityMetrics.ts`:

```ts
export type OverviewSnapshot = {
   overview: ReturnType<typeof computeOverview>;
   sources: ReturnType<typeof aggregateSources>;
   citedPromptIds: number[]; // prompts where the brand was cited in ≥1 model
};

/** Turn a scan's result rows into a comparable snapshot. Pure — the DB wrapper
 *  that loads the rows lives in lib/aiVisibilityRead.ts. */
export function buildSnapshot(rows: ResultRow[]): OverviewSnapshot {
   const citedPromptIds = Array.from(new Set(rows.filter((r) => r.ownCited).map((r) => r.promptId))).sort((a, b) => a - b);
   return { overview: computeOverview(rows), sources: aggregateSources(rows), citedPromptIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest aiVisibilityMetrics -t buildSnapshot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/aiVisibilityMetrics.ts __tests__/lib/aiVisibilityMetrics.test.ts
git commit -m "feat(ai-vis): add buildSnapshot pure helper"
```

---

## Task 3: `computeDelta` (pure)

**Files:**
- Modify: `lib/aiVisibilityMetrics.ts` (append after `buildSnapshot`)
- Test: `__tests__/lib/aiVisibilityMetrics.test.ts`

**Interfaces:**
- Consumes: `OverviewSnapshot` (Task 2).
- Produces:
  - `export type Trend = 'up' | 'down' | 'same'`
  - `export type MetricDelta = { current: number; previous: number; delta: number; trend: Trend }`
  - `export type OverviewDelta = { visibilityScore: MetricDelta; perModel: Array<{ model: string } & MetricDelta>; sources: { added: string[]; removed: string[] }; prompts: { gained: number[]; lost: number[] } }`
  - `export function computeDelta(current: OverviewSnapshot, previous: OverviewSnapshot): OverviewDelta`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/aiVisibilityMetrics.test.ts`:

```ts
import { computeDelta } from '../../lib/aiVisibilityMetrics';

describe('computeDelta', () => {
   const previous = buildSnapshot([
      { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 3, citations: [cit('oracle.com'), cit('shoper.pl'), cit('idztech.pl', 'https://idztech.pl/a')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, citations: [cit('oracle.com')] },
   ]);
   const current = buildSnapshot([
      { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 1, citations: [cit('idztech.pl', 'https://idztech.pl/a'), cit('vercel.com')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, citations: [cit('oracle.com')] },
   ]);

   it('reports score delta with direction', () => {
      const d = computeDelta(current, previous);
      // current p1 score 100, p2 0 → 50; previous p1 70, p2 0 → 35
      expect(d.visibilityScore).toEqual({ current: 50, previous: 35, delta: 15, trend: 'up' });
   });
   it('reports sources added and removed (by domain, deduped)', () => {
      const d = computeDelta(current, previous);
      expect(d.sources.added.sort()).toEqual(['vercel.com']);
      expect(d.sources.removed.sort()).toEqual(['shoper.pl']);
   });
   it('reports prompts that gained/lost own citation', () => {
      const gainedCase = computeDelta(
         buildSnapshot([{ promptId: 9, model: 'gemini', ownCited: true, ownPosition: 1, citations: [cit('idztech.pl')] }]),
         buildSnapshot([{ promptId: 9, model: 'gemini', ownCited: false, ownPosition: null, citations: [] }]),
      );
      expect(gainedCase.prompts.gained).toEqual([9]);
      expect(gainedCase.prompts.lost).toEqual([]);
   });
   it('down and same trends', () => {
      const same = computeDelta(previous, previous);
      expect(same.visibilityScore.trend).toBe('same');
      const down = computeDelta(previous, current);
      expect(down.visibilityScore.trend).toBe('down');
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest aiVisibilityMetrics -t computeDelta`
Expected: FAIL — `computeDelta is not a function`.

- [ ] **Step 3: Implement `computeDelta`**

Append to `lib/aiVisibilityMetrics.ts`:

```ts
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
export function computeDelta(current: OverviewSnapshot, previous: OverviewSnapshot): OverviewDelta {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest aiVisibilityMetrics -t computeDelta`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/aiVisibilityMetrics.ts __tests__/lib/aiVisibilityMetrics.test.ts
git commit -m "feat(ai-vis): add computeDelta with trend direction"
```

---

## Task 4: `lib/aiVisibilityRead.ts` (DB → snapshot)

**Files:**
- Create: `lib/aiVisibilityRead.ts`
- Test: `__tests__/lib/aiVisibilityRead.test.ts`

**Interfaces:**
- Consumes: `queryRows` (`lib/db/query`), `buildSnapshot`, `computeOverview`(indirect), `aggregateSources`(indirect), `ResultRow`, `OverviewSnapshot` (Task 2), `LlmCitation` (`lib/dataforseoLlm`).
- Produces:
  - `export const parseCitations: (raw: string | null) => LlmCitation[]`
  - `export const mapDbRowsToResultRows: (dbRows: DbResultRow[]) => ResultRow[]` where `DbResultRow = { prompt_id: number; model: string; own_cited: number; own_position: number | null; citations: string | null }`
  - `export async function loadScanResultRows(scanId: number): Promise<ResultRow[]>`
  - `export async function buildOverview(scanId: number): Promise<OverviewSnapshot>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/aiVisibilityRead.test.ts`:

```ts
// buildOverview/loadScanResultRows touch the DB; parseCitations + mapDbRowsToResultRows are pure.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { parseCitations, mapDbRowsToResultRows } from '../../lib/aiVisibilityRead';

describe('parseCitations', () => {
   it('coerces missing domain/title to empty strings and drops non-url entries', () => {
      const out = parseCitations(JSON.stringify([{ url: 'https://a.com/x' }, { title: 'no url' }, { url: 'https://b.com', domain: 'b.com', title: 'B' }]));
      expect(out).toEqual([
         { url: 'https://a.com/x', domain: '', title: '' },
         { url: 'https://b.com', domain: 'b.com', title: 'B' },
      ]);
   });
   it('returns [] on null or invalid JSON', () => {
      expect(parseCitations(null)).toEqual([]);
      expect(parseCitations('{not json')).toEqual([]);
   });
});

describe('mapDbRowsToResultRows', () => {
   it('maps db columns to ResultRow, coercing own_cited to boolean', () => {
      const rows = mapDbRowsToResultRows([
         { prompt_id: 5, model: 'gemini', own_cited: 1, own_position: 2, citations: JSON.stringify([{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }]) },
         { prompt_id: 6, model: 'chat_gpt', own_cited: 0, own_position: null, citations: null },
      ]);
      expect(rows[0]).toEqual({ promptId: 5, model: 'gemini', ownCited: true, ownPosition: 2, citations: [{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }] });
      expect(rows[1]).toEqual({ promptId: 6, model: 'chat_gpt', ownCited: false, ownPosition: null, citations: [] });
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest aiVisibilityRead`
Expected: FAIL — module `lib/aiVisibilityRead` not found.

- [ ] **Step 3: Implement the module**

Create `lib/aiVisibilityRead.ts`:

```ts
/** DB → overview snapshot. Thin wrapper so the read API and the /history + delta
 *  paths all turn a scanId into a comparable snapshot the same way. Pure mapping
 *  helpers (parseCitations, mapDbRowsToResultRows) are exported for unit tests. */
import { queryRows } from './db/query';
import { buildSnapshot, ResultRow, OverviewSnapshot } from './aiVisibilityMetrics';
import type { LlmCitation } from './dataforseoLlm';

export type DbResultRow = {
   prompt_id: number; model: string; own_cited: number; own_position: number | null; citations: string | null;
};

export const parseCitations = (raw: string | null): LlmCitation[] => {
   if (!raw) return [];
   try {
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      // Coerce every field to a string: a stored citation with a url but missing
      // title/domain must not yield `undefined` (norm(domain) would throw downstream).
      return v
         .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof c.url === 'string')
         .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
   } catch { return []; }
};

export const mapDbRowsToResultRows = (dbRows: DbResultRow[]): ResultRow[] => dbRows.map((r) => ({
   promptId: r.prompt_id,
   model: r.model,
   ownCited: !!r.own_cited,
   ownPosition: r.own_position,
   citations: parseCitations(r.citations),
}));

export async function loadScanResultRows(scanId: number): Promise<ResultRow[]> {
   const dbRows = await queryRows<DbResultRow>(
      `SELECT prompt_id, model, own_cited, own_position, citations
       FROM ai_vis_results WHERE scan_id = ? AND error IS NULL`,
      [scanId],
   );
   return mapDbRowsToResultRows(dbRows);
}

export async function buildOverview(scanId: number): Promise<OverviewSnapshot> {
   return buildSnapshot(await loadScanResultRows(scanId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest aiVisibilityRead`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/aiVisibilityRead.ts __tests__/lib/aiVisibilityRead.test.ts
git commit -m "feat(ai-vis): add aiVisibilityRead (DB → snapshot)"
```

---

## Task 5: attach `delta` to the `overview` data view

**Files:**
- Modify: `pages/api/ai-visibility/[slug]/data.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `computeDelta` (Tasks 2–3), `loadScanResultRows`, `parseCitations` (Task 4).
- Produces: `GET data?view=overview` response gains `delta: OverviewDelta | null` and `previousScanAt: string | null`.

- [ ] **Step 1: Update imports**

In `pages/api/ai-visibility/[slug]/data.ts`, replace the metrics import line (currently line 9):

```ts
import { computeOverview, aggregateSources, aggregateCompetitors, ResultRow } from '../../../../lib/aiVisibilityMetrics';
```

with (note: `computeOverview` is dropped — after this task the overview branch uses `buildSnapshot`, and no other branch calls `computeOverview` directly, so keeping it would be an unused import):

```ts
import { aggregateSources, aggregateCompetitors, buildSnapshot, computeDelta, ResultRow } from '../../../../lib/aiVisibilityMetrics';
import { parseCitations as parseCitationsShared, loadScanResultRows } from '../../../../lib/aiVisibilityRead';
import { AI_VIS_SETTINGS } from '../../../../lib/aiVisibility';
```

- [ ] **Step 2: Remove the now-duplicated local `parseCitations`**

Delete the local `const parseCitations = (raw: string | null): LlmCitation[] => { ... }` block (currently lines 17–28) and its now-unused `import type { LlmCitation }` line (currently line 10). Then update the `rows` mapping (currently line 66) to call the shared helper:

```ts
         citations: parseCitationsShared(r.citations),
```

- [ ] **Step 3: Order the "latest completed" scan by `finished_at`**

The existing latest-scan query (currently lines 44–50) orders by `s.id DESC`. Change its `ORDER BY s.id DESC` to `ORDER BY s.finished_at DESC` so "latest" means most-recently-finished, matching the cadence definition (a retried scan can get a higher `id` but an earlier `finished_at`). The query becomes:

```ts
      const scan = await queryOne<{ id: number, finished_at: string | null }>(
         `SELECT s.id, s.finished_at FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.finished_at DESC LIMIT 1`,
         [domain.ID],
      );
```

- [ ] **Step 4: Replace the `overview` branch**

Replace the `if (view === 'overview') { ... }` block (currently lines 69–72) with (previous scan selected by `finished_at` chronology, plus `nextRefreshAt`/`daysUntilRefresh`):

```ts
      if (view === 'overview') {
         const current = buildSnapshot(rows);
         // "Previous" = the completed scan that finished before this one (chronology
         // by finished_at, NOT id — a retry may have a higher id but earlier finish).
         const prev = scan.finished_at ? await queryOne<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s
             JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' AND s.finished_at < ?
             ORDER BY s.finished_at DESC LIMIT 1`,
            [domain.ID, scan.finished_at],
         ) : undefined;
         const delta = prev ? computeDelta(current, buildSnapshot(await loadScanResultRows(prev.id))) : null;

         // Next automatic refresh = last finish + cadence; days until (clamped ≥ 0).
         const nextRefreshAt = scan.finished_at
            ? new Date(new Date(scan.finished_at).getTime() + AI_VIS_SETTINGS.REFRESH_INTERVAL_DAYS * 86_400_000).toISOString()
            : null;
         const daysUntilRefresh = nextRefreshAt
            ? Math.max(0, Math.ceil((new Date(nextRefreshAt).getTime() - Date.now()) / 86_400_000))
            : null;

         return res.status(200).json({
            scanId: scan.id,
            finishedAt: scan.finished_at,
            overview: current.overview,
            sourceCount: current.sources.length,
            delta,
            previousScanAt: prev ? prev.finished_at : null,
            nextRefreshAt,
            daysUntilRefresh,
         });
      }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `LlmCitation` is still referenced elsewhere in the file, keep its import; otherwise its removal is required to avoid an unused-import lint.)

- [ ] **Step 6: Run the existing test suite for regressions**

Run: `npx jest aiVisibilityMetrics aiVisibilityRead`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "pages/api/ai-visibility/[slug]/data.ts"
git commit -m "feat(ai-vis): return delta + nextRefreshAt in overview view"
```

---

## Task 6: Overview UI — delta badges, "last updated", Refresh button + confirm modal

**Files:**
- Modify: `pages/sites/[domain]/ai-visibility/overview.tsx`

**Interfaces:**
- Consumes: `data?view=overview` `{ finishedAt, delta, previousScanAt }` (Task 5); `useStartAiVisScan` (extended in Task 12 — this task uses only its current no-arg form for the button, then Task 12 wires the confirm flow). To avoid ordering coupling, this task adds the **display** (delta badge + trend arrow + "last updated"); the Refresh button + confirm modal are added in Task 12 alongside the hook change.

- [ ] **Step 1: Extend the `OverviewData` type**

In `overview.tsx`, replace the `OverviewData` type (currently lines 12–16) with:

```ts
type MetricDelta = { current: number; previous: number; delta: number; trend: 'up' | 'down' | 'same' };
type OverviewData = {
   pending?: boolean;
   overview?: { visibilityScore: number; mentionRate: number; avgPosition: number | null; directCitations: number; pages: number; perModel: Array<{ model: string; score: number }> };
   sourceCount?: number;
   finishedAt?: string | null;
   previousScanAt?: string | null;
   nextRefreshAt?: string | null;
   daysUntilRefresh?: number | null;
   delta?: {
      visibilityScore: MetricDelta;
      perModel: Array<{ model: string } & MetricDelta>;
      sources: { added: string[]; removed: string[] };
      prompts: { gained: number[]; lost: number[] };
   } | null;
};
```

- [ ] **Step 2: Add a `DeltaBadge` component**

In `overview.tsx`, immediately before `const AiVisibilityOverview: NextPage = () => {` (currently line 71), add:

```tsx
const DeltaBadge = ({ d }: { d: MetricDelta }) => {
   if (d.trend === 'same') return null;
   const up = d.trend === 'up';
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: up ? '#1AB25E' : '#FF6F77', fontFamily: FONT }}>
         {up ? '↑' : '↓'}{Math.abs(d.delta)}
      </span>
   );
};

const daysAgo = (iso?: string | null): number | null => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
```

- [ ] **Step 3: Show the score delta + "last updated" next to the Visibility panel title**

In the Visibility `<Panel>` `title` prop (currently line 105), replace:

```tsx
                     title={<span>Visibility score: <span style={{ fontWeight: 400, color: '#18181B' }}>{pending || !o ? '—' : o.visibilityScore}</span></span>}
```

with:

```tsx
                     title={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                           Visibility score: <span style={{ fontWeight: 400, color: '#18181B' }}>{pending || !o ? '—' : o.visibilityScore}</span>
                           {!pending && ov?.delta ? <DeltaBadge d={ov.delta.visibilityScore} /> : null}
                           {!pending && daysAgo(ov?.finishedAt) !== null ? (
                              <span style={{ fontSize: 12, color: '#9F9FA9', fontWeight: 400 }}>· last updated {daysAgo(ov?.finishedAt) === 0 ? 'today' : `${daysAgo(ov?.finishedAt)}d ago`}</span>
                           ) : null}
                           {!pending && typeof ov?.daysUntilRefresh === 'number' ? (
                              <span style={{ fontSize: 12, color: '#9F9FA9', fontWeight: 400 }}>· next auto refresh in {ov.daysUntilRefresh}d</span>
                           ) : null}
                        </span>
                     )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Manual smoke (optional if a scan exists)**

If a completed scan + a previous scan exist for a domain, run `npm run dev`, open `/sites/<slug>/ai-visibility/overview`, and confirm the score shows a green ↑ / red ↓ badge and "last updated Nd ago". With only one scan, no badge shows (delta null) — that is correct.

- [ ] **Step 6: Commit**

```bash
git add "pages/sites/[domain]/ai-visibility/overview.tsx"
git commit -m "feat(ai-vis): show visibility score delta + last-updated on Overview"
```

---

## Task 7: `findDueConfigIds`

**Files:**
- Modify: `lib/aiVisibilityScan.ts` (add near `enqueueAiVisScan`)
- Test: `__tests__/lib/aiVisibilityDue.test.ts`

**Interfaces:**
- Consumes: `AI_VIS_SETTINGS` (Task 1), `queryRows` (existing import).
- Produces:
  - `export type DueSelect = (sql: string, repl: unknown[]) => Promise<Array<{ id: number }>>`
  - `export async function findDueConfigIds(limit?: number, run?: DueSelect): Promise<number[]>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/aiVisibilityDue.test.ts`:

```ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { findDueConfigIds } from '../../lib/aiVisibilityScan';

describe('findDueConfigIds', () => {
   it('selects configs whose latest completed scan is stale and none active, oldest first, capped', async () => {
      let captured = '';
      const run = async (sql: string) => { captured = sql; return [{ id: 3 }, { id: 7 }]; };
      const ids = await findDueConfigIds(5, run);
      expect(ids).toEqual([3, 7]);
      expect(captured).toMatch(/status\s*=\s*'completed'/i);        // considers completed scans
      expect(captured).toMatch(/finished_at/i);                      // cadence measured on finished_at
      expect(captured).toMatch(/IN\s*\(\s*'queued'\s*,\s*'running'\s*\)/i); // excludes active
      expect(captured).toMatch(/ORDER BY[\s\S]*last_done ASC/i);     // oldest first
      expect(captured).toMatch(/LIMIT\s+5/i);                        // batch cap
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest aiVisibilityDue`
Expected: FAIL — `findDueConfigIds is not a function`.

- [ ] **Step 3: Implement `findDueConfigIds`**

In `lib/aiVisibilityScan.ts`, first add `AI_VIS_SETTINGS` to the existing import from `./aiVisibility` (the line importing `sanitizeModels, AI_VIS_CONCURRENCY, ...`) so it reads:

```ts
import { sanitizeModels, AI_VIS_CONCURRENCY, AI_VIS_HARD_CAP_PAIRS, AI_VIS_SCAN_STALE_MS, AI_VIS_SETTINGS } from './aiVisibility';
```

Then add, immediately after `enqueueAiVisScan` (after its closing `}`):

```ts
export type DueSelect = (sql: string, repl: unknown[]) => Promise<Array<{ id: number }>>;
const defaultDueSelect: DueSelect = (sql, repl) => queryRows<{ id: number }>(sql, repl);

/**
 * Configs due for an automatic refresh: their most-recent COMPLETED scan finished
 * more than REFRESH_INTERVAL_DAYS ago AND they have no queued/running scan. Oldest
 * first (ORDER BY last_done ASC), capped at `limit` so one tick can't flood the
 * worker — a backlog of due configs drains a batch per tick (next tick takes the
 * next oldest N). Configs that never completed a scan are excluded (their first
 * scan is user-driven). `run` is injectable for unit tests. Interpolated values
 * are constants, not user input. Dialect-aware date math mirrors enqueueAiVisScan.
 */
export async function findDueConfigIds(limit = AI_VIS_SETTINGS.SCHEDULER_BATCH_LIMIT, run: DueSelect = defaultDueSelect): Promise<number[]> {
   const isPg = !!process.env.DATABASE_URL;
   const days = AI_VIS_SETTINGS.REFRESH_INTERVAL_DAYS;
   const cutoff = isPg ? `NOW() - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;
   const cap = Number(limit) || AI_VIS_SETTINGS.SCHEDULER_BATCH_LIMIT;
   const rows = await run(
      `SELECT c.id AS id
         FROM ai_vis_configs c
         JOIN (
            SELECT config_id, MAX(finished_at) AS last_done
              FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id
         ) lc ON lc.config_id = c.id
        WHERE lc.last_done < ${cutoff}
          AND NOT EXISTS (
             SELECT 1 FROM ai_vis_scans a WHERE a.config_id = c.id AND a.status IN ('queued', 'running')
          )
        ORDER BY lc.last_done ASC
        LIMIT ${cap}`,
      [],
   );
   return rows.map((r) => Number(r.id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest aiVisibilityDue`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/aiVisibilityScan.ts __tests__/lib/aiVisibilityDue.test.ts
git commit -m "feat(ai-vis): add findDueConfigIds (14-day cadence selector)"
```

---

## Task 8: `due-scans` internal endpoint

**Files:**
- Create: `pages/api/ai-visibility/internal/due-scans.ts`

**Interfaces:**
- Consumes: `findDueConfigIds`, `enqueueAiVisScan` (`lib/aiVisibilityScan`), `ensureAiVisibilityTables`, `getErrorMessage`.
- Produces: `POST /api/ai-visibility/internal/due-scans` → `{ due: Array<{ configId: number; scanId: number }> }` (auth: `x-internal-token`).

- [ ] **Step 1: Create the endpoint**

Create `pages/api/ai-visibility/internal/due-scans.ts`:

```ts
// POST /api/ai-visibility/internal/due-scans — machine-to-machine, called by the
// sidecar scheduler. Finds configs due for a 14-day refresh (oldest first, capped),
// enqueues a scan for each, and returns the scanIds for the sidecar to drive.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { findDueConfigIds, enqueueAiVisScan } from '../../../../lib/aiVisibilityScan';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const token = req.headers['x-internal-token'];
   if (!process.env.INTERNAL_PIPELINE_TOKEN || token !== process.env.INTERNAL_PIPELINE_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
   }
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   try {
      await db.sync();
      await ensureAiVisibilityTables();

      const due: Array<{ configId: number; scanId: number }> = [];
      const selectAndEnqueue = async () => {
         const configIds = await findDueConfigIds();
         for (const configId of configIds) {
            const scanId = await enqueueAiVisScan(configId);
            due.push({ configId, scanId });
         }
      };

      // Cross-instance safety: if the sidecar is ever scaled to >1 instance, two
      // ticks could both see config X as due and both enqueue (→ two scans, double
      // cost). A Postgres transaction-scoped advisory lock serializes the whole
      // find+enqueue: a second caller blocks on pg_advisory_xact_lock until the
      // first transaction ends. The lock outlives the enqueue calls (they run
      // inside the awaited callback), so serialization holds even though enqueue
      // itself isn't transactional. SQLite dev is single-process → no lock needed.
      const isPg = !!process.env.DATABASE_URL;
      if (isPg) {
         await db.transaction(async (tx) => {
            await db.query('SELECT pg_advisory_xact_lock(918273001)', { transaction: tx });
            await selectAndEnqueue();
         });
      } else {
         await selectAndEnqueue();
      }

      return res.status(200).json({ due });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Manual verify (auth + empty result)**

Run `npm run dev`, then:

```bash
# Wrong/no token → 401
curl -s -X POST localhost:3000/api/ai-visibility/internal/due-scans -H 'Content-Type: application/json' -d '{}'
# With the token (match your .env.local INTERNAL_PIPELINE_TOKEN) → { "due": [...] }
curl -s -X POST localhost:3000/api/ai-visibility/internal/due-scans -H 'Content-Type: application/json' -H "x-internal-token: <token>" -d '{}'
```

Expected: first returns `{"error":"unauthorized"}` (401); second returns `{"due":[]}` when no config's latest completed scan is older than 14 days (the current single scan is fresh/queued, so `due` is empty — correct).

- [ ] **Step 4: Commit**

```bash
git add pages/api/ai-visibility/internal/due-scans.ts
git commit -m "feat(ai-vis): add due-scans internal endpoint"
```

---

## Task 9: sidecar scheduler loop + startup hook

**Files:**
- Create: `python-sidecar/pipeline/ai_vis_scheduler.py`
- Modify: `python-sidecar/main.py` (add a startup event)

**Interfaces:**
- Consumes: `run_scan_loop` (`pipeline/ai_vis_scan.py`), env `NEXTJS_URL`, `INTERNAL_PIPELINE_TOKEN`.
- Produces: `async def scheduler_loop(nextjs_url: str) -> None` launched on FastAPI startup.

- [ ] **Step 1: Create the scheduler module**

Create `python-sidecar/pipeline/ai_vis_scheduler.py`:

```python
"""Cadence driver for AI Visibility.

Every SCHEDULER_TICK_HOURS the sidecar asks Node which configs are due for a
14-day refresh (Node applies the predicate + cap), then drives each returned scan
through the existing run_scan_loop. An asyncio.Lock ensures a tick never overlaps
itself (e.g. after a restart). Best-effort — never raises out of the loop.

SCHEDULER_TICK_HOURS mirrors AI_VIS_SETTINGS.SCHEDULER_TICK_HOURS in lib/aiVisibility.ts.
"""
import asyncio
import os
import random

import httpx

SCHEDULER_TICK_HOURS = 6
_tick_lock = asyncio.Lock()


async def _tick(nextjs_url: str) -> None:
    async with _tick_lock:
        url = f"{nextjs_url.rstrip('/')}/api/ai-visibility/internal/due-scans"
        headers = {
            "Content-Type": "application/json",
            "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json={})
        if resp.status_code >= 400:
            print(f"[ai_vis_scheduler] due-scans HTTP {resp.status_code}: {resp.text[:200]}")
            return
        due = resp.json().get("due", [])
        # Import here to avoid a circular import at module load.
        from pipeline.ai_vis_scan import run_scan_loop
        # SEQUENTIAL, not create_task: a batch of 5 scans launched at once would fan
        # out to ~5×250 concurrent DataForSEO calls (rate-limit / memory risk). The
        # 6h tick has slack — whether the batch finishes in 20 or 50 min is fine.
        for item in due:
            await run_scan_loop(item["scanId"], nextjs_url)
        print(f"[ai_vis_scheduler] tick processed {len(due)} scan(s)")


async def scheduler_loop(nextjs_url: str) -> None:
    # Startup jitter so synchronized restarts across instances don't all hit
    # due-scans in the same second. Tiny (0–60s) — keeps the first tick effectively
    # immediate for fast post-restart recovery.
    await asyncio.sleep(random.uniform(0, 60))
    while True:
        try:
            await _tick(nextjs_url)
        except Exception as exc:  # noqa: BLE001 — best-effort; keep the loop alive
            print(f"[ai_vis_scheduler] tick failed: {type(exc).__name__}: {exc}")
        await asyncio.sleep(SCHEDULER_TICK_HOURS * 3600)
```

- [ ] **Step 2: Launch it on startup**

In `python-sidecar/main.py`, immediately after the `app.add_middleware(CORSMiddleware, ...)` block (before the first model/endpoint), add:

```python
@app.on_event("startup")
async def _start_ai_vis_scheduler() -> None:
    """Launch the AI Visibility cadence loop as a detached task on the always-on
    sidecar. The loop's first tick runs almost immediately (after a 0–60s jitter),
    NOT after a full 6h sleep — this intentionally shortens recovery after a
    restart so due scans aren't stranded for hours. Skipped implicitly in one-off
    script contexts that don't start the app."""
    import asyncio
    from pipeline.ai_vis_scheduler import scheduler_loop
    nextjs_url = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")
    asyncio.create_task(scheduler_loop(nextjs_url))
    print("[ai_vis_scheduler] started")
```

- [ ] **Step 3: Compile-check the Python**

Run: `python -m py_compile python-sidecar/main.py python-sidecar/pipeline/ai_vis_scheduler.py`
Expected: no output (success).

- [ ] **Step 4: Manual verify (optional, local sidecar)**

If you run the sidecar locally (`cd python-sidecar && uvicorn main:app --port 8001`), the log prints `[ai_vis_scheduler] started` on boot and `[ai_vis_scheduler] tick processed 0 scan(s)` on the first tick (no configs due yet). Do NOT wait 6h — the first tick fires within ~60s of startup (jitter).

- [ ] **Step 5: Commit**

```bash
git add python-sidecar/pipeline/ai_vis_scheduler.py python-sidecar/main.py
git commit -m "feat(ai-vis): sidecar scheduler drives 14-day re-scans"
```

---

## Task 10: `/history` endpoint

**Files:**
- Create: `pages/api/ai-visibility/[slug]/history.ts`

**Interfaces:**
- Consumes: `verifyUser`, `getCurrentUserId`, `verifyDomainOwnershipBySlug`, `ensureAiVisibilityTables`, `buildOverview` (Task 4), `queryRows`, `getErrorMessage`.
- Produces: `GET /api/ai-visibility/[slug]/history` → `{ scans: Array<{ scanId: number; finishedAt: string | null; visibilityScore: number }> }` (newest-first, last 24).

- [ ] **Step 1: Create the endpoint**

Create `pages/api/ai-visibility/[slug]/history.ts`:

```ts
// GET /api/ai-visibility/[slug]/history — completed scans newest-first with their
// visibility score. Not consumed by the UI yet; enables a future trend chart with
// no schema change.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryRows } from '../../../../lib/db/query';
import { buildOverview } from '../../../../lib/aiVisibilityRead';

const HISTORY_LIMIT = 24;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as unknown as { ID: number, domain: string };

   try {
      const scans = await queryRows<{ id: number, finished_at: string | null }>(
         `SELECT s.id, s.finished_at FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.id DESC LIMIT ${HISTORY_LIMIT}`,
         [domain.ID],
      );
      // Deliberate N+1 (one buildOverview per scan), bounded by HISTORY_LIMIT (24).
      // Fine at this cap; if history ever needs hundreds of points, replace with a
      // single grouped aggregation query. Not worth the complexity now.
      const out: Array<{ scanId: number, finishedAt: string | null, visibilityScore: number }> = [];
      for (const s of scans) {
         const snap = await buildOverview(s.id);
         out.push({ scanId: s.id, finishedAt: s.finished_at, visibilityScore: snap.overview.visibilityScore });
      }
      return res.status(200).json({ scans: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Manual verify**

Run `npm run dev`, sign in, then open `localhost:3000/api/ai-visibility/<slug>/history` in the browser (uses your session cookie).
Expected: `{"scans":[...]}` — one entry per completed scan with a numeric `visibilityScore`. Empty array before any scan completes.

- [ ] **Step 4: Commit**

```bash
git add "pages/api/ai-visibility/[slug]/history.ts"
git commit -m "feat(ai-vis): add scan history endpoint"
```

---

## Task 11: manual-refresh guard in `/scan`

**Files:**
- Modify: `pages/api/ai-visibility/[slug]/scan.ts`

**Interfaces:**
- Consumes: `AI_VIS_SETTINGS` (Task 1), `queryOne` (already imported).
- Produces: `POST /scan` returns `409 { needsConfirm: true, lastScanDaysAgo: number }` when the latest completed scan is < `MANUAL_REFRESH_COOLDOWN_DAYS` old, no scan is active, and the body lacks `{ force: true }`.

- [ ] **Step 1: Import `AI_VIS_SETTINGS`**

In `pages/api/ai-visibility/[slug]/scan.ts`, add to the existing `lib/aiVisibility` usage by adding this import near the other lib imports:

```ts
import { AI_VIS_SETTINGS } from '../../../../lib/aiVisibility';
```

- [ ] **Step 2: Insert the guard before enqueue**

In `scan.ts`, locate:

```ts
   const scanId = await enqueueAiVisScan(cfg.id);
```

Immediately BEFORE that line, insert:

```ts
   // Manual-refresh cost guard: a full scan is ~$4. If the last completed scan is
   // recent and nothing is already running, require an explicit { force: true }.
   const active = await queryOne<{ id: number }>(
      "SELECT id FROM ai_vis_scans WHERE config_id = ? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1",
      [cfg.id],
   );
   const force = !!(req.body && (req.body as { force?: boolean }).force);
   if (!active && !force) {
      const last = await queryOne<{ finished_at: string | null }>(
         "SELECT finished_at FROM ai_vis_scans WHERE config_id = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1",
         [cfg.id],
      );
      if (last?.finished_at) {
         const days = (Date.now() - new Date(last.finished_at).getTime()) / 86_400_000;
         if (days < AI_VIS_SETTINGS.MANUAL_REFRESH_COOLDOWN_DAYS) {
            return res.status(409).json({ needsConfirm: true, lastScanDaysAgo: Math.floor(days) });
         }
      }
   }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Manual verify**

With a completed scan younger than 7 days present:

```bash
# no force → 409 needsConfirm
curl -s -i -X POST "localhost:3000/api/ai-visibility/<slug>/scan" -H 'Content-Type: application/json' -b '<session cookie>' -d '{}' | head -1
```

Expected: `HTTP/1.1 409`. (Sending `{"force":true}` would proceed to enqueue — do NOT run that unless you intend to spend ~$4.)

- [ ] **Step 5: Commit**

```bash
git add "pages/api/ai-visibility/[slug]/scan.ts"
git commit -m "feat(ai-vis): 409 manual-refresh cost guard on /scan"
```

---

## Task 12: frontend — force flag, confirm modal, Refresh button

**Files:**
- Modify: `services/aiVisibility.tsx`
- Modify: `pages/sites/[domain]/ai-visibility/overview.tsx`

**Interfaces:**
- Consumes: `/scan` 409 contract (Task 11).
- Produces: `useStartAiVisScan(slug)` mutation now accepts `{ force?: boolean }` and resolves to `{ scanId: number; needsConfirm: false } | { needsConfirm: true; lastScanDaysAgo: number }`.

- [ ] **Step 1: Rewrite `useStartAiVisScan`**

In `services/aiVisibility.tsx`, replace the whole `useStartAiVisScan` function (currently lines 53–62) with:

```tsx
export type StartScanResult =
   | { needsConfirm: false; scanId: number }
   | { needsConfirm: true; lastScanDaysAgo: number };

export function useStartAiVisScan(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation<StartScanResult, Error, { force?: boolean } | void>(
      async (opts) => {
         const force = !!(opts && 'force' in opts && opts.force);
         const r = await fetch(`/api/ai-visibility/${slug}/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }),
         });
         let body: unknown = null;
         try { body = await r.json(); } catch { /* empty body */ }
         if (r.status === 409 && (body as { needsConfirm?: boolean } | null)?.needsConfirm) {
            return { needsConfirm: true, lastScanDaysAgo: (body as { lastScanDaysAgo: number }).lastScanDaysAgo };
         }
         if (!r.ok) throw new Error((body as { error?: string } | null)?.error || `Request failed (${r.status})`);
         return { needsConfirm: false, scanId: (body as { scanId: number }).scanId };
      },
      {
         onSuccess: (res) => { if (!res.needsConfirm) qc.invalidateQueries(['ai-vis-scan-status', slug]); },
         onError: toastError,
      },
   );
}
```

- [ ] **Step 2: Verify the setup wizard still compiles**

`pages/sites/[domain]/ai-visibility/setup.tsx` calls `startScan.mutateAsync()`. That still type-checks (arg is optional). The first scan never hits the cooldown (no completed scan yet), so its result is always `{ needsConfirm: false, scanId }`.

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Add the Refresh button + confirm modal to Overview**

In `pages/sites/[domain]/ai-visibility/overview.tsx`:

(a) Extend the imports:

```tsx
import { useAiVisData, useStartAiVisScan } from '../../../../services/aiVisibility';
import { Modal } from '../../../../components/ui';
import toast from 'react-hot-toast';
```

(b) Inside `AiVisibilityOverview`, after the existing `const sourcesQ = ...` line, add:

```tsx
   const startScan = useStartAiVisScan(slug);
   const [confirmDays, setConfirmDays] = useState<number | null>(null);

   const runScan = async (force: boolean) => {
      const res = await startScan.mutateAsync(force ? { force: true } : undefined);
      if (res.needsConfirm) { setConfirmDays(res.lastScanDaysAgo); return; }
      setConfirmDays(null);
      toast.success('Scan started');
   };
```

(c) Add a Refresh button. Inside the top-level returned `<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>` (currently line 102), add as the FIRST child (before the Visibility `<Panel>`):

```tsx
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                        type="button"
                        onClick={() => runScan(false)}
                        disabled={startScan.isLoading || crunching}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E4E4E7', borderRadius: 8, padding: '7px 14px', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: startScan.isLoading || crunching ? 'not-allowed' : 'pointer' }}
                     >
                        {crunching ? 'Scanning…' : 'Refresh data'}
                     </button>
                  </div>
```

`crunching` is the render-prop flag from `AiVisPageShell` and is `true` whenever a scan is `queued` OR `running` — so the button is already disabled during a pending scan (not only during the `startScan` request), preventing the "Refresh → queued → Refresh again" double-click path.

(d) Add the confirm modal. Immediately before the closing `</div>` of that same top-level flex container (i.e. after the Stat cards grid, currently around line 170), add:

```tsx
                  {confirmDays !== null && (
                     <Modal title="Refresh AI Visibility?" onClose={() => setConfirmDays(null)} width={460}>
                        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                           <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>
                              Ostatni skan {confirmDays === 0 ? 'dzisiaj' : `${confirmDays} dni temu`}. Pełne odświeżenie to ~$4 kredytów DataForSEO. Odświeżyć mimo to?
                           </p>
                           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button type="button" onClick={() => setConfirmDays(null)} style={{ border: '1px solid #E4E4E7', borderRadius: 8, padding: '8px 16px', background: '#fff', color: '#18181B', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Anuluj</button>
                              <button type="button" onClick={() => runScan(true)} disabled={startScan.isLoading} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Odśwież (~$4)</button>
                           </div>
                        </div>
                     </Modal>
                  )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `Modal` is not exported from `components/ui`, import it from its actual path — `components/ui` re-exports it per `setup.tsx`, which uses `import { Modal } from '../../../../components/ui'`.)

- [ ] **Step 5: Manual verify**

Run `npm run dev`, open the Overview for a domain with a recent completed scan. Click "Refresh data" → the confirm modal appears ("Ostatni skan N dni temu … ~$4"). Click "Anuluj" → closes, no scan. (Only click "Odśwież (~$4)" if you intend to spend the credits.)

- [ ] **Step 6: Commit**

```bash
git add services/aiVisibility.tsx "pages/sites/[domain]/ai-visibility/overview.tsx"
git commit -m "feat(ai-vis): Refresh button with cost-confirm modal"
```

---

## Task 13: Final sweep

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full AI Visibility test run**

Run: `npx jest aiVisibility`
Expected: all AI Visibility suites pass (`aiVisibilityMetrics`, `aiVisibilityScan`, `aiVisibilityRead`, `aiVisibilityDue`).

- [ ] **Step 3: Python compile-check**

Run: `python -m py_compile python-sidecar/main.py python-sidecar/pipeline/ai_vis_scheduler.py python-sidecar/pipeline/ai_vis_scan.py`
Expected: no output (success).

- [ ] **Step 4: Lint the touched files (if the repo lints in CI)**

Run: `npx eslint lib/aiVisibilityMetrics.ts lib/aiVisibilityRead.ts lib/aiVisibilityScan.ts "pages/api/ai-visibility/**/*.ts" services/aiVisibility.tsx "pages/sites/[domain]/ai-visibility/overview.tsx"`
Expected: no errors (warnings acceptable if pre-existing).

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(ai-vis): lint/type sweep for cyclic tracking" || echo "nothing to commit"
```

---

## Deployment notes (out of code scope — for the operator)

After merge, for the scheduler + hand-off to work in production:
- Redeploy the python-sidecar (Render) so `ai_vis_scheduler.py` + the startup hook ship.
- Ensure env on BOTH Vercel and Render: `INTERNAL_PIPELINE_TOKEN`, `NEXTJS_URL` (public app URL — the sidecar calls back to it), `PYTHON_SIDECAR_URL`.
- The first scheduled tick fires on sidecar boot; nothing is due until a config's latest completed scan passes 14 days.
```
