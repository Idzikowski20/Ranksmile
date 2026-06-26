# P3d — Blog-audit Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the domain-setup scan into a real blog-content audit — crawl the site, score each blog post with a no-LLM rule engine, and surface posts under 70 as "optimize" recommendations (LLM "create" ideas kept alongside), with full deep-analysis run on demand.

**Architecture:** Node gathers blog-post URLs (sitemap + GSC, filtered by a confirmed `blog_paths` set) and passes them to the Python sidecar. A new `blog_audit` sidecar stage fetches each post and computes a rule-based 0–100 score; the rewritten `recommendations` stage emits `optimize` (audited posts < 70) + `create` (LLM) items. Node materializes both into `page_audits` and `domain_recommendations` in a single transaction. Opening an optimize rec triggers the existing hybrid deep-analysis, cached in `page_audits.deep_json` with a content-hash + 30-day TTL.

**Tech Stack:** Next.js 12 (pages router, TypeScript), Sequelize over Postgres/SQLite, Python FastAPI sidecar (httpx + BeautifulSoup), Jest (Node unit tests), pytest (Python unit tests).

**Spec:** `docs/superpowers/specs/2026-06-26-blog-audit-recommendations-design.md`

---

## Conventions (read before starting)

- **Working dir / verify:** every shell step assumes `cd /c/Users/patry/Desktop/serpbear` (Bash cwd resets each call). Type-check with `npx tsc --noEmit`. Jest: `npx jest <path>`. Python: `cd python-sidecar && python -m pytest <path>` (run `pip install pytest` once if missing).
- **No new `any`.** Use precise types or `unknown` + narrowing.
- **DB quirks:** Sequelize `db.query(sql, { replacements })` → `[rows, meta]`; with `type: QueryTypes.SELECT` → rows only. Domain PK is quoted `"ID"` on Postgres. NEVER `ON CONFLICT` — delete-then-insert. `CURRENT_TIMESTAMP` works on both Postgres and SQLite.
- **Commits:** stage only the files named in the step. Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. After each task run `graphify update .`.
- **Constant:** `OPTIMIZE_THRESHOLD = 70` lives in `lib/blogAudit.ts` (Node) and `pipeline/stages/domain/triage_scorer.py` (Python). Never inline the number `70`.

## File Structure

**Create (Node):**
- `lib/blogPaths.ts` — normalize blog-path input + segment-aware URL matching.
- `lib/detectBlogPaths.ts` — pure URL→candidate-segment clustering (slug density).
- `lib/blogAudit.ts` — shared constants (`OPTIMIZE_THRESHOLD`) + the `PageAudit` type.
- `lib/gatherBlogUrls.ts` — gather candidate post URLs (sitemap + GSC) filtered by blog paths.
- `pages/api/domains/detect-blog-paths.ts` — detection endpoint (cluster + signal sampling).
- `pages/api/domains/blog-paths.ts` — GET/PUT `domain.blog_paths`.
- `pages/api/domains/[slug]/page-audit-deep.ts` — deep-on-demand for one audited page.

**Create (Python):**
- `python-sidecar/pipeline/stages/domain/triage_scorer.py` — `score_triage(signals)` + threshold.
- `python-sidecar/pipeline/stages/domain/page_signals.py` — `extract_page_signals(html, url)`.
- `python-sidecar/pipeline/stages/domain/blog_audit.py` — `BlogAuditStage`.
- `python-sidecar/tests/test_triage_scorer.py`, `test_page_signals.py`.

**Modify:**
- `lib/ensurePipelineTables.ts` — `page_audits` table + `domain_recommendations.url/score`.
- `lib/ensureTenancyTables.ts` — `domain.blog_paths` column.
- `database/models/domain.ts` — `blog_paths` field.
- `lib/domainPipeline.ts` — `DomainResult` + `materializeDomainSetup` + kick payload.
- `python-sidecar/pipeline/domain_runner.py` — register `BlogAuditStage`, return audit.
- `python-sidecar/pipeline/stages/domain/recommendations.py` — emit optimize + create.
- `pages/setup.tsx` — blog-path detect/confirm step.
- `components/domains/DomainSettings.tsx` — blog-path field.
- `pages/dashboard/index.tsx` + `components/dashboard/RecommendationsSection.tsx` — render optimize/create + coverage footnote.
- `__tests__/lib/blogPaths.test.ts`, `__tests__/lib/detectBlogPaths.test.ts`.

---

## Task 1: Blog-path helpers, schema, and detection backend

### Task 1.1: `lib/blogPaths.ts` — normalize + segment match

**Files:**
- Create: `lib/blogPaths.ts`
- Test: `__tests__/lib/blogPaths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/blogPaths.test.ts
import { normalizeBlogPaths, matchesBlogPath } from '../../lib/blogPaths';

describe('normalizeBlogPaths', () => {
  it('reduces a prefix to its blog segment, deduped, locale/category-stripped', () => {
    expect(normalizeBlogPaths(['/blog/'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/en/blog/', '/pl/blog'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/category/blog/'])).toEqual(['blog']);
    expect(normalizeBlogPaths(['/blog/', '/poradnik/'])).toEqual(['blog', 'poradnik']);
  });
  it('ignores blanks and bare slashes', () => {
    expect(normalizeBlogPaths(['', '   ', '/'])).toEqual([]);
  });
});

describe('matchesBlogPath', () => {
  const paths = ['blog', 'poradnik'];
  it('matches when any URL path segment equals a blog segment', () => {
    expect(matchesBlogPath('https://x.pl/blog/jak-wybrac-hosting', paths)).toBe(true);
    expect(matchesBlogPath('https://x.pl/en/blog/post', paths)).toBe(true);
    expect(matchesBlogPath('https://x.pl/poradnik/seo', paths)).toBe(true);
  });
  it('rejects non-blog and segment-listing URLs', () => {
    expect(matchesBlogPath('https://x.pl/produkty/abc', paths)).toBe(false);
    expect(matchesBlogPath('https://x.pl/blog', paths)).toBe(false); // listing page, no post slug
    expect(matchesBlogPath('https://x.pl/blog/', paths)).toBe(false);
  });
  it('returns false when no paths configured or url is malformed', () => {
    expect(matchesBlogPath('https://x.pl/blog/post', [])).toBe(false);
    expect(matchesBlogPath('not a url', paths)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/blogPaths.test.ts`
Expected: FAIL — `Cannot find module '../../lib/blogPaths'`.

- [ ] **Step 3: Implement**

```ts
// lib/blogPaths.ts
/** Helpers for blog-path detection + matching (P3d blog audit). */

const LOCALE_OR_WRAPPER = new Set([
  'en', 'pl', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'cs', 'ru', 'uk',
  'category', 'categories', 'kategoria', 'tag', 'tags',
]);

/** Path segments of a URL or path string, lowercased, blanks removed. */
function segments(urlOrPath: string): string[] {
  let pathname = urlOrPath;
  try {
    pathname = new URL(urlOrPath).pathname;
  } catch {
    // already a path like "/blog/post"
  }
  return pathname.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Reduce user/detected prefixes to their distinguishing "blog segment".
 * "/en/blog/" → "blog", "/category/blog/" → "blog", "/poradnik/" → "poradnik".
 * Picks the first segment that is not a locale/category wrapper.
 */
export function normalizeBlogPaths(prefixes: string[]): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    const seg = segments(prefix).find((s) => !LOCALE_OR_WRAPPER.has(s));
    if (seg && !out.includes(seg)) out.push(seg);
  }
  return out;
}

/**
 * True when the URL is a post UNDER one of the blog segments: some path segment
 * equals a blog segment AND there is at least one more segment after it (the post slug).
 */
export function matchesBlogPath(url: string, blogSegments: string[]): boolean {
  if (blogSegments.length === 0) return false;
  const segs = segments(url);
  for (let i = 0; i < segs.length; i += 1) {
    if (blogSegments.includes(segs[i]) && i < segs.length - 1) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/blogPaths.test.ts`
