# P3d — Blog-audit recommendations (design)

**Status:** approved (2026-06-26)
**Supersedes:** the LLM-only behavior of `RecommendationsStage` from P3c.

## Goal

The domain setup scan should crawl the site, **audit the blog posts**, and surface the
weak ones (content score **< 70**) as actionable "Optimize" recommendations — instead of
only inventing content ideas with an LLM. Non-blog pages (landing, product, contact) are
ignored. A few LLM "Create" ideas are kept alongside the audit results.

## Why

Today `RecommendationsStage` makes a single LLM call over topics + competitors and emits
generic content *ideas*. The user expects the Recommendations section to reflect **the
actual state of their existing content**: which published blog posts are underperforming
and need work. That is a page-level content audit, which the pipeline does not currently do.

## Decisions (from brainstorming)

1. **Blog discovery:** auto-detect blog path(s) + user confirm (hybrid). Not fully manual,
   not fully automatic.
2. **Scoring:** cheap rule-based triage for every blog post during the scan (no per-page
   LLM); full hybrid deep-analysis runs **on demand** when a recommendation is opened.
3. **Recs model:** augment — keep both `optimize` (audited posts < 70) and `create`
   (LLM ideas) recommendations, tagged by `type`.

## Architecture

New sidecar pipeline shape:

```
keywords → topics → competitors → blog_audit (NEW) → recommendations (REWRITTEN)
```

- **blog_audit (new stage):** gather all URLs (sitemap + GSC pages), keep only those whose
  path starts with a confirmed blog prefix, fetch each post with bounded concurrency,
  compute the rule-based content score (no LLM), persist one `page_audits` row per post.
- **recommendations (rewritten stage):** emits into `domain_recommendations`:
  - `type='optimize'` — each audited post with `score < 70`, worst-first, carrying `url` + `score`.
  - `type='create'` — the existing LLM topic/competitor ideas (kept, but secondary).
- **deep-on-demand (Node):** opening an `optimize` recommendation triggers the existing
  full `deep-analysis` (LLM hybrid 0.7·rule + 0.3·LLM + 6-signal breakdown), result cached
  in `page_audits.deep_json`. The scan never calls the LLM per page.

## Blog-path detection + confirm (hybrid)

- **Detection** (new endpoint, e.g. `POST /api/domains/detect-blog-paths` taking the domain
  + GSC site): crawl the sitemap (reuse `pages/api/articles/fetch-site-links.ts` sitemap
  parsing) and read GSC page paths; cluster URLs by path segment; rank candidate segments by
  a **weighted signal score**, not just slug length, to cut false positives (`/produkty/`,
  `/features/`, `/integrations/`, `/docs/` also have long slugs but are not blogs). Signals
  per candidate segment, summed into a score:
  - child count — how many `/<seg>/<slug>` URLs it has (+, primary),
  - average slug length — longer, hyphenated slugs read as articles (+),
  - URL depth — typical post depth (a `/blog/<slug>` flat structure vs deep nesting) (+),
  - date share — fraction of children whose path contains a year/`YYYY/MM` date (+),
  - **known-blog-segment bonus** — segment name in {`blog`, `news`, `articles`, `article`,
    `posts`, `poradnik`, `academy`, `knowledge`, `insights`} (+),
  - on a small sample of child pages: JSON-LD `Article`/`BlogPosting` schema, `datePublished`,
    an `author`, a `<article>` element, or an RSS `<link rel="alternate">` (each +). A
    segment with article signals beats a segment with only long slugs.
  Return the top candidate prefix(es), e.g. `["/blog/"]` or `["/poradnik/"]`. Sampling is
  bounded (a few child fetches per candidate) so detection stays fast.
- **Prefix shape:** stored prefixes are **normalized** so a locale/category wrapper still
  matches — e.g. `/en/blog/`, `/pl/blog/`, `/category/blog/` all resolve to the blog
  segment `blog`. Matching is segment-aware: a URL is a blog post if any of its path
  segments equals a configured blog segment (not a naive `startsWith`). `blog_paths` stays a
  JSON array so multiple blogs (`["/blog/", "/poradnik/"]`) are supported. Regex is **not**
  exposed to users (YAGNI); the segment-match rule covers the locale/category cases.
- **Confirm UI:** in the **setup wizard**, after domain selection, show a
  **"Where does your blog live?"** field pre-filled with detected prefix(es), editable as
  chips (add/remove). Loading spinner while detecting (mirrors the brand-name fetch UX).
