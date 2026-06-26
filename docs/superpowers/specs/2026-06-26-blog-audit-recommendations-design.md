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
  parsing) and read GSC page paths; cluster URLs by first path segment; rank segments by how
  many deep, slug-like children they contain (a segment with many `/<seg>/<long-slug>` URLs
  is a blog). Return the top candidate prefix(es), e.g. `["/blog/"]` or `["/poradnik/"]`.
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

- `domain.blog_paths` — `TEXT` holding a JSON array of path prefixes (e.g. `["/blog/"]`).
  Added idempotently in `ensureTenancyTables`/domain bootstrap (consistent with existing
  `ALTER TABLE … ADD COLUMN` patterns), nullable, default null.
- New table **`page_audits`** (added in `lib/ensurePipelineTables.ts`):
  - `id` PK, `domain_id` (FK to domain), `url` TEXT, `score` INT,
    `signals_json` TEXT, `status` TEXT (`'triaged'` | `'deep'`),
    `deep_json` TEXT NULL, `audited_at` timestamp.
  - Triage writes `score` + `signals_json` + `status='triaged'`; deep-on-demand writes
    `deep_json` + `status='deep'`.
  - Re-scan is delete-first per domain (mirrors the existing materialize-on-done pattern),
    no `ON CONFLICT`.
- `domain_recommendations` gains nullable **`url`** TEXT and **`score`** INT columns
  (the `type` column already exists). Idempotent `ALTER TABLE` in `ensurePipelineTables`.

## Triage scoring (no LLM)

Reuse the existing rule engine — `lib/contentScore.ts` (Node) and the Python
`_compute_rule_base` (mirrors `contentScore.ts`). Per blog post, a lightweight HTML fetch
extracts: word count, heading structure/count, title + meta presence and lengths,
paragraph count, image-alt coverage, internal link count. The rule engine maps these to a
0–100 score. No SERP scrape, no LLM.

Budget/limits:
- Bounded concurrency (~8 parallel fetches).
- The scan audits up to **N = 100** blog posts; if more exist, it **logs** the count
  dropped (no silent truncation, per design.md). Deep-on-demand and re-scans cover the rest.
- Per-fetch timeout; a failed/blocked fetch is recorded as skipped (not scored), not fatal
  to the stage.

## Deep-on-demand

When the user opens an `optimize` recommendation (or the corresponding page audit), Node
calls the existing `deep-analysis` path (sidecar `score_ranking` hybrid). The result —
final score + the 6-signal rubric (meta_quality, content_depth, eeat, freshness, technical,
competitiveness) with per-signal recommendations — is stored in `page_audits.deep_json` and
shown in the recommendation detail. Cached: a second open reads `deep_json` without a new
LLM call (until the next scan invalidates it).

## Dashboard / UI

- Recommendations section lists `optimize` recs first (URL + score gauge + "Optimize" label,
  reusing the existing score-gauge `Row`), then `create` recs (priority pill `Row`). The
  item shape already supports both (`score?` vs `priority?`).
- Empty-state messaging adapts:
  - no `blog_paths` set → "Set your blog path to start auditing your content" + link to
    domain settings.
  - blog path set, nothing under 70 → the existing "Your domain looks healthy" success state.

## Error handling

- Detection endpoint failure → wizard field falls back to empty + placeholder; never blocks
  setup completion.
- blog_audit stage: individual fetch failures are skipped and counted; the stage succeeds
  with whatever it audited. A total fetch failure (0 posts) still completes the stage
  (recommendations may then be `create`-only).
- deep-on-demand failure surfaces an inline error in the recommendation detail; the triage
  score remains shown.

## Out of scope (YAGNI)

- Configurable score threshold (hardcoded `< 70`).
- Auditing non-blog page types.
- Scheduled re-audits (re-audit happens on manual re-scan only).
- Per-post historical score tracking.

## Decomposition (for the implementation plan)

- **T1 — schema & detection backend:** `domain.blog_paths`, `page_audits` table,
  `domain_recommendations.url/score`, `detect-blog-paths` endpoint + URL-clustering helper.
- **T2 — sidecar blog_audit stage:** crawl/filter/fetch/triage, persist `page_audits`;
  rewrite `recommendations` stage to emit `optimize` + `create`.
- **T3 — wizard + domain-settings blog-path UI:** detection call, pre-filled editable chips,
  persistence.
- **T4 — deep-on-demand + dashboard wiring:** deep-analysis trigger on rec open + caching,
  Recommendations section optimize/create rendering + adaptive empty-states.