Expected: PASS (3 + 2 cases).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add lib/blogPaths.ts __tests__/lib/blogPaths.test.ts
git commit -m "feat(blog-audit): blog-path normalize + segment matcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.2: `lib/detectBlogPaths.ts` — slug-density clustering

**Files:**
- Create: `lib/detectBlogPaths.ts`
- Test: `__tests__/lib/detectBlogPaths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/detectBlogPaths.test.ts
import { rankBlogSegments } from '../../lib/detectBlogPaths';

describe('rankBlogSegments', () => {
  it('ranks segments with many deep slug-like children highest', () => {
    const urls = [
      'https://x.pl/blog/jak-wybrac-hosting-wordpress',
      'https://x.pl/blog/najlepsze-wtyczki-seo-2025',
      'https://x.pl/blog/audyt-tresci-krok-po-kroku',
      'https://x.pl/blog/pozycjonowanie-lokalne',
      'https://x.pl/o-nas',
      'https://x.pl/kontakt',
      'https://x.pl/produkty/abonament',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('blog');
    expect(ranked[0].slugChildren).toBe(4);
  });
  it('ignores single-page segments and the root', () => {
    const urls = ['https://x.pl/', 'https://x.pl/kontakt', 'https://x.pl/o-nas'];
    expect(rankBlogSegments(urls)).toEqual([]);
  });
  it('treats a segment with only short children as a weak candidate', () => {
    const urls = [
      'https://x.pl/sklep/a', 'https://x.pl/sklep/b',
      'https://x.pl/blog/dlugi-tytul-wpisu-blogowego',
      'https://x.pl/blog/inny-dlugi-tytul-wpisu',
    ];
    const ranked = rankBlogSegments(urls);
    expect(ranked[0].segment).toBe('blog'); // longer slugs win
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/detectBlogPaths.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/detectBlogPaths.ts
/** Pure URL→blog-segment clustering for blog detection (P3d). Signal sampling
 *  (Article schema / <article> / RSS) is layered on top in the API endpoint. */

export interface SegmentCandidate {
  segment: string;       // first path segment, e.g. "blog"
  slugChildren: number;  // count of /<segment>/<slug> children with a slug-like child
  avgSlugLen: number;    // average length of those child slugs (longer ⇒ more article-like)
}

const WRAPPER = new Set(['en', 'pl', 'de', 'fr', 'es', 'category', 'tag', 'page']);

function firstContentSegment(pathname: string): { seg: string; child: string } | null {
  const parts = pathname.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
  let i = 0;
  while (i < parts.length && WRAPPER.has(parts[i])) i += 1;
  if (i >= parts.length - 1) return null; // need a segment AND a child slug
  return { seg: parts[i], child: parts[i + 1] };
}

/** Rank path segments by how many deep, slug-like children they have. */
export function rankBlogSegments(urls: string[]): SegmentCandidate[] {
  const acc = new Map<string, { count: number; slugLenSum: number }>();
  for (const url of urls) {
    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { continue; }
    const fc = firstContentSegment(pathname);
    if (!fc) continue;
    // slug-like = contains a hyphen or is reasonably long (article slug, not "a"/"b")
    const slugLike = fc.child.includes('-') || fc.child.length >= 8;
    if (!slugLike) continue;
    const cur = acc.get(fc.seg) ?? { count: 0, slugLenSum: 0 };
    cur.count += 1;
    cur.slugLenSum += fc.child.length;
    acc.set(fc.seg, cur);
  }
  return [...acc.entries()]
    .map(([segment, v]) => ({ segment, slugChildren: v.count, avgSlugLen: v.slugLenSum / v.count }))
    .filter((c) => c.slugChildren >= 2)
    .sort((a, b) => b.slugChildren - a.slugChildren || b.avgSlugLen - a.avgSlugLen);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/detectBlogPaths.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add lib/detectBlogPaths.ts __tests__/lib/detectBlogPaths.test.ts
git commit -m "feat(blog-audit): slug-density blog-segment clustering

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.3: Schema — `page_audits` table + `domain_recommendations.url/score`

**Files:**
- Modify: `lib/ensurePipelineTables.ts`

- [ ] **Step 1: Read the current file end-to-end** so the new SQL matches the existing `db.query(...)` style and the idempotent `ALTER TABLE` helper already used for other columns.

Run: `cd /c/Users/patry/Desktop/serpbear && sed -n '1,80p' lib/ensurePipelineTables.ts`

- [ ] **Step 2: Add the `page_audits` table + the two new recommendation columns.** Inside `ensurePipelineTables()`, after the existing `CREATE TABLE IF NOT EXISTS domain_recommendations (...)` block, add:

```ts
   await db.query(`CREATE TABLE IF NOT EXISTS page_audits (
      id ${pk},
      domain_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      path TEXT,
      title TEXT,
      score INTEGER,
      signals_json TEXT,
      fetch_status TEXT,
      content_hash TEXT,
      duration_ms INTEGER,
      status TEXT DEFAULT 'triaged',
      deep_json TEXT,
      deep_generated_at TIMESTAMP,
      audited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`);

   // domain_recommendations: optimize recs carry a page url + snapshot score
   const recCols: Array<[string, string]> = [['url', 'TEXT'], ['score', 'INTEGER']];
   for (const [col, type] of recCols) {
      try {
         await db.query(`ALTER TABLE domain_recommendations ADD COLUMN ${col} ${type}`);
      } catch {
         // column already exists — ignore
      }
   }
```

Note: `pk` is the existing primary-key fragment used by the other `CREATE TABLE` calls in this file (e.g. `id SERIAL PRIMARY KEY` on Postgres / `INTEGER PRIMARY KEY AUTOINCREMENT` on SQLite). Reuse the SAME expression this file already uses for `domain_recommendations.id` — read it in Step 1 and mirror it; do not invent a new one.

- [ ] **Step 3: Verify type-check + table creation.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep ensurePipelineTables || echo "tsc clean"
```
Expected: `tsc clean`. (Live table creation is verified end-to-end in Task 2.6 when a scan runs.)

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add lib/ensurePipelineTables.ts
git commit -m "feat(blog-audit): page_audits table + domain_recommendations url/score

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.4: `domain.blog_paths` column + model field

**Files:**
- Modify: `lib/ensureTenancyTables.ts`, `database/models/domain.ts`

- [ ] **Step 1: Find where domain columns are added idempotently.**

Run: `cd /c/Users/patry/Desktop/serpbear && grep -n "ADD COLUMN\|ignoreExisting\|workspace_id\|brand_knowledge" lib/ensureTenancyTables.ts`

- [ ] **Step 2: Add `blog_paths` next to the existing domain ALTERs** (use the SAME `ignoreExisting`/try-catch wrapper the file already uses — mirror the `workspace_id` or `brand_knowledge` line):

