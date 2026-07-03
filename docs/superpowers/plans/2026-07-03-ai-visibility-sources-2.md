# AI Visibility — Sources 2.0 (SurferSEO parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach SurferSEO parity on the AI Visibility Sources page — per-source brand mentions + sentiment (extracted from the stored AI answers), a Mention Gap vs competitors, a richer detail modal, and real prompt/model filtering.

**Architecture:** A cheap deepseek-chat pass extracts `{brand, domain, sentiment, quotes}` from each already-stored `ai_vis_results.answer` into a new `brands` JSONB column (chunked after each scan + a one-time backfill). Pure functions in `lib/aiVisibilityMetrics.ts` aggregate those per source (brands stack, `mentioned`, Mention Gap, per-source brand table). The data endpoint gains prompt/model filters and a `source-detail` view; the frontend adds columns/tooltips/hover, Mention Gap bubble cards, a modal trend+brands table, and a grouped multiselect prompt picker.

**Tech Stack:** Next.js 12 pages API, Sequelize raw SQL (`lib/db/query`), `ai` SDK + `@ai-sdk/deepseek` (`deepseek('deepseek-chat')` via `generateText`), react-query v3, `react-chartjs-2` (existing), Jest (next/jest — transpiles, does NOT typecheck; `tsc --noEmit` is the type gate).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-ai-visibility-sources-2-design.md`.
- Branch: `feature/ai-visibility-sources` (already checked out, stacked on PR #21). Commit after each task; do NOT push/merge unless asked.
- **Never** stage `.env` or `python-sidecar/__pycache__/**` — they show as modified but stay excluded from every commit.
- Brand extraction uses `deepseek('deepseek-chat')` (NOT a reasoning model — the thinking block eats `maxOutputTokens` → empty output). Cost target ~$0.05–0.15/scan.
- DB portability: `const isPg = !!process.env.DATABASE_URL`. `brands` is `JSONB` on Postgres (node-pg returns it already parsed → an array) and `TEXT` on SQLite (a JSON string). Every parser handles BOTH shapes.
- `db.query(sql, { replacements: [...] })`; `queryOne`/`queryRows` from `lib/db/query`. UPDATE on Postgres returns `[[], {rowCount}]` — use the existing `affectedRows` helper shape if a task needs a row count.
- No new TypeScript `any`. Inline styles for new UI (repo CLAUDE.md); font `var(--font-family-primary)`; tokens brand `#783AFB`, orange `#F97316`, success `#1AB25E`, warn `#D97706`, error `#FF6F77`, content `#18181B`, muted `#52525C`/`#71717B`/`#9F9FA9`, card border `#F4F4F5`, panel border `#E4E4E7`.
- Copy is honest: brand tooltips say "…in AI answers citing this source" (we analyse answers, not scraped pages). **Price** column always renders `N/A` (no data source).

---

## File structure

| File | Responsibility |
|------|----------------|
| `lib/aiVisibilityBrands.ts` (create) | `buildBrandPrompt`, `parseBrandResponse`, `extractBrandsForRow`, `runBrandChunk`, `findConfigsNeedingBrands` |
| `lib/ensureAiVisibilityTables.ts` (modify) | add `brands` column to `ai_vis_results` (CREATE + ALTER) |
| `lib/aiVisibilityRead.ts` (modify) | `parseBrands`; `DbResultRow.brands`; map onto `ResultRow`; `loadScanResultRows` selects `brands` |
| `lib/aiVisibilityMetrics.ts` (modify) | `BrandMention`/`SourceBrand`/`SourceDetailBrand`/`GapCard` types; `ResultRow.brands`; `aggregateSources` (+brands/mentioned); `mentionGap`; `gapBrandCandidates`; `brandsForSource` |
| `lib/aiVisibilityScan.ts` (modify) | after a scan finishes, loop `runBrandChunk` (best-effort) |
| `pages/api/ai-visibility/internal/analyze-brands.ts` (create) | internal-token backfill over latest scans needing brands |
| `python-sidecar/pipeline/ai_vis_scheduler.py` (modify) | call `analyze-brands` after `due-scans` each tick |
| `pages/api/ai-visibility/[slug]/data.ts` (modify) | `sources` filter params + `mentioned`/`brands`/`gapCards`/`gapCandidates`; new `view=source-detail` |
| `services/aiVisibility.tsx` (modify) | `useAiVisSourceDetail` hook |
| `components/aiVisibility/SourcesTable.tsx` (modify) | Mentioned/Brands/Price columns, header tooltips, hover polish |
| `components/aiVisibility/MentionGapCards.tsx` (create) | per-brand gap bubble cards + add/remove/swap |
| `components/aiVisibility/SourceDetailModal.tsx` (modify) | trend chart + brands/sentiment table |
| `components/aiVisibility/PromptPicker.tsx` (modify) | multiselect grouped by topic + Select all |
| `pages/sites/[domain]/ai-visibility/sources.tsx` (modify) | filter state, Mention Gap, wire filters → shell/toolbar/query |
| `__tests__/lib/aiVisibilityBrands.test.ts` (create) | prompt/parse tests |
| `__tests__/lib/aiVisibilityMetrics.test.ts` / `aiVisibilityRead.test.ts` (modify) | aggregation + parse tests |

---

## Phase A — extraction + backfill

### Task A1: `brands` column + `parseBrandResponse`

**Files:** Modify `lib/ensureAiVisibilityTables.ts`; Create `lib/aiVisibilityBrands.ts`; Create `__tests__/lib/aiVisibilityBrands.test.ts`.

**Produces:** `BrandMention` (re-exported from metrics in B1; for A defined locally then moved — to avoid a forward dep, define the shape in `aiVisibilityBrands.ts` as `RawBrand` and let B1 own `BrandMention`). `parseBrandResponse(raw: unknown): RawBrand[]`; `buildBrandPrompt(answer: string, ownBrand: string): string`. `RawBrand = { brand: string; domain: string; sentiment: 'positive'|'neutral'|'negative'|'mixed'; quotes: string[] }`.

- [ ] **Step 1: Add the column.** In `lib/ensureAiVisibilityTables.ts`, add `brands ${JSON_T},` to the `ai_vis_results` CREATE (right after the `citations ${JSON_T},` line), and after the index lines add a best-effort ALTER for existing tables:

```ts
   try { await db.query(`ALTER TABLE ai_vis_results ADD COLUMN brands ${JSON_T}`); } catch (e) { ignoreExisting('ai_vis_results.brands', e); }
```

- [ ] **Step 2: Write the failing test** (`__tests__/lib/aiVisibilityBrands.test.ts`):

```ts
import { parseBrandResponse, buildBrandPrompt } from '../../lib/aiVisibilityBrands';

describe('parseBrandResponse', () => {
   it('parses an array, coercing fields and clamping quotes to 3', () => {
      const out = parseBrandResponse([
         { brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['a', 'b', 'c', 'd'] },
         { brand: 'Squarespace' },
         { domain: 'x.com' }, // no brand → dropped
      ]);
      expect(out).toEqual([
         { brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['a', 'b', 'c'] },
         { brand: 'Squarespace', domain: '', sentiment: 'neutral', quotes: [] },
      ]);
   });
   it('accepts a JSON string and unknown sentiment defaults to neutral', () => {
      const out = parseBrandResponse(JSON.stringify([{ brand: 'Duda', sentiment: 'weird' }]));
      expect(out).toEqual([{ brand: 'Duda', domain: '', sentiment: 'neutral', quotes: [] }]);
   });
   it('returns [] on null / non-array / invalid JSON', () => {
      expect(parseBrandResponse(null)).toEqual([]);
      expect(parseBrandResponse('{not json')).toEqual([]);
      expect(parseBrandResponse({})).toEqual([]);
   });
});

describe('buildBrandPrompt', () => {
   it('includes the answer text and own brand and asks for JSON', () => {
      const p = buildBrandPrompt('Wix is great', 'idztech');
      expect(p).toContain('Wix is great');
      expect(p).toContain('idztech');
      expect(p.toLowerCase()).toContain('json');
   });
});
```

- [ ] **Step 3: Run → fail** (`npx jest aiVisibilityBrands`). Expected: "Cannot find module".

- [ ] **Step 4: Implement** (`lib/aiVisibilityBrands.ts`):

```ts
/**
 * Brand extraction for AI Visibility Sources. Pulls the brands/companies an AI
 * answer names (with sentiment + quotes) out of the STORED answer text — we do not
 * scrape the cited pages. Pure helpers (prompt/parse) are unit-tested; the DB-driven
 * chunk mirrors runScanChunk (resumable, idempotent, per-row best effort).
 */
