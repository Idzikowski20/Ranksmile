# AI Visibility (SurferSEO AI Tracker parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-domain AI Visibility tracking (Overview / Sources / Competitors / Prompts / Fanout Queries) with a setup wizard, backed by the DataForSEO AI Optimization API.

**Architecture:** A wizard writes a config (selected prompts grouped by topic) to Postgres/SQLite via the ensure-tables pattern; Finish enqueues a scan that fans each selected prompt out to ChatGPT/Gemini/Perplexity through DataForSEO `llm_responses/live` (fire-and-forget kick + status polling, mirroring `lib/domainPipeline.ts`), persists answers + citations per (prompt, model), and five read endpoints aggregate those rows for the sub-pages. A route guard redirects any AI Visibility page to the wizard until a config exists.

**Tech Stack:** Next.js 12 (pages router, legacy `<Link>` needs a single `<a>` child), Sequelize raw SQL via `db.query` / `lib/db/query` helpers, react-query v3, axios, existing `lib/dataforseo.ts` Basic-auth client, Jest.

## Scope (2026-07-02, reduced by user)

**Build now: configure (setup wizard + guard) + Overview only.** Skip Task 10 (Sources/Prompts pages) and Task 11 (Competitors/Fanout pages). Backend Tasks 1–7 stay as-is (Overview consumes the `overview`, `prompts`, `sources` views; the `competitors`/`fanout` views ship in the endpoint but no page renders them yet). Sidebar already links all five AI Visibility items; the four unbuilt ones will 404 until a later pass — acceptable for this scope. Task 9's main chart follows the actual product HTML the user pasted: a "Visibility score" 5-bar chart (per model), not the promo-video competitor-benchmark variant.

## Global Constraints

- New UI code = inline `style={{ }}`; font always `var(--font-family-primary)`; icons = inline SVG only (project CLAUDE.md).
- Design tokens: card border `#F4F4F5`, panel border `#E4E4E7`, input border `#D4D4D8`, content text `#18181B`, muted `#52525C`/`#71717B`, brand purple `#783AFB`, dark button `#2F2F34`, success `#1AB25E`, error `#FF6F77`, dropdown shadow `0px 18px 40px rgba(17,24,39,0.14), 0px 8px 18px rgba(17,24,39,0.09)`, z-index 150.
- No new TypeScript `any` (memory: avoid-any-type) — use `unknown` + narrowing or precise types.
- Show skeleton loaders while fetching, never a flash of empty state (memory: skeletons-not-empty-states).
- DB portability: every ensure-table snippet must work on Postgres (`DATABASE_URL` set) and SQLite (unset) — copy the `PK`/`JSON_T` consts pattern from `lib/ensurePipelineTables.ts`.
- DataForSEO env vars are `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` (already used by `lib/dataforseo.ts`). Never introduce new names for these.
- API handlers follow the existing shape: `verifyUser` → 401, method check → 405, `getCurrentUserId` + `verifyDomainOwnershipBySlug` → 403/404, `getErrorMessage` in catch.
- Scan cost is real money (~$0.005–0.03 per LLM response). Every scan records cost as **integer micro-dollars** (`cost_micros`, USD × 1e6) to avoid float drift; the runner hard-caps at `AI_VIS_HARD_CAP_PAIRS` (60 prompts × 3 models). All runner tuning constants live in `lib/aiVisibility.ts` — never re-declare them per-module.
- LLM calls retry up to 3× with exponential backoff on 429/5xx/timeout only (never on 4xx). A `running` scan whose `started_at` is older than `AI_VIS_SCAN_STALE_MS` is treated as dead and reclaimed by the next `enqueueAiVisScan`, so a killed request can never wedge the queue.
- Files created earlier this session that this plan **replaces**: `lib/aiVisibility.ts` (localStorage mock — rewritten in Task 4), `lib/useAiVisibilityGuard.ts` (rewired in Task 8), `components/aiVisibility/CrunchingBar.tsx` (rewired in Task 9). `components/aiVisibility/AiVisibilityToolbar.tsx` is kept as-is.
- Commit style: existing history uses `feat:`/`fix:`/`polish:` prefixes.

## Review response (2026-07-02)

Applied from technical design review. Each item is baked into the task code above — this is the index, not a separate backlog.

- **Stale-scan reclaim (was: fire-and-forget risk).** `enqueueAiVisScan` now reclaims a `running` scan older than `AI_VIS_SCAN_STALE_MS` before checking for an active one, so a Vercel/crash-killed scan can't wedge the queue forever. `enqueue`/`claim`/`kick` stay separable so the trigger can move to cron/sidecar/BullMQ with no signature change (Task 5).
- **LLM retry/backoff.** `runLlmPrompt` retries 3× (1s/2s backoff) on 429/5xx/timeout, never on 4xx; `isRetryable` unit-tested (Task 2).
- **Per-row progress.** Progress + cost written after every result, not batched every 5 (Task 5).
- **Constants centralised.** `AI_VIS_CONCURRENCY`, `AI_VIS_HARD_CAP_PAIRS`, `AI_VIS_SCAN_STALE_MS`, `AI_VIS_ALL_MODELS` live only in `lib/aiVisibility.ts` (Task 4).
- **Model whitelist.** `sanitizeModels` drops unknown model ids before dispatch, so a corrupt `["abc"]` config row can't reach `runLlmPrompt` (Tasks 4 + 5).
- **Cost as integer micros.** `cost_micros INTEGER` everywhere; `/1e6` only at the display boundary (Tasks 1, 5, 6, status endpoint).
- **Citation coercion.** `parseCitations` forces `domain`/`title` to strings so aggregation never sees `undefined` (Task 6).
- **`fetchJson` + toast helper.** One fetch/error helper replaces the repeated `if (!r.ok) throw`; mutations toast via `react-hot-toast` (Task 7).
- **`PromptSelector` split** into `TopicAccordion` / `PromptRow` / `AddPromptRow` (Task 8).
- **`cancelled` status** documented in the enum (column already allows it) for a future cancel button.

**Deliberately NOT adopted (would fight the codebase's conventions):**
- *Schema-version constant* — this repo's ensure-tables pattern is versionless idempotent `ALTER … ADD COLUMN` (`lib/ensurePipelineTables.ts`). A version nothing reads is cargo-cult; skipped per CLAUDE.md "match existing style / YAGNI".
- *Logger abstraction* — repo standard is `console.warn/error`. Adopted the intent (no bare `catch {}` — use `console.warn` like `ignoreExisting`) but did not introduce a logging layer.
- *Per-scan telemetry (latency/tokens)* — deferred; `started_at`/`finished_at` already give duration. Listed under Out of scope.

---

### Task 1: AI Visibility tables (ensure pattern)

**Files:**
- Create: `lib/ensureAiVisibilityTables.ts`
- Create: `scripts/verify-ai-vis-tables.js` (scratch verification, committed for reuse)

**Interfaces:**
- Produces: `ensureAiVisibilityTables(): Promise<void>` — idempotent, guards with a module-level `checked` flag.
- Tables (used by Tasks 4–6): `ai_vis_configs`, `ai_vis_prompts`, `ai_vis_competitors`, `ai_vis_scans`, `ai_vis_results`.

- [ ] **Step 1: Write the ensure module**

```ts
// lib/ensureAiVisibilityTables.ts
import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const NOW = 'CURRENT_TIMESTAMP';

/** Mirrors lib/ensurePipelineTables.ts: log non-"already exists" failures. */
function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[ai-vis] ${label} failed:`, m);
}

/**
 * Workspace-level AI Visibility tracking tables. Distinct from the
 * article-level ai_visibility_runs/citations pair (lib/aiVisibilityStore.ts):
 * these are keyed on domain_id and hold the wizard config + scan results.
 */