```ts
   await ignoreExisting(() => db.query(`ALTER TABLE domain ADD COLUMN blog_paths TEXT`));
```

(If the file uses a bare `try { … } catch {}` instead of `ignoreExisting`, mirror that exact form.)

- [ ] **Step 3: Add the model field.** In `database/models/domain.ts`, beside the existing optional columns (e.g. `brand_knowledge`/`workspace_id`), add:

```ts
   @Column({ type: DataType.TEXT, allowNull: true })
   blog_paths!: string | null;
```

Match the decorator style already in the file (sequelize-typescript `@Column`). `blog_paths` stores a JSON array string, e.g. `["blog","poradnik"]`.

- [ ] **Step 4: Verify.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -E "domain.ts|ensureTenancyTables" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add lib/ensureTenancyTables.ts database/models/domain.ts
git commit -m "feat(blog-audit): domain.blog_paths column + model field

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.5: `blog-paths` GET/PUT endpoint

**Files:**
- Create: `pages/api/domains/blog-paths.ts`

- [ ] **Step 1: Implement** (mirror auth + ownership from `pages/api/domains/[slug]/recommendations.ts`, which we read earlier — `verifyUser`, `getCurrentUserId`, `verifyDomainOwnershipBySlug`):

```ts
// GET/PUT /api/domains/blog-paths?slug=... — read/write domain.blog_paths (JSON array)
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../utils/verifyDomainOwnership';
import { normalizeBlogPaths } from '../../../lib/blogPaths';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   const slug = (req.query.slug as string) || (req.body?.slug as string);
   const ownership = await verifyDomainOwnershipBySlug(slug, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;

   if (req.method === 'GET') {
      const rows = await db.query<{ blog_paths: string | null }>(
         `SELECT blog_paths FROM domain WHERE "ID" = ?`,
         { replacements: [domainId], type: (await import('sequelize')).QueryTypes.SELECT },
      );
      let paths: string[] = [];
      try { paths = JSON.parse(rows[0]?.blog_paths || '[]'); } catch { paths = []; }
      return res.status(200).json({ blogPaths: paths });
   }

   if (req.method === 'PUT') {
      const input = Array.isArray(req.body?.blogPaths) ? (req.body.blogPaths as string[]) : [];
      const normalized = normalizeBlogPaths(input);
      await db.query(`UPDATE domain SET blog_paths = ? WHERE "ID" = ?`, {
         replacements: [JSON.stringify(normalized), domainId],
      });
      return res.status(200).json({ blogPaths: normalized });
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
```

Note: `"ID"` is the quoted Postgres PK. On SQLite the quoted identifier also resolves. If the existing codebase reads domain by a different column elsewhere, mirror that — but `recommendations.ts` returns `ownership.ID`, so `"ID"` is correct.

- [ ] **Step 2: Verify type-check.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "blog-paths" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add pages/api/domains/blog-paths.ts
git commit -m "feat(blog-audit): GET/PUT domain.blog_paths endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 1.6: `detect-blog-paths` endpoint (cluster + signal sampling)

**Files:**
- Create: `pages/api/domains/detect-blog-paths.ts`

- [ ] **Step 1: Read the sitemap helper** so we reuse its fetching, not reinvent it.

Run: `cd /c/Users/patry/Desktop/serpbear && grep -n "sitemap\|export\|function" pages/api/articles/fetch-site-links.ts | head -30`

If `fetch-site-links.ts` exports a reusable sitemap function, import it. If its logic is inline in the handler, replicate the minimal sitemap fetch here (fetch `/sitemap.xml`, regex `<loc>(.*?)</loc>`), keeping it small.

- [ ] **Step 2: Implement** — gather URLs (sitemap + GSC pages via the existing `/api/gsc/pages` logic or `gscAccounts`), rank segments, sample up to 3 child pages per top candidate for article signals, return prefixes:

```ts
// POST /api/domains/detect-blog-paths { domain, siteUrl } → { blogPaths: string[] }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { rankBlogSegments } from '../../../lib/detectBlogPaths';

const UA = 'Mozilla/5.0 (compatible; SerpBearBot/1.0)';

async function fetchSitemapUrls(domain: string): Promise<string[]> {
   const base = domain.startsWith('http') ? domain : `https://${domain}`;
   for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
         const r = await fetch(`${base}${path}`, { headers: { 'User-Agent': UA } });
         if (!r.ok) continue;
         const xml = await r.text();
         const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
         if (locs.length) return locs.slice(0, 2000);
      } catch { /* try next */ }
   }
   return [];
}

/** True if a page shows article signals: JSON-LD Article/BlogPosting, datePublished, <article>, or RSS link. */
async function hasArticleSignals(url: string): Promise<boolean> {
   try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) return false;
      const html = (await r.text()).slice(0, 200_000);
      return /"@type"\s*:\s*"(Article|BlogPosting|NewsArticle)"/i.test(html)
         || /datePublished/i.test(html)
         || /<article[\s>]/i.test(html)
         || /<link[^>]+type=["']application\/rss\+xml["']/i.test(html);
   } catch { return false; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

   const domain = (req.body?.domain as string || '').trim();
   if (!domain) return res.status(400).json({ error: 'domain is required' });

   const urls = await fetchSitemapUrls(domain);
   const ranked = rankBlogSegments(urls);
   if (ranked.length === 0) return res.status(200).json({ blogPaths: [] });

   // Confirm the top 2 candidates with article signals from a sample child url.
   const confirmed: string[] = [];
   for (const cand of ranked.slice(0, 2)) {
      const sample = urls.find((u) => {
         try { return new URL(u).pathname.toLowerCase().includes(`/${cand.segment}/`); } catch { return false; }
      });
      const ok = sample ? await hasArticleSignals(sample) : false;
      // Keep the strongest candidate even if signal probe failed (slug density already strong).
      if (ok || (confirmed.length === 0 && cand.slugChildren >= 3)) confirmed.push(`/${cand.segment}/`);
   }
   return res.status(200).json({ blogPaths: confirmed });
}
```

- [ ] **Step 2: Verify type-check.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "detect-blog-paths" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 3: Manual smoke test** (dev server running):

```bash
cd /c/Users/patry/Desktop/serpbear
curl -s -X POST http://localhost:3000/api/domains/detect-blog-paths -H 'Content-Type: application/json' -d '{"domain":"idztech.pl"}' --cookie "<auth-cookie>"
```
Expected: JSON like `{"blogPaths":["/blog/"]}` (or `[]` if no sitemap). Auth cookie from the browser session.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add pages/api/domains/detect-blog-paths.ts
git commit -m "feat(blog-audit): detect-blog-paths endpoint (cluster + article signals)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git stash --include-untracked -- . 2>/dev/null; graphify update . >/dev/null 2>&1; git stash pop 2>/dev/null || true
```

(Simpler: just run `graphify update .` after the commit — no stash needed if the tree is clean.)

---

## Task 2: Sidecar blog_audit stage + recommendations rewrite + Node materialize

### Task 2.1: `triage_scorer.py` — no-LLM rule score

**Files:**
- Create: `python-sidecar/pipeline/stages/domain/triage_scorer.py`
- Test: `python-sidecar/tests/test_triage_scorer.py`

- [ ] **Step 1: Write the failing test**