import { generateText } from 'ai';
import { deepseek } from './ai/deepseek';
import { queryOne, queryRows } from './db/query';
import db from '../database/database';

const SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed']);

export type RawBrand = { brand: string; domain: string; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; quotes: string[] };

export function buildBrandPrompt(answer: string, ownBrand: string): string {
   return [
      'You extract brand/company/product mentions from an AI assistant answer.',
      `The tracked brand is "${ownBrand}".`,
      'Return ONLY a JSON array (no prose). Each item: {"brand": string, "domain": string, "sentiment": "positive"|"neutral"|"negative"|"mixed", "quotes": string[]}.',
      '- brand: canonical display name (e.g. "Wix", not "wix.com").',
      '- domain: the brand\'s main website domain if obvious, else "".',
      '- sentiment: how the answer portrays the brand.',
      '- quotes: up to 3 short verbatim snippets mentioning the brand.',
      'List brands in the order they first appear. Skip generic terms.',
      '',
      'ANSWER:',
      answer.slice(0, 8000),
   ].join('\n');
}

export function parseBrandResponse(raw: unknown): RawBrand[] {
   let v: unknown = raw;
   if (typeof raw === 'string') {
      // Models sometimes wrap JSON in ```json fences — strip to the first [ … ].
      const s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
      const start = s.indexOf('[');
      const end = s.lastIndexOf(']');
      try { v = JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s); } catch { return []; }
   }
   if (!Array.isArray(v)) return [];
   return v
      .filter((b): b is Record<string, unknown> => !!b && typeof (b as { brand?: unknown }).brand === 'string' && !!(b as { brand?: string }).brand)
      .map((b) => ({
         brand: String(b.brand),
         domain: typeof b.domain === 'string' ? b.domain : '',
         sentiment: (typeof b.sentiment === 'string' && SENTIMENTS.has(b.sentiment) ? b.sentiment : 'neutral') as RawBrand['sentiment'],
         quotes: Array.isArray(b.quotes) ? b.quotes.filter((q): q is string => typeof q === 'string').slice(0, 3) : [],
      }));
}

export async function extractBrandsForRow(answer: string, ownBrand: string): Promise<RawBrand[] | null> {
   try {
      const { text } = await generateText({ model: deepseek('deepseek-chat'), prompt: buildBrandPrompt(answer, ownBrand), maxOutputTokens: 900 });
      return parseBrandResponse(text);
   } catch {
      return null; // leave the row NULL so a later tick retries
   }
}

export type BrandChunkResult = { done: number; remaining: number };
export const AI_VIS_BRAND_CHUNK = 20;

/** Analyse up to `limit` un-analysed answers of a scan; UPDATE ai_vis_results.brands.
 *  Idempotent (brands IS NULL only), per-row try/catch. Returns rows left to analyse. */
export async function runBrandChunk(scanId: number, ownBrand: string, limit = AI_VIS_BRAND_CHUNK): Promise<BrandChunkResult> {
   const pending = await queryRows<{ id: number, answer: string | null }>(
      `SELECT id, answer FROM ai_vis_results
       WHERE scan_id = ? AND brands IS NULL AND error IS NULL AND answer IS NOT NULL
       ORDER BY id LIMIT ?`,
      [scanId, limit],
   );
   for (const row of pending) {
      const brands = await extractBrandsForRow(row.answer || '', ownBrand);
      if (brands === null) continue; // keep NULL, retry next time
      await db.query('UPDATE ai_vis_results SET brands = ? WHERE id = ?', { replacements: [JSON.stringify(brands), row.id] }).catch(() => {});
   }
   const left = await queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ? AND brands IS NULL AND error IS NULL AND answer IS NOT NULL",
      [scanId],
   );
   return { done: pending.length, remaining: Number(left?.n ?? 0) };
}

