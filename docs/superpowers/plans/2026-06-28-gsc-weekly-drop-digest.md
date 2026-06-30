# GSC Weekly Traffic-Drop Digest (Package A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly per-organization email digest that flags GSC ranking drops by threshold transition (not raw %), plus a "Traffic drop" badge in the app.

**Architecture:** A weekly cron block (in the existing daily Vercel cron) snapshots per-page GSC data into `gsc_page_snapshots`, then a pure `lib/gscDrops.ts` compares this week vs last week to produce tier buckets + a domain summary. That single detection function feeds both the email (`lib/gscDigestEmail.ts`, sent to all active org members, throttled 1/7d) and a badge API (`/api/gsc/traffic-alerts`).

**Tech Stack:** Next.js 12 API routes, TypeScript, Sequelize raw `db.query`, Jest (`__tests__/`), nodemailer via `lib/sendMail.ts`, GSC JSON via `utils/searchConsole.ts`.

**Conventions to follow:**
- DB dialect: `const isPostgres = !!process.env.DATABASE_URL`. PK = `SERIAL PRIMARY KEY` (PG) / `INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite). `domain` table PK column is quoted `"ID"`.
- Ensure-table libs use a module-level `checked` flag + `ignoreExisting(label, e)` helper (see `lib/ensurePipelineTables.ts`).
- Run a single test file: `npx jest <path> --watch=false`. Type-check: `npx tsc --noEmit`.
- New UI = inline `style={{}}` + `var(--font-family-primary)` + inline SVG (design.md). Commit only named files (never `git add -A`). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. After code changes run `graphify update .`.

---

## File Structure

- `lib/ensureGscSnapshotTables.ts` — creates `gsc_page_snapshots` + adds `organizations.last_gsc_digest_sent_at`. Idempotent.
- `lib/gscDrops.ts` — **pure** tier-detection + domain summary (no DB). Exported types reused everywhere.
- `lib/gscSnapshots.ts` — week math, per-page aggregation of `sevenDays`, capture (upsert) + read of snapshots.
- `lib/gscDigestEmail.ts` — **pure** HTML builder for the digest.
- `pages/api/cron/daily.ts` — add a Monday-guarded weekly block (capture → per-org digest → throttle).
- `pages/api/gsc/traffic-alerts.ts` — workspace-scoped badge data.
- Dashboard + domain-list + content-audit — render the badge/section (Task 7).
- Tests in `__tests__/lib/`.

---

## Task 1: Snapshot schema

**Files:**
- Create: `lib/ensureGscSnapshotTables.ts`
- Test: `__tests__/lib/ensureGscSnapshotTables.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/ensureGscSnapshotTables.test.ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[], {}]) } }));
import db from '../../database/database';
import { ensureGscSnapshotTables } from '../../lib/ensureGscSnapshotTables';
const mockQuery = db.query as jest.Mock;