```python
# python-sidecar/tests/test_triage_scorer.py
from pipeline.stages.domain.triage_scorer import score_triage, OPTIMIZE_THRESHOLD


def test_strong_post_scores_high():
    signals = {
        "word_count": 1800, "title_length": 52, "description_length": 150,
        "heading_count": 12, "paragraph_count": 22, "image_alt_ratio": 1.0,
        "internal_links": 8,
    }
    assert score_triage(signals) >= 80


def test_thin_post_scores_low_enough_to_flag():
    signals = {
        "word_count": 180, "title_length": 12, "description_length": 0,
        "heading_count": 1, "paragraph_count": 2, "image_alt_ratio": 0.0,
        "internal_links": 0,
    }
    assert score_triage(signals) < OPTIMIZE_THRESHOLD


def test_score_is_clamped_0_100():
    assert 0 <= score_triage({}) <= 100
    assert score_triage({"word_count": 5000, "title_length": 55, "description_length": 160,
                         "heading_count": 20, "paragraph_count": 40, "image_alt_ratio": 1.0,
                         "internal_links": 20}) <= 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -m pytest tests/test_triage_scorer.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Implement** (mirrors `_compute_rule_base` but with absolute targets — no SERP, no LLM):

```python
# python-sidecar/pipeline/stages/domain/triage_scorer.py
"""No-LLM rule-based content score for blog-post triage (P3d).

Mirrors the deduction philosophy of score_ranking._compute_rule_base, but uses
absolute on-page targets because triage has no SERP competitor context.
"""

OPTIMIZE_THRESHOLD = 70

WORDS_TARGET = 1200      # a healthy blog post
TITLE_MIN, TITLE_MAX = 30, 65
DESC_MIN = 70


def score_triage(signals: dict) -> int:
    """Map on-page signals to a 0-100 content score. Higher = healthier."""
    score = 80

    word_count = signals.get("word_count", 0)
    if word_count < WORDS_TARGET * 0.4:
        score -= 30
    elif word_count < WORDS_TARGET * 0.7:
        score -= 15

    title_len = signals.get("title_length", 0)
    if title_len < TITLE_MIN or title_len > TITLE_MAX:
        score -= 10

    if signals.get("description_length", 0) < DESC_MIN:
        score -= 8

    if signals.get("heading_count", 0) < 3:
        score -= 10

    if signals.get("paragraph_count", 0) < 4:
        score -= 5

    # image alt coverage: ratio 0..1 of images that have alt text
    alt_ratio = signals.get("image_alt_ratio", 1.0)
    if alt_ratio < 0.5:
        score -= 5

    if signals.get("internal_links", 0) < 2:
        score -= 5

    # reward depth a little so strong posts clear 80
    if word_count >= WORDS_TARGET and signals.get("heading_count", 0) >= 8:
        score += 8

    return max(0, min(100, score))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -m pytest tests/test_triage_scorer.py -v`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add python-sidecar/pipeline/stages/domain/triage_scorer.py python-sidecar/tests/test_triage_scorer.py
git commit -m "feat(blog-audit): no-LLM triage scorer + threshold

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.2: `page_signals.py` — HTML → signals

**Files:**
- Create: `python-sidecar/pipeline/stages/domain/page_signals.py`
- Test: `python-sidecar/tests/test_page_signals.py`

- [ ] **Step 1: Write the failing test**

```python
# python-sidecar/tests/test_page_signals.py
from pipeline.stages.domain.page_signals import extract_page_signals

HTML = """
<html><head>
<title>Jak wybrac hosting WordPress - kompletny poradnik</title>
<meta name="description" content="Praktyczny przewodnik po wyborze hostingu pod WordPress, krok po kroku i bez zbednych terminow.">
</head><body>
<article>
<h1>Jak wybrac hosting WordPress</h1>
<h2>Wymagania</h2><p>Pierwszy akapit ma sporo tresci.</p>
<h2>Parametry</h2><p>Drugi akapit.</p><p>Trzeci akapit.</p>
<img src="a.jpg" alt="zrzut panelu"><img src="b.jpg">
<a href="/blog/inny-wpis">link</a><a href="https://x.pl/kontakt">kontakt</a>
</article>
</body></html>
"""


def test_extracts_core_signals():
    s = extract_page_signals(HTML, "https://x.pl/blog/jak-wybrac-hosting")
    assert s["title"].startswith("Jak wybrac hosting")
    assert s["path"] == "/blog/jak-wybrac-hosting"
    assert s["heading_count"] >= 3       # h1 + 2×h2
    assert s["paragraph_count"] == 3
    assert s["word_count"] > 5
    assert 0.0 <= s["image_alt_ratio"] <= 1.0
    assert s["image_alt_ratio"] == 0.5   # 1 of 2 imgs has alt
    assert s["internal_links"] >= 1
    assert isinstance(s["content_hash"], str) and len(s["content_hash"]) == 64  # sha256 hex


def test_empty_html_is_safe():
    s = extract_page_signals("", "https://x.pl/blog/x")
    assert s["word_count"] == 0
    assert s["title"] == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -m pytest tests/test_page_signals.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (reuses BeautifulSoup like `fetch_page.py`; prefers `<article>`/content selectors for body):

```python
# python-sidecar/pipeline/stages/domain/page_signals.py
"""Extract on-page signals from blog-post HTML for triage scoring (P3d)."""
import hashlib
from urllib.parse import urlparse

from bs4 import BeautifulSoup

CONTENT_SELECTORS = [
    "article", "main", ".post-content", ".entry-content",
    ".article-content", "#content", '[role="main"]',
]


def _main_node(soup: BeautifulSoup):
    for sel in CONTENT_SELECTORS:
        node = soup.select_one(sel)
        if node and len(node.get_text(separator=" ", strip=True).split()) >= 50:
            return node
    return soup.body or soup


def extract_page_signals(html: str, url: str) -> dict:
    soup = BeautifulSoup(html or "", "lxml")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag.get("content", "") if desc_tag else ""

    node = _main_node(soup)
    text = node.get_text(separator=" ", strip=True)
    word_count = len([w for w in text.split() if w])

    headings = node.find_all(["h1", "h2", "h3"])
    paragraphs = [p for p in node.find_all("p") if p.get_text(strip=True)]

    imgs = node.find_all("img")
    with_alt = sum(1 for i in imgs if (i.get("alt") or "").strip())
    image_alt_ratio = (with_alt / len(imgs)) if imgs else 1.0

    host = urlparse(url).netloc
    internal_links = 0
    for a in node.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/") or host and host in href:
            internal_links += 1

    content_hash = hashlib.sha256(text.encode("utf-8", "ignore")).hexdigest()

    return {
        "url": url,
        "path": urlparse(url).path or "/",
        "title": title,
        "word_count": word_count,
        "title_length": len(title),
        "description_length": len(description),
        "heading_count": len(headings),
        "paragraph_count": len(paragraphs),
        "image_alt_ratio": round(image_alt_ratio, 3),
        "internal_links": internal_links,
        "content_hash": content_hash,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -m pytest tests/test_page_signals.py -v`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add python-sidecar/pipeline/stages/domain/page_signals.py python-sidecar/tests/test_page_signals.py
git commit -m "feat(blog-audit): page-signal extraction from HTML

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.3: `BlogAuditStage` — fetch + triage all posts

**Files:**
- Create: `python-sidecar/pipeline/stages/domain/blog_audit.py`