/** Latest completed scan per config that still has un-analysed answers (for backfill). */
export async function findConfigsNeedingBrands(limit = 5): Promise<Array<{ scanId: number; brandName: string }>> {
   return queryRows<{ scanId: number; brandName: string }>(
      `SELECT s.id AS "scanId", c.brand_name AS "brandName"
       FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id AND r.brands IS NULL AND r.error IS NULL AND r.answer IS NOT NULL)
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}
```

> Note: the `"scanId"`/`"brandName"` quoted aliases are Postgres case-preserving; on SQLite the alias case is returned as written too. `queryRows<T>` maps rows straight to `T`.

- [ ] **Step 5: Run → pass** (`npx jest aiVisibilityBrands`). Then `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0.

- [ ] **Step 6: Commit**

```bash
git add lib/ensureAiVisibilityTables.ts lib/aiVisibilityBrands.ts "__tests__/lib/aiVisibilityBrands.test.ts"
git commit -m "feat(ai-vis): brands column + deepseek brand extraction (prompt/parse/chunk)"
```

---

### Task A2: hook brand extraction into the scan runner

**Files:** Modify `lib/aiVisibilityScan.ts`.

**Interfaces:**
- Consumes: `runBrandChunk`, `findConfigsNeedingBrands` (Task A1).
- Produces: after `kickAiVisScan` finishes a scan, brands are extracted for that scan.

- [ ] **Step 1: Import** at the top of `lib/aiVisibilityScan.ts` (next to the other imports):

```ts
import { runBrandChunk } from './aiVisibilityBrands';
```

- [ ] **Step 2: Add a brand-loop helper** near the bottom of the file (before the final export or after `kickAiVisScan`):

```ts
/** Best-effort: analyse a finished scan's answers for brands. Never throws — Sources
 *  just shows "no brands yet" if this fails. Loads the config's brand name itself. */
export async function runBrandsForScan(scanId: number): Promise<void> {
   try {
      const cfg = await queryOne<{ brand_name: string }>(
         'SELECT c.brand_name FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id WHERE s.id = ? LIMIT 1',
         [scanId],
      );
      const ownBrand = cfg?.brand_name || '';
      for (let i = 0; i < 100; i += 1) {
         const { remaining } = await runBrandChunk(scanId, ownBrand);
         if (remaining === 0) break;
      }
   } catch { /* brands are optional */ }
}
```

- [ ] **Step 3: Call it when the scan completes** inside `kickAiVisScan`. Locate the loop that calls `runScanChunk` until `finished`, and after the loop ends (scan finished) add:

```ts
   await runBrandsForScan(scanId);
```

(If `kickAiVisScan` returns early on `finished`, place the call right before that return so a fully-driven scan always triggers extraction. The `for (;;)` loop in `kickAiVisScan` breaks on `finished` — add `await runBrandsForScan(scanId);` immediately after the `break`/loop exit, before the function returns.)

- [ ] **Step 4: Type-check.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0. (No unit test: this is DB+network orchestration; covered by the backfill endpoint + manual.)

- [ ] **Step 5: Commit**

```bash
git add lib/aiVisibilityScan.ts
git commit -m "feat(ai-vis): extract brands after a scan completes"
```

---

### Task A3: backfill endpoint + sidecar tick

**Files:** Create `pages/api/ai-visibility/internal/analyze-brands.ts`; Modify `python-sidecar/pipeline/ai_vis_scheduler.py`.

**Interfaces:**
- Consumes: `findConfigsNeedingBrands`, `runBrandChunk` (A1).
- Produces: `POST /api/ai-visibility/internal/analyze-brands` (internal-token) analyses one chunk per due config and returns counts.

- [ ] **Step 1: Create the endpoint** (`pages/api/ai-visibility/internal/analyze-brands.ts`):

```ts
// POST /api/ai-visibility/internal/analyze-brands — machine-to-machine, called by the
// sidecar tick. Backfills brand extraction for the latest completed scan of each config
// that still has un-analysed answers. One chunk per config per call → drained over ticks.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { findConfigsNeedingBrands, runBrandChunk } from '../../../../lib/aiVisibilityBrands';
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
      const configs = await findConfigsNeedingBrands();
      const out: Array<{ scanId: number; done: number; remaining: number }> = [];
      for (const c of configs) {
         try { const r = await runBrandChunk(c.scanId, c.brandName); out.push({ scanId: c.scanId, ...r }); } catch { /* per-item */ }
      }
      return res.status(200).json({ analyzed: out });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}
```

- [ ] **Step 2: Call it from the sidecar tick.** In `python-sidecar/pipeline/ai_vis_scheduler.py`, inside `_tick`, after the `due-scans` POST, add a second best-effort call:

```python
        # Backfill brand extraction for scans that still have un-analysed answers.
        try:
            brand_url = f"{nextjs_url.rstrip('/')}/api/ai-visibility/internal/analyze-brands"
            async with httpx.AsyncClient(timeout=60) as client:
                await client.post(brand_url, headers=headers, json={})
        except Exception:
            pass
```

(Reuse the existing `headers` dict with `x-internal-token`.)

- [ ] **Step 3: Type-check + lint.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0. (Python: no test runner here; the call mirrors the existing due-scans POST.)

- [ ] **Step 4: Commit**

```bash
git add "pages/api/ai-visibility/internal/analyze-brands.ts" python-sidecar/pipeline/ai_vis_scheduler.py
git commit -m "feat(ai-vis): brand backfill endpoint + sidecar tick"
```

---

## Phase B — read + aggregations + endpoints

### Task B1: types + `parseBrands` + `ResultRow.brands`

**Files:** Modify `lib/aiVisibilityMetrics.ts`, `lib/aiVisibilityRead.ts`; Modify `__tests__/lib/aiVisibilityRead.test.ts`, `__tests__/lib/aiVisibilityMetrics.test.ts`.

**Produces:** `BrandMention` (= `RawBrand` + `pos: number`), `SourceBrand`, `SourceDetailBrand`, `GapCard` in metrics; `ResultRow.brands: BrandMention[]`; `parseBrands(raw): BrandMention[]` in read.

- [ ] **Step 1: Extend `ResultRow` + add types** in `lib/aiVisibilityMetrics.ts`. Replace the `ResultRow` type and add below it:

```ts
export type BrandMention = { brand: string, domain: string, sentiment: 'positive' | 'neutral' | 'negative' | 'mixed', pos: number, quotes: string[] };

export type ResultRow = {
   promptId: number, model: string, ownCited: boolean, ownPosition: number | null,
   citations: LlmCitation[], topic: string, text: string, brands: BrandMention[],
};

export type SourceBrand = { brand: string, domain: string };
export type SourceDetailBrand = { pos: number, brand: string, sentiment: BrandMention['sentiment'], quotes: string[] };
export type GapCard = { brand: string, gap: number, shared: number, you: number };
```

- [ ] **Step 2: `parseBrands` + mapping** in `lib/aiVisibilityRead.ts`. Add `brands` to `DbResultRow`, add `parseBrands`, extend `mapDbRowsToResultRows`, and select `brands` in `loadScanResultRows`:

```ts
// in DbResultRow type add:  brands: unknown;
export const parseBrands = (raw: unknown): BrandMention[] => {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   return v
      .filter((b): b is { brand: string } & Record<string, unknown> => !!b && typeof (b as { brand?: unknown }).brand === 'string')
      .map((b, i) => ({
         brand: String(b.brand),
         domain: typeof b.domain === 'string' ? b.domain : '',
         sentiment: (['positive', 'neutral', 'negative', 'mixed'].includes(String(b.sentiment)) ? b.sentiment : 'neutral') as BrandMention['sentiment'],
         pos: i + 1, // order of appearance is the stored array order
         quotes: Array.isArray(b.quotes) ? b.quotes.filter((q): q is string => typeof q === 'string').slice(0, 3) : [],
      }));
};
```

Add `brands: parseBrands(r.brands),` to the `mapDbRowsToResultRows` object, and change the `loadScanResultRows` SELECT to include `r.brands`:

```ts
`SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, r.brands, p.topic, p.text
 FROM ai_vis_results r JOIN ai_vis_prompts p ON p.id = r.prompt_id
 WHERE r.scan_id = ? AND r.error IS NULL`
```

Import `BrandMention` in `aiVisibilityRead.ts`: change the metrics import to `import { ResultRow, BrandMention } from './aiVisibilityMetrics';`.

- [ ] **Step 2b: Keep `data.ts` compiling.** `ResultRow` now requires `brands`, and `pages/api/ai-visibility/[slug]/data.ts` has an inline `const rows: ResultRow[] = dbRows.map(...)` (feeding the `competitors`/`prompts` branches) that omits it → tsc breaks until B3 rewrites the file. Add `brands: [],` to that inline mapping object now (the competitors/prompts branches don't read brands; B3 switches the `sources` branch to `loadScanResultRows`, which supplies real brands). This one-line edit is the only `data.ts` change in Phase B1.

- [ ] **Step 3: Fix fixtures.** In BOTH test files, add `brands: []` to every `ResultRow`/`mapDbRowsToResultRows` fixture object (tsc gate later needs it). In `aiVisibilityRead.test.ts` add a `parseBrands` describe:

```ts
import { parseBrands } from '../../lib/aiVisibilityRead';
describe('parseBrands', () => {
   it('maps array (jsonb) assigning pos by order, coercing fields', () => {
      expect(parseBrands([{ brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['q'] }, { nope: 1 }]))
         .toEqual([{ brand: 'Wix', domain: 'wix.com', sentiment: 'positive', pos: 1, quotes: ['q'] }]);
   });
   it('parses a JSON string and returns [] on junk', () => {
      expect(parseBrands(JSON.stringify([{ brand: 'X' }]))).toEqual([{ brand: 'X', domain: '', sentiment: 'neutral', pos: 1, quotes: [] }]);
      expect(parseBrands('{bad')).toEqual([]);
      expect(parseBrands(null)).toEqual([]);
   });
});
```

And update the existing `mapDbRowsToResultRows` test rows to include `brands` in the input (`brands: JSON.stringify([{ brand: 'Wix' }])` for row 1, `brands: null` for row 2) and assert `brands` in the output (`[{ brand: 'Wix', domain: '', sentiment: 'neutral', pos: 1, quotes: [] }]` and `[]`).

- [ ] **Step 4: Run + tsc + commit**

```bash
npx jest aiVisibilityRead aiVisibilityMetrics
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add lib/aiVisibilityMetrics.ts lib/aiVisibilityRead.ts "__tests__/lib/aiVisibilityRead.test.ts" "__tests__/lib/aiVisibilityMetrics.test.ts"
git commit -m "feat(ai-vis): BrandMention type + parseBrands + ResultRow.brands"
```

---

### Task B2: aggregations — sources+brands, mentionGap, candidates, brandsForSource

**Files:** Modify `lib/aiVisibilityMetrics.ts`; Modify `__tests__/lib/aiVisibilityMetrics.test.ts`.

**Interfaces:**
- Consumes: `ResultRow.brands`, `BrandMention`, `SourceBrand`, `SourceDetailBrand`, `GapCard` (B1).
- Produces: `aggregateSources(rows, ownBrand)` now returns rows with `mentioned`/`brands`; `mentionGap(rows, brand, ownBrand)`; `gapBrandCandidates(rows, ownBrand)`; `brandsForSource(rows, url)`.

- [ ] **Step 1: Write failing tests** (append to `__tests__/lib/aiVisibilityMetrics.test.ts`). Add a `brand` helper and fixtures:

```ts
import { mentionGap, gapBrandCandidates, brandsForSource } from '../../lib/aiVisibilityMetrics';
const brand = (b: string, domain = '', sentiment = 'neutral' as const, pos = 1) => ({ brand: b, domain, sentiment, pos, quotes: [] });

const brandRows: ResultRow[] = [
   { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q',
     citations: [cit('oracle.com', 'https://oracle.com/a')], brands: [brand('Oracle', 'oracle.com'), brand('Idztech', 'idztech.pl', 'positive', 2)] },
   { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q',
     citations: [cit('oracle.com', 'https://oracle.com/a')], brands: [brand('Oracle', 'oracle.com')] },
];

describe('aggregateSources with brands', () => {
   it('marks mentioned when own brand appears in a citing answer, and lists brands', () => {
      const s = aggregateSources(brandRows, 'Idztech').find((x) => x.url === 'https://oracle.com/a');
      expect(s?.mentioned).toBe(true);
      expect(s?.brands.map((b) => b.brand)).toContain('Oracle');
   });
});
describe('mentionGap', () => {
   it('counts gap (competitor without you), shared, and you-only over answers', () => {
      expect(mentionGap(brandRows, 'Oracle', 'Idztech')).toEqual({ brand: 'Oracle', gap: 1, shared: 1, you: 0 });
   });
});
describe('gapBrandCandidates', () => {
   it('lists competitor brands by frequency, excluding own', () => {
      expect(gapBrandCandidates(brandRows, 'Idztech')).toEqual(['Oracle']);
   });
});
describe('brandsForSource', () => {
   it('returns per-url brands ordered by pos with dominant sentiment', () => {
      const b = brandsForSource(brandRows, 'https://oracle.com/a');
      expect(b[0].brand).toBe('Oracle');
      expect(b.find((x) => x.brand === 'Idztech')?.sentiment).toBe('positive');
   });
});
```

- [ ] **Step 2: Run → fail** (`npx jest aiVisibilityMetrics -t "with brands|mentionGap|gapBrandCandidates|brandsForSource"`).

- [ ] **Step 3: Implement.** In `lib/aiVisibilityMetrics.ts`, (a) change `aggregateSources` signature to `aggregateSources(rows: ResultRow[], ownBrand = '')` and enrich its return, and (b) append the three new functions. Replace `aggregateSources`:

```ts
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
      return top.length && top.every((t) => t[1] === top[0][1]) && top.length > 1 ? 'mixed' : (top[0]?.[0] as SourceDetailBrand['sentiment']) || 'neutral';
   };
   return Array.from(byBrand.values())
      .map((e) => ({ pos: e.pos, brand: e.brand, sentiment: dominant(e.sentiments), quotes: Array.from(e.quotes).slice(0, 3) }))
      .sort((a, b) => a.pos - b.pos);
}
```

Note: `data.ts` currently calls `aggregateSources(rows)` (sources view) — still valid (ownBrand defaults to `''`). B3 passes the real brand.

- [ ] **Step 4: Run + tsc + commit**

```bash
npx jest aiVisibilityMetrics
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add lib/aiVisibilityMetrics.ts "__tests__/lib/aiVisibilityMetrics.test.ts"
git commit -m "feat(ai-vis): source brands/mentioned + mentionGap + candidates + brandsForSource"
```

---

### Task B3: data.ts — filters + brands + gapCards + source-detail

**Files:** Modify `pages/api/ai-visibility/[slug]/data.ts`.

**Interfaces:**
- Consumes: `aggregateSources(rows, ownBrand)`, `mentionGap`, `gapBrandCandidates`, `brandsForSource` (B2); `loadScanResultRows` (B1).
- Produces: `GET data?view=sources[&prompts=&models=&gapBrands=]` → `{ sources, gapCards, gapCandidates }`; `GET data?view=source-detail&url=` → `{ history, brands, brandCount }`.

- [ ] **Step 1: Load the brand name + a filtered-rows helper.** In `data.ts`, after `rows` is built (the existing `dbRows.map(...)` now includes `brands` because the query selects it — add `r.brands` to the DbResultRow query and `brands: parseCitationsShared` NO — use the read mapper). Simplest: replace the inline `rows` mapping in `data.ts` with `const rows = await loadScanResultRows(scan.id);` and add the config brand. Add near the top of the handler try-block, after `scan` is fetched:

```ts
      const cfg = await queryOne<{ brand_name: string }>(
         'SELECT c.brand_name FROM ai_vis_configs c WHERE c.domain_id = ? ORDER BY c.id DESC LIMIT 1', [domain.ID],
      );
      const ownBrand = cfg?.brand_name || domain.domain;
      const parseIds = (v: unknown): number[] => (typeof v === 'string' && v ? v.split(',').map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : []);
      const parseList = (v: unknown): string[] => (typeof v === 'string' && v ? v.split(',').filter(Boolean) : []);
      const filterRows = (rs: ResultRow[]): ResultRow[] => {
         const pids = parseIds(req.query.prompts); const models = parseList(req.query.models);
         return rs.filter((r) => (!pids.length || pids.includes(r.promptId)) && (!models.length || models.includes(r.model)));
      };