export async function ensureAiVisibilityTables(): Promise<void> {
   if (checked) return;

   // One config per domain. No row ⇒ the wizard has not been completed
   // and the route guard sends the user to /ai-visibility/setup.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_configs (
      id ${PK},
      domain_id INTEGER NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      prompt_limit INTEGER DEFAULT 50,
      models ${JSON_T},
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW},
      updated_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_configs', e));

   // topic is a denormalised group label — topics are display grouping only,
   // so a separate topics table would be a join with no additional data.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_prompts (
      id ${PK},
      config_id INTEGER NOT NULL,
      topic TEXT NOT NULL,
      text TEXT NOT NULL,
      provenance ${JSON_T},
      selected INTEGER DEFAULT 1,
      is_custom INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_prompts', e));

   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_competitors (
      id ${PK},
      config_id INTEGER NOT NULL,
      competitor_domain TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_competitors', e));

   // status ∈ queued | running | completed | failed | cancelled.
   // cost is stored as integer micro-dollars (USD × 1e6) to avoid float drift
   // when summing ~180 small per-call costs; divide by 1e6 at display.
   // started_at is the staleness heartbeat: a `running` scan older than
   // SCAN_STALE_MS (see lib/aiVisibility.ts) is treated as dead by enqueue.
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_scans (
      id ${PK},
      config_id INTEGER NOT NULL,
      status TEXT DEFAULT 'queued',
      progress_done INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      cost_micros INTEGER DEFAULT 0,
      error TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_scans', e));

   // One row per (scan, prompt, model). citations = [{url, domain, title}].
   await db.query(`CREATE TABLE IF NOT EXISTS ai_vis_results (
      id ${PK},
      scan_id INTEGER NOT NULL,
      prompt_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      answer TEXT,
      citations ${JSON_T},
      own_cited INTEGER DEFAULT 0,
      own_position INTEGER,
      cost_micros INTEGER DEFAULT 0,
      error TEXT,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('ai_vis_results', e));

   try { await db.query('CREATE INDEX IF NOT EXISTS idx_ai_vis_results_scan ON ai_vis_results (scan_id)'); } catch (e) { ignoreExisting('idx results', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_ai_vis_prompts_config ON ai_vis_prompts (config_id)'); } catch (e) { ignoreExisting('idx prompts', e); }

   checked = true;
}
```

- [ ] **Step 2: Write the verification script**

```js
// scripts/verify-ai-vis-tables.js
// Run: node scripts/verify-ai-vis-tables.js  (uses .env DATABASE_URL if set, else sqlite)
require('dotenv').config();
(async () => {
   require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
   const db = require('../database/database').default;
   const { ensureAiVisibilityTables } = require('../lib/ensureAiVisibilityTables');
   await db.sync();
   await ensureAiVisibilityTables();
   for (const t of ['ai_vis_configs', 'ai_vis_prompts', 'ai_vis_competitors', 'ai_vis_scans', 'ai_vis_results']) {
      const [rows] = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
      console.log(`${t}: OK (${JSON.stringify(rows)})`);
   }
   process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the verification script**

Run: `node scripts/verify-ai-vis-tables.js`
Expected: five `…: OK` lines, exit 0. (If ts-node is absent: `npm i -D ts-node` first — check `package.json` before installing; other scripts in `scripts/` may already show the established runner.)

- [ ] **Step 4: Commit**

```bash
git add lib/ensureAiVisibilityTables.ts scripts/verify-ai-vis-tables.js
git commit -m "feat(ai-visibility): tables for configs, prompts, scans, results"
```

---

### Task 2: DataForSEO LLM client (`llm_responses/live`)

**Files:**
- Create: `lib/dataforseoLlm.ts`
- Test: `__tests__/lib/dataforseoLlm.test.ts`
- Create: `scripts/probe-dfs-llm.js` (scratch — verifies real API + model names)

**Interfaces:**
- Consumes: `isDataForSeoConfigured()` re-exported pattern from `lib/dataforseo.ts` (duplicate the tiny authHeader locally — `lib/dataforseo.ts` doesn't export it; do NOT modify that file).
- Produces (used by Task 5):
  - `type LlmModel = 'chat_gpt' | 'gemini' | 'perplexity'`
  - `type LlmCitation = { url: string, domain: string, title: string }`
  - `type LlmAnswer = { text: string, citations: LlmCitation[], costUsd: number }`
  - `runLlmPrompt(model: LlmModel, prompt: string, countryIso?: string): Promise<LlmAnswer>`
  - `parseLlmItems(items: unknown[]): { text: string, citations: LlmCitation[] }` (pure, exported for tests)

- [ ] **Step 1: Write the failing parser test**

```ts
// __tests__/lib/dataforseoLlm.test.ts
import { parseLlmItems } from '../../lib/dataforseoLlm';

// Shape from docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live:
// items[] → {type:'message', sections:[{type:'text', text, annotations:[{title,url}]}]}
const FIXTURE_ITEMS = [
   { type: 'reasoning', sections: [{ type: 'summary_text', text: 'thinking…' }] },
   {
      type: 'message',
      sections: [{
         type: 'text',
         text: 'The amusement park industry in France remains significant.',
         annotations: [
            { title: 'France Parks Report', url: 'https://www.grandviewresearch.com/report' },
            { title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Parc' },
         ],
      }],
   },
];

describe('parseLlmItems', () => {
   it('extracts message text and citations with domains', () => {
      const out = parseLlmItems(FIXTURE_ITEMS);
      expect(out.text).toContain('amusement park industry');
      expect(out.citations).toHaveLength(2);
      expect(out.citations[0]).toEqual({
         title: 'France Parks Report',
         url: 'https://www.grandviewresearch.com/report',
         domain: 'grandviewresearch.com',
      });
   });

   it('ignores reasoning items and survives malformed input', () => {
      expect(parseLlmItems([])).toEqual({ text: '', citations: [] });
      expect(parseLlmItems([{ type: 'message' }, null as unknown as object])).toEqual({ text: '', citations: [] });
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/dataforseoLlm.test.ts`
Expected: FAIL — `Cannot find module '../../lib/dataforseoLlm'`

- [ ] **Step 3: Write the client**

```ts
// lib/dataforseoLlm.ts
/**
 * DataForSEO AI Optimization — LLM Responses live client.
 * One prompt → one live request per model → answer text + web citations.
 * Docs: docs.dataforseo.com/v3/ai_optimization/{chat_gpt,gemini,perplexity}/llm_responses/live
 * Cost: ~$0.005–0.03 per call depending on model + tokens (returned in `cost`).
 */
import axios from 'axios';
import { isDataForSeoConfigured } from './dataforseo';

const BASE = 'https://api.dataforseo.com/v3';

export type LlmModel = 'chat_gpt' | 'gemini' | 'perplexity';
export type LlmCitation = { url: string, domain: string, title: string };
export type LlmAnswer = { text: string, citations: LlmCitation[], costUsd: number };

export const LLM_MODEL_LABEL: Record<LlmModel, string> = {
   chat_gpt: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity',
};

/** Default model_name per provider — verified against scripts/probe-dfs-llm.js. */
const MODEL_NAME: Record<LlmModel, string> = {
   chat_gpt: 'gpt-4.1-mini',
   gemini: 'gemini-2.5-flash',
   perplexity: 'sonar',
};

const authHeader = (): string => {
   const login = process.env.DATAFORSEO_LOGIN || '';
   const password = process.env.DATAFORSEO_PASSWORD || '';
   return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
};

const domainFromUrl = (url: string): string => {
   try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

/** Pure parser for result[0].items — exported for unit tests. */
export function parseLlmItems(items: unknown[]): { text: string, citations: LlmCitation[] } {
   let text = '';
   const citations: LlmCitation[] = [];
   for (const raw of Array.isArray(items) ? items : []) {
      const item = raw as { type?: string, sections?: Array<{ type?: string, text?: string, annotations?: Array<{ title?: string, url?: string }> }> } | null;
      if (!item || item.type !== 'message' || !Array.isArray(item.sections)) continue;
      for (const section of item.sections) {
         if (section?.type !== 'text') continue;
         if (section.text) text += (text ? '\n' : '') + section.text;
         for (const a of section.annotations ?? []) {
            if (a?.url) citations.push({ url: a.url, title: a.title || '', domain: domainFromUrl(a.url) });
         }
      }
   }
   return { text, citations };
}

/** Transient HTTP statuses worth retrying — 429 rate-limit + 5xx + network/timeout. */
const isRetryable = (e: unknown): boolean => {
   const err = e as { response?: { status?: number }, code?: string };
   const status = err?.response?.status;
   if (status && (status === 429 || status >= 500)) return true;      // 429 + 5xx
   if (status && status >= 400 && status < 500) return false;         // other 4xx = permanent
   return err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET';
};

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

/**
 * POST one prompt to a provider's llm_responses/live endpoint, with up to
 * 3 attempts (exponential backoff 1s/2s/4s) on 429/5xx/timeout. 4xx auth/validation
 * errors (400/401/404) are NOT retried — they will never succeed. Backoff jitter is
 * NOT time-based (plan constraint: no Date.now/Math.random) — fixed doubling schedule.
 */
export async function runLlmPrompt(model: LlmModel, prompt: string, countryIso?: string): Promise<LlmAnswer> {
   if (!isDataForSeoConfigured()) {
      throw new Error('DataForSEO not configured — set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.');
   }
   const task: Record<string, unknown> = {
      user_prompt: prompt.slice(0, 500),
      model_name: MODEL_NAME[model],
      max_output_tokens: 1024,
      web_search: true,
   };
   if (countryIso) task.web_search_country_iso_code = countryIso.toUpperCase();

   const MAX_ATTEMPTS = 3;
   let lastErr: unknown;
   for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
         const res = await axios.post(`${BASE}/ai_optimization/${model}/llm_responses/live`, [task], {
            headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
            timeout: 120000,
         });
         if (res.data?.status_code !== 20000) {
            throw new Error(`DataForSEO API ${res.data?.status_code}: ${res.data?.status_message}`);
         }
         const taskData = res.data?.tasks?.[0];
         if (taskData?.status_code !== 20000) {
            throw new Error(`DataForSEO task ${taskData?.status_code}: ${taskData?.status_message}`);
         }
         const result = taskData?.result?.[0] ?? {};
         const parsed = parseLlmItems(result.items ?? []);
         return { ...parsed, costUsd: Number(taskData?.cost ?? 0) };
      } catch (e) {
         lastErr = e;
         if (attempt >= MAX_ATTEMPTS || !isRetryable(e)) break;
         await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s
      }
   }
   throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
```

Add an `isRetryable` unit test in Step 1's test file: `expect(isRetryable({ response: { status: 429 } })).toBe(true)`, `…status:503 → true`, `…status:400 → false`, `{ code: 'ETIMEDOUT' } → true`. Export `isRetryable` for the test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/dataforseoLlm.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the live-API probe script**

```js
// scripts/probe-dfs-llm.js
// Verifies credentials, endpoint paths and MODEL_NAME values against the real API.
// Run: node scripts/probe-dfs-llm.js "best CRM for small business"
require('dotenv').config();
(async () => {
   require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
   const { runLlmPrompt } = require('../lib/dataforseoLlm');
   const prompt = process.argv[2] || 'best project management tools';
   for (const model of ['chat_gpt', 'gemini', 'perplexity']) {
      try {
         const out = await runLlmPrompt(model, prompt, 'PL');
         console.log(`\n=== ${model} ($${out.costUsd}) — ${out.citations.length} citations ===`);
         console.log(out.text.slice(0, 200));
         console.log(out.citations.slice(0, 5));
      } catch (e) { console.error(`${model} FAILED:`, e.message); }
   }
   process.exit(0);
})();
```

- [ ] **Step 6: Run the probe against the real API**

Run: `node scripts/probe-dfs-llm.js "najlepsze narzędzia SEO"`
Expected: three `=== model ($cost) — N citations ===` blocks with non-empty text. If a provider rejects `model_name`, the error message lists valid names — update `MODEL_NAME` accordingly and re-run. (Memory rule: verify by script, not by asking the user to click through the UI.)

- [ ] **Step 7: Commit**

```bash
git add lib/dataforseoLlm.ts __tests__/lib/dataforseoLlm.test.ts scripts/probe-dfs-llm.js
git commit -m "feat(ai-visibility): DataForSEO llm_responses client with citation parsing"
```

---

### Task 3: Scoring + aggregation lib (pure)

**Files:**
- Create: `lib/aiVisibilityMetrics.ts`
- Test: `__tests__/lib/aiVisibilityMetrics.test.ts`

**Interfaces:**
- Consumes: `LlmCitation` from Task 2.
- Produces (used by Tasks 5–6):
  - `type ResultRow = { promptId: number, model: string, ownCited: boolean, ownPosition: number | null, citations: LlmCitation[] }`
  - `ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null` — 1-based index of first own-domain citation.
  - `computeOverview(rows: ResultRow[]): { visibilityScore: number, mentionRate: number, avgPosition: number | null, directCitations: number, pages: number, perModel: Array<{ model: string, score: number }> }`
  - `aggregateSources(rows: ResultRow[]): Array<{ url: string, domain: string, timesShown: number, models: string[] }>`
  - `aggregateCompetitors(rows: ResultRow[], ownDomain: string): Array<{ domain: string, mentions: number, share: number }>`

**Scoring definition (locked here so UI and API agree):**
- Per-(prompt,model): cited at position 1 → 100; position p → `max(0, 100 - (p-1)*15)`; not cited → 0.
- `visibilityScore` = round(mean over all (prompt,model) pairs).
- `mentionRate` = % of pairs with `ownCited`.
- `avgPosition` = mean of `ownPosition` over cited pairs, 1 decimal; null when never cited.
- `directCitations` = count of own-domain citation entries; `pages` = distinct own-domain URLs.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/aiVisibilityMetrics.test.ts
import { ownDomainPosition, computeOverview, aggregateSources, aggregateCompetitors, ResultRow } from '../../lib/aiVisibilityMetrics';

const cit = (domain: string, url?: string) => ({ domain, url: url || `https://${domain}/x`, title: '' });

const rows: ResultRow[] = [
   { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 1, citations: [cit('idztech.pl', 'https://idztech.pl/a'), cit('oracle.com')] },
   { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, citations: [cit('oracle.com')] },
   { promptId: 2, model: 'chat_gpt', ownCited: true, ownPosition: 3, citations: [cit('shoper.pl'), cit('oracle.com'), cit('idztech.pl', 'https://idztech.pl/b')] },
   { promptId: 2, model: 'gemini', ownCited: false, ownPosition: null, citations: [] },
];

describe('ownDomainPosition', () => {
   it('returns 1-based index of first own citation, www-insensitive', () => {
      expect(ownDomainPosition([cit('a.com'), cit('www.idztech.pl')], 'idztech.pl')).toBe(2);
      expect(ownDomainPosition([cit('a.com')], 'idztech.pl')).toBeNull();
   });
});

describe('computeOverview', () => {
   it('computes score, rate, position, citations, pages', () => {
      const o = computeOverview(rows);
      // scores: 100 (p1) + 0 + 70 (p3) + 0 = 170/4 = 42.5 → 43
      expect(o.visibilityScore).toBe(43);
      expect(o.mentionRate).toBe(50);
      expect(o.avgPosition).toBe(2);
      expect(o.directCitations).toBe(2);
      expect(o.pages).toBe(2);
      expect(o.perModel).toEqual([
         { model: 'chat_gpt', score: 85 },
         { model: 'gemini', score: 0 },
      ]);
   });
   it('handles empty input', () => {
      const o = computeOverview([]);
      expect(o.visibilityScore).toBe(0);
      expect(o.avgPosition).toBeNull();
   });
});

describe('aggregateSources', () => {
   it('counts url occurrences across models', () => {
      const s = aggregateSources(rows);
      const oracle = s.find((x) => x.domain === 'oracle.com');
      expect(oracle?.timesShown).toBe(3);
      expect(oracle?.models.sort()).toEqual(['chat_gpt', 'gemini']);
      expect(s[0].timesShown).toBeGreaterThanOrEqual(s[s.length - 1].timesShown); // sorted desc
   });
});

describe('aggregateCompetitors', () => {
   it('excludes own domain and computes share of total citations', () => {
      const c = aggregateCompetitors(rows, 'idztech.pl');
      expect(c.find((x) => x.domain === 'idztech.pl')).toBeUndefined();
      expect(c[0].domain).toBe('oracle.com');
      expect(c[0].mentions).toBe(3);
   });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/aiVisibilityMetrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/aiVisibilityMetrics.ts
/** Pure aggregation for AI Visibility — shared by the scan runner and read APIs. */
import type { LlmCitation } from './dataforseoLlm';

export type ResultRow = {
   promptId: number,
   model: string,
   ownCited: boolean,
   ownPosition: number | null,
   citations: LlmCitation[],
};

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

export function ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null {
   const own = norm(ownDomain);
   const idx = citations.findIndex((c) => norm(c.domain) === own || norm(c.domain).endsWith(`.${own}`));
   return idx === -1 ? null : idx + 1;
}

const pairScore = (r: ResultRow): number => (
   r.ownCited && r.ownPosition ? Math.max(0, 100 - (r.ownPosition - 1) * 15) : 0
);

export function computeOverview(rows: ResultRow[]) {
   const perModelMap = new Map<string, number[]>();
   for (const r of rows) {
      const list = perModelMap.get(r.model) ?? [];
      list.push(pairScore(r));
      perModelMap.set(r.model, list);
   }
   const scores = rows.map(pairScore);
   const cited = rows.filter((r) => r.ownCited && r.ownPosition);
   const ownUrls = new Set<string>();
   let directCitations = 0;
   for (const r of rows) {
      for (const c of r.citations) {
         if (r.ownCited && ownDomainPosition([c], '') === null) { /* per-citation own check below */ }
      }
   }
   // count own citations properly: a row knows its own domain only via ownCited/ownPosition,
   // so aggregate own URLs from citations that repeat rows' own domain markers:
   // callers pass rows built with ownCited/ownPosition derived from the same citations,
   // so recompute here from position: the citation at ownPosition (1-based) is own.
   for (const r of rows) {
      if (!r.ownCited || !r.ownPosition) continue;
      const c = r.citations[r.ownPosition - 1];
      if (c) { directCitations += 1; ownUrls.add(c.url); }
   }
   const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
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
```

Note: delete the leftover no-op loop (`for … { /* per-citation own check below */ }`) before committing — it's shown here only to flag the subtlety that own-URL counting derives from `ownPosition`, not from re-matching domains.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/aiVisibilityMetrics.test.ts`
Expected: PASS (all describe blocks). If `perModel` ordering differs, sort by model name in the test, not the implementation.

- [ ] **Step 5: Commit**

```bash
git add lib/aiVisibilityMetrics.ts __tests__/lib/aiVisibilityMetrics.test.ts
git commit -m "feat(ai-visibility): pure scoring + aggregation (overview, sources, competitors)"
```

---

### Task 4: Config API + prompt generation

**Files:**
- Rewrite: `lib/aiVisibility.ts` (drop localStorage mock; keep only shared types)
- Create: `pages/api/ai-visibility/[slug]/config.ts`
- Create: `pages/api/ai-visibility/[slug]/generate-prompts.ts`
- Delete: nothing yet (guard hook rewired in Task 8)

**Interfaces:**
- Consumes: `ensureAiVisibilityTables` (Task 1), `getPeopleAlsoAsk` from `lib/dataforseo.ts`, `queryOne`/`queryRows` from `lib/db/query`, `verifyUser`, `getCurrentUserId`, `verifyDomainOwnershipBySlug`, `getErrorMessage`.
- Produces:
  - `GET /api/ai-visibility/[slug]/config` → `{ config: AiVisConfig | null }` where `AiVisConfig = { id: number, brandName: string, promptLimit: number, models: string[], completedAt: string | null, topics: Array<{ title: string, prompts: Array<{ id: number, text: string, provenance: string[], selected: boolean }> }> }`
  - `POST` same path with body `{ brandName: string, topics: Array<{ title: string, prompts: Array<{ text: string, provenance: string[], selected: boolean, isCustom?: boolean }> }> }` → `{ config: AiVisConfig }` (upsert: replaces all prompts).
  - `POST /api/ai-visibility/[slug]/generate-prompts` body `{ topic: string }` → `{ prompts: Array<{ text: string, provenance: string[] }> }`

- [ ] **Step 1: Rewrite `lib/aiVisibility.ts` as types-only**

```ts
// lib/aiVisibility.ts
/** Shared AI Visibility types (client + server). Persistence lives in the DB
 * (lib/ensureAiVisibilityTables.ts) — the earlier localStorage mock is gone. */

export type AiVisPrompt = { id: number, text: string, provenance: string[], selected: boolean };
export type AiVisTopic = { title: string, prompts: AiVisPrompt[] };
export type AiVisConfig = {
   id: number,
   brandName: string,
   promptLimit: number,
   models: string[],
   completedAt: string | null,
   topics: AiVisTopic[],
};

/** The five AI engines we track (the "Big 5"). Anything read from
 * ai_vis_configs.models is filtered against this before dispatch, so a
 * corrupt/hand-edited row like ["abc"] can never reach the scan runner.
 * chat_gpt/perplexity/gemini use DFS llm_responses; ai_overview/ai_mode use
 * DFS Google SERP endpoints — routing lives in lib/dataforseoLlm.ts. */
export const AI_VIS_ALL_MODELS = ['ai_overview', 'ai_mode', 'chat_gpt', 'perplexity', 'gemini'] as const;
export const AI_VIS_DEFAULT_MODELS: string[] = [...AI_VIS_ALL_MODELS];
export const AI_VIS_MODEL_LABEL: Record<string, string> = {
   ai_overview: 'AI Overviews', ai_mode: 'AI Mode', chat_gpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini',
};
export const AI_VIS_PROMPT_LIMIT = 50;

// Runner tuning — single source of truth so scan concurrency, the budget backstop,
// and the stale-scan heartbeat are not duplicated across modules (review point 4).
export const AI_VIS_CONCURRENCY = 3;
export const AI_VIS_HARD_CAP_PAIRS = 250; // 50 prompts × 5 models — budget backstop
export const AI_VIS_SCAN_STALE_MS = 10 * 60 * 1000; // a `running` scan older than this is dead

/** Keep only recognised model ids (used by both config save and the scan runner). */
export function sanitizeModels(models: unknown): string[] {
   const all = AI_VIS_ALL_MODELS as readonly string[];
   const list = Array.isArray(models) ? models.filter((m): m is string => typeof m === 'string' && all.includes(m)) : [];
   return list.length ? list : AI_VIS_DEFAULT_MODELS;
}

export function countSelected(topics: AiVisTopic[]): number {
   return topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0);
}
```

- [ ] **Step 2: Fix the two components that imported the mock**

`components/aiVisibility/CrunchingBar.tsx` imports `crunchingRemaining` — replace the import and the `useEffect` body with a `remainingMs` prop for now (Task 9 wires it to scan status):

```tsx
// components/aiVisibility/CrunchingBar.tsx — new signature
const CrunchingBar = ({ visible }: { visible: boolean }) => {
   if (!visible) return null;
   /* keep the existing JSX pill exactly as-is, minus the interval logic */
```

`lib/useAiVisibilityGuard.ts` imports `readConfig` — replace body to call the API (final version; Task 8 just consumes it):

```ts
// lib/useAiVisibilityGuard.ts
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import type { AiVisConfig } from './aiVisibility';

/** Gate AI Visibility sub-pages: no completed config ⇒ redirect to the wizard. */
export function useAiVisibilityGuard(slug: string | undefined): { ready: boolean, config: AiVisConfig | null } {
   const router = useRouter();
   const { data, isLoading } = useQuery<{ config: AiVisConfig | null }>(
      ['ai-vis-config', slug],
      async () => {
         const r = await fetch(`/api/ai-visibility/${slug}/config`);
         return r.json();
      },
      { enabled: !!slug, staleTime: 30_000 },
   );
   const config = data?.config ?? null;
   useEffect(() => {
      if (!slug || isLoading || data === undefined) return;
      if (!config?.completedAt) router.replace(`/sites/${slug}/ai-visibility/setup`);
   }, [slug, isLoading, data, config, router]);
   return { ready: !!config?.completedAt, config };
}
```

- [ ] **Step 3: Write the config route**

```ts
// pages/api/ai-visibility/[slug]/config.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { AiVisConfig, AiVisTopic, AI_VIS_DEFAULT_MODELS, AI_VIS_PROMPT_LIMIT } from '../../../../lib/aiVisibility';

type ConfigRow = { id: number, brand_name: string, prompt_limit: number, models: string | null, completed_at: string | null };
type PromptRow = { id: number, topic: string, text: string, provenance: string | null, selected: number };

const parseJsonArray = (raw: string | null): string[] => {
   if (!raw) return [];
   try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
};

async function loadConfig(domainId: number): Promise<AiVisConfig | null> {
   const row = await queryOne<ConfigRow>('SELECT * FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domainId]);
   if (!row) return null;
   const prompts = await queryRows<PromptRow>(
      'SELECT id, topic, text, provenance, selected FROM ai_vis_prompts WHERE config_id = ? ORDER BY sort_order, id', [row.id],
   );
   const topics: AiVisTopic[] = [];
   for (const p of prompts) {
      let t = topics.find((x) => x.title === p.topic);
      if (!t) { t = { title: p.topic, prompts: [] }; topics.push(t); }
      t.prompts.push({ id: p.id, text: p.text, provenance: parseJsonArray(p.provenance), selected: !!p.selected });
   }
   return {
      id: row.id,
      brandName: row.brand_name,
      promptLimit: row.prompt_limit || AI_VIS_PROMPT_LIMIT,
      models: parseJsonArray(row.models).length ? parseJsonArray(row.models) : AI_VIS_DEFAULT_MODELS,
      completedAt: row.completed_at,
      topics,
   };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   try {
      if (req.method === 'GET') {
         return res.status(200).json({ config: await loadConfig(domainId) });
      }
      if (req.method === 'POST') {
         const { brandName, topics } = req.body as { brandName?: string, topics?: AiVisTopic[] };
         if (!brandName || !Array.isArray(topics)) return res.status(400).json({ error: 'brandName and topics are required' });
         const selectedCount = topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0);
         if (selectedCount === 0) return res.status(400).json({ error: 'Select at least one prompt' });
         if (selectedCount > AI_VIS_PROMPT_LIMIT) return res.status(400).json({ error: `Prompt limit is ${AI_VIS_PROMPT_LIMIT}` });

         const existing = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domainId]);
         let configId: number;
         if (existing) {
            configId = existing.id;
            await db.query(
               'UPDATE ai_vis_configs SET brand_name = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
               { replacements: [brandName, configId] },
            );
            await db.query('DELETE FROM ai_vis_prompts WHERE config_id = ?', { replacements: [configId] });
         } else {
            await db.query(
               'INSERT INTO ai_vis_configs (domain_id, brand_name, prompt_limit, models, completed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
               { replacements: [domainId, brandName, AI_VIS_PROMPT_LIMIT, JSON.stringify(AI_VIS_DEFAULT_MODELS)] },
            );
            const created = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domainId]);
            if (!created) throw new Error('Failed to create config');
            configId = created.id;
         }

         let order = 0;
         for (const t of topics) {
            for (const p of t.prompts) {
               await db.query(
                  'INSERT INTO ai_vis_prompts (config_id, topic, text, provenance, selected, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  { replacements: [configId, t.title, p.text, JSON.stringify(p.provenance || []), p.selected ? 1 : 0, (p as { isCustom?: boolean }).isCustom ? 1 : 0, order] },
               );
               order += 1;
            }
         }
         return res.status(200).json({ config: await loadConfig(domainId) });
      }
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Config failed' });
   }
}
```

- [ ] **Step 4: Write the generate-prompts route (PAA-backed)**

```ts
// pages/api/ai-visibility/[slug]/generate-prompts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from '../../../../lib/dataforseo';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 60 };

/** Provenance tag from where Google surfaced the question. */
const provenanceFor = (domain: string): string[] => {
   if (/reddit\.com$/i.test(domain)) return ['reddit'];
   if (/quora\.com$/i.test(domain)) return ['quora'];
   return ['google'];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

   const { topic } = req.body as { topic?: string };
   if (!topic?.trim()) return res.status(400).json({ error: 'topic is required' });

   try {
      if (!isDataForSeoConfigured()) {
         // Graceful degradation (same pattern as the free keyword stack): template prompts.
         const base = topic.trim();
         return res.status(200).json({
            prompts: [
               { text: `Jakie są najlepsze rozwiązania: ${base}?`, provenance: [] },
               { text: `${base} — co warto wiedzieć?`, provenance: [] },
               { text: `Które firmy polecacie w temacie: ${base}?`, provenance: [] },
               { text: `${base}: porównanie opcji`, provenance: [] },
               { text: `Jak zacząć: ${base}?`, provenance: [] },
            ],
            degraded: true,
         });
      }
      const { questions, related } = await getPeopleAlsoAsk({ keyword: topic, country: 'PL', languageCode: 'pl' });
      const fromPaa = questions.slice(0, 8).map((q) => ({ text: q.question, provenance: provenanceFor(q.domain) }));
      const fromRelated = related.slice(0, Math.max(0, 10 - fromPaa.length)).map((r) => ({ text: r, provenance: ['google'] }));
      return res.status(200).json({ prompts: [...fromPaa, ...fromRelated] });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Prompt generation failed' });
   }
}
```

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npx jest __tests__/lib`
Expected: no type errors (the two rewired components compile), lib tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/aiVisibility.ts lib/useAiVisibilityGuard.ts components/aiVisibility/CrunchingBar.tsx "pages/api/ai-visibility/[slug]/config.ts" "pages/api/ai-visibility/[slug]/generate-prompts.ts"
git commit -m "feat(ai-visibility): config CRUD + PAA-backed prompt generation"
```

---

### Task 5: Scan orchestrator (enqueue → fire-and-forget kick → status)

**Files:**
- Create: `lib/aiVisibilityScan.ts`
- Create: `pages/api/ai-visibility/[slug]/scan.ts`
- Create: `pages/api/ai-visibility/[slug]/scan-status.ts`
- Test: `__tests__/lib/aiVisibilityScan.test.ts` (claim logic only — network is not unit-tested)

**Interfaces:**
- Consumes: `runLlmPrompt`, `LlmModel` (Task 2); `ownDomainPosition` (Task 3); tables (Task 1).
- Produces:
  - `enqueueAiVisScan(configId: number): Promise<number>` — inserts a `queued` scan, returns id. Refuses (returns existing id) if a scan is already `queued`/`running` for the config.
  - `kickAiVisScan(scanId: number, ownDomain: string): Promise<void>` — atomic claim (`UPDATE … SET status='running' WHERE id=? AND status='queued'`), then runs all selected prompts × models with concurrency 3, persisting one `ai_vis_results` row each (errors recorded per-row, never thrown), finally `status='completed'`.
  - `POST /api/ai-visibility/[slug]/scan` → `202 { scanId }` (mirrors `run-setup.ts`).
  - `GET /api/ai-visibility/[slug]/scan-status` → `{ status: 'idle'|'queued'|'running'|'completed'|'failed', progressDone: number, progressTotal: number, costUsd: number, finishedAt: string | null }`

- [ ] **Step 1: Write the failing claim test**

```ts
// __tests__/lib/aiVisibilityScan.test.ts
/** Claim guard: two concurrent kicks must not both run the same scan. */
import { claimScan } from '../../lib/aiVisibilityScan';

// claimScan is factored to take a query executor so it is testable without a DB.
describe('claimScan', () => {
   it('returns true only when the UPDATE changed a row', async () => {
      const hits: string[] = [];
      const execOnce = async (sql: string) => { hits.push(sql); return [[], 1] as [unknown[], number]; };
      const execNone = async () => [[], 0] as [unknown[], number];
      expect(await claimScan(7, execOnce)).toBe(true);
      expect(hits[0]).toMatch(/status\s*=\s*'running'/i);
      expect(hits[0]).toMatch(/status\s*=\s*'queued'/i);
      expect(await claimScan(7, execNone)).toBe(false);
   });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/aiVisibilityScan.test.ts`
Expected: FAIL — module/export not found.

- [ ] **Step 3: Implement the orchestrator**

```ts
// lib/aiVisibilityScan.ts
/**
 * AI Visibility scan runner. Mirrors lib/domainPipeline.ts orchestration and is
 * deliberately split into three composable pieces so the trigger can change
 * without touching the work:
 *   enqueueAiVisScan(configId)  — write a `queued` row (idempotent per active scan)
 *   claimScan(scanId)           — atomic optimistic lock: queued → running
 *   kickAiVisScan(scanId, dom)  — claim, then run all (prompt × model) pairs
 * Today the API route fire-and-forgets kickAiVisScan; migrating to a cron poller,
 * BullMQ worker, or the python-sidecar means calling claimScan+kick from there
 * instead — no signature changes. Results are per (prompt, model); a failed call
 * is recorded on its own row so one bad prompt never fails the whole scan.
 */
import db from '../database/database';
import { queryOne, queryRows } from './db/query';
import { runLlmPrompt, LlmModel } from './dataforseoLlm';
import { ownDomainPosition } from './aiVisibilityMetrics';
import { sanitizeModels, AI_VIS_CONCURRENCY, AI_VIS_HARD_CAP_PAIRS, AI_VIS_SCAN_STALE_MS } from './aiVisibility';

type Exec = (sql: string, replacements?: unknown[]) => Promise<[unknown[], number]>;

const defaultExec: Exec = async (sql, replacements) => {
   const out = await db.query(sql, { replacements });
   return out as unknown as [unknown[], number];
};

/** Atomic claim — exported for unit tests with a stub executor. */
export async function claimScan(scanId: number, exec: Exec = defaultExec): Promise<boolean> {
   const [, affected] = await exec(
      "UPDATE ai_vis_scans SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued'",
      [scanId],
   );
   return Number(affected) > 0;
}

export async function enqueueAiVisScan(configId: number): Promise<number> {
   // Reclaim a dead scan first: without this, a `running` scan killed mid-run
   // (Vercel 60s timeout, crash, deploy) would match the active-check below and
   // block every future scan for this config forever. Mark stale `running`
   // scans as failed so the queue can advance. staleSecs is derived from a
   // constant (not user input) → safe to interpolate. Dialect-specific age math.
   const isPg = !!process.env.DATABASE_URL;
   const staleSecs = Math.floor(AI_VIS_SCAN_STALE_MS / 1000);
   await db.query(
      isPg
         ? `UPDATE ai_vis_scans SET status = 'failed', error = 'stale (reclaimed)', finished_at = NOW()
             WHERE config_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${staleSecs} seconds'`
         : `UPDATE ai_vis_scans SET status = 'failed', error = 'stale (reclaimed)', finished_at = CURRENT_TIMESTAMP
             WHERE config_id = ? AND status = 'running' AND started_at < datetime('now', '-${staleSecs} seconds')`,
      { replacements: [configId] },
   ).catch(() => { /* best-effort reclaim; the active-check still guards double-run */ });

   const active = await queryOne<{ id: number }>(
      "SELECT id FROM ai_vis_scans WHERE config_id = ? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1",
      [configId],
   );
   if (active) return active.id;
   await db.query('INSERT INTO ai_vis_scans (config_id, status) VALUES (?, ?)', { replacements: [configId, 'queued'] });
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM ai_vis_scans WHERE config_id = ? ORDER BY id DESC LIMIT 1', [configId],
   );
   if (!created) throw new Error('Failed to enqueue scan');
   return created.id;
}

type PromptRow = { id: number, text: string };

export async function kickAiVisScan(scanId: number, ownDomain: string): Promise<void> {
   if (!(await claimScan(scanId))) return; // someone else runs it

   try {
      const scan = await queryOne<{ config_id: number }>('SELECT config_id FROM ai_vis_scans WHERE id = ? LIMIT 1', [scanId]);
      if (!scan) throw new Error('Scan not found');
      const cfg = await queryOne<{ models: string | null }>('SELECT models FROM ai_vis_configs WHERE id = ? LIMIT 1', [scan.config_id]);
      // sanitizeModels drops anything not in AI_VIS_ALL_MODELS, so a corrupt row
      // (e.g. ["abc"]) can never reach runLlmPrompt; falls back to defaults.
      let parsedModels: unknown = null;
      try { parsedModels = cfg?.models ? JSON.parse(cfg.models) : null; } catch { parsedModels = null; }
      const models = sanitizeModels(parsedModels) as LlmModel[];

      const prompts = await queryRows<PromptRow>(
         'SELECT id, text FROM ai_vis_prompts WHERE config_id = ? AND selected = 1 ORDER BY sort_order, id',
         [scan.config_id],
      );
      const pairs = prompts
         .flatMap((p) => models.map((m) => ({ prompt: p, model: m })))
         .slice(0, AI_VIS_HARD_CAP_PAIRS);

      await db.query('UPDATE ai_vis_scans SET progress_total = ? WHERE id = ?', { replacements: [pairs.length, scanId] });

      let done = 0;
      let costMicros = 0; // integer micro-dollars — no float drift when summing ~180 calls
      const queue = [...pairs];
      const worker = async (): Promise<void> => {
         for (;;) {
            const pair = queue.shift();
            if (!pair) return;
            try {
               const out = await runLlmPrompt(pair.model, pair.prompt.text, 'PL');
               const pos = ownDomainPosition(out.citations, ownDomain);
               const micros = Math.round(out.costUsd * 1e6);
               costMicros += micros;
               await db.query(
                  `INSERT INTO ai_vis_results (scan_id, prompt_id, model, answer, citations, own_cited, own_position, cost_micros)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  { replacements: [scanId, pair.prompt.id, pair.model, out.text, JSON.stringify(out.citations), pos ? 1 : 0, pos, micros] },
               );
            } catch (e) {
               await db.query(
                  'INSERT INTO ai_vis_results (scan_id, prompt_id, model, error) VALUES (?, ?, ?, ?)',
                  { replacements: [scanId, pair.prompt.id, pair.model, String((e as Error)?.message ?? e)] },
               ).catch(() => { /* row-level best effort */ });
            }
            done += 1;
            // Update after EVERY row (not batched): a DB write is trivial next to a
            // ~15s LLM call, and batching left the progress bar frozen for a minute
            // when only a few slow models were in flight (review point 3).
            await db.query('UPDATE ai_vis_scans SET progress_done = ?, cost_micros = ? WHERE id = ?', { replacements: [done, costMicros, scanId] }).catch(() => {});
         }
      };
      await Promise.all(Array.from({ length: AI_VIS_CONCURRENCY }, worker));
      await db.query(
         "UPDATE ai_vis_scans SET status = 'completed', progress_done = ?, cost_micros = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
         { replacements: [done, costMicros, scanId] },
      );
   } catch (error) {
      await db.query(
         "UPDATE ai_vis_scans SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
         { replacements: [String((error as Error)?.message ?? error), scanId] },
      ).catch(() => {});
   }
}
```

- [ ] **Step 4: Run the claim test**

Run: `npx jest __tests__/lib/aiVisibilityScan.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the two routes**

```ts
// pages/api/ai-visibility/[slug]/scan.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { enqueueAiVisScan, kickAiVisScan } from '../../../../lib/aiVisibilityScan';
import { queryOne } from '../../../../lib/db/query';

export const config = { maxDuration: 300 }; // scan runs inline post-response on long-lived fn

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as { ID: number, domain: string };

   const cfg = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domain.ID]);
   if (!cfg) return res.status(400).json({ error: 'Complete the AI Visibility setup first' });

   const scanId = await enqueueAiVisScan(cfg.id);
   void kickAiVisScan(scanId, domain.domain); // fire-and-forget; atomic claim guards double-run
   return res.status(202).json({ scanId });
}
```

```ts
// pages/api/ai-visibility/[slug]/scan-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { queryOne } from '../../../../lib/db/query';

type ScanRow = { status: string, progress_done: number, progress_total: number, cost_micros: number, finished_at: string | null };

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
   const domainId = (ownership as { ID: number }).ID;

   const scan = await queryOne<ScanRow>(
      `SELECT s.status, s.progress_done, s.progress_total, s.cost_micros, s.finished_at
       FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
       WHERE c.domain_id = ? ORDER BY s.id DESC LIMIT 1`,
      [domainId],
   );
   if (!scan) return res.status(200).json({ status: 'idle', progressDone: 0, progressTotal: 0, costUsd: 0, finishedAt: null });
   return res.status(200).json({
      status: scan.status,
      progressDone: scan.progress_done || 0,
      progressTotal: scan.progress_total || 0,
      costUsd: (scan.cost_micros || 0) / 1e6, // integer micros → USD at the boundary
      finishedAt: scan.finished_at,
   });
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Note the Vercel caveat: on Hobby, `maxDuration: 300` clamps to 60s — a 50-prompt scan may get killed mid-run and stay `running` forever. Acceptable for v1 on the paid plan (Render/Vercel Pro per deploy topology); if it bites, the follow-up is moving `kickAiVisScan` into the python-sidecar. Add this note to the scan route as a comment.

- [ ] **Step 7: End-to-end probe with a tiny config (real API, ~$0.05)**

Run a scratch script (do not commit) that inserts a config with 2 prompts for a dev domain, POSTs `enqueueAiVisScan` + `kickAiVisScan` directly, then prints `ai_vis_results` rows. Verify: rows have `answer`, `citations` JSON, `own_cited` correct for a domain you know is cited (use `wikipedia.org` as own domain to force a hit).
Expected: 2 prompts × 3 models = 6 rows, scan `completed`, `cost_micros > 0`.

- [ ] **Step 8: Commit**

```bash
git add lib/aiVisibilityScan.ts __tests__/lib/aiVisibilityScan.test.ts "pages/api/ai-visibility/[slug]/scan.ts" "pages/api/ai-visibility/[slug]/scan-status.ts"
git commit -m "feat(ai-visibility): scan orchestrator with atomic claim + status endpoint"
```

---

### Task 6: Read APIs (overview, sources, competitors, prompts, fanout)

**Files:**
- Create: `pages/api/ai-visibility/[slug]/data.ts` (single endpoint, `?view=` param — five near-identical handlers would violate DRY; they share auth + latest-scan resolution)

**Interfaces:**
- Consumes: Task 3 aggregations; tables.
- Produces: `GET /api/ai-visibility/[slug]/data?view=overview|sources|competitors|prompts|fanout` →
  - `overview`: `{ scanId, finishedAt, overview: ReturnType<typeof computeOverview> }`
  - `sources`: `{ sources: Array<{ url, domain, timesShown, models }> }`
  - `competitors`: `{ competitors: Array<{ domain, mentions, share }> }`
  - `prompts`: `{ prompts: Array<{ id, topic, text, perModel: Array<{ model, cited, position }> , score: number }> }`
  - `fanout`: `{ queries: [] }` (v1 stub — Beta badge in UI; real data needs LLM Mentions `fan_out_queries` scope, out of scope here)
  - Any view when no completed scan exists: `200 { pending: true }` (UI shows skeletons + CrunchingBar).

- [ ] **Step 1: Implement the endpoint**

```ts
// pages/api/ai-visibility/[slug]/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { computeOverview, aggregateSources, aggregateCompetitors, ResultRow } from '../../../../lib/aiVisibilityMetrics';
import type { LlmCitation } from '../../../../lib/dataforseoLlm';

type DbResultRow = {
   prompt_id: number, model: string, own_cited: number, own_position: number | null,
   citations: string | null, topic: string, text: string,
};

const parseCitations = (raw: string | null): LlmCitation[] => {
   if (!raw) return [];
   try {
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      // Coerce every field to a string: a stored citation with a url but missing
      // title/domain must not yield `undefined` (aggregateSources → norm(domain) would throw).
      return v
         .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof c.url === 'string')
         .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
   } catch { return []; }
};

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
   const domain = ownership as { ID: number, domain: string };
   const view = String(req.query.view || 'overview');

   try {
      const scan = await queryOne<{ id: number, finished_at: string | null }>(
         `SELECT s.id, s.finished_at FROM ai_vis_scans s
          JOIN ai_vis_configs c ON c.id = s.config_id
          WHERE c.domain_id = ? AND s.status = 'completed'
          ORDER BY s.id DESC LIMIT 1`,
         [domain.ID],
      );
      if (!scan) return res.status(200).json({ pending: true });

      if (view === 'fanout') return res.status(200).json({ queries: [] }); // Beta stub

      const dbRows = await queryRows<DbResultRow>(
         `SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, p.topic, p.text
          FROM ai_vis_results r JOIN ai_vis_prompts p ON p.id = r.prompt_id
          WHERE r.scan_id = ? AND r.error IS NULL`,
         [scan.id],
      );
      const rows: ResultRow[] = dbRows.map((r) => ({
         promptId: r.prompt_id,
         model: r.model,
         ownCited: !!r.own_cited,
         ownPosition: r.own_position,
         citations: parseCitations(r.citations),
      }));

      if (view === 'overview') {
         return res.status(200).json({ scanId: scan.id, finishedAt: scan.finished_at, overview: computeOverview(rows) });
      }
      if (view === 'sources') {
         return res.status(200).json({ sources: aggregateSources(rows) });
      }
      if (view === 'competitors') {
         return res.status(200).json({ competitors: aggregateCompetitors(rows, domain.domain) });
      }
      if (view === 'prompts') {
         const byPrompt = new Map<number, { id: number, topic: string, text: string, perModel: Array<{ model: string, cited: boolean, position: number | null }> }>();
         for (const r of dbRows) {
            const entry = byPrompt.get(r.prompt_id) ?? { id: r.prompt_id, topic: r.topic, text: r.text, perModel: [] };
            entry.perModel.push({ model: r.model, cited: !!r.own_cited, position: r.own_position });
            byPrompt.set(r.prompt_id, entry);
         }
         const prompts = Array.from(byPrompt.values()).map((p) => {
            const scores = p.perModel.map((m) => (m.cited && m.position ? Math.max(0, 100 - (m.position - 1) * 15) : 0));
            const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            return { ...p, score };
         }).sort((a, b) => b.score - a.score);
         return res.status(200).json({ prompts });
      }
      return res.status(400).json({ error: `Unknown view: ${view}` });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Data fetch failed' });
   }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Verify against the Task 5 probe data**

With the dev DB still holding the Task 5 probe scan: `curl -s "http://localhost:3000/api/ai-visibility/<slug>/data?view=overview"` (with a session cookie from the browser, or temporarily via the TEMP-PROBE bypass pattern used earlier in this repo — revert after).
Expected: `{ scanId, finishedAt, overview: { visibilityScore, mentionRate, ... } }` with sane values.

- [ ] **Step 4: Commit**

```bash
git add "pages/api/ai-visibility/[slug]/data.ts"
git commit -m "feat(ai-visibility): unified read endpoint for the five sub-pages"
```

---

### Task 7: react-query services

**Files:**
- Create: `services/aiVisibility.tsx`

**Interfaces:**
- Consumes: routes from Tasks 4–6.
- Produces (used by Tasks 8–11):
  - `useAiVisData<T>(slug: string | undefined, view: string)` — generic fetcher keyed `['ai-vis-data', slug, view]`, `enabled: !!slug`, `staleTime: 30_000`.
  - `useAiVisScanStatus(slug: string | undefined)` — polls 3s while `queued`/`running`, else stops (same shape as `useSetupStatus`).
  - `useStartAiVisScan(slug)` / `useSaveAiVisConfig(slug)` — mutations invalidating the keys above.
  - `useGeneratePrompts(slug)` — mutation returning `{ prompts }`.

- [ ] **Step 1: Implement**

```tsx
// services/aiVisibility.tsx
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast'; // established app toast (services/domains.tsx, keywords.tsx …)
import type { AiVisConfig, AiVisTopic } from '../lib/aiVisibility';

export type AiVisScanStatus = {
   status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
   progressDone: number, progressTotal: number, costUsd: number, finishedAt: string | null,
};

/** Single fetch+parse+error helper — replaces the repeated `if (!r.ok) throw …`
 * across every hook (review point 13). Throws Error(message-from-server) so
 * react-query onError can toast it uniformly. */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
   const r = await fetch(url, init);
   let body: unknown = null;
   try { body = await r.json(); } catch { /* empty/non-JSON body */ }
   if (!r.ok) {
      const msg = (body as { error?: string } | null)?.error || `Request failed (${r.status})`;
      throw new Error(msg);
   }
   return body as T;
}

/** Shared mutation error handler: surface the server message as a toast. */
const toastError = (e: unknown): void => { toast.error(e instanceof Error ? e.message : 'Something went wrong'); };

const jsonPost = (body: unknown): RequestInit => ({
   method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export function useAiVisData<T>(slug: string | undefined, view: string) {
   return useQuery<T & { pending?: boolean }>(
      ['ai-vis-data', slug, view],
      () => fetchJson<T & { pending?: boolean }>(`/api/ai-visibility/${slug}/data?view=${view}`),
      { enabled: !!slug, staleTime: 30_000 },
   );
}

export function useAiVisScanStatus(slug: string | undefined) {
   return useQuery<AiVisScanStatus>(
      ['ai-vis-scan-status', slug],
      () => fetchJson<AiVisScanStatus>(`/api/ai-visibility/${slug}/scan-status`),
      {
         enabled: !!slug,
         refetchInterval: (data) => (
            data?.status === 'running' ? 3000
            : data?.status === 'queued' ? 5000
            : false
         ),
      },
   );
}

export function useStartAiVisScan(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation(
      () => fetchJson<{ scanId: number }>(`/api/ai-visibility/${slug}/scan`, { method: 'POST' }),
      {
         onSuccess: () => { qc.invalidateQueries(['ai-vis-scan-status', slug]); },
         onError: toastError,
      },
   );
}

export function useSaveAiVisConfig(slug: string | undefined) {
   const qc = useQueryClient();
   return useMutation(
      (body: { brandName: string, topics: AiVisTopic[] }) => fetchJson<{ config: AiVisConfig }>(`/api/ai-visibility/${slug}/config`, jsonPost(body)),
      {
         onSuccess: () => {
            qc.invalidateQueries(['ai-vis-config', slug]);
            qc.invalidateQueries(['ai-vis-data', slug]);
         },
         onError: toastError,
      },
   );
}

export function useGeneratePrompts(slug: string | undefined) {
   return useMutation(
      (topic: string) => fetchJson<{ prompts: Array<{ text: string, provenance: string[] }> }>(`/api/ai-visibility/${slug}/generate-prompts`, jsonPost({ topic })),
      { onError: toastError },
   );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add services/aiVisibility.tsx
git commit -m "feat(ai-visibility): react-query hooks (data, scan status, config, generation)"
```

---

### Task 8: Setup wizard page

**Files:**
- Create: `pages/sites/[domain]/ai-visibility/setup.tsx`
- Create: `components/aiVisibility/PromptSelector.tsx` (orchestrator + wizard state types)
- Create: `components/aiVisibility/TopicAccordion.tsx` (one topic card: header, chevron, rename, remove, generate/skeleton)
- Create: `components/aiVisibility/PromptRow.tsx` (checkbox + text + source badge + remove)
- Create: `components/aiVisibility/AddPromptRow.tsx` (the "+ Add prompt to {topic}" ghost row → inline input)
- Create: `components/aiVisibility/sourceIcons.tsx`

**Component split (review point 12 — a single 700–900-line component violates the plan's own focused-file rule):**
- `PromptSelector` — owns the accordion open/close set and maps over topics; renders a `TopicAccordion` per topic. No row-level markup.
- `TopicAccordion` — one topic card; owns nothing (fully controlled), calls up via callbacks; renders `PromptRow[]` + `AddPromptRow` + skeleton rows while `generating`.
- `PromptRow` — a single 52px prompt line.
- `AddPromptRow` — the ghost "add prompt" row with its own local input state (the only leaf-local state; commits via `onAdd`).

**Interfaces:**
- Consumes: `useSaveAiVisConfig`, `useGeneratePrompts`, `useStartAiVisScan` (Task 7); `AiVisTopic`, `countSelected`, `AI_VIS_PROMPT_LIMIT` (Task 4); existing `/api/domains/[slug]/topics` for seed topic titles; `AppShell`, `DomainSubLayout`.
- Produces: on Finish → save config → start scan → `router.replace('/sites/[slug]/ai-visibility/overview')`.

UI spec (matches user screenshots 1:1):
- Heading "Select prompts you want to track", `N of 50 prompts used` + 44px yellow progress bar (`#F0B429`-family — use `#E6A817` fill on `#F4F4F5` track, rounded-full).
- Right: outline buttons "Add topic", "Add in bulk" (bulk = textarea modal, one prompt per line, goes into a "Bulk" topic).
- Topic accordion card (`border: 1px solid #E4E4E7, borderRadius 8`): chevron, editable title, "`{n} prompts`" muted, stacked circular source icons; hover trash to remove topic. New empty topic shows: title input + "Remove" + dark "Generate prompts" button; while generating → 5 skeleton rows (checkbox square + bar, pulsing).
- Prompt row (52px, top border `#F4F4F5`): checkbox (existing `Checkbox` from `components/ui`), text (truncate, hover underline), source icon, hover trash.
- Footer per topic: "+ Add prompt to {topic}" ghost row → inline input, Enter commits (`isCustom: true`, selected).
- Bottom: right-aligned "Uses N prompts from your limit" + dark `Finish` button (disabled while saving / when N===0 / N>50).

**Local wizard state type** (lives in `PromptSelector.tsx`, exported):

```ts
export type WizardPrompt = { key: string, text: string, provenance: string[], selected: boolean, isCustom?: boolean };
export type WizardTopic = { key: string, title: string, prompts: WizardPrompt[], generating?: boolean };
```

- [ ] **Step 1: Create `sourceIcons.tsx`** — `GoogleIcon`, `RedditIcon` (simplified snoo circle, `#FF4500` bg + white face paths from the reference HTML), `QuoraIcon` (`#B92B27` Q path from reference HTML), each 16px, plus `SourceBadge = ({ source }: { source: string })` rendering the right icon inside a 24px white circle with `border: 1px solid #E4E4E7`. Copy exact `path d=` values from the reference markup in the session transcript (Google G four-color paths; Quora single path `M7.3799.9483A11.9628…`).

- [ ] **Step 2: Create the four selector components (leaf → root)**

Build in dependency order so each compiles against the one below it.

```tsx
// components/aiVisibility/PromptRow.tsx
const PromptRow = ({ prompt, onToggle, onRemove }: {
   prompt: WizardPrompt;
   onToggle: () => void;
   onRemove: () => void;
}) => { /* 52px row: <Checkbox> + text (truncate, hover underline) + <SourceBadge> + hover trash */ };

// components/aiVisibility/AddPromptRow.tsx — the only leaf with local state (its input)
const AddPromptRow = ({ topicTitle, onAdd }: { topicTitle: string; onAdd: (text: string) => void }) => {
   const [text, setText] = useState('');
   /* ghost "+ Add prompt to {topicTitle}" → inline input; Enter commits onAdd(text) then clears */
};

// components/aiVisibility/TopicAccordion.tsx — one fully-controlled topic card
const TopicAccordion = ({ topic, open, onToggleOpen, onRename, onRemoveTopic, onGenerate, onTogglePrompt, onRemovePrompt, onAddPrompt }: {
   topic: WizardTopic;
   open: boolean;
   onToggleOpen: () => void;
   onRename: (title: string) => void;      // blur commits
   onRemoveTopic: () => void;
   onGenerate: () => void;                  // parent calls useGeneratePrompts
   onTogglePrompt: (promptKey: string) => void;
   onRemovePrompt: (promptKey: string) => void;
   onAddPrompt: (text: string) => void;
}) => { /* header (chevron, editable title, "{n} prompts", stacked SourceBadges, hover trash);
          body: PromptRow[] + AddPromptRow; when topic.generating → 5 skeleton rows */ };

// components/aiVisibility/PromptSelector.tsx — orchestrator; owns only the open-set
export type WizardPrompt = { key: string, text: string, provenance: string[], selected: boolean, isCustom?: boolean };
export type WizardTopic = { key: string, title: string, prompts: WizardPrompt[], generating?: boolean };

const PromptSelector = ({ topics, onChange, onGenerate, limit }: {
   topics: WizardTopic[];
   onChange: (next: WizardTopic[]) => void;   // immutable updates, computed here from callbacks
   onGenerate: (topicKey: string, title: string) => void;
   limit: number;
}) => {
   const [open, setOpen] = useState<Set<string>>(() => new Set(topics.map((t) => t.key)));
   /* map topics → <TopicAccordion>, wiring each callback to an immutable onChange(next) */
};
```

(Move the `WizardPrompt`/`WizardTopic` export block from the interface section into `PromptSelector.tsx` — it is the single source consumed by the three child components and `setup.tsx`.)

Skeleton row while `topic.generating` (5×): `<div style={{height:52,display:'flex',alignItems:'center',gap:12,padding:'0 16px',borderTop:'1px solid #F4F4F5'}}><div style={{width:16,height:16,borderRadius:4,background:'#F4F4F5'}} className="animate-pulse"/><div style={{height:14,width:'60%',borderRadius:4,background:'#F4F4F5'}} className="animate-pulse"/></div>` — lives in `TopicAccordion`. Verify `animate-pulse` exists (grep `animate-pulse` in `styles/`); if absent, add a local `@keyframes` in a `<style>` tag like `TopicalMapCanvas` does.

- [ ] **Step 3: Create `setup.tsx`** — page wiring:

```tsx
// pages/sites/[domain]/ai-visibility/setup.tsx (structure)
const AiVisibilitySetup: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';
   // seed: GET /api/domains/[slug]/topics → topic titles; for each of the first 4,
   // auto-run generate-prompts ONCE on mount (parallel), first 5 results selected.
   const [topics, setTopics] = useState<WizardTopic[]>([]);
   const save = useSaveAiVisConfig(slug);
   const startScan = useStartAiVisScan(slug);
   const generate = useGeneratePrompts(slug);
   const selectedCount = topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0);

   const onFinish = async () => {
      await save.mutateAsync({
         brandName: domain,
         topics: topics.map((t) => ({
            title: t.title,
            prompts: t.prompts.map((p) => ({ id: 0, text: p.text, provenance: p.provenance, selected: p.selected, isCustom: p.isCustom })),
         })),
      });
      await startScan.mutateAsync();
      router.replace(`/sites/${slug}/ai-visibility/overview`);
   };
   /* AppShell + DomainSubLayout(section="AI Visibility Setup", contentMaxWidth=880) wrapper,
      header row, PromptSelector, footer with "Uses N prompts from your limit" + Finish */
};
```

Guard note: `setup.tsx` itself must NOT use `useAiVisibilityGuard` (it would loop). If config already exists, pre-fill `topics` from it instead of the topics API.

- [ ] **Step 4: Verify headless** — Puppeteer probe (same TEMP-PROBE pattern as topical-map work: add `|| path.startsWith('/sites') /* TEMP-PROBE */` to `isPublic` in `pages/_app.tsx`, mock `/api/domains*` + `/api/ai-visibility/*` with `page.setRequestInterception`): screenshot wizard, assert `20 of 50 prompts used` text, toggle a checkbox, add a custom prompt, click Finish → assert POST body shape + redirect to overview. **Revert TEMP-PROBE after.**

- [ ] **Step 5: Commit**

```bash
git add "pages/sites/[domain]/ai-visibility/setup.tsx" components/aiVisibility/PromptSelector.tsx components/aiVisibility/TopicAccordion.tsx components/aiVisibility/PromptRow.tsx components/aiVisibility/AddPromptRow.tsx components/aiVisibility/sourceIcons.tsx
git commit -m "feat(ai-visibility): setup wizard with topic/prompt selection"
```

---

### Task 9: Overview page + guard + CrunchingBar wiring

**Files:**
- Create: `pages/sites/[domain]/ai-visibility/overview.tsx`
- Create: `components/aiVisibility/AiVisPageShell.tsx` (shared: AppShell + DomainSubLayout + guard + toolbar + CrunchingBar for all 5 pages)
- Create: `components/aiVisibility/StatCard.tsx`, `components/aiVisibility/SkeletonBlocks.tsx`

**Interfaces:**
- Consumes: `useAiVisibilityGuard` (Task 4), `useAiVisData`, `useAiVisScanStatus` (Task 7), `AiVisibilityToolbar` (exists), `CrunchingBar` (Task 4 signature `{ visible }`).
- Produces: `AiVisPageShell` used by Tasks 10–11:

```tsx
const AiVisPageShell = ({ slug, domain, section, children }: {
   slug: string; domain: string; section: string; children: (ctx: { crunching: boolean }) => React.ReactNode;
}) => {
   const { ready } = useAiVisibilityGuard(slug);
   const { data: scan } = useAiVisScanStatus(ready ? slug : undefined);
   const crunching = scan?.status === 'queued' || scan?.status === 'running';
   /* AppShell → DomainSubLayout(section) → sticky page header (title + Export/Share) →
      AiVisibilityToolbar → children({crunching}) → <CrunchingBar visible={crunching} /> */
};
```

Overview layout (matches screenshots + the AI Tracker promo-video redesign): the main chart is **competitive benchmarking, not a historical trendline** — per Surfer's own redesign rationale ("a trend chart needs weeks of data; competitive benchmarking is useful from the first session"). Sections:

1. **Visibility score** card: header shows score value or `—` + "View Competitors" outline link → `/sites/[slug]/ai-visibility/competitors`. Body = **competitor benchmark bar chart**: first bar = own brand (brand purple `#783AFB`), then top 4 competitor domains by mentions (gray `#D4D4D8` bars), each bar with favicon + domain label below and score label above. Data: own score from `view=overview`, rivals from `view=competitors` (`share` scaled to the same 0–100 axis). While `pending || crunching`, pulsing skeleton bars at 70/60/50/40/30% heights exactly like the reference HTML.
2. **Topics & Prompts** panel (2-col grid with Sources): header has a **`#` / `>_` segmented toggle** — `#` = topic view (rows = topic titles with mean score across their prompts), `>_` = prompt view (rows = top 5 individual prompts by score). Default = topic view (matches the video: "topic level insights … strategic clusters"). Data from `view=prompts` grouped client-side by `topic`.
3. **Sources** panel: top 5 by timesShown, favicon via `https://www.google.com/s2/favicons?domain=`, "View all" → sources page.
4. 3-col grid: Mention rate / Average position / Direct citations+Pages stat cards (value + 200px skeleton block when pending). Historical trendline per metric is a **deferred** follow-up (needs multiple scans over time; schema already supports it via one row per scan).

- [ ] **Step 1: Build `SkeletonBlocks.tsx`** (`SkeletonBar`, `SkeletonRow`, `SkeletonChart` — the pulsing shapes reused everywhere; single place for the pulse animation).
- [ ] **Step 2: Build `AiVisPageShell.tsx`** per interface above.
- [ ] **Step 3: Build `overview.tsx`** with real data mapping from `useAiVisData<{ overview: … }>(slug, 'overview')` + `useAiVisData<{ prompts: … }>(slug, 'prompts')` + `useAiVisData<{ sources: … }>(slug, 'sources')`.
- [ ] **Step 4: Verify headless** — TEMP-PROBE + mocked API: (a) no config → asserts redirect to `/setup`; (b) config + `pending: true` + status `running` → skeletons + CrunchingBar visible; (c) completed payload → score renders, 5 prompt rows, 5 source rows. Screenshot each state. Revert TEMP-PROBE.
- [ ] **Step 5: Commit**

```bash
git add "pages/sites/[domain]/ai-visibility/overview.tsx" components/aiVisibility/AiVisPageShell.tsx components/aiVisibility/StatCard.tsx components/aiVisibility/SkeletonBlocks.tsx
git commit -m "feat(ai-visibility): overview page with skeletons + crunching state"
```

---

### Task 10: Sources + Prompts pages

**Files:**
- Create: `pages/sites/[domain]/ai-visibility/sources.tsx`
- Create: `pages/sites/[domain]/ai-visibility/prompts.tsx`

**Interfaces:**
- Consumes: `AiVisPageShell`, `useAiVisData`, `SearchBar`/`SortableHeader` from `components/ui`, `useSortState` from `lib/useSortState` (same pattern as topical-map page).

Sources page: full-width table — Link (favicon + `domain`/`path` split-styling like the screenshot: domain bold, path muted), model chips (small pills per model), Times shown (right, sortable) — client-side search + sort; skeleton rows ×8 while loading/pending.

Prompts page: table grouped by topic (topic header row) — Prompt text, one column per model (✓ + position or `—`), Score (right, sortable). Skeletons ×8.

- [ ] **Step 1: Build `sources.tsx`** (search via `SearchBar`, sort via `useSortState<'timesShown'>`).
- [ ] **Step 2: Build `prompts.tsx`**.
- [ ] **Step 3: Verify headless** (mock completed payloads; assert row counts + sort toggling reverses first row; screenshots). Revert TEMP-PROBE.
- [ ] **Step 4: Commit**

```bash
git add "pages/sites/[domain]/ai-visibility/sources.tsx" "pages/sites/[domain]/ai-visibility/prompts.tsx"
git commit -m "feat(ai-visibility): sources + prompts pages"
```

---

### Task 11: Competitors + Fanout Queries pages

**Files:**
- Create: `pages/sites/[domain]/ai-visibility/competitors.tsx`
- Create: `pages/sites/[domain]/ai-visibility/fanout-queries.tsx`

Competitors: table — Domain (favicon + name; own domain pinned first with a "You" pill in brand purple), Mentions (sortable), Share of voice (% + 6px progress bar in `#783AFB` on `#F4F4F5`). Data = `view=competitors` + own row synthesized from `view=overview` `directCitations`.

Fanout Queries: `Beta` pill next to the page title; since API returns `{ queries: [] }`, render an informative card (not an empty flash — this is a deliberate Beta state, distinct from loading): icon + "Fanout query data is coming soon" + one-paragraph explanation ("Fanout queries are the follow-up searches AI models run while answering a prompt…"). Skeletons only while the request is in flight.

- [ ] **Step 1: Build `competitors.tsx`**.
- [ ] **Step 2: Build `fanout-queries.tsx`**.
- [ ] **Step 3: Verify headless** (screenshots both; competitors sorted desc by mentions). Revert TEMP-PROBE.
- [ ] **Step 4: Full check: `npx tsc --noEmit && npx jest && npx next lint` (or the repo's lint script from package.json).**
- [ ] **Step 5: Commit**

```bash
git add "pages/sites/[domain]/ai-visibility/competitors.tsx" "pages/sites/[domain]/ai-visibility/fanout-queries.tsx"
git commit -m "feat(ai-visibility): competitors + fanout queries (beta) pages"
```

---

### Task 12: Final sweep

- [ ] **Step 1: Delete dead code** — remove anything the mock era left unused: grep `markCrunchStart|crunchingRemaining|buildInitialTopics|readConfig|writeConfig` — zero hits expected outside git history.
- [ ] **Step 2: Sidebar active-state QA** — click through all 5 sidebar items; active highlight follows; `Fanout Queries` shows the Beta badge.
- [ ] **Step 3: Re-run everything** — `npx tsc --noEmit && npx jest`, plus `node scripts/verify-ai-vis-tables.js`.
- [ ] **Step 4: Update graph** — `graphify update .` (project CLAUDE.md rule).
- [ ] **Step 5: Commit any stragglers; propose merge via superpowers:finishing-a-development-branch.**

---

## Out of scope (explicitly deferred)

- Real Fanout Queries data (LLM Mentions `fan_out_queries` scope) — Beta stub ships instead.
- AI Overviews / AI Mode as scan models (DFS covers them via the LLM Mentions index, not per-prompt live responses) — schema supports adding them later via `ai_vis_configs.models`.
- Scheduled daily rescans (cron) — manual scan-on-Finish only; "Refresh" button can reuse `POST /scan` later. (Surfer refreshes daily on Pro+, weekly on Standard — cadence table for when we add cron.)
- Historical trendline toggle on Overview (needs several scans over days; `ai_vis_scans` one-row-per-scan already supports computing it — pure frontend follow-up).
- **Brand sentiment / framing analysis** (Surfer: "what your brand sentiment is … how your brand was framed in the response vs. competitors") — would need an LLM classification pass over `ai_vis_results.answer`; the column is already stored, so this is additive.
- Sidebar "Get started" checklist widget — separate polish task, not part of this feature's core loop.
- Cost dashboard in Settings — `cost_micros` is recorded per scan, surfacing it (as `/1e6` USD) is a follow-up.

## Research addendum — full surferseo.com/ai-tracker scrape (2026-07-02)

Raw HTML (408 KB) scraped and reduced to text; key facts locked into the plan above:

- **Models tracked by Surfer**: Gemini, Google AI Overviews, Google AI Mode, ChatGPT, Perplexity ("Big 5"). One prompt tracks all 5 simultaneously.
- **Hero metrics**: Visibility Score (with "+13 since last 30d" delta chip), Mention Rate 80%, Average Position 4.2, "Top sources:" favicon strip.
- **Product pillars (tabs)**: Track AI Visibility & Sentiment · Spy on Competitors · Find & Fix Mention Gaps · Strategize & Report.
- **How-it-works flow**: 01 TRACK (add product/brand/buyer-intent prompts) → 02 EVALUATE (Share of Voice trends, missing mentions, which sources LLMs pull from, brand sentiment, channel/content-type performance) → 03 BRIDGE THE GAPS (identify sources LLMs trust → outreach list) → 04 STRATEGIZE (plugs into Topical Map, Fanout Queries, Content Editor, Content Audit).
- **Data method**: real scraping of user-facing interfaces (not sanitized APIs); multiple queries per day per model, averaged to cut noise.
- **Refresh cadence**: daily (Pro / Peace of Mind / Enterprise), weekly (Discovery / Standard). Standard = ChatGPT only.
- **Plans**: Pro €182/mo — 50 prompts daily; Peace of Mind €299/mo — 100 prompts daily + API access; Enterprise — custom quota.
- **Promo-video redesign insight (transcript)**: Overview defaults to **competitor benchmark bar chart** (own brand vs top rivals) because a trendline is useless on day one; **prompts grouped into topic clusters** as the default insight level with drill-down to individual prompts; historical trendline is a toggle once data accumulates. This is reflected in Task 9.

## Self-review notes

- Spec coverage: wizard (Task 8), guard (Tasks 4/9), 5 sub-pages (9–11), crunching bar (9), scan pipeline (5), DFS integration (2), scoring (3), storage (1), hooks (7). Sidebar nav was wired earlier this session.
- Type consistency: `AiVisTopic/AiVisPrompt` (Task 4) are the API shape; the wizard uses local `WizardTopic/WizardPrompt` (keys instead of ids) and maps on save — intentional, documented in Task 8.
- Known risk called out in-plan: Vercel maxDuration clamp (Task 5 Step 6), DFS `model_name` values verified by probe script (Task 2 Step 6), `animate-pulse` availability check (Task 8 Step 2).