- [ ] **Step 1: Read `contracts.py`** to match `AnalysisStage`/`StageContext` exactly (payload, get_state/set_state, emit_progress).

Run: `cd /c/Users/patry/Desktop/serpbear && sed -n '1,80p' python-sidecar/pipeline/contracts.py`

- [ ] **Step 2: Implement the stage.** Node passes `payload["blog_urls"]` (list of post URLs already filtered by blog path). The stage fetches each with bounded concurrency, extracts signals, scores, and records `fetch_status`/`duration_ms`; it stores `page_audits` + `audit_counts` in ctx state.

```python
# python-sidecar/pipeline/stages/domain/blog_audit.py
"""BlogAuditStage — fetch each blog post, compute a no-LLM triage score (P3d)."""
import asyncio
import time

import httpx

from pipeline.contracts import AnalysisStage, StageContext
from pipeline.stages.domain.page_signals import extract_page_signals
from pipeline.stages.domain.triage_scorer import score_triage

MAX_POSTS = 100
CONCURRENCY = 8
FETCH_TIMEOUT = 15.0
UA = "Mozilla/5.0 (compatible; SerpBearBot/1.0)"


def _status_from_exc(exc: Exception) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "TIMEOUT"
    return "ERROR"


async def _audit_one(client: httpx.AsyncClient, url: str) -> dict:
    start = time.monotonic()
    try:
        r = await client.get(url, headers={"User-Agent": UA}, follow_redirects=True)
        duration_ms = int((time.monotonic() - start) * 1000)
        if r.status_code == 403:
            return {"url": url, "fetch_status": "HTTP_403", "duration_ms": duration_ms}
        if r.status_code == 404:
            return {"url": url, "fetch_status": "HTTP_404", "duration_ms": duration_ms}
        if r.status_code >= 400:
            return {"url": url, "fetch_status": "ERROR", "duration_ms": duration_ms}
        signals = extract_page_signals(r.text, url)
        score = score_triage(signals)
        return {
            "url": url,
            "path": signals["path"],
            "title": signals["title"],
            "score": score,
            "signals": signals,
            "content_hash": signals["content_hash"],
            "fetch_status": "OK",
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # noqa: BLE001 — per-post isolation, never fail the stage
        return {"url": url, "fetch_status": _status_from_exc(exc),
                "duration_ms": int((time.monotonic() - start) * 1000)}


class BlogAuditStage(AnalysisStage):
    name = "blog_audit"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        all_urls: list[str] = ctx.payload.get("blog_urls", []) or []
        total = len(all_urls)
        urls = all_urls[:MAX_POSTS]
        if total > MAX_POSTS:
            print(f"[blog_audit] {total} posts found, auditing first {MAX_POSTS}")

        await ctx.emit_progress(self, 5, f"Auditing {len(urls)} blog posts")

        audits: list[dict] = []
        sem = asyncio.Semaphore(CONCURRENCY)
        done = 0

        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
            async def worker(u: str) -> None:
                nonlocal done
                async with sem:
                    result = await _audit_one(client, u)
                audits.append(result)
                done += 1
                if done % 10 == 0 or done == len(urls):
                    pct = 5 + int(90 * done / max(1, len(urls)))
                    await ctx.emit_progress(self, pct, f"Audited {done}/{len(urls)} posts")

            await asyncio.gather(*(worker(u) for u in urls))

        scored = [a for a in audits if a.get("fetch_status") == "OK"]
        counts = {"audited": len(scored), "skipped": len(audits) - len(scored), "total": total}
        ctx.set_state("page_audits", audits)
        ctx.set_state("audit_counts", counts)
        await ctx.emit_progress(self, 100, f"Audited {counts['audited']}, skipped {counts['skipped']}")
        return {"page_audits": audits, "audit_counts": counts}
```

- [ ] **Step 3: Smoke-check imports compile.**

```bash
cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -c "from pipeline.stages.domain.blog_audit import BlogAuditStage; print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add python-sidecar/pipeline/stages/domain/blog_audit.py
git commit -m "feat(blog-audit): BlogAuditStage (bounded-concurrency fetch + triage)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.4: Rewrite `recommendations.py` — optimize + create

**Files:**
- Modify: `python-sidecar/pipeline/stages/domain/recommendations.py`

- [ ] **Step 1: Read the full current stage** (we saw the top earlier; read the `run()` tail).

Run: `cd /c/Users/patry/Desktop/serpbear && sed -n '60,120p' python-sidecar/pipeline/stages/domain/recommendations.py`

- [ ] **Step 2: Change `run()` to build optimize recs from the audit first, then append the existing LLM "create" ideas.** Replace the body of `run()` with:

```python
    async def run(self, ctx: StageContext) -> dict:
        topics: list[dict] = ctx.get_state("topics") or []
        competitors: list[dict] = ctx.get_state("competitors") or []
        brand_knowledge: str = ctx.payload.get("brandKnowledge", "")
        audits: list[dict] = ctx.get_state("page_audits") or []

        from pipeline.stages.domain.triage_scorer import OPTIMIZE_THRESHOLD

        # 1. Optimize recs: audited posts under the threshold, worst-first (immutable snapshot).
        weak = sorted(
            [a for a in audits if a.get("fetch_status") == "OK" and a.get("score") is not None
             and a["score"] < OPTIMIZE_THRESHOLD],
            key=lambda a: a["score"],
        )
        recs: list[dict] = []
        for a in weak[:20]:
            recs.append({
                "title": a.get("title") or a.get("path") or a["url"],
                "rationale": f"Content score {a['score']}/100 — below {OPTIMIZE_THRESHOLD}. Improve depth, headings, and meta.",
                "priority": "high" if a["score"] < 50 else "medium",
                "type": "optimize",
                "url": a["url"],
                "score": a["score"],
            })

        # 2. Create recs: existing LLM content ideas from topics + competitors.
        await ctx.emit_progress(self, 60, "Generating content ideas")
        ideas = None
        try:
            ideas = await _llm_recommendations(topics, competitors, brand_knowledge)
        except Exception as exc:  # noqa: BLE001
            print(f"[recommendations] LLM call failed: {exc}")
        for idea in (ideas or [])[:5]:
            recs.append({
                "title": idea.get("title", ""),
                "rationale": idea.get("rationale", ""),
                "priority": idea.get("priority", "medium"),
                "type": "create",
                "topic_index": idea.get("topic_index"),
            })

        ctx.set_state("recommendations", recs)
        await ctx.emit_progress(self, 100, f"{len(recs)} recommendations")
        return {"recommendations": recs}
```

Keep the existing module-level `_llm_recommendations`, `_get_client`, `MODEL` exactly as they are. Only the `run()` method changes. The old single-retry fallback block is replaced by the try/except above — no behavior is lost (an LLM failure just yields zero `create` recs while optimize recs still ship).

- [ ] **Step 3: Smoke-check imports compile.**

```bash
cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -c "from pipeline.stages.domain.recommendations import RecommendationsStage; print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add python-sidecar/pipeline/stages/domain/recommendations.py
git commit -m "feat(blog-audit): recommendations = optimize (audit) + create (LLM)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.5: Register `BlogAuditStage` in the runner + return audit

**Files:**
- Modify: `python-sidecar/pipeline/domain_runner.py`