```

(Keep the existing `dbRows` query for the `prompts` view; but for `sources`/`source-detail` use `loadScanResultRows`.)

- [ ] **Step 2: Rewrite the `sources` branch:**

```ts
      if (view === 'sources') {
         const all = filterRows(await loadScanResultRows(scan.id));
         const gapBrands = parseList(req.query.gapBrands);
         const candidates = gapBrandCandidates(all, ownBrand);
         const selected = gapBrands.length ? gapBrands : candidates.slice(0, 4);
         return res.status(200).json({
            sources: aggregateSources(all, ownBrand),
            gapCards: selected.map((b) => mentionGap(all, b, ownBrand)),
            gapCandidates: candidates,
         });
      }
```

- [ ] **Step 3: Add the `source-detail` branch** (before the `return res.status(400)…`):

```ts
      if (view === 'source-detail') {
         const url = typeof req.query.url === 'string' ? req.query.url : '';
         if (!url) return res.status(200).json({ history: [], brands: [], brandCount: 0 });
         const scans = await queryRows<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' ORDER BY s.id DESC LIMIT 24`, [domain.ID],
         );
         const history: Array<{ finishedAt: string | null, timesShown: number }> = [];
         for (const s of scans.slice().reverse()) {
            const rs = filterRows(await loadScanResultRows(s.id));
            history.push({ finishedAt: s.finished_at, timesShown: rs.reduce((acc, r) => acc + r.citations.filter((c) => c.url === url).length, 0) });
         }
         const latest = filterRows(await loadScanResultRows(scan.id));
         const brands = brandsForSource(latest, url);
         return res.status(200).json({ history, brands, brandCount: brands.length });
      }