- **Persistence:** `domain.blog_paths` (JSON array of prefixes). Also editable later via a
  **domain-settings** field, so already-created domains (e.g. `idztech.pl`, which never saw
  this wizard step) can set/fix it.
- **Fallback:** detection finds nothing → field empty with placeholder `/blog/` + hint. The
  scan audits nothing until a path is set; the Recommendations empty-state instructs the
  user to set a blog path.

## Data model

- `domain.blog_paths` — `TEXT` holding a JSON array of path segments (e.g. `["blog"]`).
  Added idempotently in `ensureTenancyTables`/domain bootstrap (consistent with existing
  `ALTER TABLE … ADD COLUMN` patterns). **Default `'[]'`, not null** — so every read is an
  unconditional `JSON.parse(blog_paths)` with no `if (blog_paths)` guard.
- New table **`page_audits`** (added in `lib/ensurePipelineTables.ts`):
  - `id` PK, `domain_id` (FK to domain), `url` TEXT, **`path`** TEXT, **`title`** TEXT,
    `score` INT, **`word_count`** INT, `signals_json` TEXT,
    **`fetch_status`** TEXT (`'OK'` | `'TIMEOUT'` | `'HTTP_403'` | `'HTTP_404'` |
    `'BLOCKED'` | `'ERROR'`), **`content_hash`** TEXT (hash of the fetched main content),
    **`duration_ms`** INT (fetch time),
    `status` TEXT — **open vocabulary**, currently `'triaged'` | `'deep'`, reserved for
    future `'queued'` | `'failed'` | `'outdated'` (stored as plain text, no DB enum, so new
    states need no migration), `deep_json` TEXT NULL,
    **`deep_content_hash`** TEXT NULL (the `content_hash` the cached `deep_json` was built
    against), **`deep_generated_at`** timestamp NULL, **`last_audited_at`** timestamp.
  - `path` + `title` + `word_count` are captured during triage so the dashboard renders a
    row ("Score 54 · 650 words · How to Start Investing") without ever re-fetching HTML.
  - Triage writes `path`+`title`+`score`+`word_count`+`signals_json`+`fetch_status`
    +`content_hash`+`duration_ms`+`status='triaged'`. Deep-on-demand writes `deep_json`
    +`deep_content_hash`+`deep_generated_at`+`status='deep'`.
  - `fetch_status` + `duration_ms` make skips explainable and surface slow pages.
  - **Re-scan sync (preserves deep_json):** the audit is NOT delete-all. Inside **one
    transaction**, for each freshly-audited post: `UPDATE` the triage columns of the
    matching `(domain_id, url)` row — **keeping `deep_json`/`deep_content_hash`/
    `deep_generated_at`/`status`** — or `INSERT` if the URL is new; then `DELETE` only the
    rows whose URL no longer appears. No `ON CONFLICT` (SELECT-existing → UPDATE/INSERT →
    delete-missing). Effect: an expensive deep analysis a user paid for survives every later
    scan **as long as the post still exists**; it self-invalidates only when its content
    changes (see deep-cache below) or after the TTL. Single transaction ⇒ no empty-flicker.
- `domain_recommendations` gains nullable **`url`** TEXT and **`score`** INT columns
  (the `type` column already exists). Idempotent `ALTER TABLE` in `ensurePipelineTables`.
  Unlike `page_audits`, recommendations ARE regenerated delete-first each scan — they are
  cheap **immutable snapshots**: `score`/`url` are copied from `page_audits` at scan time,
  not joined live, so a recommendation never changes mid-browse.

## Triage scoring (no LLM)

Reuse the existing rule engine — `lib/contentScore.ts` (Node) and the Python
`_compute_rule_base` (mirrors `contentScore.ts`). Per blog post, a lightweight HTML fetch
extracts: word count, heading structure/count, title + meta presence and lengths,
paragraph count, image-alt coverage, internal link count. The rule engine maps these to a
0–100 score. No SERP scrape, no LLM.

The threshold is a named constant, not a magic number:
`const OPTIMIZE_THRESHOLD = 70` (Node) / `OPTIMIZE_THRESHOLD = 70` (Python).

Budget/limits:
- Bounded concurrency (~8 parallel fetches).
- The scan audits up to **N = 100** blog posts. It records three counts —
  **`audited` / `skipped` / `total`** — in the stage/job state and the dashboard shows them
  ("100 of 174 audited, 74 skipped"), so the user knows why not every post appears (no
  silent truncation, per design.md). Deep-on-demand and re-scans cover the rest.