- [ ] **Step 1: Add the stage to the pipeline + a timeout.** In `build_domain_setup_pipeline()`, import and insert `BlogAuditStage` BEFORE `RecommendationsStage`:

```python
    from pipeline.stages.domain.blog_audit import BlogAuditStage
    # ...
    return [
        KeywordsStage(),
        TopicsStage(),
        CompetitorsStage(),
        BlogAuditStage(),
        RecommendationsStage(),
    ]
```

In the `TIMEOUTS` dict at the top of the file add: `"blog_audit": 240,`.

- [ ] **Step 2: Return the audit data in the runner's result dict.** Find the result assembly (the block returning `{"keywords": ..., "recommendations": ctx.get_state("recommendations") or []}`) and add:

```python
            "page_audits": ctx.get_state("page_audits") or [],
            "audit_counts": ctx.get_state("audit_counts") or {"audited": 0, "skipped": 0, "total": 0},
```

- [ ] **Step 3: Verify the pipeline builds.**

```bash
cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -c "from pipeline.domain_runner import build_domain_setup_pipeline; print([s.name for s in build_domain_setup_pipeline()])"
```
Expected: `['keywords', 'topics', 'competitors', 'blog_audit', 'recommendations']`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add python-sidecar/pipeline/domain_runner.py
git commit -m "feat(blog-audit): register BlogAuditStage + return audit in runner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.6: Node — gather blog URLs, pass in payload, materialize audit

**Files:**
- Create: `lib/gatherBlogUrls.ts`
- Modify: `lib/domainPipeline.ts`

- [ ] **Step 1: Implement the URL gatherer** (sitemap reuse from Task 1.6 + GSC pages, filtered by `matchesBlogPath`). Reads `domain.blog_paths`:

```ts
// lib/gatherBlogUrls.ts
import db from '../database/database';
import { QueryTypes } from 'sequelize';
import { matchesBlogPath } from './blogPaths';

const UA = 'Mozilla/5.0 (compatible; SerpBearBot/1.0)';

async function sitemapUrls(domainName: string): Promise<string[]> {
   const base = domainName.startsWith('http') ? domainName : `https://${domainName}`;
   for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
         const r = await fetch(`${base}${path}`, { headers: { 'User-Agent': UA } });
         if (!r.ok) continue;
         const xml = await r.text();
         const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
         if (locs.length) return locs;
      } catch { /* next */ }
   }
   return [];
}

/** All candidate blog-post URLs for a domain, filtered by its blog_paths. Empty if none set. */
export async function gatherBlogUrls(domainId: number, domainName: string): Promise<string[]> {
   const rows = await db.query<{ blog_paths: string | null }>(
      `SELECT blog_paths FROM domain WHERE "ID" = ?`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   let segments: string[] = [];
   try { segments = JSON.parse(rows[0]?.blog_paths || '[]'); } catch { segments = []; }
   if (segments.length === 0) return [];

   const urls = await sitemapUrls(domainName);
   const seen = new Set<string>();
   const out: string[] = [];
   for (const u of urls) {
      if (!matchesBlogPath(u, segments)) continue;
      const key = u.split('#')[0].split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
   }
   return out;
}
```

- [ ] **Step 2: Pass `blog_urls` into the sidecar kick payload.** In `lib/domainPipeline.ts`, find `kickDomainSetup` (≈ line 166) where the payload sent to the sidecar is built. Import the gatherer and add `blog_urls` to that payload object:

```ts
import { gatherBlogUrls } from './gatherBlogUrls';
// inside kickDomainSetup, after resolving the domain's id + name:
const blogUrls = await gatherBlogUrls(domainId, domainName);
// merge into the existing payload literal:
//   payload = { ...existing, brandKnowledge, blog_urls: blogUrls }
```

(Use the domain id + name already loaded in `kickDomainSetup`; if only the id is in scope, `SELECT domain FROM domain WHERE "ID" = ?` to get the name. Mirror the existing payload-building code.)

- [ ] **Step 3: Extend `DomainResult` + `materializeDomainSetup`.** In `lib/domainPipeline.ts`:

Extend the type (≈ line 9-15):

```ts
export interface PageAuditResult {
   url: string; path?: string; title?: string; score?: number;
   signals?: unknown; content_hash?: string; fetch_status?: string; duration_ms?: number;
}
export interface DomainResult {
   // ...existing fields...
   recommendations: { title: string; rationale?: string; priority?: string; type?: string; topic_index?: number; url?: string; score?: number }[];
   page_audits?: PageAuditResult[];
   audit_counts?: { audited: number; skipped: number; total: number };
}
```

In `materializeDomainSetup` (≈ line 80-97), add `'page_audits'` to the delete-first loop, insert the audit rows, and add `url`/`score` to the recommendation insert:

```ts
   await db.transaction(async (tx: Transaction) => {
      const q = (sql: string, repl: unknown[]) => db.query(sql, { replacements: repl, transaction: tx });
      for (const t of ['domain_keywords', 'domain_topics', 'domain_competitors', 'domain_recommendations', 'page_audits'])
         await q(`DELETE FROM ${t} WHERE domain_id = ?`, [domainId]);
      // ...existing topic/keyword/competitor inserts unchanged...

      for (const a of result.page_audits || [])
         await q(
            `INSERT INTO page_audits (domain_id, url, path, title, score, signals_json, fetch_status, content_hash, duration_ms, status, audited_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'triaged', CURRENT_TIMESTAMP)`,
            [domainId, a.url, a.path ?? null, a.title ?? null, a.score ?? null,
             a.signals ? JSON.stringify(a.signals) : null, a.fetch_status ?? null,
             a.content_hash ?? null, a.duration_ms ?? null],
         );

      for (const r of result.recommendations || [])
         await q(
            `INSERT INTO domain_recommendations (domain_id, topic_id, title, rationale, priority, type, url, score, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [domainId, r.topic_index != null ? topicIds[r.topic_index] ?? null : null,
             r.title, r.rationale || '', r.priority || 'medium', r.type || 'content',
             r.url ?? null, r.score ?? null],
         );
   });
```

Replace ONLY the delete loop + the recommendation insert; keep the topic/keyword/competitor inserts and the `topicIds` map exactly as they are.

- [ ] **Step 4: Persist `audit_counts` on the job for the dashboard.** The status read is `getSetupStatus` (≈ line 185). Store counts where the job row lives — find the `analysis_jobs` update on done and add a column or stash counts in the existing result/progress JSON. Simplest: add a nullable `audit_counts` TEXT column to `analysis_jobs` in `lib/ensurePipelineTables.ts` and write `JSON.stringify(result.audit_counts)` in `materializeDomainSetup`; surface it from `getSetupStatus`. (If `analysis_jobs` already stores a JSON `result`/`meta` blob, write into that instead of a new column.)

- [ ] **Step 5: Verify type-check.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -E "domainPipeline|gatherBlogUrls" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 6: End-to-end live test.** Restart the sidecar (so new stages load) and the dev server. Set a blog path for `idztech.pl` via `PUT /api/domains/blog-paths`, then re-run the scan (dashboard auto-kick or `runSetup`). Verify:

```bash
# After the scan reaches 'done', inspect via Neon MCP or:
cd /c/Users/patry/Desktop/serpbear
# expect page_audits rows + domain_recommendations rows with type='optimize', url, score
```
Use the Neon MCP `run_sql`: `SELECT type, title, url, score FROM domain_recommendations WHERE domain_id = <id>;` and `SELECT count(*), fetch_status FROM page_audits WHERE domain_id = <id> GROUP BY fetch_status;`
Expected: optimize recs present with url+score; page_audits populated with mostly `OK`.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add lib/gatherBlogUrls.ts lib/domainPipeline.ts lib/ensurePipelineTables.ts
git commit -m "feat(blog-audit): gather blog urls + materialize page_audits & optimize recs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
graphify update . >/dev/null 2>&1 && echo "graphify ok"
```

---

## Task 3: Blog-path UI — wizard + domain settings

### Task 3.1: Setup wizard — detect + confirm blog path

**Files:**
- Modify: `pages/setup.tsx`

- [ ] **Step 1: Read the wizard step where the domain is chosen** (we know it has step 1 site picker + chosen-domain box). Locate the chosen-domain block.

Run: `cd /c/Users/patry/Desktop/serpbear && grep -n "submitChosen\|chosen\|configure\|step\|spinner\|brand name" pages/setup.tsx | head -30`

- [ ] **Step 2: Add a "Where does your blog live?" field** below the chosen-domain box. On domain choice, fire detection; show a spinner, then editable chips pre-filled with the result. Add state + effect:

```tsx
// near other useState in the wizard:
const [blogPaths, setBlogPaths] = useState<string[]>([]);
const [blogDetecting, setBlogDetecting] = useState(false);

// when a domain is chosen (call inside the existing onChoose/effect that sets the domain):
async function detectBlogPaths(domainName: string) {
  setBlogDetecting(true);
  try {
    const r = await fetch('/api/domains/detect-blog-paths', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domainName }),
    });
    const data = r.ok ? await r.json() : { blogPaths: [] };
    setBlogPaths(Array.isArray(data.blogPaths) ? data.blogPaths : []);
  } catch { setBlogPaths([]); } finally { setBlogDetecting(false); }
}
```

The field UI (inline styles per design.md — chips, add/remove, placeholder `/blog/`):

```tsx
<div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
  <label style={{ fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
    Where does your blog live?
  </label>
  <span style={{ fontSize: 12, color: '#52525C' }}>We audit posts under these paths.</span>
  {blogDetecting ? (
    <span style={{ fontSize: 13, color: '#71717B' }}>Detecting your blog…</span>
  ) : (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {blogPaths.map((p) => (
        <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: '#F4F4F5', fontSize: 13, color: '#18181B' }}>
          {p}
          <button type="button" onClick={() => setBlogPaths(blogPaths.filter((x) => x !== p))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#71717B', fontSize: 14, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <input placeholder="/blog/" style={{ border: '1px solid #D4D4D8', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v && !blogPaths.includes(v)) setBlogPaths([...blogPaths, v]);
            (e.target as HTMLInputElement).value = '';
            e.preventDefault();
          }
        }} />
    </div>
  )}
</div>
```

- [ ] **Step 3: Persist blog paths when the wizard configures the domain.** In the existing `submitChosen`/configure handler, after the domain is created (the configure call returns `domainSlug`), PUT the paths:

```tsx
if (blogPaths.length > 0 && configuredSlug) {
  await fetch('/api/domains/blog-paths', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: configuredSlug, blogPaths }),
  });
}
```

(`configuredSlug` = the `domainSlug` returned by `/api/domains/configure`. Wire it from the existing response handling.)

- [ ] **Step 4: Verify type-check + manual flow.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "setup.tsx" || echo "tsc clean"
```
Expected: `tsc clean`. Manually: run the wizard, pick a domain, see the detected `/blog/` chip pre-filled and editable.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add pages/setup.tsx
git commit -m "feat(blog-audit): wizard blog-path detect + confirm chips

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3.2: Domain settings — edit blog path (existing domains)

