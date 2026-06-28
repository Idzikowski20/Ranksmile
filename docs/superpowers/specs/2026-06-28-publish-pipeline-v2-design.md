# Package B — Publish Pipeline v2 (app → WordPress)

**Goal:** Make content published from the app to WordPress more robust and SEO-effective: self-host generated images, ensure clean Gutenberg blocks, sync SEO meta to the active SEO plugin (Yoast/RankMath/AIOSEO), log optimize/publish before-after, and (optionally) carry ACF fields.

**Status:** Design 2026-06-28. Package B of a 2-package split (Package A = GSC weekly drop digest). Implement after Package A. Several sub-features are independent — the plan can phase them.

---

## 1. Context from the 3 analyzed plugins

BabyLoveGrowth / RankPill / Soro are all one-way publishers. Reusable, proven patterns:
- **Sideload images to the media library** (never hotlink) + set `_wp_attachment_image_alt` — all three.
- **MIME fallback chain** (finfo → URL ext → magic bytes) for hosts without fileinfo — Soro.
- **Write SEO meta to Yoast + RankMath + AIOSEO simultaneously, no detection** — all three (simpler than detecting; each plugin reads only its own keys).
- **Rebuild the Yoast indexable** right after insert so the SEO score is fresh — Soro.
- **Idempotency via external id; slug conflict → save as draft** — Soro.
- **IndexNow** (instant Bing indexing) — Soro (optional bonus).

Our fork is already ahead on one axis: it has Gutenberg/Classic/Elementor parsers and we defaulted to the **Gutenberg parser**, so `import_post` already converts our HTML → blocks and sideloads in-content images. Package B builds on that.

---

## 2. Sub-features & decisions

### B1 — Self-host generated images (app-side R2) — **highest value**
**Problem:** auto-optimize inserts Pollinations image URLs (external, ephemeral, slow, weak SEO).
**Decision:** when an image is generated, fetch the bytes and upload to **R2** via the existing `lib/uploadToBlob.ts` `uploadImageBuffer(buffer, contentType, prefix, bucket)`, then replace the Pollinations URL in the article HTML with the R2 URL and persist an alt (from the surrounding heading / keyword). Async, off the critical path (image generation already moved off it). On publish, the plugin still sideloads the (now stable R2) URL into the WP media library — so the final post is fully self-hosted in WP too.
**Files:** the auto-optimize image step (sidecar/Node), `lib/uploadToBlob.ts` (reuse), article content writer.
**Out of scope:** retro-migrating already-published external URLs.

### B2 — Gutenberg blocks integrity — **mostly already done**
**State:** plugin default parser = Gutenberg (`Parsers_Controller::GUTENBERG`); `lib/wpContentClean.ts` already normalizes our HTML for clean conversion (lifts imgs out of p/li, unwraps wrappers, strips unsupported attrs).
**Decision:** verify + harden the HTML→block mapping rather than build a second converter. Add coverage for tables, blockquotes, `<pre>`/code, ordered/unordered nesting, and figures/captions; add fixtures asserting the cleaned HTML round-trips through the plugin's supported-tag set. No new app-side block serializer unless gaps are found.
**Files:** `lib/wpContentClean.ts` (+ tests), plugin Gutenberg parser (only if a tag is mishandled).

### B3 — SEO meta sync to the active SEO plugin (plugin-side)
**Problem:** today `import_post` sets the post + (some) AIOSEO meta; Yoast/RankMath title/description/focus-kw aren't fully populated.
**Decision (follow the 3 plugins):** in `save_data_into_database`/`resolve_post_meta_details`, write meta to **all three** key-sets from our payload (`postMetaTitle`, `postMetaDescription`, `keywords[0]` as focus keyword):
- Yoast: `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw`
- RankMath: `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`
- AIOSEO: `_aioseo_title`, `_aioseo_description` (+ existing handling)
Plus **rebuild the Yoast indexable** after insert (Soro's two-path approach: DI container for Yoast ≥14, else fire `wpseo_save_indexable`).
**Files:** `wordpress-plugin/includes/surfer/class-content-importer.php` (or wherever post meta is resolved). No app-side change (payload already carries meta_title/description/keywords).

### B4 — Optimize/publish before-after logger (app-side)
**Problem:** no record of what auto-optimize changed; hard to debug "it made it worse".
**Decision:** persist a compact log per auto-optimize run: `article_id, kind ('auto-optimize'|'publish'), before_excerpt, after_excerpt, before_score, after_score, meta (json), created_at`. Store full before/after content only when small, else a hash + first N chars (avoid bloat). Surface a minimal "Optimize history" entry (reuse VersionHistory UI patterns if cheap; otherwise API-only in v1). The plugin already logs imports server-side (`get_surfer_logger()->log_import`) — this is the **app-side** equivalent for optimize.
**Files:** new `lib/optimizeLog.ts` + table (idempotent ensure), hook in `pages/api/articles/auto-optimize.ts` and `pages/api/wordpress/publish.ts`.

### B5 — ACF export/import (optional, last)
**Decision:** only if target users use Advanced Custom Fields. ACF fields are plain postmeta under the hood. Add an optional `custom_fields` map to the publish payload (the plugin's `import_post` already reads `custom_fields` / `normalize_custom_fields_for_import`). App-side: a per-domain "ACF field mapping" config (article field → ACF key). Defer until there's a concrete user need; spec'd here only as a known extension point.

---

## 3. Suggested phasing (independent sub-features)
1. **B1 self-host images** (app-side, highest ROI, no plugin reinstall).
2. **B3 SEO meta sync** (plugin-side; bundles with a plugin release).
3. **B4 optimize logger** (app-side, aids debugging the rest).
4. **B2 blocks hardening** (tests-first; only touch code where fixtures fail).
5. **B5 ACF** (deferred until needed).

Each phase is independently shippable and testable.

## 4. Error handling
- B1: image fetch/upload failure → keep the original URL, log, never block publishing.
- B3: writing unused meta keys is harmless (inactive plugins ignore them); indexable rebuild wrapped in try/catch.
- B4: logging is best-effort (`.catch(() => {})`), never fails the optimize/publish.

## 5. Testing
- B1: unit-test the URL-replace + alt assignment on sample HTML; integration via a scratch script that generates → uploads to R2 → asserts URL swapped.
- B2: fixture HTML → `cleanHtmlForWordPress` → assert supported-tag-only output (tables/lists/quotes/code/figure).
- B3: PHP smoke (manual on a Yoast + a RankMath site) — verify meta + indexable rebuild.
- B4: assert a log row is written on optimize/publish with before/after fields.

## 6. File map (by phase)
- B1: auto-optimize image step, `lib/uploadToBlob.ts` (reuse), article writer.
- B2: `lib/wpContentClean.ts` + tests; plugin Gutenberg parser (conditional).
- B3: `wordpress-plugin/includes/surfer/class-content-importer.php`; release zip.
- B4: `lib/optimizeLog.ts` + ensure-table; `pages/api/articles/auto-optimize.ts`; `pages/api/wordpress/publish.ts`.
- B5: publish payload `custom_fields`; per-domain ACF mapping config (deferred).