```

- [ ] **Step 4: Fix imports.** Add `mentionGap, gapBrandCandidates, brandsForSource` to the metrics import; ensure `loadScanResultRows` + `queryRows` are imported. Remove the now-unused inline `rows` mapping ONLY if no other branch uses it (the `sources`/`competitors` legacy branches use `aggregateSources`/`aggregateCompetitors` on `rows` — keep `rows` for the `competitors` branch; the `sources` branch now uses `all`).

- [ ] **Step 5: tsc + manual + commit.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0. Manual: `?view=sources` returns `sources[].mentioned/brands`, `gapCards`, `gapCandidates`; `&prompts=1` changes counts; `&view=source-detail&url=<u>` returns `history`+`brands`.

```bash
git add "pages/api/ai-visibility/[slug]/data.ts"
git commit -m "feat(ai-vis): sources filters + mentioned/brands + gapCards + source-detail view"
```

---

### Task B4: `useAiVisSourceDetail` hook + filter-aware sources hook

**Files:** Modify `services/aiVisibility.tsx`.

- [ ] **Step 1: Append hooks:**

```tsx
export type SourceDetailPayload = { history: Array<{ finishedAt: string | null; timesShown: number }>; brands: Array<{ pos: number; brand: string; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; quotes: string[] }>; brandCount: number };
export function useAiVisSourceDetail(slug: string | undefined, url: string | null) {
   return useQuery<SourceDetailPayload>(['ai-vis-source-detail', slug, url],
      () => fetchJson<SourceDetailPayload>(`/api/ai-visibility/${slug}/data?view=source-detail&url=${encodeURIComponent(url as string)}`),
      { enabled: !!slug && !!url, staleTime: 60_000 });
}
export function useAiVisSources<T>(slug: string | undefined, params: { prompts?: number[]; models?: string[]; gapBrands?: string[] }) {
   const q = new URLSearchParams({ view: 'sources' });
   if (params.prompts?.length) q.set('prompts', params.prompts.join(','));
   if (params.models?.length) q.set('models', params.models.join(','));
   if (params.gapBrands?.length) q.set('gapBrands', params.gapBrands.join(','));
   const key = q.toString();
   return useQuery<T & { pending?: boolean }>(['ai-vis-sources', slug, key],
      () => fetchJson<T & { pending?: boolean }>(`/api/ai-visibility/${slug}/data?${key}`),
      { enabled: !!slug, staleTime: 30_000, keepPreviousData: true });
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add services/aiVisibility.tsx
git commit -m "feat(ai-vis): useAiVisSourceDetail + filter-aware useAiVisSources hooks"
```

---

## Phase C — table parity (columns, tooltips, hover)

### Task C1: SourcesTable columns + header tooltips + hover

**Files:** Modify `components/aiVisibility/SourcesTable.tsx`.

**Interfaces:**
- Consumes: `SourceRow` now has `mentioned: boolean` and `brands: Array<{ domain: string; brand: string }>` (B1/B2 shape via the endpoint). Update the `SourceRow` type in this file to add `mentioned` and `brands`.

- [ ] **Step 1: Extend `SourceRow`** at the top of `SourcesTable.tsx`:

```ts
export type SourceRow = { url: string; domain: string; timesShown: number; models: string[]; mentioned?: boolean; brands?: Array<{ domain: string; brand: string }> };
```

- [ ] **Step 2: Add header tooltip + brand-stack + open-details icon helpers** (module scope, above the component). Reuse `HoverTooltip` (already imported):

```tsx
const HeadTip = ({ label, tip, align = 'left' }: { label: string; tip: string; align?: 'left' | 'right' | 'center' }) => (
   <HoverTooltip label={tip} align={align}>
      <span style={{ cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, textDecorationColor: '#C4C4CC' }}>{label}</span>
   </HoverTooltip>
);
const GRAY_SWIRL = 'https://www.google.com/s2/favicons?domain=example.com&sz=32'; // fallback favicon
const BrandStack = ({ brands }: { brands: Array<{ domain: string; brand: string }> }) => {
   const shown = brands.slice(0, 3);
   if (!shown.length) return <span style={{ color: '#9F9FA9' }}>—</span>;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
         {shown.map((b, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b.brand} alt="" title={b.brand} src={b.domain ? faviconFor(b.domain) : GRAY_SWIRL} width={16} height={16} style={{ borderRadius: 9999, border: '1px solid #fff', marginLeft: i ? -5 : 0, background: '#fff', opacity: b.domain ? 1 : 0.4 }} />
         ))}
         {brands.length > 3 ? <span style={{ marginLeft: 6, fontSize: 13, color: '#71717B' }}>+{brands.length - 3}</span> : null}
      </span>
   );
};
const OpenDetailsIcon = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 17H16.75C17.99 17 19 15.99 19 14.75V5.25C19 4.01 17.99 3 16.75 3H13V17Z" fill="currentColor" /><path d="M11 3.5V16.5H3.25C2.28 16.5 1.5 15.72 1.5 14.75V5.25C1.5 4.28 2.28 3.5 3.25 3.5H11Z" stroke="currentColor" /></svg>);
```

- [ ] **Step 3: Add the columns.** Widen the header row and each body row with Mentioned / Brands / Price cells. In the header block add (after the Source header cell, before Models):

```tsx
<div style={{ ...headCell, width: 100, flexShrink: 0, justifyContent: 'center' }}><HeadTip label="Mentioned" tip="Whether your brand is mentioned in AI answers citing this source" align="center" /></div>
<div style={{ ...headCell, width: 120, flexShrink: 0 }}><HeadTip label="Brands" tip="Brands mentioned in AI answers citing this source" /></div>
<div style={{ ...headCell, width: 90, flexShrink: 0, justifyContent: 'flex-end' }}><HeadTip label="Price" tip="Price of offers from link and sponsored article providers" align="right" /></div>
```

Change the existing "Times shown" header tip to use `HeadTip label="Times shown" tip="Number of times the URL appears in AI answers"` (keep the sort button — wrap the label in the sort button as-is, add the dotted style to the label span).

In each body row (both the flat `sorted.map` row and the grouped child row — NOT the group parent row), add after the `SourceCell`:

```tsx
<div style={{ ...bodyCell, width: 100, flexShrink: 0, justifyContent: 'center', color: s.mentioned ? '#18181B' : '#71717B' }}>{s.mentioned ? 'Yes' : 'No'}</div>
<div style={{ ...bodyCell, width: 120, flexShrink: 0 }}><BrandStack brands={s.brands || []} /></div>
<div style={{ ...bodyCell, width: 90, flexShrink: 0, justifyContent: 'flex-end', color: '#9F9FA9' }}>N/A</div>
```

For the **grouped parent row** (domain), render empty placeholders for these three cells (`<div style={{ ...bodyCell, width: 100, flexShrink: 0 }} />` etc.) so columns line up, keeping the existing `URLs` count cell.

- [ ] **Step 4: Row hover polish.** Change `hoverOn`/`hoverOff` to a light-purple hover and reveal an open-details icon. Replace `hoverOn`/`hoverOff`:

```tsx
const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#FBFAFF'; const ic = e.currentTarget.querySelector('[data-open]') as HTMLElement | null; if (ic) ic.style.opacity = '1'; };
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#fff'; const ic = e.currentTarget.querySelector('[data-open]') as HTMLElement | null; if (ic) ic.style.opacity = '0'; };
```

In `SourceCell`, add a trailing open-details icon (absolute right, hidden until row hover) — add before the closing `</div>` of the `SourceCell` root:

```tsx
<span data-open style={{ position: 'absolute', right: 8, opacity: 0, transition: 'opacity 120ms ease', color: '#71717B', zIndex: 1 }}><OpenDetailsIcon /></span>
```

(Grouped child rows keep their own `bg-#FCFCFD` hover reset — update that inline `onMouseLeave` to also reset the icon opacity via the same querySelector, or reuse `hoverOff` and set the child base bg back to `#FCFCFD` by giving the child row a distinct handler.)

