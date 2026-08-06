# Surfer-parity Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror SurferSEO's content flow end to end — typed analysis phases with a live right-hand panel, an outline that carries its knowledge base, a streamed article write, and a factor-based AI score with the sentence that earned each point.

**Architecture:** Surfer runs Phoenix/Absinthe with one WebSocket and 71 GraphQL subscriptions. We keep our Next.js + Python sidecar + `analysis_jobs` table and reproduce the *contract*, not the transport: the sidecar posts typed phase patches to `/api/articles/job-progress`, Node merges them into a `progress_json` column, and the editor consumes one SSE stream per job instead of polling. Entity shapes (`crawlingSerp { finished total status }`, `AiArticleStatusStreaming` / `AiArticleContentStreaming` as two channels, `AioScore { factors[] }` with `textSpan`) match theirs one-for-one.

**Tech Stack:** Next.js Pages Router (TypeScript, no `any`), Sequelize raw SQL over Postgres/SQLite, FastAPI + httpx sidecar (Python 3.12), Jest + React Testing Library, pytest, Koala UI v11 tokens.

## Global Constraints

- Never introduce TypeScript `any` — use `unknown` + narrowing or types from `lib/types/` (CLAUDE.md §7).
- UI work reads `DESIGN.md` first and uses `components/koala` tokens/icons; accent `#F84416`, card radius 16px, button radius 12px.
- Never `import { X } from 'sequelize'` at module scope in `lib/*` — Jest dies on uuid ESM. Use a dynamic `await import('sequelize')` inside the function.
- Every `ALTER TABLE ... ADD COLUMN` on the Postgres path uses `IF NOT EXISTS`; the SQLite path keeps the `try {} catch {}` form (SQLite has no `IF NOT EXISTS` for columns).
- Do not weaken existing planner gates. `KNOWLEDGE_COVERAGE_MIN_PCT = 95` and `validateBlueprint`'s `targetClaims >= 5` stay as they are. Surfer scores after writing; we gate before. See "Deliberate deviation" at the end.
- Copy contracts and UX patterns from the audit, never competitor code, schema text or prompt wording.
- Source of truth for the audit: `docs/superpowers/plans/2026-08-06-surfer-parity-flow.md`.

---

## Already shipped (do not redo)

The outline half of the flow landed in `42791b70`: `reviewOutlineFromBundle` renders each
section's claims with their sources, the required blocks with evidence hints, and the
bridge into the next section — our equivalent of Surfer's
`outline { title level knowledgeBase { text sources } }`. Tasks below assume it is in place.

## File Structure

**Phase A — typed analysis phases**
- Create `lib/analysisPhases.ts` — phase types, `emptyPhases()`, `mergePhases()`, `phasesFromStage()`. Pure, no DB.
- Create `lib/analysisPhaseRows.ts` — maps phases to the two rendered groups. Pure.
- Create `components/articles/AnalysisProgressPanel.tsx` — presentational panel.
- Modify `lib/ensureArticlesTables.ts` — add `analysis_jobs.progress_json`.
- Modify `pages/api/articles/job-progress.ts` — accept/merge/return `phases`.
- Modify `python-sidecar/pipeline/contracts.py` — `StageContext.emit_phase()`.
- Modify `python-sidecar/pipeline/stages/scrape_serp.py` — per-result crawl events.
- Modify `pages/articles/[id]/index.tsx` — render the panel while analysing.

**Phase B — streamed generation**
- Modify `lib/ensureArticlesTables.ts` — add `analysis_jobs.stream_text`, `analysis_jobs.status_text`.
- Modify `pages/api/articles/job-progress.ts` — accept `statusText` and `contentChunk`.
- Create `pages/api/articles/[id]/generate-stream.ts` — SSE tail of one job.
- Modify `python-sidecar/main.py` + `python-sidecar/pipeline/article_pipeline.py` — emit status lines and content chunks while writing.
- Modify `components/articles/ArticleEditor.tsx` — consume SSE instead of polling.

**Phase C — typed scoring**
- Create `lib/aiScore/factors.ts` — factor types + `aioScore()`.
- Create `lib/aiScore/introductionFactors.ts` — the four introduction scorers.
- Modify `components/articles/ContentScorePanel.tsx` — list factors with their `textSpan`.

**Phase D — pipeline versioning**
- Modify `lib/ensureArticlesTables.ts`, `pages/api/articles/[id]/generate.ts`.

---

## Phase A — Typed analysis phases

### Task 1: Phase model

**Files:**
- Create: `lib/analysisPhases.ts`
- Test: `__tests__/lib/analysisPhases.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PhaseStatus`, `SimplePhase`, `CrawlPhase`, `AnalysisPhases`, `emptyPhases(): AnalysisPhases`, `mergePhases(prev: AnalysisPhases | null, patch: Partial<AnalysisPhases>): AnalysisPhases`, `phasesFromStage(stage: string, stagePercent: number): Partial<AnalysisPhases>`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/analysisPhases.test.ts
import {
  emptyPhases, mergePhases, phasesFromStage,
} from '../../lib/analysisPhases';