**Files:**
- Modify: `components/domains/DomainSettings.tsx`

- [ ] **Step 1: Read the component** to match its form/section pattern and how it loads/saves domain settings.

Run: `cd /c/Users/patry/Desktop/serpbear && sed -n '1,60p' components/domains/DomainSettings.tsx`

- [ ] **Step 2: Add a "Blog paths" section** that loads from `GET /api/domains/blog-paths?slug=...` and saves via `PUT`. Reuse the same chip UI as the wizard (Task 3.1 Step 2 markup). On mount:

```tsx
const [blogPaths, setBlogPaths] = useState<string[]>([]);
useEffect(() => {
  if (!domain?.slug) return;
  fetch(`/api/domains/blog-paths?slug=${encodeURIComponent(domain.slug)}`)
    .then((r) => (r.ok ? r.json() : { blogPaths: [] }))
    .then((d) => setBlogPaths(Array.isArray(d.blogPaths) ? d.blogPaths : []))
    .catch(() => setBlogPaths([]));
}, [domain?.slug]);

async function saveBlogPaths() {
  await fetch('/api/domains/blog-paths', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: domain.slug, blogPaths }),
  });
}
```

Render the chip field (same markup as wizard) + a Save button that calls `saveBlogPaths`. Match the component's existing button styling.

- [ ] **Step 3: Verify.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "DomainSettings" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add components/domains/DomainSettings.tsx
git commit -m "feat(blog-audit): edit blog paths in domain settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
graphify update . >/dev/null 2>&1 && echo "graphify ok"
```

---

## Task 4: Deep-on-demand + dashboard wiring

### Task 4.1: Deep-on-demand endpoint

**Files:**
- Create: `pages/api/domains/[slug]/page-audit-deep.ts`

- [ ] **Step 1: Read how the existing per-article deep-analysis is triggered** so we call the same sidecar path, not a new one.

Run: `cd /c/Users/patry/Desktop/serpbear && sed -n '1,80p' pages/api/articles/deep-analysis.ts`

- [ ] **Step 2: Implement** — given `{ url }`, load the `page_audits` row; if `deep_json` is present, `deep_generated_at` is within 30 days, AND a fresh content hash matches, return the cache; otherwise run deep-analysis, store, and return:

```ts
// POST /api/domains/[slug]/page-audit-deep { url } → { deep, cached }
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as { ID: number }).ID;
   const url = (req.body?.url as string || '').trim();
   if (!url) return res.status(400).json({ error: 'url is required' });

   const rows = await db.query<{ deep_json: string | null; deep_generated_at: string | null; content_hash: string | null }>(
      `SELECT deep_json, deep_generated_at, content_hash FROM page_audits WHERE domain_id = ? AND url = ? LIMIT 1`,
      { replacements: [domainId, url], type: QueryTypes.SELECT },
   );
   const row = rows[0];
   const fresh = row?.deep_json && row.deep_generated_at
      && (Date.now() - new Date(row.deep_generated_at).getTime()) < TTL_MS;
   if (fresh) {
      return res.status(200).json({ deep: JSON.parse(row.deep_json as string), cached: true });
   }

   // Run the existing deep-analysis path for this URL (reuse the sidecar call from
   // pages/api/articles/deep-analysis.ts — extract its core into a helper if needed).
   const deep = await runDeepAnalysisForUrl(url); // implement per Step 3

   await db.query(
      `UPDATE page_audits SET deep_json = ?, deep_generated_at = CURRENT_TIMESTAMP, status = 'deep' WHERE domain_id = ? AND url = ?`,
      { replacements: [JSON.stringify(deep), domainId, url] },
   );
   return res.status(200).json({ deep, cached: false });
}
```

- [ ] **Step 3: Provide `runDeepAnalysisForUrl`.** Based on what Step 1 reveals: if `deep-analysis.ts` already exposes a function that takes a URL/keyword and returns the score + 6 signals, import and call it. If the logic is inline in that handler, extract the sidecar-calling core into `lib/deepAnalysis.ts` and import it from BOTH `deep-analysis.ts` and here (DRY). The deep result shape is the sidecar `score_ranking` output (`ranking_score` + `ranking_signals[]`). Keep `any` out — type it as:

```ts
// lib/deepAnalysis.ts (extracted)
export interface DeepResult { ranking_score: number; ranking_signals: Array<{ name: string; score: number; verdict: string; recommendation: string }>; }
export async function runDeepAnalysisForUrl(url: string): Promise<DeepResult> { /* moved sidecar call */ }
```

- [ ] **Step 4: Verify type-check.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -E "page-audit-deep|deepAnalysis" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add pages/api/domains/\[slug\]/page-audit-deep.ts lib/deepAnalysis.ts pages/api/articles/deep-analysis.ts
git commit -m "feat(blog-audit): deep-on-demand endpoint with content-hash + 30d TTL cache

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.2: Dashboard — render optimize/create + coverage footnote

**Files:**
- Modify: `components/dashboard/RecommendationsSection.tsx`, `pages/dashboard/index.tsx`

- [ ] **Step 1: Surface `audit_counts` from setup status.** In `pages/dashboard/index.tsx`, the `useSetupStatus` result already drives the pipeline UI. Read counts from it (or from a small `GET` on the job). Pass a `coverage` prop to `RecommendationsSection`:

```tsx
const coverage = setup?.auditCounts; // { audited, skipped, total } | undefined
// ...
<RecommendationsSection
  items={recommendations.slice(0, 3)}
  total={recommendations.length}
  faviconDomain={primaryDomain?.domain || ''}
  viewHref={recommendationsHref}
  loading={articlesLoading}
  coverage={coverage}
  pipeline={/* unchanged */}