- [ ] **Step 5: tsc + lint + manual + commit.** `npx tsc --noEmit` → 0; eslint touched file (house-style max-len OK). Manual: Mentioned Yes/No, brand favicon stack `+N`, Price N/A, dotted header tooltips, hover purple + open icon.

```bash
git add components/aiVisibility/SourcesTable.tsx
git commit -m "feat(ai-vis): Sources table — Mentioned/Brands/Price columns, header tooltips, hover"
```

---

### Task C2: stat-card tooltips on the Sources page

**Files:** Modify `pages/sites/[domain]/ai-visibility/sources.tsx`.

- [ ] **Step 1: Update the three `StatCard` hints** to the SurferSEO copy:

```tsx
<StatCard label="Domains" value={fmtK(domainCount)} hint="Unique domains found in AI answers" pending={pending} />
<StatCard label="URLs" value={fmtK(sources.length)} hint="Unique URLs found in AI answers" pending={pending} />
<StatCard label="References" value={fmtK(referenceCount)} hint="Number of times URLs appear in AI answers" pending={pending} />
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add "pages/sites/[domain]/ai-visibility/sources.tsx"
git commit -m "feat(ai-vis): Sources stat-card tooltips (LLM-response copy)"
```

---

## Phase D — Mention Gap

### Task D1: `MentionGapCards` component

**Files:** Create `components/aiVisibility/MentionGapCards.tsx`.

**Interfaces:**
- Consumes: `gapCards: Array<{ brand, gap, shared, you }>`, `gapCandidates: string[]`, `ownLabel: string`, `selected: string[]`, `onSelected: (b: string[]) => void`.
- Produces: `<MentionGapCards …/>` — a horizontal scroll of gap cards with a bubble chart, add/remove/swap.

- [ ] **Step 1: Implement** (`components/aiVisibility/MentionGapCards.tsx`):

```tsx
import React, { useState } from 'react';

const FONT = 'var(--font-family-primary)';
type Card = { brand: string; gap: number; shared: number; you: number };

const Bubble = ({ card }: { card: Card }) => {
   // Competitor circle (orange) fixed; your circle (violet) radius ∝ √mentions, offset right.
   const compR = 37;
   const yourTotal = card.shared + card.you;
   const yourR = Math.max(3, Math.min(compR, Math.round(compR * Math.sqrt(yourTotal) / Math.sqrt(Math.max(1, card.gap + card.shared)))));
   const cx2 = compR + (compR + yourR) * 0.06 + compR; // slight overlap on the right edge
   const w = cx2 + yourR + 2;
   return (
      <svg width={w} height={74} style={{ overflow: 'visible' }} aria-hidden>
         <circle cx={compR} cy={37} r={compR} fill="#F97316" fillOpacity={0.7} />
         <circle cx={cx2} cy={37} r={yourR} fill="#783AFB" fillOpacity={0.75} />
         {card.shared > 0 ? <circle cx={cx2} cy={37} r={yourR} fill="#FF6F77" clipPath={`circle(${compR}px at ${compR - cx2}px 0)`} /> : null}
      </svg>
   );
};

const ChevronDown = () => (<svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>);
const XIcon = () => (<svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" /></svg>);
const PlusIcon = () => (<svg viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);

const legendRow = (n: number, label: string, color: string) => (
   <>
      <div style={{ textAlign: 'right', fontWeight: 600, color: '#18181B', fontSize: 14 }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#18181B' }}>{label}<span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} /></div>
   </>
);

const Picker = ({ candidates, exclude, onPick, onClose }: { candidates: string[]; exclude: string[]; onPick: (b: string) => void; onClose: () => void }) => (
   <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 220, maxHeight: 260, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.2s ease' }} onMouseLeave={onClose}>
      {candidates.filter((c) => !exclude.includes(c)).map((c) => (
         <button key={c} type="button" onClick={() => onPick(c)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#18181B', cursor: 'pointer', fontFamily: FONT }}>{c}</button>
      ))}
   </div>
);

const MentionGapCards = ({ cards, candidates, ownLabel, selected, onSelected }: { cards: Card[]; candidates: string[]; ownLabel: string; selected: string[]; onSelected: (b: string[]) => void }) => {
   const [addOpen, setAddOpen] = useState(false);
   const [swapFor, setSwapFor] = useState<string | null>(null);
   if (!candidates.length) return null;
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Mention Gap</div>
         <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {cards.map((card) => (
               <div key={card.brand} style={{ position: 'relative', width: 300, flexShrink: 0, border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setSwapFor((s) => (s === card.brand ? null : card.brand))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{card.brand} <ChevronDown /></button>
                        {swapFor === card.brand ? <Picker candidates={candidates} exclude={selected} onPick={(b) => { onSelected(selected.map((x) => (x === card.brand ? b : x))); setSwapFor(null); }} onClose={() => setSwapFor(null)} /> : null}
                     </div>
                     <button type="button" aria-label="Remove" onClick={() => onSelected(selected.filter((x) => x !== card.brand))} style={{ border: 'none', background: 'transparent', color: '#9F9FA9', cursor: 'pointer', display: 'inline-flex' }}><XIcon /></button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px' }}>
                        {legendRow(card.gap, 'Gap', '#F97316')}
                        {legendRow(card.shared, 'Shared', '#FF6F77')}
                        {legendRow(card.you, ownLabel, '#783AFB')}
                     </div>
                     <Bubble card={card} />
                  </div>
               </div>
            ))}
            <div style={{ position: 'relative', flexShrink: 0 }}>
               <button type="button" aria-label="Add brand" onClick={() => setAddOpen((o) => !o)} style={{ width: 56, height: 144, border: '1px solid #F4F4F5', borderRadius: 12, background: 'transparent', color: '#71717B', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><PlusIcon /></button>
               {addOpen ? <Picker candidates={candidates} exclude={selected} onPick={(b) => { onSelected([...selected, b]); setAddOpen(false); }} onClose={() => setAddOpen(false)} /> : null}
            </div>
         </div>
      </div>
   );
};

export default MentionGapCards;
```