describe('mergePhases', () => {
  it('starts every phase as NEW', () => {
    expect(emptyPhases().crawlingSerp).toEqual({
      status: 'NEW', finished: null, total: null, currentUrl: null, error: null,
    });
  });

  it('merges a patch without dropping untouched phases', () => {
    const next = mergePhases(emptyPhases(), {
      crawlingSerp: { status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/x' },
    });
    expect(next.crawlingSerp.finished).toBe(6);
    expect(next.fetchingSerp.status).toBe('NEW');
  });

  it('treats null previous state as empty', () => {
    expect(mergePhases(null, { fetchingSerp: { status: 'DONE' } }).fetchingSerp.status).toBe('DONE');
  });
});

describe('phasesFromStage', () => {
  it('maps a finished scrape_serp stage to a done fetch and a running crawl', () => {
    expect(phasesFromStage('scrape_serp', 100)).toEqual({
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'RUNNING' },
    });
  });

  it('maps ai_search to our AI Search phase', () => {
    expect(phasesFromStage('ai_search', 0).aiSearch).toEqual({ status: 'RUNNING' });
    expect(phasesFromStage('ai_search', 100).aiSearch).toEqual({ status: 'DONE' });
  });

  it('ignores stages that have no phase of their own', () => {
    expect(phasesFromStage('score_ranking', 0)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/analysisPhases.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — `Cannot find module '../../lib/analysisPhases'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/analysisPhases.ts
/**
 * Typed analysis phases. The sidecar reports one patch per event and Node merges
 * them, so the editor renders fields instead of parsing a progress sentence.
 * Shape mirrors the audited Surfer contract (fetchingSerp / crawlingSerp
 * { finished total } / loadingCompetitors) plus our own aiSearch phase.
 */
export type PhaseStatus = 'NEW' | 'RUNNING' | 'DONE' | 'ERROR';

export type SimplePhase = { status: PhaseStatus; error?: string | null };

export type CrawlPhase = SimplePhase & {
  finished: number | null;
  total: number | null;
  currentUrl?: string | null;
};

export type AnalysisPhases = {
  importingContent: SimplePhase;
  fetchingSerp: SimplePhase;
  crawlingSerp: CrawlPhase;
  loadingCompetitors: SimplePhase;
  aiSearch: SimplePhase;
};

export function emptyPhases(): AnalysisPhases {
  const simple = (): SimplePhase => ({ status: 'NEW', error: null });
  return {
    importingContent: simple(),
    fetchingSerp: simple(),
    crawlingSerp: {
      status: 'NEW', finished: null, total: null, currentUrl: null, error: null,
    },
    loadingCompetitors: simple(),
    aiSearch: simple(),
  };
}

export function mergePhases(
  prev: AnalysisPhases | null,
  patch: Partial<AnalysisPhases>,
): AnalysisPhases {
  const base = prev ?? emptyPhases();
  return {
    importingContent: { ...base.importingContent, ...patch.importingContent },
    fetchingSerp: { ...base.fetchingSerp, ...patch.fetchingSerp },
    crawlingSerp: { ...base.crawlingSerp, ...patch.crawlingSerp },
    loadingCompetitors: { ...base.loadingCompetitors, ...patch.loadingCompetitors },
    aiSearch: { ...base.aiSearch, ...patch.aiSearch },
  };
}

/** Fallback for stages that only report start/done (no per-item events yet). */
export function phasesFromStage(stage: string, stagePercent: number): Partial<AnalysisPhases> {
  const done = stagePercent >= 100;
  switch (stage) {
    case 'fetch_page':
      return { importingContent: { status: done ? 'DONE' : 'RUNNING' } };
    case 'scrape_serp':
      return done
        ? { fetchingSerp: { status: 'DONE' }, crawlingSerp: { status: 'RUNNING' } }
        : { fetchingSerp: { status: 'RUNNING' } };
    case 'classify_content':
    case 'extract_terms':
      return {
        crawlingSerp: { status: done ? 'DONE' : 'RUNNING' },
        loadingCompetitors: { status: done ? 'DONE' : 'RUNNING' },
      };
    case 'ai_search':
      return { aiSearch: { status: done ? 'DONE' : 'RUNNING' } };
    default:
      return {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/analysisPhases.test.ts --testPathIgnorePatterns worktrees`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/analysisPhases.ts __tests__/lib/analysisPhases.test.ts
git commit -m "feat(analysis): typed phase model for pipeline progress"
```

---

### Task 2: Phase rows for the panel

**Files:**
- Create: `lib/analysisPhaseRows.ts`
- Test: `__tests__/lib/analysisPhaseRows.test.ts`

**Interfaces:**
- Consumes: `AnalysisPhases`, `emptyPhases` from `lib/analysisPhases`.
- Produces: `RowState = 'done' | 'active' | 'pending' | 'error'`, `PhaseRow = { id: string; label: string; state: RowState; detail?: string }`, `PhaseGroup = { id: 'ai-search' | 'google'; title: string; rows: PhaseRow[] }`, `analysisPhaseGroups(phases: AnalysisPhases): PhaseGroup[]`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/analysisPhaseRows.test.ts
import { emptyPhases, mergePhases } from '../../lib/analysisPhases';
import { analysisPhaseGroups } from '../../lib/analysisPhaseRows';

function rows(phases = emptyPhases()) {
  const groups = analysisPhaseGroups(phases);
  return Object.fromEntries(groups.map((g) => [g.id, g.rows]));
}

describe('analysisPhaseGroups', () => {
  it('renders two groups in Surfer order: AI Search then Google', () => {
    expect(analysisPhaseGroups(emptyPhases()).map((g) => g.id)).toEqual(['ai-search', 'google']);
  });

  it('shows the crawl counter as detail while crawling', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: {
        status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/wiki/Detektyw',
      },
    });
    const crawl = rows(phases).google.find((r) => r.id === 'crawling');
    expect(crawl).toMatchObject({ state: 'active', label: 'Crawling result 6/10', detail: 'pl.wikipedia.org' });
  });

  it('labels the crawl generically when no counter arrived yet', () => {
    const phases = mergePhases(emptyPhases(), { crawlingSerp: { status: 'RUNNING' } });
    expect(rows(phases).google.find((r) => r.id === 'crawling')?.label).toBe('Crawling…');
  });

  it('reports the SERP row with its result count once fetched', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: { status: 'RUNNING', total: 10 },
    });
    expect(rows(phases).google[0]).toMatchObject({ state: 'done', label: 'Got 10 search results' });
  });

  it('marks a phase that errored', () => {
    const phases = mergePhases(emptyPhases(), { aiSearch: { status: 'ERROR', error: 'timeout' } });
    expect(rows(phases)['ai-search'][1]).toMatchObject({ state: 'error', detail: 'timeout' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/analysisPhaseRows.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — `Cannot find module '../../lib/analysisPhaseRows'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/analysisPhaseRows.ts
import type { AnalysisPhases, CrawlPhase, SimplePhase } from './analysisPhases';

export type RowState = 'done' | 'active' | 'pending' | 'error';
export type PhaseRow = { id: string; label: string; state: RowState; detail?: string };
export type PhaseGroup = { id: 'ai-search' | 'google'; title: string; rows: PhaseRow[] };

function stateOf(phase: SimplePhase): RowState {
  if (phase.status === 'ERROR') return 'error';
  if (phase.status === 'DONE') return 'done';
  if (phase.status === 'RUNNING') return 'active';
  return 'pending';
}

/** A row that only lights up once its phase has finished (the "…guidelines" tail rows). */
function trailingState(phase: SimplePhase): RowState {
  if (phase.status === 'ERROR') return 'error';
  return phase.status === 'DONE' ? 'done' : 'pending';
}

function hostOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function crawlLabel(crawl: CrawlPhase): string {
  if (crawl.status === 'DONE') return 'Crawled competitor pages';
  if (typeof crawl.finished === 'number' && typeof crawl.total === 'number') {
    return `Crawling result ${crawl.finished}/${crawl.total}`;
  }
  return 'Crawling…';
}

export function analysisPhaseGroups(phases: AnalysisPhases): PhaseGroup[] {
  const serpCount = phases.crawlingSerp.total;
  return [
    {
      id: 'ai-search',
      title: 'AI Search',
      rows: [
        {
          id: 'prompts',
          label: 'Generated prompts',
          state: phases.aiSearch.status === 'NEW' ? 'pending' : 'done',
        },
        {
          id: 'answers',
          label: 'Scraping answers from ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity',
          state: stateOf(phases.aiSearch),
          ...(phases.aiSearch.error ? { detail: phases.aiSearch.error } : {}),
        },
        {
          id: 'ai-guidelines',
          label: 'Calculating AI Search guidelines',
          state: trailingState(phases.aiSearch),
        },
      ],
    },
    {
      id: 'google',
      title: 'Google Search results',
      rows: [
        {
          id: 'serp',
          label: serpCount ? `Got ${serpCount} search results` : 'Getting search results',
          state: stateOf(phases.fetchingSerp),
          ...(phases.fetchingSerp.error ? { detail: phases.fetchingSerp.error } : {}),
        },
        {
          id: 'crawling',
          label: crawlLabel(phases.crawlingSerp),
          state: stateOf(phases.crawlingSerp),
          ...(hostOf(phases.crawlingSerp.currentUrl) ? { detail: hostOf(phases.crawlingSerp.currentUrl) } : {}),
        },
        {
          id: 'seo-guidelines',
          label: 'Calculating Content Scores and SEO guidelines',
          state: trailingState(phases.loadingCompetitors),
        },
      ],
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/analysisPhaseRows.test.ts --testPathIgnorePatterns worktrees`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/analysisPhaseRows.ts __tests__/lib/analysisPhaseRows.test.ts
git commit -m "feat(analysis): map phases to panel rows"
```

---

### Task 3: Persist and serve phases

**Files:**
- Modify: `lib/ensureArticlesTables.ts` (analysis_jobs block near line 186)
- Modify: `pages/api/articles/job-progress.ts` (POST body near line 202; GET response near line 143)
- Test: `__tests__/api/jobProgressPhases.test.ts`

**Interfaces:**
- Consumes: `mergePhases`, `emptyPhases`, `phasesFromStage`, `AnalysisPhases`.
- Produces: POST accepts `phases?: Partial<AnalysisPhases>`; GET returns `phases: AnalysisPhases | null` alongside the existing fields.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/jobProgressPhases.test.ts
import { emptyPhases, mergePhases, phasesFromStage } from '../../lib/analysisPhases';

// The handler is thin; the contract worth pinning is what gets stored for a request.
function storedPhases(prevJson: string | null, body: {
  currentStage?: string; stageProgress?: number; phases?: object;
}) {
  const prev = prevJson ? JSON.parse(prevJson) : null;
  const patch = body.phases ?? phasesFromStage(body.currentStage || '', body.stageProgress ?? 0);
  return mergePhases(prev, patch);
}

describe('job-progress phase persistence', () => {
  it('derives phases from a stage-only event', () => {
    expect(storedPhases(null, { currentStage: 'scrape_serp', stageProgress: 100 }).fetchingSerp.status)
      .toBe('DONE');
  });

  it('prefers an explicit phase patch over the stage fallback', () => {
    const stored = storedPhases(JSON.stringify(emptyPhases()), {
      currentStage: 'scrape_serp',
      stageProgress: 0,
      phases: { crawlingSerp: { status: 'RUNNING', finished: 3, total: 10 } },
    });
    expect(stored.crawlingSerp.finished).toBe(3);
    expect(stored.fetchingSerp.status).toBe('NEW');
  });

  it('keeps earlier phases when a later event arrives', () => {
    const first = storedPhases(null, { currentStage: 'scrape_serp', stageProgress: 100 });
    const second = storedPhases(JSON.stringify(first), { currentStage: 'ai_search', stageProgress: 0 });
    expect(second.fetchingSerp.status).toBe('DONE');
    expect(second.aiSearch.status).toBe('RUNNING');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/jobProgressPhases.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — `Cannot find module '../../lib/analysisPhases'` is already solved by Task 1, so this fails only if Task 1 was skipped. If Task 1 is done, this test passes immediately; that is expected — it pins the merge contract the handler must use. Proceed to Step 3 and wire the handler.

- [ ] **Step 3: Add the column**

In `lib/ensureArticlesTables.ts`, inside the block that creates `analysis_jobs` (after the `CREATE TABLE IF NOT EXISTS analysis_jobs` statement), add:

```ts
   if (isPg) {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS progress_json TEXT`); } catch {}
   } else {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN progress_json TEXT`); } catch {}
   }
```

Use the same `isPg` flag the surrounding code already uses. If that block has no `isPg` in scope, use `Boolean(process.env.DATABASE_URL)`.

- [ ] **Step 4: Store phases on POST**

In `pages/api/articles/job-progress.ts`, extend the destructure near line 202 and write the merged JSON. Add the import at the top of the file:

```ts
import { mergePhases, phasesFromStage, type AnalysisPhases } from '../../../lib/analysisPhases';
```

Then, in the non-terminal branch (the `UPDATE analysis_jobs SET status = 'running' ...` near line 341), replace the statement with:

```ts
    const { phases: phasePatch } = req.body as { phases?: Partial<AnalysisPhases> };
    const prevRows = await db.query<{ progress_json: string | null }>(
      `SELECT progress_json FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    const prev = prevRows[0]?.progress_json
      ? JSON.parse(prevRows[0].progress_json) as AnalysisPhases
      : null;
    const nextPhases = mergePhases(
      prev,
      phasePatch ?? phasesFromStage(currentStage || '', Number(stageProgress ?? 0)),
    );

    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           current_stage = COALESCE(?, current_stage),
           stage_progress = COALESCE(?, stage_progress),
           total_progress = COALESCE(?, total_progress),
           progress_message = COALESCE(?, progress_message),
           progress_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('queued', 'running')`,
      { replacements: [
        currentStage || null, stageProgress ?? null, totalProgress ?? null, message || null,
        JSON.stringify(nextPhases), jobId,
      ] },
    );
```

- [ ] **Step 5: Return phases on GET**

In the same file, add `progress_json` to the two `SELECT` column lists of the GET branch (near lines 114 and 116), then extend the response object near line 143:

```ts
        phases: j.progress_json ? JSON.parse(j.progress_json) as AnalysisPhases : null,
```

Widen the row generic to include `progress_json: string | null`.

- [ ] **Step 6: Verify**

Run: `npx jest __tests__/api/jobProgressPhases.test.ts --testPathIgnorePatterns worktrees && npx tsc --noEmit`
Expected: tests PASS, no type errors outside `.worktrees`.

- [ ] **Step 7: Commit**

```bash
git add lib/ensureArticlesTables.ts pages/api/articles/job-progress.ts __tests__/api/jobProgressPhases.test.ts
git commit -m "feat(analysis): persist typed phases on analysis_jobs"
```

---

### Task 4: Sidecar emits phases, including per-result crawl events

**Files:**
- Modify: `python-sidecar/pipeline/contracts.py` (after `emit_progress`, ends line 64)
- Modify: `python-sidecar/pipeline/runner.py:19-34`
- Modify: `python-sidecar/pipeline/stages/scrape_serp.py`
- Test: `python-sidecar/tests/test_emit_phase.py`

**Interfaces:**
- Consumes: the POST contract from Task 3 (`{"jobId", "phases"}`).
- Produces: `StageContext.emit_phase(patch: dict, message: str = "") -> None`.

- [ ] **Step 1: Write the failing test**

```python
# python-sidecar/tests/test_emit_phase.py
"""emit_phase posts a typed patch; it must never raise into the pipeline."""
import asyncio

from pipeline.contracts import StageContext


def test_emit_phase_without_nextjs_url_is_a_noop():
    ctx = StageContext("job_1", {}, "")
    asyncio.run(ctx.emit_phase({"crawlingSerp": {"status": "RUNNING", "finished": 1, "total": 10}}))


def test_emit_phase_builds_the_expected_body(monkeypatch):
    sent = {}

    class FakeResponse:
        status_code = 200
        text = ""

    class FakeClient:
        def __init__(self, *a, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None):
            sent["url"] = url
            sent["json"] = json
            return FakeResponse()

    import pipeline.contracts as contracts
    monkeypatch.setattr(contracts.httpx, "AsyncClient", FakeClient)

    ctx = StageContext("job_2", {}, "http://localhost:3000")
    patch = {"crawlingSerp": {"status": "RUNNING", "finished": 6, "total": 10,
                              "currentUrl": "https://pl.wikipedia.org/x"}}
    asyncio.run(ctx.emit_phase(patch, "Crawling result 6/10"))

    assert sent["url"].endswith("/api/articles/job-progress")
    assert sent["json"]["jobId"] == "job_2"
    assert sent["json"]["phases"] == patch
    assert sent["json"]["message"] == "Crawling result 6/10"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python-sidecar && python -m pytest tests/test_emit_phase.py -q`
Expected: FAIL — `AttributeError: 'StageContext' object has no attribute 'emit_phase'`

- [ ] **Step 3: Implement emit_phase**

Append to `StageContext` in `python-sidecar/pipeline/contracts.py`:

```python
    async def emit_phase(self, patch: dict, message: str = "") -> None:
        """Post a typed phase patch (Node merges it into analysis_jobs.progress_json).

        Progress events must never break the pipeline, so every failure is logged
        and swallowed — same contract as emit_progress."""
        if not self._nextjs_url:
            print(f"[pipeline] phase {patch} {message}")
            return
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self._nextjs_url}/api/articles/job-progress",
                    headers={
                        "Content-Type": "application/json",
                        "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
                    },
                    json={"jobId": self.job_id, "phases": patch, "message": message},
                )
                if resp.status_code >= 400:
                    print(f"[pipeline] phase update HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            print(f"[pipeline] phase update failed: {type(exc).__name__}: {exc}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python-sidecar && python -m pytest tests/test_emit_phase.py -q`
Expected: PASS (2 tests)

- [ ] **Step 5: Emit per-result crawl events**

In `python-sidecar/pipeline/stages/scrape_serp.py`, find the loop that fetches competitor pages. Before the loop, emit the total; inside it, emit after each page:

```python
        total = len(urls)
        await ctx.emit_phase({"fetchingSerp": {"status": "DONE"},
                              "crawlingSerp": {"status": "RUNNING", "finished": 0, "total": total}})
        for index, url in enumerate(urls, start=1):
            # ... existing per-URL fetch ...
            await ctx.emit_phase(
                {"crawlingSerp": {"status": "RUNNING", "finished": index,
                                  "total": total, "currentUrl": url}},
                f"Crawling result {index}/{total}",
            )
        await ctx.emit_phase({"crawlingSerp": {"status": "DONE", "finished": total, "total": total},
                              "loadingCompetitors": {"status": "RUNNING"}})
```

If the stage fetches concurrently, keep a counter guarded by the existing gather and emit after each completion instead of by index.

- [ ] **Step 6: Mark the terminal phases**

In `python-sidecar/pipeline/runner.py`, after the loop that runs stages (after line 34, before `return result`), add:

```python
        await self.ctx.emit_phase({
            "crawlingSerp": {"status": "DONE"},
            "loadingCompetitors": {"status": "DONE"},
            "aiSearch": {"status": "DONE"},
        })
```

- [ ] **Step 7: Verify the suite still passes**

Run: `cd python-sidecar && python -m pytest tests -q`
Expected: PASS (all existing tests plus the 2 new)

- [ ] **Step 8: Commit**

```bash
git add python-sidecar/pipeline/contracts.py python-sidecar/pipeline/runner.py python-sidecar/pipeline/stages/scrape_serp.py python-sidecar/tests/test_emit_phase.py
git commit -m "feat(sidecar): emit typed analysis phases with per-result crawl events"
```

---

### Task 5: The panel

**Files:**
- Create: `components/articles/AnalysisProgressPanel.tsx`
- Test: `__tests__/components/AnalysisProgressPanel.test.tsx`
- Modify: `pages/articles/[id]/index.tsx` (side panel card, near line 2178)

**Interfaces:**
- Consumes: `analysisPhaseGroups`, `PhaseGroup`, `AnalysisPhases`.
- Produces: `<AnalysisProgressPanel phases={AnalysisPhases} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/AnalysisProgressPanel.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalysisProgressPanel from '../../components/articles/AnalysisProgressPanel';
import { emptyPhases, mergePhases } from '../../lib/analysisPhases';

describe('AnalysisProgressPanel', () => {
  it('shows both groups', () => {
    render(<AnalysisProgressPanel phases={emptyPhases()} />);
    expect(screen.getByText('AI Search')).toBeInTheDocument();
    expect(screen.getByText('Google Search results')).toBeInTheDocument();
  });

  it('shows the live crawl counter and host', () => {
    const phases = mergePhases(emptyPhases(), {
      fetchingSerp: { status: 'DONE' },
      crawlingSerp: {
        status: 'RUNNING', finished: 6, total: 10, currentUrl: 'https://pl.wikipedia.org/wiki/X',
      },
    });
    render(<AnalysisProgressPanel phases={phases} />);
    expect(screen.getByText('Crawling result 6/10')).toBeInTheDocument();
    expect(screen.getByText('pl.wikipedia.org')).toBeInTheDocument();
  });

  it('marks finished rows for assistive tech', () => {
    const phases = mergePhases(emptyPhases(), { fetchingSerp: { status: 'DONE' } });
    render(<AnalysisProgressPanel phases={phases} />);
    expect(screen.getByLabelText('Done: Getting search results')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/AnalysisProgressPanel.test.tsx --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `components/articles/AnalysisProgressPanel`

- [ ] **Step 3: Write the component**

```tsx
// components/articles/AnalysisProgressPanel.tsx
import React from 'react';
import { Icon } from '../koala/icons';
import { analysisPhaseGroups, type PhaseRow } from '../../lib/analysisPhaseRows';
import type { AnalysisPhases } from '../../lib/analysisPhases';

const Marker: React.FC<{ state: PhaseRow['state'] }> = ({ state }) => {
  if (state === 'done') return <Icon name="Check" size={16} weight="bold" />;
  if (state === 'error') return <Icon name="WarningCircle" size={16} weight="bold" />;
  if (state === 'active') {
    return (
      <span
        className="inline-block aspect-square animate-spin rounded-full"
        style={{ width: 14, height: 14, border: '1.5px solid currentColor', borderBottomColor: 'transparent' }}
      />
    );
  }
  return <span style={{ width: 14, height: 14, display: 'inline-block' }} />;
};

const AnalysisProgressPanel: React.FC<{ phases: AnalysisPhases }> = ({ phases }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '8px 4px' }} aria-live="polite">
    {analysisPhaseGroups(phases).map((group) => (
      <section key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--koala-text-primary)' }}>{group.title}</h3>
        {group.rows.map((row) => (
          <div
            key={row.id}
            aria-label={row.state === 'done' ? `Done: ${row.label}` : row.label}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              color: row.state === 'pending' || row.state === 'done'
                ? 'var(--koala-text-secondary)'
                : 'var(--koala-text-primary)',
            }}
          >
            <span style={{ paddingTop: 2 }}><Marker state={row.state} /></span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>
              {row.label}
              {row.detail ? (
                <span style={{ display: 'block', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                  {row.detail}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </section>
    ))}
  </div>
);

export default AnalysisProgressPanel;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/AnalysisProgressPanel.test.tsx --testPathIgnorePatterns worktrees`
Expected: PASS (3 tests)

- [ ] **Step 5: Render it while the article is analysing**

In `pages/articles/[id]/index.tsx`, inside the side-panel card (`<div className="koala-panel editor-side-panel-card">`, near line 2178), make the analysing case win before `editorLocked`:

```tsx
              {isDeepAnalyzing && analysisPhases ? (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                  <AnalysisProgressPanel phases={analysisPhases} />
                </div>
              ) : editorLocked ? (
```

Add the state next to the existing `useBackgroundDeepAnalysis` call (line 505) — poll the job endpoint that already exists:

```tsx
  const [analysisPhases, setAnalysisPhases] = useState<AnalysisPhases | null>(null);
  useEffect(() => {
    if (!id || !isDeepAnalyzing) return undefined;
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/articles/job-progress?articleId=${id}&jobType=deep_analysis`);
      if (!res.ok || cancelled) return;
      const data = await res.json() as { phases?: AnalysisPhases | null };
      if (data.phases && !cancelled) setAnalysisPhases(data.phases);
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id, isDeepAnalyzing]);
```

Imports: `AnalysisProgressPanel` from `../../../components/articles/AnalysisProgressPanel`, `type { AnalysisPhases }` from `../../../lib/analysisPhases`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint "pages/articles/[id]/index.tsx" components/articles/AnalysisProgressPanel.tsx`
Expected: no type errors; no new lint errors versus `git stash` baseline.

- [ ] **Step 7: Commit**

```bash
git add components/articles/AnalysisProgressPanel.tsx __tests__/components/AnalysisProgressPanel.test.tsx "pages/articles/[id]/index.tsx"
git commit -m "feat(editor): deep-analysis progress panel in the side column"
```

---

## Phase B — Streamed generation

Surfer runs two subscriptions per draft: `AiArticleStatusStreaming` (the status line) and `AiArticleContentStreaming` (the text). We reproduce both channels over one SSE response, because a Vercel function cannot hold an Absinthe socket. The sidecar keeps posting to `/api/articles/job-progress`; Node tails the row and pushes deltas, so the browser polls nothing.

### Task 6: Status and content columns

**Files:**
- Modify: `lib/ensureArticlesTables.ts` (analysis_jobs block)
- Modify: `pages/api/articles/job-progress.ts` (POST)
- Test: `__tests__/api/jobProgressStream.test.ts`

**Interfaces:**
- Produces: POST accepts `statusText?: string` and `contentChunk?: string`; the row gains `status_text TEXT` and `stream_text TEXT` (chunks appended in arrival order).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/jobProgressStream.test.ts
import { appendChunk } from '../../lib/streamText';

describe('appendChunk', () => {
  it('appends to an empty stream', () => {
    expect(appendChunk(null, '<h1>Title</h1>')).toBe('<h1>Title</h1>');
  });

  it('concatenates in arrival order', () => {
    expect(appendChunk('<h1>T</h1>', '<p>Body</p>')).toBe('<h1>T</h1><p>Body</p>');
  });

  it('caps runaway streams at 400k characters', () => {
    const long = 'x'.repeat(399_995);
    expect(appendChunk(long, 'abcdefghij')).toHaveLength(400_000);
  });

  it('ignores an empty chunk', () => {
    expect(appendChunk('<p>a</p>', '')).toBe('<p>a</p>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/jobProgressStream.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `../../lib/streamText`

- [ ] **Step 3: Implement**

```ts
// lib/streamText.ts
/** Generation streams append here; the cap stops a runaway writer filling the row. */
export const MAX_STREAM_CHARS = 400_000;

export function appendChunk(prev: string | null, chunk: string): string {
  if (!chunk) return prev ?? '';
  const next = (prev ?? '') + chunk;
  return next.length > MAX_STREAM_CHARS ? next.slice(0, MAX_STREAM_CHARS) : next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/jobProgressStream.test.ts --testPathIgnorePatterns worktrees`
Expected: PASS (4 tests)

- [ ] **Step 5: Add columns and wire the POST**

In `lib/ensureArticlesTables.ts`, next to `progress_json` from Task 3:

```ts
   if (isPg) {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS status_text TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS stream_text TEXT`); } catch {}
   } else {
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN status_text TEXT`); } catch {}
      try { await db.query(`ALTER TABLE analysis_jobs ADD COLUMN stream_text TEXT`); } catch {}
   }
```

In `pages/api/articles/job-progress.ts`, in the same non-terminal POST branch as Task 3:

```ts
    const { statusText, contentChunk } = req.body as { statusText?: string; contentChunk?: string };
    if (typeof statusText === 'string' && statusText.trim()) {
      await db.query(
        `UPDATE analysis_jobs SET status_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [statusText.trim().slice(0, 300), jobId] },
      );
    }
    if (typeof contentChunk === 'string' && contentChunk) {
      const { appendChunk } = await import('../../../lib/streamText');
      const rows = await db.query<{ stream_text: string | null }>(
        `SELECT stream_text FROM analysis_jobs WHERE id = ?`,
        { replacements: [jobId], type: QueryTypes.SELECT },
      );
      await db.query(
        `UPDATE analysis_jobs SET stream_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [appendChunk(rows[0]?.stream_text ?? null, contentChunk), jobId] },
      );
    }
```

- [ ] **Step 6: Verify**

Run: `npx jest __tests__/api/jobProgressStream.test.ts --testPathIgnorePatterns worktrees && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/streamText.ts lib/ensureArticlesTables.ts pages/api/articles/job-progress.ts __tests__/api/jobProgressStream.test.ts
git commit -m "feat(generation): store status line and content chunks per job"
```

---

### Task 7: SSE endpoint

**Files:**
- Create: `pages/api/articles/[id]/generate-stream.ts`
- Test: `__tests__/lib/streamDelta.test.ts`
- Create: `lib/streamDelta.ts`

**Interfaces:**
- Consumes: `analysis_jobs.status_text`, `stream_text`, `status`.
- Produces: `GET /api/articles/[id]/generate-stream?jobId=<id>` emitting SSE events `status` (`{ text }`), `content` (`{ chunk }`), `done` (`{ html }`), `error` (`{ message }`); and `streamDelta(sentLength: number, full: string): { chunk: string; nextLength: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/streamDelta.test.ts
import { streamDelta } from '../../lib/streamDelta';

describe('streamDelta', () => {
  it('emits only what has not been sent', () => {
    expect(streamDelta(5, 'abcdefgh')).toEqual({ chunk: 'fgh', nextLength: 8 });
  });

  it('emits nothing when nothing changed', () => {
    expect(streamDelta(8, 'abcdefgh')).toEqual({ chunk: '', nextLength: 8 });
  });

  it('restarts when the stored text shrank (job restarted)', () => {
    expect(streamDelta(20, 'abc')).toEqual({ chunk: 'abc', nextLength: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/streamDelta.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `../../lib/streamDelta`

- [ ] **Step 3: Implement the delta helper**

```ts
// lib/streamDelta.ts
/** What the SSE loop still owes the client, given how much it already sent. */
export function streamDelta(sentLength: number, full: string): { chunk: string; nextLength: number } {
  if (full.length < sentLength) return { chunk: full, nextLength: full.length };
  return { chunk: full.slice(sentLength), nextLength: full.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/streamDelta.test.ts --testPathIgnorePatterns worktrees`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the endpoint**

```ts
// pages/api/articles/[id]/generate-stream.ts
// GET /api/articles/[id]/generate-stream?jobId=... — one SSE response carrying the
// two channels Surfer splits across AiArticleStatusStreaming and
// AiArticleContentStreaming. Node tails the job row so the browser polls nothing.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { assertArticleAccess } from '../../../../lib/tenancy';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { flushHeaders, flushSse } from '../../../../lib/types/api';
import { streamDelta } from '../../../../lib/streamDelta';

export const config = { maxDuration: 300 };

const TICK_MS = 700;

type JobRow = {
  status: string;
  status_text: string | null;
  stream_text: string | null;
  error: string | null;
};

function send(res: NextApiResponse, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  flushSse(res);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const articleId = Number(req.query.id);
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
  if (!Number.isFinite(articleId) || !jobId) {
    return res.status(400).json({ error: 'articleId and jobId are required' });
  }
  const userId = await getCurrentUserId(req, res);
  if (!(await assertArticleAccess(userId, articleId))) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  flushHeaders(res);
  res.write(':ok\n\n');

  let sentLength = 0;
  let lastStatus = '';
  let closed = false;
  req.on('close', () => { closed = true; });

  // eslint-disable-next-line no-constant-condition
  while (!closed) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query<JobRow>(
      `SELECT status, status_text, stream_text, error FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    const job = rows[0];
    if (!job) {
      send(res, 'error', { message: 'job not found' });
      break;
    }
    if (job.status_text && job.status_text !== lastStatus) {
      lastStatus = job.status_text;
      send(res, 'status', { text: job.status_text });
    }
    const delta = streamDelta(sentLength, job.stream_text ?? '');
    if (delta.chunk) {
      sentLength = delta.nextLength;
      send(res, 'content', { chunk: delta.chunk });
    }
    if (job.status === 'done') {
      send(res, 'done', { html: job.stream_text ?? '' });
      break;
    }
    if (job.status === 'failed' || job.status === 'canceled') {
      send(res, 'error', { message: job.error || job.status });
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, TICK_MS); });
  }
  res.end();
}
```

- [ ] **Step 6: Emit the two channels from the sidecar**

In `python-sidecar/main.py`, inside `run_generate`, replace the two coarse `post_progress` calls with status lines, and pass a chunk callback into the pipeline:

```python
        async with _generate_slots:
            await post_status(nextjs_url, job_id, f'Researching "{payload.get("keyword", "")}"...')
            resp = await generate_article(GenerateRequest(**payload))
```

Add next to `post_progress` in `python-sidecar/pipeline/domain_runner.py`:

```python
async def post_status(nextjs_url: str, job_id: str, text: str) -> None:
    """Status line for the editor (Surfer's AiArticleStatusStreaming equivalent)."""
    await _post(nextjs_url, {"jobId": job_id, "statusText": text})


async def post_chunk(nextjs_url: str, job_id: str, chunk: str) -> None:
    await _post(nextjs_url, {"jobId": job_id, "contentChunk": chunk})
```

where `_post` is the existing helper `post_progress` already uses (extract it if it is inline). In `python-sidecar/pipeline/article_pipeline.py`, `run_pipeline` takes two optional callbacks and calls them around each section:

```python
async def run_pipeline(..., on_status=None, on_chunk=None) -> str:
    ...
    if on_status:
        await on_status("Reading competitor outlines...")
```

and in the compiled branch, after each section renders:

```python
        if on_status:
            await on_status(f"Writing: {heading} ({index}/{total})")
        if on_chunk:
            await on_chunk(section_html)
```

- [ ] **Step 7: Consume the stream in the editor**

In `components/articles/ArticleEditor.tsx`, replace the polling loop inside `handleWriteWithAi` (the `new Promise` with `tick` near line 2005) with an `EventSource`:

```tsx
        await new Promise<void>((resolve, reject) => {
          const source = new EventSource(`/api/articles/${articleId}/generate-stream?jobId=${encodeURIComponent(jobId!)}`);
          source.addEventListener('status', (event) => {
            if (!isCurrentRun()) return;
            const { text } = JSON.parse((event as MessageEvent).data) as { text: string };
            setGenerateMsg(text);
          });
          source.addEventListener('done', () => { source.close(); resolve(); });
          source.addEventListener('error', () => {
            source.close();
            reject(new Error('Generation stream failed'));
          });
        });
```

Keep the existing post-stream reload of `/api/articles/${articleId}` — the row is the source of truth for the final HTML.

- [ ] **Step 8: Verify**

Run: `npx jest __tests__/lib/streamDelta.test.ts --testPathIgnorePatterns worktrees && npx tsc --noEmit && cd python-sidecar && python -m pytest tests -q`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/streamDelta.ts "pages/api/articles/[id]/generate-stream.ts" __tests__/lib/streamDelta.test.ts python-sidecar components/articles/ArticleEditor.tsx
git commit -m "feat(generation): stream status and content instead of polling"
```

---

## Phase C — Typed scoring

### Task 8: Factor model and introduction scorers

**Files:**
- Create: `lib/aiScore/factors.ts`
- Create: `lib/aiScore/introductionFactors.ts`
- Test: `__tests__/lib/aiScore/introductionFactors.test.ts`

**Interfaces:**
- Produces: `FactorName`, `ScoreFactor = { name: FactorName; found: boolean; score: number; textSpan?: string; value?: number }`, `factsCoverageFactor(covered: number, total: number): ScoreFactor`, `aioScore(factors: ScoreFactor[], weights?: Partial<Record<FactorName, number>>): { value: number; factors: ScoreFactor[] }`, `scoreIntroduction(opts): ScoreFactor[]`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/aiScore/introductionFactors.test.ts
import { scoreIntroduction } from '../../../lib/aiScore/introductionFactors';
import { aioScore, factsCoverageFactor } from '../../../lib/aiScore/factors';

const html = `
  <h1>Detektywi Kraków</h1>
  <p>Detektywi w Krakowie realizują obserwację osób, wykrywanie zdrad i wywiad gospodarczy.</p>
  <p>Artykuł kierowany jest do klientów indywidualnych oraz przedsiębiorców.</p>
`;

describe('scoreIntroduction', () => {
  const factors = scoreIntroduction({
    html,
    keyword: 'detektywi kraków',
    coveredTopics: ['obserwacja', 'wywiad gospodarczy'],
    audienceTerms: ['klientów', 'przedsiębiorców'],
  });
  const byName = Object.fromEntries(factors.map((f) => [f.name, f]));

  it('returns the four introduction factors', () => {
    expect(factors.map((f) => f.name).sort()).toEqual([
      'INTRODUCTION_COVERED_TOPICS',
      'INTRODUCTION_EARLY_QUERY_ANSWER',
      'INTRODUCTION_TARGET_AUDIENCE',
      'INTRODUCTION_TOPIC_RELEVANCE',
    ]);
  });

  it('finds the sentence that answers the query and returns it as the span', () => {
    expect(byName.INTRODUCTION_EARLY_QUERY_ANSWER.found).toBe(true);
    expect(byName.INTRODUCTION_EARLY_QUERY_ANSWER.textSpan)
      .toContain('Detektywi w Krakowie realizują obserwację');
  });

  it('names the audience sentence', () => {
    expect(byName.INTRODUCTION_TARGET_AUDIENCE.textSpan).toContain('przedsiębiorców');
  });

  it('scores every factor between 0 and 1', () => {
    for (const factor of factors) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(1);
    }
  });

  it('reports a miss instead of inventing a span', () => {
    const empty = scoreIntroduction({
      html: '<h1>T</h1><p>Lorem ipsum dolor sit amet.</p>',
      keyword: 'detektywi kraków',
      coveredTopics: ['obserwacja'],
      audienceTerms: ['przedsiębiorców'],
    });
    const audience = empty.find((f) => f.name === 'INTRODUCTION_TARGET_AUDIENCE');
    expect(audience).toMatchObject({ found: false, score: 0 });
    expect(audience?.textSpan).toBeUndefined();
  });
});

describe('aioScore', () => {
  it('is the weighted mean of its factors on a 0-100 scale', () => {
    const value = aioScore([
      { name: 'FACTS_COVERAGE', found: true, score: 0.8, value: 80 },
      { name: 'INTRODUCTION_COVERED_TOPICS', found: true, score: 1 },
    ]).value;
    expect(value).toBeGreaterThan(80);
    expect(value).toBeLessThanOrEqual(100);
  });

  it('turns a coverage ratio into a factor', () => {
    expect(factsCoverageFactor(41, 50)).toMatchObject({ name: 'FACTS_COVERAGE', value: 82, found: true });
  });

  it('handles an empty knowledge base without dividing by zero', () => {
    expect(factsCoverageFactor(0, 0)).toMatchObject({ value: 0, found: false, score: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/aiScore --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `lib/aiScore/factors`

- [ ] **Step 3: Implement the factor model**

```ts
// lib/aiScore/factors.ts
/**
 * Typed AI score, mirroring the audited AioScore contract: a value plus the factors
 * that produced it, each carrying the sentence that earned it. Weights live here,
 * not inside the formula, so they can be tuned without touching the scorers.
 */
export type FactorName =
  | 'FACTS_COVERAGE'
  | 'INTRODUCTION_COVERED_TOPICS'
  | 'INTRODUCTION_TARGET_AUDIENCE'
  | 'INTRODUCTION_EARLY_QUERY_ANSWER'
  | 'INTRODUCTION_TOPIC_RELEVANCE';

export type ScoreFactor = {
  name: FactorName;
  found: boolean;
  /** 0..1 */
  score: number;
  /** The sentence that satisfied the factor. Absent when found === false. */
  textSpan?: string;
  /** Percentage form, for factors the UI shows as a number. */
  value?: number;
};

export const DEFAULT_WEIGHTS: Record<FactorName, number> = {
  FACTS_COVERAGE: 4,
  INTRODUCTION_COVERED_TOPICS: 1,
  INTRODUCTION_TARGET_AUDIENCE: 1,
  INTRODUCTION_EARLY_QUERY_ANSWER: 2,
  INTRODUCTION_TOPIC_RELEVANCE: 1,
};

export function factsCoverageFactor(covered: number, total: number): ScoreFactor {
  const ratio = total > 0 ? covered / total : 0;
  return {
    name: 'FACTS_COVERAGE',
    found: total > 0 && covered > 0,
    score: ratio,
    value: Math.round(ratio * 100),
  };
}

export function aioScore(
  factors: ScoreFactor[],
  weights: Partial<Record<FactorName, number>> = {},
): { value: number; factors: ScoreFactor[] } {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const totalWeight = factors.reduce((sum, factor) => sum + (merged[factor.name] ?? 1), 0);
  if (!totalWeight) return { value: 0, factors };
  const weighted = factors.reduce(
    (sum, factor) => sum + factor.score * (merged[factor.name] ?? 1),
    0,
  );
  return { value: Math.round((weighted / totalWeight) * 100), factors };
}
```

- [ ] **Step 4: Implement the introduction scorers**

```ts
// lib/aiScore/introductionFactors.ts
import type { FactorName, ScoreFactor } from './factors';

const INTRO_SENTENCE_LIMIT = 6;

function introSentences(html: string): string[] {
  const withoutHeadings = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  const text = withoutHeadings.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, INTRO_SENTENCE_LIMIT);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** First sentence containing any of the terms; the span is returned verbatim. */
function findSpan(sentences: string[], terms: string[]): { span?: string; hits: number } {
  const wanted = terms.map(normalize).filter(Boolean);
  if (!wanted.length) return { hits: 0 };
  let best: { span: string; hits: number } | null = null;
  for (const sentence of sentences) {
    const haystack = normalize(sentence);
    const hits = wanted.filter((term) => haystack.includes(term)).length;
    if (hits && (!best || hits > best.hits)) best = { span: sentence, hits };
  }
  return best ? { span: best.span, hits: best.hits } : { hits: 0 };
}

function factor(name: FactorName, span: string | undefined, score: number): ScoreFactor {
  return span
    ? { name, found: true, score: Math.min(1, score), textSpan: span }
    : { name, found: false, score: 0 };
}

export function scoreIntroduction(opts: {
  html: string;
  keyword: string;
  coveredTopics: string[];
  audienceTerms: string[];
}): ScoreFactor[] {
  const sentences = introSentences(opts.html);
  const keywordTerms = opts.keyword.split(/\s+/).filter((word) => word.length > 2);

  const topics = findSpan(sentences, opts.coveredTopics);
  const audience = findSpan(sentences, opts.audienceTerms);
  const early = findSpan(sentences.slice(0, 2), keywordTerms);
  const relevance = findSpan(sentences, keywordTerms);

  return [
    factor(
      'INTRODUCTION_COVERED_TOPICS',
      topics.span,
      opts.coveredTopics.length ? topics.hits / opts.coveredTopics.length : 0,
    ),
    factor(
      'INTRODUCTION_TARGET_AUDIENCE',
      audience.span,
      opts.audienceTerms.length ? audience.hits / opts.audienceTerms.length : 0,
    ),
    factor(
      'INTRODUCTION_EARLY_QUERY_ANSWER',
      early.span,
      keywordTerms.length ? early.hits / keywordTerms.length : 0,
    ),
    factor(
      'INTRODUCTION_TOPIC_RELEVANCE',
      relevance.span,
      keywordTerms.length ? relevance.hits / keywordTerms.length : 0,
    ),
  ];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/aiScore --testPathIgnorePatterns worktrees`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/aiScore __tests__/lib/aiScore
git commit -m "feat(score): typed AI factors with the sentence that earned each point"
```

---

### Task 9: Show the factors

**Files:**
- Modify: `components/articles/ContentScorePanel.tsx`
- Test: `__tests__/components/ScoreFactorList.test.tsx`
- Create: `components/articles/ScoreFactorList.tsx`

**Interfaces:**
- Consumes: `ScoreFactor` from `lib/aiScore/factors`.
- Produces: `<ScoreFactorList factors={ScoreFactor[]} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/ScoreFactorList.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ScoreFactorList from '../../components/articles/ScoreFactorList';

describe('ScoreFactorList', () => {
  it('shows a readable label and the sentence that earned the point', () => {
    render(<ScoreFactorList factors={[{
      name: 'INTRODUCTION_EARLY_QUERY_ANSWER',
      found: true,
      score: 0.96,
      textSpan: 'Detektywi w Krakowie realizują obserwację osób.',
    }]} />);
    expect(screen.getByText('Answers the query early')).toBeInTheDocument();
    expect(screen.getByText('“Detektywi w Krakowie realizują obserwację osób.”')).toBeInTheDocument();
  });

  it('tells the writer what is missing instead of showing an empty quote', () => {
    render(<ScoreFactorList factors={[{
      name: 'INTRODUCTION_TARGET_AUDIENCE', found: false, score: 0,
    }]} />);
    expect(screen.getByText('Not found in the introduction')).toBeInTheDocument();
  });

  it('shows facts coverage as a percentage', () => {
    render(<ScoreFactorList factors={[{
      name: 'FACTS_COVERAGE', found: true, score: 0.82, value: 82,
    }]} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/ScoreFactorList.test.tsx --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `components/articles/ScoreFactorList`

- [ ] **Step 3: Implement**

```tsx
// components/articles/ScoreFactorList.tsx
import React from 'react';
import { Icon } from '../koala/icons';
import type { FactorName, ScoreFactor } from '../../lib/aiScore/factors';

const LABELS: Record<FactorName, string> = {
  FACTS_COVERAGE: 'Facts covered',
  INTRODUCTION_COVERED_TOPICS: 'Covers the planned topics',
  INTRODUCTION_TARGET_AUDIENCE: 'Names the reader',
  INTRODUCTION_EARLY_QUERY_ANSWER: 'Answers the query early',
  INTRODUCTION_TOPIC_RELEVANCE: 'Stays on topic',
};

const ScoreFactorList: React.FC<{ factors: ScoreFactor[] }> = ({ factors }) => (
  <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
    {factors.map((factor) => (
      <li key={factor.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon
          name={factor.found ? 'CheckCircle' : 'Circle'}
          size={16}
          weight="bold"
          style={{ marginTop: 2, color: factor.found ? 'var(--koala-success-500)' : 'var(--koala-text-secondary)' }}
        />
        <span style={{ fontSize: 14 }}>
          <span style={{ color: 'var(--koala-text-primary)' }}>{LABELS[factor.name]}</span>
          {typeof factor.value === 'number' ? (
            <span style={{ marginLeft: 6, color: 'var(--koala-text-secondary)' }}>{factor.value}%</span>
          ) : null}
          <span style={{ display: 'block', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
            {factor.textSpan ? `“${factor.textSpan}”` : 'Not found in the introduction'}
          </span>
        </span>
      </li>
    ))}
  </ul>
);

export default ScoreFactorList;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/ScoreFactorList.test.tsx --testPathIgnorePatterns worktrees`
Expected: PASS (3 tests)

- [ ] **Step 5: Persist the factors when an article finishes**

Nothing writes `ai_factors` yet. Add it where the finished article is already reconciled — `lib/reconcilePostGenerateArticle.ts`, called from the `article_generate` terminal branch of `pages/api/articles/job-progress.ts` (near line 286). Inside that function, after the score data is assembled:

```ts
  const { scoreIntroduction } = await import('./aiScore/introductionFactors');
  const { aioScore, factsCoverageFactor } = await import('./aiScore/factors');

  const coverage = coverageSnapshot?.items ?? [];
  const factors = [
    factsCoverageFactor(coverage.filter((item) => item.covered).length, coverage.length),
    ...scoreIntroduction({
      html,
      keyword: article.target_keyword || '',
      coveredTopics: coverage.slice(0, 8).map((item) => item.label),
      audienceTerms: readerAudienceTerms,
    }),
  ];
  const ai = aioScore(factors);
  scoreData.ai_factors = ai.factors;
  scoreData.ai_score = ai.value;
```

`coverageSnapshot` is the snapshot the function already builds for `ai_info_to_cover`; `readerAudienceTerms` comes from `bundle.reader.readerPersona.split(/\s+/)` when `score_data.content_planner_v2` is present, otherwise `[]`. Extend the `ScoreData` type in `lib/contentScore.ts` with `ai_factors?: ScoreFactor[]` and `ai_score?: number`.

- [ ] **Step 6: Render it under the AI Search gauge**

In `components/articles/ContentScorePanel.tsx`, below the AI Search score block, render `<ScoreFactorList factors={aiFactors} />` where `const aiFactors = scoreData?.ai_factors ?? []`. Guard with `aiFactors.length > 0` so an article scored before this change renders unchanged.

- [ ] **Step 7: Commit**

```bash
git add components/articles/ScoreFactorList.tsx components/articles/ContentScorePanel.tsx __tests__/components/ScoreFactorList.test.tsx
git commit -m "feat(score): list AI factors with their evidence in the editor"
```

---

## Phase D — Pipeline versioning

### Task 10: Record which pipeline wrote the article

**Files:**
- Modify: `lib/ensureArticlesTables.ts`
- Modify: `pages/api/articles/[id]/generate.ts`
- Test: `__tests__/lib/pipelineVersion.test.ts`
- Create: `lib/pipelineVersion.ts`

**Interfaces:**
- Produces: `PIPELINE_VERSION: string`, `pipelineVersionTag(opts: { manualOutline: boolean }): string`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/pipelineVersion.test.ts
import { PIPELINE_VERSION, pipelineVersionTag } from '../../lib/pipelineVersion';

describe('pipelineVersionTag', () => {
  it('records the planner version', () => {
    expect(pipelineVersionTag({ manualOutline: false })).toBe(PIPELINE_VERSION);
  });

  it('marks articles whose outline the user edited', () => {
    expect(pipelineVersionTag({ manualOutline: true })).toBe(`${PIPELINE_VERSION}+manual-outline`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/pipelineVersion.test.ts --testPathIgnorePatterns worktrees`
Expected: FAIL — cannot find `../../lib/pipelineVersion`

- [ ] **Step 3: Implement**

```ts
// lib/pipelineVersion.ts
import { PLANNER_VERSION } from './contentPlanner/types';

/** Bump when the planner or writer changes in a way that should be measurable later. */
export const PIPELINE_VERSION = `planner-${PLANNER_VERSION}`;

export function pipelineVersionTag(opts: { manualOutline: boolean }): string {
  return opts.manualOutline ? `${PIPELINE_VERSION}+manual-outline` : PIPELINE_VERSION;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/pipelineVersion.test.ts --testPathIgnorePatterns worktrees`
Expected: PASS (2 tests)

- [ ] **Step 5: Persist it**

In `lib/ensureArticlesTables.ts`, next to the other article columns:

```ts
   if (isPg) {
      try { await db.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS pipeline_version TEXT`); } catch {}
   } else {
      try { await db.query(`ALTER TABLE articles ADD COLUMN pipeline_version TEXT`); } catch {}
   }
```

In `pages/api/articles/[id]/generate.ts`, where the job is inserted and the article is marked `generating` (near line 342), also write the tag:

```ts
    const { pipelineVersionTag } = await import('../../../../lib/pipelineVersion');
    await db.query(
      `UPDATE articles SET status = 'generating', pipeline_version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE ${articleIdSql} = ?`,
      { replacements: [pipelineVersionTag({ manualOutline: approvedHeadings.length > 0 }), articleId] },
    );
```

- [ ] **Step 6: Verify**

Run: `npx jest __tests__/lib/pipelineVersion.test.ts --testPathIgnorePatterns worktrees && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/pipelineVersion.ts lib/ensureArticlesTables.ts "pages/api/articles/[id]/generate.ts" __tests__/lib/pipelineVersion.test.ts
git commit -m "feat(articles): record the pipeline version that wrote each article"
```

---

## Deliberate deviation from 1:1

Everything above mirrors Surfer's contract. One thing does not, on purpose:

**Their quality gate runs after writing; ours runs before.** `AioScore` is computed on a
finished article, and four of its five factors judge the introduction. Our
`validateBlueprint` (`targetClaims >= 5`) and `KNOWLEDGE_COVERAGE_MIN_PCT = 95` refuse to
start the Write Engine when the harvested knowledge is too thin. Phase C copies their
*presentation* — typed factors, evidence spans — and adds it on top of our gate rather
than in place of it. Removing our gate to match them exactly would let the writer produce
articles with no covered claims, which is the failure mode this product exists to avoid.

If you want the gate softened anyway, that is a one-line change in
`lib/contentPlanner/validators/planValidators.ts:26` plus
`lib/contentPlanner/types.ts:368` — but it belongs in its own commit with its own
before/after comparison on a real keyword, not folded into this plan.