- Per-fetch timeout; a failed/blocked fetch is recorded with its `fetch_status` (and counted
  as `skipped`), not fatal to the stage.

## Deep-on-demand

When the user opens an `optimize` recommendation (or the corresponding page audit), Node
calls the existing `deep-analysis` path (sidecar `score_ranking` hybrid). The result —
final score + the 6-signal rubric (meta_quality, content_depth, eeat, freshness, technical,
competitiveness) with per-signal recommendations — is stored in `page_audits.deep_json` +
`deep_generated_at` and shown in the recommendation detail.

**Cache validity** — a cached `deep_json` is reused only when it is still fresh, checked
with **no extra fetch**:
- `deep_content_hash === content_hash` — the latest triage hash equals the hash the deep
  analysis was built against. A re-scan recomputes `content_hash`; if the post changed, the
  two diverge and the cache is stale. **and**
- `deep_generated_at` is within the TTL (**30 days**) — covers SERP drift over time.
Otherwise the deep analysis re-runs and overwrites `deep_json` + `deep_content_hash` +
`deep_generated_at`. Because re-scan sync keeps these columns, a user's deep analysis stays
valid across scans until the post's content actually changes.

## Dashboard / UI

- Recommendations are shown as **two visually distinct sub-sections**, not one mixed list:
  - **"Needs optimization"** — `optimize` recs: title + score gauge + `word_count`
    ("Score 48 · 650 words · How to Start Investing"), worst-first. Reuses the score-gauge `Row`.
  - **"Create new content"** — `create` recs: title + priority pill ("Priority High").
    Reuses the priority-pill `Row`.
  Each sub-section has its own small header; either is hidden when it has no items. The item
  shape already supports both (`score?`/`word_count?` vs `priority?`).
- Empty-state messaging adapts:
  - no `blog_paths` set → "Set your blog path to start auditing your content" + link to
    domain settings.
  - blog path set, nothing under 70 → the existing "Your domain looks healthy" success state.
- A small footnote line shows the audit coverage from the stage counts:
  "Audited 100 of 174 posts (74 skipped)" so partial coverage is visible, not silent.

## Error handling

- Detection endpoint failure → wizard field falls back to empty + placeholder; never blocks
  setup completion.
- blog_audit stage: individual fetch failures are skipped and counted; the stage succeeds
  with whatever it audited. A total fetch failure (0 posts) still completes the stage
  (recommendations may then be `create`-only).
- deep-on-demand failure surfaces an inline error in the recommendation detail; the triage
  score remains shown.

## Out of scope (YAGNI)

- Configurable score threshold (fixed `OPTIMIZE_THRESHOLD = 70`; named constant, not a UI setting).
- User-facing regex for blog paths (segment-match + normalization covers the real cases).
- Auditing non-blog page types.
- Scheduled re-audits (re-audit happens on manual re-scan only; deep cache has a 30-day TTL).
- Per-post historical score tracking (trend lines over time).

## Decomposition (for the implementation plan)

- **T1 — schema & detection backend:** `domain.blog_paths` (default `'[]'`), full
  `page_audits` table (path/title/word_count/fetch_status/content_hash/duration_ms/
  deep_content_hash/deep_generated_at/last_audited_at), nullable
  `domain_recommendations.url/score`, `detect-blog-paths` endpoint with the signal-weighted
  URL-clustering helper (child count + slug length + depth + date share + known-segment bonus
  + Article/`datePublished`/`<article>`/RSS sampling) and prefix normalization + segment-match
  matcher.
- **T2 — sidecar blog_audit stage:** crawl + segment-match filter + bounded-concurrency fetch
  + rule-based triage (`OPTIMIZE_THRESHOLD`), capture path/title/word_count/content_hash/
  fetch_status/duration_ms, persist `page_audits` via single-transaction **UPSERT-sync**
  (UPDATE/INSERT by (domain_id,url), delete-missing, keep deep columns), emit
  audited/skipped/total counts; rewrite `recommendations` stage to emit immutable `optimize`
  (from audits <70) + `create` (LLM) snapshots, delete-first.
- **T3 — wizard + domain-settings blog-path UI:** detection call, pre-filled editable chips,
  persistence to `domain.blog_paths`.
- **T4 — deep-on-demand + dashboard wiring:** deep-analysis trigger on rec open with
  `deep_content_hash == content_hash` + 30-day-TTL cache validation (no extra fetch),
  Recommendations split into "Needs optimization" + "Create new content" sub-sections,
  adaptive empty-states, and the "audited X of Y" coverage footnote.