- [ ] **Step 2: tsc + lint + commit.** `npx tsc --noEmit` → 0.

```bash
git add components/aiVisibility/MentionGapCards.tsx
git commit -m "feat(ai-vis): MentionGapCards (gap/shared/you bubbles, add/remove/swap)"
```

---

### Task D2: wire Mention Gap into the Sources page

**Files:** Modify `pages/sites/[domain]/ai-visibility/sources.tsx`.

**Interfaces:**
- Consumes: `useAiVisSources` (B4), `MentionGapCards` (D1).

- [ ] **Step 1: Switch the sources query + add gap state.** Replace `const sourcesQ = useAiVisData<SourcesData>(slug, 'sources');` with the filter-aware hook and read the new fields. Add gap-brand state persisted in `localStorage`:

```tsx
   const [gapBrands, setGapBrands] = useState<string[] | null>(null);
   const sourcesQ = useAiVisSources<{ sources?: SourceRow[]; gapCards?: Array<{ brand: string; gap: number; shared: number; you: number }>; gapCandidates?: string[] }>(slug, { gapBrands: gapBrands ?? undefined });
   useEffect(() => {
      if (gapBrands !== null || !slug) return;
      try { const saved = JSON.parse(localStorage.getItem(`aiVisGap:${slug}`) || 'null'); if (Array.isArray(saved)) setGapBrands(saved); } catch { /* ignore */ }
   }, [slug, gapBrands]);
   const setGap = (b: string[]) => { setGapBrands(b); try { localStorage.setItem(`aiVisGap:${slug}`, JSON.stringify(b)); } catch { /* ignore */ } };
   const gapCards = sourcesQ.data?.gapCards || [];
   const gapCandidates = sourcesQ.data?.gapCandidates || [];
```

(Update `SourcesData`/`sources` derivations to read from `sourcesQ.data?.sources`. Import `useAiVisSources`, `useEffect`, `MentionGapCards`, `SourceRow`.)

- [ ] **Step 2: Render `MentionGapCards`** between the stat cards and the URLs toolbar:

```tsx
{!pending && gapCandidates.length ? (
   <MentionGapCards cards={gapCards} candidates={gapCandidates} ownLabel="You" selected={(gapBrands ?? gapCandidates.slice(0, 4))} onSelected={setGap} />
) : null}
```