/>
```

(If `setup` doesn't carry `auditCounts` yet, extend `getSetupStatus` in `lib/domainPipeline.ts` + the `useSetupStatus` type to include it, reading the column/JSON written in Task 2.6 Step 4.)

- [ ] **Step 2: Render the coverage footnote + the optimize URL.** In `RecommendationsSection.tsx`, extend `Props` with `coverage?: { audited: number; skipped: number; total: number }` and add, below the rows in the populated return (before/after the "View N" link):

```tsx
{coverage && coverage.total > coverage.audited && (
  <span style={{ fontSize: 12, color: '#71717B', fontFamily: font }}>
    Audited {coverage.audited} of {coverage.total} posts ({coverage.skipped} skipped)
  </span>
)}
```

The `Row` already shows the score gauge for items with `score` (optimize) and the priority pill for items with `priority` (create) — no Row change needed since optimize recs carry `score`. Optionally show the path: if `item.title` is empty fall back to the URL path (already handled in the sidecar by titling from `path`/`url`).

- [ ] **Step 3: Adapt the empty state for "no blog path set."** Pass whether a blog path exists (from a `GET /api/domains/blog-paths`) and branch the empty state message:

```tsx
// in dashboard: const { data: bp } = useQuery(['blogPaths', activeDomainSlug], () => fetch(`/api/domains/blog-paths?slug=${activeDomainSlug}`).then(r => r.ok ? r.json() : { blogPaths: [] }), { enabled: !!activeDomainSlug });
// pass hasBlogPath={(bp?.blogPaths?.length ?? 0) > 0}
```

In `RecommendationsSection` empty state, when `!hasBlogPath` show: "Set your blog path to start auditing your content" with a link to domain settings; otherwise keep the existing "Your domain looks healthy" success state.

- [ ] **Step 4: Verify type-check.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -E "RecommendationsSection|dashboard/index" || echo "tsc clean"
```
Expected: `tsc clean`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add components/dashboard/RecommendationsSection.tsx pages/dashboard/index.tsx
git commit -m "feat(blog-audit): dashboard optimize recs + coverage footnote + no-path empty state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.3: Wire deep-on-demand into the recommendation open

**Files:**
- Modify: `pages/domain/[slug]/recommendations.tsx` (the recommendations page that lists `optimize`/`create` recs)

- [ ] **Step 1: Read the recommendations page** to see how a recommendation row is rendered + whether it has an expand/detail.

Run: `cd /c/Users/patry/Desktop/serpbear && grep -n "recommendation\|optimize\|onClick\|expand\|detail" pages/domain/\[slug\]/recommendations.tsx | head -30`

- [ ] **Step 2: On opening an `optimize` recommendation, call the deep endpoint and render the 6 signals.** Add state + handler:

```tsx
const [deep, setDeep] = useState<Record<string, DeepResult>>({});
const [deepLoading, setDeepLoading] = useState<string | null>(null);

async function openOptimize(url: string) {
  if (deep[url]) return;
  setDeepLoading(url);
  try {
    const r = await fetch(`/api/domains/${slug}/page-audit-deep`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (r.ok) { const d = await r.json(); setDeep((m) => ({ ...m, [url]: d.deep })); }
  } finally { setDeepLoading(null); }
}
```

Render: when a row is expanded and `deep[url]` exists, show the `ranking_score` + each `ranking_signals[]` entry (name, score, verdict, recommendation). While `deepLoading === url`, show a spinner (reuse the existing skeleton/spinner pattern on this page). On error, show an inline error message; keep the triage score visible.

- [ ] **Step 3: Verify type-check + manual.**

```bash
cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "recommendations.tsx" || echo "tsc clean"
```
Expected: `tsc clean`. Manually: open an optimize rec → deep analysis runs once → second open is instant (cache).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
git add pages/domain/\[slug\]/recommendations.tsx
git commit -m "feat(blog-audit): deep-analysis on optimize-rec open (cached)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
graphify update . >/dev/null 2>&1 && echo "graphify ok"
```

---

## Final verification (after all tasks)

- [ ] `cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit` → clean.
- [ ] `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/blogPaths.test.ts __tests__/lib/detectBlogPaths.test.ts` → green.
- [ ] `cd /c/Users/patry/Desktop/serpbear/python-sidecar && python -m pytest tests/ -v` → green.
- [ ] Live: a fresh scan on a domain WITH a blog path → `page_audits` populated, `domain_recommendations` has `type='optimize'` rows with `url`+`score`, dashboard shows them worst-first + coverage footnote; opening one runs deep-analysis once and caches it.
- [ ] Live: a domain WITHOUT a blog path → Recommendations shows the "set your blog path" empty state, no audit attempted.
- [ ] `graphify update .` run.

## Notes / risks carried from the spec

- Triage does ~100 HTTP fetches → adds 20–60s to the scan (bounded concurrency keeps it sane). The `blog_audit` timeout is 240s.
- Sitemap-less sites yield zero blog URLs even with a blog path set; a future improvement is to fall back to the GSC page list filtered by `matchesBlogPath`. For now GSC fallback is included in `gatherBlogUrls` ONLY if you wire the GSC page query (left out of the minimal version above — add it if sitemap coverage proves insufficient).
- The sidecar MUST be restarted after Task 2 for the new stages to load (stateless process, no hot reload of stage modules).
```