describe('ensureGscSnapshotTables', () => {
  beforeEach(() => mockQuery.mockClear());
  it('creates the snapshot table and adds the org throttle column', async () => {
    await ensureGscSnapshotTables();
    const sql = mockQuery.mock.calls.map((c: unknown[]) => String((c as unknown[])[0])).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gsc_page_snapshots');
    expect(sql).toContain('ALTER TABLE organizations ADD COLUMN last_gsc_digest_sent_at');
    expect(sql).toContain('idx_gsc_snap_domain_week');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ensureGscSnapshotTables.test.ts --watch=false`
Expected: FAIL — cannot find module `../../lib/ensureGscSnapshotTables`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/ensureGscSnapshotTables.ts
import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[gsc-snap] ${label} failed:`, m);
}

/** Weekly per-page GSC snapshots (for week-over-week drop detection) + org email throttle. Idempotent. */
export async function ensureGscSnapshotTables(): Promise<void> {
   if (checked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS gsc_page_snapshots (
         id          ${PK},
         domain_id   INTEGER NOT NULL,
         page        TEXT NOT NULL,
         week_start  DATE NOT NULL,
         clicks      INTEGER NOT NULL DEFAULT 0,
         impressions INTEGER NOT NULL DEFAULT 0,
         position    REAL,
         captured_at TIMESTAMP DEFAULT ${NOW}
      )
   `);
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_snap_unique ON gsc_page_snapshots(domain_id, page, week_start)'); } catch (e) { ignoreExisting('unique index', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_gsc_snap_domain_week ON gsc_page_snapshots(domain_id, week_start)'); } catch (e) { ignoreExisting('week index', e); }
   try { await db.query('ALTER TABLE organizations ADD COLUMN last_gsc_digest_sent_at TIMESTAMP'); } catch (e) { ignoreExisting('throttle column', e); }
   checked = true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/ensureGscSnapshotTables.test.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ensureGscSnapshotTables.ts __tests__/lib/ensureGscSnapshotTables.test.ts
git commit -m "feat(gsc): weekly snapshot schema + org digest throttle column"
```

---

## Task 2: Drop detection (pure logic, TDD)

**Files:**
- Create: `lib/gscDrops.ts`
- Test: `__tests__/lib/gscDrops.test.ts`

Position semantics: **lower = better** (GSC average rank, e.g. 4.2).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/gscDrops.test.ts
import { computeDrops, SnapMap, PageSnap } from '../../lib/gscDrops';

const snap = (position: number, clicks = 0, impressions = 0): PageSnap => ({ position, clicks, impressions });
const map = (entries: Record<string, PageSnap>): SnapMap => new Map(Object.entries(entries));

describe('computeDrops', () => {
  it('flags a top-10 page that fell', () => {
    const now = map({ '/a': snap(8) });
    const prev = map({ '/a': snap(4) });
    const r = computeDrops(now, prev);
    expect(r.tiers.droppedInTop10.map((e) => e.page)).toEqual(['/a']);
    expect(r.tiers.droppedInTop10[0]).toMatchObject({ prevPos: 4, nowPos: 8 });
    expect(r.hasDrops).toBe(true);
  });
  it('flags a page that dropped across a tens boundary (10-block)', () => {
    const r = computeDrops(map({ '/b': snap(21) }), map({ '/b': snap(19) }));
    expect(r.tiers.droppedATier.map((e) => e.page)).toEqual(['/b']);
  });
  it('does NOT flag droppedATier when it fell but stayed in the same 10-block', () => {
    const r = computeDrops(map({ '/c': snap(18) }), map({ '/c': snap(12) }));
    expect(r.tiers.droppedATier).toEqual([]);
    expect(r.tiers.droppedInTop10).toEqual([]);
  });
  it('flags out-of-index (present last week, absent now)', () => {
    const r = computeDrops(map({}), map({ '/d': snap(7) }));
    expect(r.tiers.outOfIndex.map((e) => e.page)).toEqual(['/d']);
    expect(r.tiers.outOfIndex[0]).toMatchObject({ prevPos: 7, nowPos: null });
  });
  it('counts growth (improved >= 2) and newly-ranking pages', () => {
    const r = computeDrops(map({ '/e': snap(5), '/f': snap(12) }), map({ '/e': snap(9) }));
    const growthPages = r.tiers.growth.map((e) => e.page).sort();
    expect(growthPages).toEqual(['/e', '/f']); // /e improved 9->5, /f newly ranking
    expect(r.hasDrops).toBe(false);
  });
  it('builds a domain summary (clicks/impressions WoW + fell/grew counts)', () => {
    const now = map({ '/a': snap(8, 10, 100), '/g': snap(3, 5, 50) });
    const prev = map({ '/a': snap(4, 20, 200), '/g': snap(6, 4, 40) });
    const r = computeDrops(now, prev);
    expect(r.summary).toMatchObject({ clicks: 15, prevClicks: 24, impressions: 150, prevImpressions: 240, pagesFell: 1, pagesGrew: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/gscDrops.test.ts --watch=false`
Expected: FAIL — cannot find module `../../lib/gscDrops`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/gscDrops.ts
export type PageSnap = { clicks: number; impressions: number; position: number };
export type SnapMap = Map<string, PageSnap>; // page path -> snapshot
export type DropEntry = { page: string; prevPos: number | null; nowPos: number | null; clicks: number; prevClicks: number };
export type DropResult = {
   tiers: { droppedInTop10: DropEntry[]; droppedATier: DropEntry[]; outOfIndex: DropEntry[]; growth: DropEntry[] };
   summary: { clicks: number; prevClicks: number; impressions: number; prevImpressions: number; pagesFell: number; pagesGrew: number };
   hasDrops: boolean;
};

const block = (pos: number) => Math.floor((pos - 1) / 10); // 1-10 -> 0, 11-20 -> 1, ...

/** Compare this week's per-page snapshot to last week's; bucket pages by threshold transition. */
export function computeDrops(now: SnapMap, prev: SnapMap): DropResult {
   const tiers: DropResult['tiers'] = { droppedInTop10: [], droppedATier: [], outOfIndex: [], growth: [] };
   let clicks = 0; let impressions = 0; let prevClicks = 0; let prevImpressions = 0; let pagesFell = 0; let pagesGrew = 0;

   for (const [, s] of now) { clicks += s.clicks; impressions += s.impressions; }
   for (const [, s] of prev) { prevClicks += s.clicks; prevImpressions += s.impressions; }

   const pages = new Set<string>([...now.keys(), ...prev.keys()]);
   for (const page of pages) {
      const n = now.get(page);
      const p = prev.get(page);
      const entry = (): DropEntry => ({ page, prevPos: p ? p.position : null, nowPos: n ? n.position : null, clicks: n ? n.clicks : 0, prevClicks: p ? p.clicks : 0 });

      if (p && !n) { tiers.outOfIndex.push(entry()); pagesFell += 1; continue; }
      if (!p && n) { if (n.position <= 50) tiers.growth.push(entry()); pagesGrew += 1; continue; }
      if (!p || !n) continue;

      if (n.position > p.position) {
         pagesFell += 1;
         if (p.position <= 10) tiers.droppedInTop10.push(entry());
         else if (p.position <= 50 && block(n.position) !== block(p.position)) tiers.droppedATier.push(entry());
      } else if (n.position <= p.position - 2) {
         pagesGrew += 1;
         if (n.position <= 50) tiers.growth.push(entry());
      }
   }

   const hasDrops = tiers.droppedInTop10.length + tiers.droppedATier.length + tiers.outOfIndex.length > 0;
   return { tiers, summary: { clicks, prevClicks, impressions, prevImpressions, pagesFell, pagesGrew }, hasDrops };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/gscDrops.test.ts --watch=false`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gscDrops.ts __tests__/lib/gscDrops.test.ts
git commit -m "feat(gsc): pure week-over-week drop tier detection"
```

---

## Task 3: Snapshot capture (week math + aggregation)

**Files:**
- Create: `lib/gscSnapshots.ts`
- Test: `__tests__/lib/gscSnapshots.test.ts`

- [ ] **Step 1: Write the failing test** (pure helpers only; DB calls covered by Task 5 integration)

```ts
// __tests__/lib/gscSnapshots.test.ts
import { weekStartFor, aggregateSevenDays } from '../../lib/gscSnapshots';

describe('weekStartFor', () => {
  it('returns the Monday of the PREVIOUS full week (UTC)', () => {
    // Wed 2026-06-24 -> this week Mon = 2026-06-22 -> previous full week Mon = 2026-06-15
    expect(weekStartFor(new Date('2026-06-24T10:00:00Z'))).toBe('2026-06-15');
    // Monday itself 2026-06-22 -> previous full week Mon = 2026-06-15
    expect(weekStartFor(new Date('2026-06-22T08:00:00Z'))).toBe('2026-06-15');
    // Sunday 2026-06-28 -> this week Mon = 2026-06-22 -> previous = 2026-06-15
    expect(weekStartFor(new Date('2026-06-28T23:00:00Z'))).toBe('2026-06-15');
  });
});

describe('aggregateSevenDays', () => {
  it('sums clicks/impressions per page and impression-weights position', () => {
    const m = aggregateSevenDays([
      { page: '/a', clicks: 5, impressions: 100, position: 4 },
      { page: '/a', clicks: 3, impressions: 100, position: 6 }, // weighted avg pos = (4*100+6*100)/200 = 5
      { page: '/b', clicks: 1, impressions: 0, position: 10 },  // no impressions -> simple avg = 10
    ]);
    expect(m.get('/a')).toEqual({ clicks: 8, impressions: 200, position: 5 });
    expect(m.get('/b')).toEqual({ clicks: 1, impressions: 0, position: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/gscSnapshots.test.ts --watch=false`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// lib/gscSnapshots.ts
import db from '../database/database';
import { readLocalSCData } from '../utils/searchConsole';
import { ensureGscSnapshotTables } from './ensureGscSnapshotTables';
import type { PageSnap, SnapMap } from './gscDrops';

type RawItem = { page: string; clicks: number; impressions: number; position: number };

/** 'YYYY-MM-DD' Monday (UTC) of the PREVIOUS full week relative to `now`. */
export function weekStartFor(now: Date): string {
   const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
   const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
   d.setUTCDate(d.getUTCDate() - (isoDow - 1)); // this week's Monday
   d.setUTCDate(d.getUTCDate() - 7);            // previous week's Monday
   return d.toISOString().slice(0, 10);
}

/** Collapse per-(page,device,country) rows into one snapshot per page. */
export function aggregateSevenDays(items: RawItem[]): SnapMap {
   const acc = new Map<string, { clicks: number; impressions: number; wpos: number; sumpos: number; n: number }>();
   for (const it of items) {
      const page = it.page || '/';
      const cur = acc.get(page) || { clicks: 0, impressions: 0, wpos: 0, sumpos: 0, n: 0 };
      cur.clicks += it.clicks || 0;
      cur.impressions += it.impressions || 0;
      cur.wpos += (it.position || 0) * (it.impressions || 0);
      cur.sumpos += it.position || 0;
      cur.n += 1;
      acc.set(page, cur);
   }
   const out: SnapMap = new Map();
   for (const [page, v] of acc) {
      const position = v.impressions > 0 ? v.wpos / v.impressions : (v.n > 0 ? v.sumpos / v.n : 0);
      out.set(page, { clicks: v.clicks, impressions: v.impressions, position } as PageSnap);
   }
   return out;
}

/** Read GSC JSON for the domain, aggregate `sevenDays`, and upsert one snapshot row per page. */
export async function captureWeeklySnapshot(domain: string, domainId: number, weekStart: string): Promise<number> {
   await ensureGscSnapshotTables();
   const sc = await readLocalSCData(domain);
   if (!sc || !Array.isArray(sc.sevenDays) || sc.sevenDays.length === 0) return 0;
   const agg = aggregateSevenDays(sc.sevenDays as RawItem[]);
   // Idempotent: clear this domain+week then insert (dialect-agnostic; mirrors lib/wpConnection.ts).
   await db.query('DELETE FROM gsc_page_snapshots WHERE domain_id = ? AND week_start = ?', { replacements: [domainId, weekStart] }).catch(() => {});
   let n = 0;
   for (const [page, s] of agg) {
      await db.query(
         'INSERT INTO gsc_page_snapshots (domain_id, page, week_start, clicks, impressions, position) VALUES (?, ?, ?, ?, ?, ?)',
         { replacements: [domainId, page, weekStart, Math.round(s.clicks), Math.round(s.impressions), s.position] },
      );
      n += 1;
   }
   return n;
}

/** Load a week's snapshot for a domain as a page -> PageSnap map. */
export async function getSnapshot(domainId: number, weekStart: string): Promise<SnapMap> {
   await ensureGscSnapshotTables();
   const [rows] = await db.query(
      'SELECT page, clicks, impressions, position FROM gsc_page_snapshots WHERE domain_id = ? AND week_start = ?',
      { replacements: [domainId, weekStart] },
   );
   const out: SnapMap = new Map();
   for (const r of rows as Array<{ page: string; clicks: number; impressions: number; position: number }>) {
      out.set(r.page, { clicks: r.clicks, impressions: r.impressions, position: r.position });
   }
   return out;
}

/** 'YYYY-MM-DD' a given number of days before a 'YYYY-MM-DD' week_start. */
export function shiftWeek(weekStart: string, weeks: number): string {
   const d = new Date(`${weekStart}T00:00:00Z`);
   d.setUTCDate(d.getUTCDate() + weeks * 7);
   return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/gscSnapshots.test.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gscSnapshots.ts __tests__/lib/gscSnapshots.test.ts
git commit -m "feat(gsc): weekly snapshot capture + week math"
```

---

## Task 4: Digest email builder

**Files:**
- Create: `lib/gscDigestEmail.ts`
- Test: `__tests__/lib/gscDigestEmail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/gscDigestEmail.test.ts
import { buildGscDigest, DomainDigest } from '../../lib/gscDigestEmail';

const domain: DomainDigest = {
  domain: 'soze.pl',
  summary: { clicks: 80, prevClicks: 100, impressions: 900, prevImpressions: 1000, pagesFell: 2, pagesGrew: 1 },
  tiers: {
    droppedInTop10: [{ page: '/oferta', prevPos: 4, nowPos: 9, clicks: 5, prevClicks: 20 }],
    droppedATier: [], outOfIndex: [{ page: '/blog/x', prevPos: 12, nowPos: null, clicks: 0, prevClicks: 3 }], growth: [],
  },
};

describe('buildGscDigest', () => {
  it('renders org name, domain, the dropped page and prev->now', () => {
    const html = buildGscDigest({ orgName: 'Idztech', domains: [domain] });
    expect(html).toContain('Idztech');
    expect(html).toContain('soze.pl');
    expect(html).toContain('/oferta');
    expect(html).toContain('4'); expect(html).toContain('9'); // prev -> now
    expect(html).toContain('-20%'); // clicks WoW
    expect(html).toContain('Out of index');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/gscDigestEmail.test.ts --watch=false`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// lib/gscDigestEmail.ts
import type { DropResult } from './gscDrops';

export type DomainDigest = { domain: string; summary: DropResult['summary']; tiers: DropResult['tiers'] };

const pct = (now: number, prev: number): string => {
   if (!prev) return now > 0 ? '+100%' : '0%';
   const v = Math.round(((now - prev) / prev) * 100);
   return `${v > 0 ? '+' : ''}${v}%`;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function tierBlock(title: string, color: string, rows: DropResult['tiers']['droppedInTop10']): string {
   if (rows.length === 0) return '';
   const items = rows.map((r) => {
      const move = r.nowPos === null ? '→ out' : `${r.prevPos === null ? '—' : Math.round(r.prevPos)} → ${Math.round(r.nowPos)}`;
      return `<tr><td style="padding:4px 0;font-size:14px;color:#18181B;">${esc(r.page)}</td><td style="padding:4px 0;font-size:13px;color:#52525C;text-align:right;white-space:nowrap;">${move}</td></tr>`;
   }).join('');
   return `<div style="margin-top:12px;"><div style="font-size:13px;font-weight:600;color:${color};margin-bottom:4px;">${title}</div><table style="width:100%;border-collapse:collapse;">${items}</table></div>`;
}

/** Pure HTML for the weekly digest. Inline styles only (email clients), design.md tokens. */
export function buildGscDigest({ orgName, domains }: { orgName: string; domains: DomainDigest[] }): string {
   const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
   const cards = domains.map((d) => {
      const s = d.summary;
      return `
      <div style="border:1px solid #E4E4E7;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:600;color:#18181B;">${esc(d.domain)}</div>
        <div style="font-size:13px;color:#52525C;margin-top:4px;">Clicks ${pct(s.clicks, s.prevClicks)} · Impressions ${pct(s.impressions, s.prevImpressions)} WoW · ${s.pagesFell} down / ${s.pagesGrew} up</div>
        ${tierBlock('Dropped in top 10', '#FF6F77', d.tiers.droppedInTop10)}
        ${tierBlock('Dropped a tier', '#FF6F77', d.tiers.droppedATier)}
        ${tierBlock('Out of index', '#B91C1C', d.tiers.outOfIndex)}
        ${tierBlock('Growth', '#1AB25E', d.tiers.growth)}
      </div>`;
   }).join('');
   return `<!doctype html><html><body style="margin:0;background:#f8f9ff;padding:24px;font-family:${F};">
     <div style="max-width:640px;margin:0 auto;">
       <div style="font-size:20px;font-weight:600;color:#18181B;margin-bottom:4px;">Weekly search report</div>
       <div style="font-size:14px;color:#52525C;margin-bottom:20px;">${esc(orgName)} — pages that changed position last week</div>
       ${cards}
       <div style="font-size:12px;color:#9F9FA9;margin-top:8px;">Position = average Google rank (lower is better).</div>
     </div>
   </body></html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/gscDigestEmail.test.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gscDigestEmail.ts __tests__/lib/gscDigestEmail.test.ts
git commit -m "feat(gsc): weekly digest email HTML builder"
```

---

## Task 5: Weekly cron block (capture + per-org digest + throttle)

**Files:**
- Modify: `pages/api/cron/daily.ts` (append a weekly block after the existing GSC refresh sweep, before the article-generation block)

- [ ] **Step 1: Add imports at the top of `pages/api/cron/daily.ts`**

```ts
import { ensureGscSnapshotTables } from '../../../lib/ensureGscSnapshotTables';
import { captureWeeklySnapshot, getSnapshot, weekStartFor, shiftWeek } from '../../../lib/gscSnapshots';
import { computeDrops } from '../../../lib/gscDrops';
import { buildGscDigest, DomainDigest } from '../../../lib/gscDigestEmail';
import { sendMail } from '../../../lib/sendMail';
```

- [ ] **Step 2: Insert the weekly block** (immediately after the `// Refresh Search Console data ...` try/catch sweep, so snapshots use fresh data)

```ts
   // ── Weekly GSC drop digest (Mondays only) ──────────────────────────────
   // Snapshot the previous full week per page, then email each org's active members
   // a digest of pages that crossed a ranking threshold. Throttled to 1/7 days/org.
   if (new Date().getUTCDay() === 1) {
      try {
         await ensureGscSnapshotTables();
         const thisWeek = weekStartFor(new Date());     // previous full week's Monday
         const lastWeek = shiftWeek(thisWeek, -1);

         // 1) Capture snapshots for every domain (isolated per domain).
         const [domRows] = await db.query('SELECT d."ID" AS id, d.domain, d.workspace_id FROM domain d');
         const allDomains = domRows as Array<{ id: number; domain: string; workspace_id: number | null }>;
         for (const dom of allDomains) {
            try { await captureWeeklySnapshot(dom.domain, dom.id, thisWeek); }
            catch (e) { console.error('[cron] snapshot failed for', dom.domain, e); }
         }

         // 2) Per organization: compute drops across its domains, email if any (and not throttled).
         const [orgRows] = await db.query('SELECT id, name, last_gsc_digest_sent_at FROM organizations');
         for (const org of orgRows as Array<{ id: number; name: string; last_gsc_digest_sent_at: string | null }>) {
            try {
               const sentAt = org.last_gsc_digest_sent_at ? new Date(org.last_gsc_digest_sent_at).getTime() : 0;
               if (Date.now() - sentAt < 7 * 24 * 3600 * 1000) continue; // throttled

               const [oDomRows] = await db.query(
                  'SELECT d."ID" AS id, d.domain FROM domain d JOIN workspaces w ON d.workspace_id = w.id WHERE w.org_id = ?',
                  { replacements: [org.id] },
               );
               const digests: DomainDigest[] = [];
               for (const d of oDomRows as Array<{ id: number; domain: string }>) {
                  const now = await getSnapshot(d.id, thisWeek);
                  const prev = await getSnapshot(d.id, lastWeek);
                  if (prev.size === 0) continue; // baseline week for this domain — nothing to compare
                  const r = computeDrops(now, prev);
                  if (r.hasDrops) digests.push({ domain: d.domain, summary: r.summary, tiers: r.tiers });
               }
               if (digests.length === 0) continue;

               const [memRows] = await db.query(
                  "SELECT DISTINCT email FROM organization_members WHERE org_id = ? AND status = 'active' AND email IS NOT NULL AND email <> ''",
                  { replacements: [org.id] },
               );
               const emails = (memRows as Array<{ email: string }>).map((m) => m.email);
               if (emails.length === 0) continue;

               const html = buildGscDigest({ orgName: org.name, domains: digests });
               let anySent = false;
               for (const to of emails) {
                  try { const { sent } = await sendMail({ to, subject: `Weekly search report — ${org.name}`, html }); anySent = anySent || sent; }
                  catch (e) { console.error('[cron] digest email failed for', to, e); }
               }
               if (anySent) {
                  await db.query('UPDATE organizations SET last_gsc_digest_sent_at = CURRENT_TIMESTAMP WHERE id = ?', { replacements: [org.id] });
               }
            } catch (e) { console.error('[cron] org digest failed for', org.id, e); }
         }
      } catch (e) { console.error('[cron] weekly GSC digest block failed', e); }
   }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Manual smoke (optional, local)** — temporarily change the guard to `if (true)` and hit the endpoint with the cron secret, then revert:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily | head
```
Expected: 200; server logs show snapshot capture (no crash). Revert the guard to `getUTCDay() === 1`.

- [ ] **Step 5: Commit**

```bash
git add pages/api/cron/daily.ts
git commit -m "feat(gsc): weekly cron — capture snapshots + per-org drop digest"
```

---

## Task 6: Badge API

**Files:**
- Create: `pages/api/gsc/traffic-alerts.ts`

- [ ] **Step 1: Write the implementation** (workspace-scoped; mirrors `pages/api/wordpress/connections.ts` auth)

```ts
// pages/api/gsc/traffic-alerts.ts
// GET /api/gsc/traffic-alerts?workspaceId=  → this week's drop tiers for the workspace's domain(s).
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { getAccessibleWorkspaceIds } from '../../../lib/tenancy';
import { getSnapshot, weekStartFor, shiftWeek } from '../../../lib/gscSnapshots';
import { computeDrops } from '../../../lib/gscDrops';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   const workspaceId = Number(req.query.workspaceId);
   if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
   const allowed = await getAccessibleWorkspaceIds(userId);
   if (!allowed.includes(workspaceId)) return res.status(403).json({ error: 'Access denied.' });

   const thisWeek = weekStartFor(new Date());
   const lastWeek = shiftWeek(thisWeek, -1);
   const [domRows] = await db.query('SELECT d."ID" AS id, d.domain FROM domain d WHERE d.workspace_id = ?', { replacements: [workspaceId] });

   const domains: Array<{ domain: string; tiers: ReturnType<typeof computeDrops>['tiers']; hasDrops: boolean }> = [];
   let haveBaseline = false;
   for (const d of domRows as Array<{ id: number; domain: string }>) {
      const prev = await getSnapshot(d.id, lastWeek);
      const now = await getSnapshot(d.id, thisWeek);
      if (prev.size > 0) haveBaseline = true;
      const r = computeDrops(now, prev);
      domains.push({ domain: d.domain, tiers: r.tiers, hasDrops: r.hasDrops });
   }
   // collecting = we don't yet have two weeks of data to compare anywhere.
   return res.status(200).json({ collecting: !haveBaseline, domains });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add pages/api/gsc/traffic-alerts.ts
git commit -m "feat(gsc): workspace-scoped traffic-alerts badge API"
```

---

## Task 7: Badge UI (dashboard section + domain/page badges)

**Files:**
- Create: `components/dashboard/TrafficAlertsSection.tsx`
- Modify: `pages/dashboard/index.tsx` (render the section), content-audit + domain-list badge (see Step 4)

> Run `/frontend-design` and re-read `design.md` before writing UI. Tokens: card `border:1px solid #E4E4E7;border-radius:12;background:#fff`; error `#FF6F77`; muted `#52525C`; primary `#18181B`; font `var(--font-family-primary)`; inline SVG only.

- [ ] **Step 1: Create the dashboard section component**

```tsx
// components/dashboard/TrafficAlertsSection.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId } from '../../lib/activeWorkspace';

const F = 'var(--font-family-primary)';

// Mirrors the /api/gsc/traffic-alerts response (no `any` — project rule).
type AlertEntry = { page: string; prevPos: number | null; nowPos: number | null };
type DomainAlerts = { domain: string; tiers: { droppedInTop10: AlertEntry[]; droppedATier: AlertEntry[]; outOfIndex: AlertEntry[]; growth: AlertEntry[] }; hasDrops: boolean };
type AlertsResponse = { collecting: boolean; domains: DomainAlerts[] };
type DropRow = AlertEntry & { domain: string; label: string };

const TrafficAlertsSection = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { data: wsData } = useWorkspaces();
  const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const [state, setState] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    if (!wsId) return;
    fetch(`/api/gsc/traffic-alerts?workspaceId=${wsId}`).then((r) => (r.ok ? (r.json() as Promise<AlertsResponse>) : null)).then(setState).catch(() => {});
  }, [wsId]);

  if (!state) return null;
  const drops: DropRow[] = state.domains.flatMap((d) => [
    ...d.tiers.droppedInTop10.map((e) => ({ ...e, domain: d.domain, label: 'Dropped in top 10' })),
    ...d.tiers.droppedATier.map((e) => ({ ...e, domain: d.domain, label: 'Dropped a tier' })),
    ...d.tiers.outOfIndex.map((e) => ({ ...e, domain: d.domain, label: 'Out of index' })),
  ]);

  return (
    <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, background: '#fff', padding: 20, fontFamily: F }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#18181B', marginBottom: 12 }}>Traffic alerts</div>
      {state.collecting ? (
        <div style={{ fontSize: 14, color: '#52525C' }}>Collecting Search Console data — your first weekly report needs two weeks of history.</div>
      ) : drops.length === 0 ? (
        <div style={{ fontSize: 14, color: '#52525C' }}>No ranking drops this week. 🎉</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drops.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
              <span style={{ color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.page}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#52525C' }}>{e.prevPos == null ? '—' : Math.round(e.prevPos)} → {e.nowPos == null ? 'out' : Math.round(e.nowPos)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 9999, padding: '1px 8px' }}>{e.label}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrafficAlertsSection;
```

- [ ] **Step 2: Mount it on the dashboard** — in `pages/dashboard/index.tsx`, import and render `<TrafficAlertsSection />` inside the `maxWidth:880` column (e.g. right after `<RecommendationsSection .../>`).

```tsx
import TrafficAlertsSection from '../../components/dashboard/TrafficAlertsSection';
// ...inside the column:
<TrafficAlertsSection />
```

- [ ] **Step 3: Type-check + run**

Run: `npx tsc --noEmit` (Expected EXIT 0). Then load `/dashboard` — the section shows the "Collecting…" state until two weeks of snapshots exist.

- [ ] **Step 4: Domain + content-audit badges** — reuse the same red pill. In the workspace domain list row and in `pages/sites/[domain]/content-audit.tsx` per-page rows, fetch `/api/gsc/traffic-alerts` once and render this badge next to any `page` present in `droppedInTop10 ∪ droppedATier ∪ outOfIndex`:

```tsx
<span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 9999, padding: '1px 8px', fontFamily: 'var(--font-family-primary)' }}>Traffic drop</span>
```

- [ ] **Step 5: Commit + graphify**

```bash
git add components/dashboard/TrafficAlertsSection.tsx pages/dashboard/index.tsx pages/sites/[domain]/content-audit.tsx
git commit -m "feat(gsc): traffic-alerts dashboard section + traffic-drop badges"
graphify update .
```

---

## Self-review notes (coverage vs spec)
- Schema (§4.1) → Task 1. Capture (§4.2) → Task 3. Drop detection (§4.3) → Task 2. Cron (§4.4) → Task 5. Email (§4.5) → Task 4. Badge API+UI (§4.6) → Tasks 6–7. Throttle/recipients/baseline (§4.4) → Task 5. Error handling (§5) → per-domain/org try-catch in Task 5; email-fail-no-throttle in Task 5. Testing (§6) → Tasks 2–4 unit tests.
- Types `PageSnap`/`SnapMap`/`DropResult`/`DomainDigest` defined once (Tasks 2 & 4) and imported elsewhere — consistent.
- "Out of index" = present last week, absent this week (matches spec).
```