- [ ] **Step 3: tsc + manual + commit.** Manual: gap cards render, remove/add/swap updates cards and persists on reload.

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add "pages/sites/[domain]/ai-visibility/sources.tsx"
git commit -m "feat(ai-vis): wire Mention Gap into Sources (localStorage-persisted selection)"
```

---

## Phase E — detail modal (trend + brands table)

### Task E1: SourceDetailModal trend chart + brands table

**Files:** Modify `components/aiVisibility/SourceDetailModal.tsx`; Modify `pages/sites/[domain]/ai-visibility/sources.tsx` (pass `slug`).

**Interfaces:**
- Consumes: `useAiVisSourceDetail` (B4), `MetricTrendChart` (existing).

- [ ] **Step 1: Accept `slug` + fetch detail.** Change the modal props to add `slug: string | undefined`, and fetch:

```tsx
import { useAiVisSourceDetail } from '../../services/aiVisibility';
import MetricTrendChart from './MetricTrendChart';
// inside component, after `const s = list[index];`
const detailQ = useAiVisSourceDetail(slug, s ? s.url : null);
const detail = detailQ.data;
```

- [ ] **Step 2: Sentiment badge + brands table.** Add a badge helper (module scope):

```tsx
const SENT_STYLE: Record<string, { bg: string; fg: string }> = {
   positive: { bg: '#E7F7EE', fg: '#1AB25E' }, neutral: { bg: '#F4F4F5', fg: '#52525C' },
   negative: { bg: '#FDECEC', fg: '#FF6F77' }, mixed: { bg: '#FEF3E2', fg: '#D97706' },
};
const SentBadge = ({ s }: { s: string }) => { const st = SENT_STYLE[s] || SENT_STYLE.neutral; return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', background: st.bg, color: st.fg }}>{s}</span>; };
```

- [ ] **Step 3: Replace the modal body** (the `Times shown / Models / Cited by` block) with the trend chart + brands table:

```tsx
<div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
   <MetricTrendChart
      labels={(detail?.history || []).map((h) => (h.finishedAt ? new Date(h.finishedAt).toLocaleDateString() : ''))}
      lines={[{ label: 'Times shown', data: (detail?.history || []).map((h) => h.timesShown), color: '#783AFB' }]}
      yMin={0}
   />
   <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Source mentioned {detail?.brandCount ?? 0} brands</div>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#71717B' }}>Brands named in AI answers that cite this source. Review the list and see where you rank.</p>
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
         <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', padding: '10px 16px', fontSize: 13, color: '#71717B', borderBottom: '1px solid #F4F4F5' }}><span>Pos.</span><span>Brand</span><span>Sentiment</span></div>
         {(detail?.brands || []).map((b) => (
            <BrandDetailRow key={b.brand} b={b} />
         ))}
         {!detail?.brands?.length ? <div style={{ padding: '16px', fontSize: 14, color: '#9F9FA9' }}>No brand data yet.</div> : null}
      </div>
   </div>
</div>
```

Add the expandable row component (module scope):

```tsx
const BrandDetailRow = ({ b }: { b: { pos: number; brand: string; sentiment: string; quotes: string[] } }) => {
   const [open, setOpen] = useState(false);
   return (
      <div style={{ borderBottom: '1px solid #F4F4F5' }}>
         <button type="button" onClick={() => b.quotes.length && setOpen((v) => !v)} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', width: '100%', alignItems: 'center', gap: 8, padding: '12px 16px', border: 'none', background: 'transparent', cursor: b.quotes.length ? 'pointer' : 'default', textAlign: 'left', fontFamily: FONT }}>
            <span style={{ fontSize: 14, color: '#18181B' }}>{b.pos}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{b.brand}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><SentBadge s={b.sentiment} />{b.quotes.length ? <span style={{ color: '#9F9FA9', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span> : null}</span>
         </button>
         {open ? <div style={{ padding: '0 16px 12px 64px', display: 'flex', flexDirection: 'column', gap: 6 }}>{b.quotes.map((q) => <span key={q} style={{ fontSize: 13, color: '#52525C', lineHeight: 1.5 }}>“{q}”</span>)}</div> : null}
      </div>
   );
};
```

Remove the old `MetricTrendChart` import guard clashes / unused `AI_VIS_MODEL_LABEL` chips if fully replaced (keep the header block with ↑/↓/external/close unchanged).

- [ ] **Step 4: Pass `slug`** from `sources.tsx` where `<SourceDetailModal … />` is rendered: add `slug={slug}`.

- [ ] **Step 5: tsc + lint + manual + commit.** Manual: modal shows the trend line + brands table; rows with quotes expand.

```bash
git add components/aiVisibility/SourceDetailModal.tsx "pages/sites/[domain]/ai-visibility/sources.tsx"
git commit -m "feat(ai-vis): source detail modal — Times-shown trend + brands/sentiment table"
```

---

## Phase F — filters (prompts multiselect + real filtering)

### Task F1: PromptPicker → grouped multiselect

**Files:** Modify `components/aiVisibility/PromptPicker.tsx`.

**Interfaces:**
- Produces: controlled multiselect. New props: `prompts: Array<{ id: number; text: string; topic: string }>`, `selected: number[]`, `onChange: (ids: number[]) => void`. Empty `selected` = "All prompts".

- [ ] **Step 1: Rewrite as a controlled grouped multiselect.** Replace the internal single-select state with props + grouping by topic, checkboxes, "Select all":

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';
const ChevronDown = () => (<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>);
const Box = ({ on }: { on: boolean }) => (<span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${on ? '#783AFB' : '#D4D4D8'}`, background: on ? '#783AFB' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{on ? <svg viewBox="0 0 20 20" width="12" height="12"><path fill="#fff" fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" /></svg> : null}</span>);
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, color: '#18181B', cursor: 'pointer' };

const PromptPicker = ({ prompts, selected, onChange }: { prompts: Array<{ id: number; text: string; topic: string }>; selected: number[]; onChange: (ids: number[]) => void }) => {
   const [open, setOpen] = useState(false);
   const [q, setQ] = useState('');
   const ref = useRef<HTMLDivElement>(null);
   useEffect(() => {
      if (!open) return undefined;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
   }, [open]);
   const groups = useMemo(() => {
      const filtered = prompts.filter((p) => p.text.toLowerCase().includes(q.trim().toLowerCase()));
      const map = new Map<string, Array<{ id: number; text: string }>>();
      for (const p of filtered) { const l = map.get(p.topic) ?? []; l.push({ id: p.id, text: p.text }); map.set(p.topic, l); }
      return Array.from(map.entries());
   }, [prompts, q]);
   const allIds = prompts.map((p) => p.id);
   const allOn = selected.length === 0 || selected.length === allIds.length;
   const isOn = (id: number) => selected.length === 0 || selected.includes(id);
   const toggle = (id: number) => {
      const base = selected.length === 0 ? allIds : selected;
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      onChange(next.length === allIds.length ? [] : next);
   };
   const toggleGroup = (ids: number[]) => {
      const base = selected.length === 0 ? allIds : selected;
      const allGroupOn = ids.every((id) => base.includes(id));
      const next = allGroupOn ? base.filter((x) => !ids.includes(x)) : Array.from(new Set([...base, ...ids]));
      onChange(next.length === allIds.length ? [] : next);
   };
   const label = allOn ? 'All prompts' : `${selected.length} prompts`;
   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button type="button" style={{ ...btn, maxWidth: 220 }} onClick={() => setOpen((o) => !o)}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span><ChevronDown /></button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 340, maxHeight: 380, overflow: 'auto', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.2s ease' }}>
               <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D4D4D8', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: FONT, marginBottom: 8, outline: 'none' }} />
               <button type="button" onClick={() => onChange([])} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', fontFamily: FONT }}><Box on={allOn} /> Select all</button>
               {groups.map(([topic, items]) => {
                  const ids = items.map((i) => i.id);
                  return (
                     <div key={topic}>
                        <button type="button" onClick={() => toggleGroup(ids)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, textAlign: 'left' }}><Box on={ids.every(isOn)} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</span></button>
                        {items.map((it) => (
                           <button key={it.id} type="button" onClick={() => toggle(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', padding: '8px 10px 8px 32px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#3F3F47', fontFamily: FONT, textAlign: 'left' }}><Box on={isOn(it.id)} /><span title={it.text} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.text}</span></button>
                        ))}
                     </div>
                  );
               })}
            </div>
         )}
      </div>
   );
};
export default PromptPicker;
```

- [ ] **Step 2: Update the toolbar prop type.** In `components/aiVisibility/AiVisibilityToolbar.tsx`, change the `prompts` prop to `Array<{ id: number; text: string; topic: string }>` and pass `selected`/`onChange` through (add `promptSelected?: number[]`, `onPromptChange?: (ids: number[]) => void`). Render `<PromptPicker prompts={prompts} selected={promptSelected || []} onChange={onPromptChange || (() => {})} />` when `prompts?.length`.

- [ ] **Step 3: Thread through `AiVisPageShell`.** Add `promptSelected?: number[]` and `onPromptChange?` props to the shell and forward to the toolbar (mirror the existing `toolbarPrompts` plumbing).

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add components/aiVisibility/PromptPicker.tsx components/aiVisibility/AiVisibilityToolbar.tsx components/aiVisibility/AiVisPageShell.tsx
git commit -m "feat(ai-vis): PromptPicker grouped multiselect (checkboxes + Select all)"
```

---

### Task F2: real prompt/model filtering on the Sources page

**Files:** Modify `pages/sites/[domain]/ai-visibility/sources.tsx`; Modify `components/aiVisibility/AiVisibilityToolbar.tsx` (models multiselect).

**Interfaces:**
- Consumes: `useAiVisSources` (B4), grouped `PromptPicker` (F1).

- [ ] **Step 1: Add filter state + query params** in `sources.tsx`:

```tsx
   const [selPrompts, setSelPrompts] = useState<number[]>([]);
   const [selModels, setSelModels] = useState<string[]>([]);
   const sourcesQ = useAiVisSources<{ sources?: SourceRow[]; gapCards?: …; gapCandidates?: string[] }>(slug, { prompts: selPrompts, models: selModels, gapBrands: gapBrands ?? undefined });
```

Fetch the prompt list for the picker (id/text/topic) from the overview snapshot endpoint or a light `view=prompts` call:

```tsx
   const promptsQ = useAiVisData<{ prompts?: Array<{ id: number; topic: string; text: string }> }>(slug, 'prompts');
   const promptOptions = (promptsQ.data?.prompts || []).map((p) => ({ id: p.id, text: p.text, topic: p.topic }));
```

- [ ] **Step 2: Pass filters to the shell.** On `<AiVisPageShell …>` add `toolbarPrompts={promptOptions}`, `promptSelected={selPrompts}`, `onPromptChange={setSelPrompts}`. For models: add a `modelSelected`/`onModelChange` pair to the toolbar's "All models" dropdown (convert it to a real multiselect writing `selModels`), threaded through the shell the same way. Model values = `AI_VIS_ALL_MODELS`.

- [ ] **Step 3: Verify filtering.** Selecting prompts/models re-queries `useAiVisSources` (distinct query key) → stats, Mention Gap, and table update. `keepPreviousData` avoids flicker.

- [ ] **Step 4: tsc + lint + manual + commit.** Manual: choosing a prompt subset changes Domains/URLs/References, gap cards, and the table; models filter likewise.

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # 0
git add "pages/sites/[domain]/ai-visibility/sources.tsx" components/aiVisibility/AiVisibilityToolbar.tsx
git commit -m "feat(ai-vis): real prompt/model filtering on Sources"
```

---

## Task G: Final sweep

- [ ] `npx tsc --noEmit` → 0. `npx jest aiVisibility` → all pass. `npx eslint` touched files (house-style max-len OK; no NEW non-maxlen violations). Manual end-to-end: brands populate after a scan (or backfill), Mentioned/Brands columns, header + stat tooltips, hover + open icon, Mention Gap add/remove/swap + persistence, detail modal trend + brands table with quotes, prompt/model multiselect really filters. Commit any sweep fixes.

## Deferred / out of scope
- Scraping source pages for literal "mentioned in the source" + real Price/offer data (different data source).
- Drag-to-reorder Mention Gap cards (SurferSEO dnd) — static scroll row instead.
- Per-brand favicon logo CDN beyond `google.com/s2/favicons` + gray fallback.
- Model-icon-in-`All models`-as-a-real-filter is included (F2); making `All models` a *segmented* control is out of scope.
