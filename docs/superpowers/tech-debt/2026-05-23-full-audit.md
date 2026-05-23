# Project Tech Debt Audit — Full Report
**Date:** 2026-05-23  
**Scope:** Dashboard, Content Writer (Articles + Editor), Sites, Site Configurator, Performance, Recommendations, Deep Analysis (import / create / GSC flow)  
**Baseline comparison:** SurferSEO feature set

---

## Scoring Key

**Priority = (Impact + Risk) × (6 − Effort)**  
Impact 1–5 (slowdown / user-facing pain), Risk 1–5 (what breaks if ignored), Effort 1–5 (1 = trivial, 5 = major refactor)

---

## 🔴 CRITICAL BUGS — broken systems

### B-1 · `deep-analysis.tsx` STEPS array missing `ai_visibility`
**File:** `pages/articles/deep-analysis.tsx` lines 9–18  
**What:** The API (`/api/articles/deep-analysis.ts`) emits SSE progress events with `step: 'ai_visibility'`. The frontend `STEPS` array has exactly 8 steps; `ai_visibility` is not one of them. The progress bar never shows the AI Visibility step — it appears stuck, and the `completedCount / STEPS.length` percentage calculation is permanently off by one step.  
**Fix:** Add `{ key: 'ai_visibility', label: 'Checking AI Search visibility' }` to the STEPS array.  
**Effort:** 1 · **Impact:** 4 · **Risk:** 3 → **Priority: 35**

---

### B-2 · `onFeaturedImageChange` prop never called
**File:** `components/articles/ArticleEditor.tsx`  
**What:** The component accepts `onFeaturedImageChange?: (img) => void` as a prop. But every place inside the file that mutates featured image calls `setFeaturedImage(...)` without calling `onFeaturedImageChange?.(img)`. The parent page (`pages/articles/[id]/index.tsx`) passes this prop — so the parent's state for `featuredImage` never syncs when the image changes inside the editor. Featured image save will silently use stale parent state.  
**Fix:** Create `updateFeaturedImage` helper that calls both. Tracked in impl plan Task 9.  
**Effort:** 1 · **Impact:** 4 · **Risk:** 4 → **Priority: 42**

---

### B-3 · Dashboard "Learn" section links to SurferSEO content
**File:** `pages/dashboard/index.tsx` lines 162–191  
**What:** `learnCards` array is hardcoded with 4 SurferSEO blog posts and YouTube links (`surferseo.art`, `surferseo.com`). This is a white-label confusion bug — users see "What's new at Surfer? April 2026" on their own tool's dashboard.  
**Fix:** Replace with your own content / empty state / generic placeholder, or remove the Learn section entirely.  
**Effort:** 1 · **Impact:** 5 · **Risk:** 5 → **Priority: 50** ← highest priority bug

---

### B-4 · `analyze-batch` fires parallel deep-analyses with no concurrency control
**File:** `pages/api/articles/analyze-batch.ts` lines 48–69  
**What:** On site configuration, `analyze-batch` fires one HTTP deep-analysis request per page simultaneously, all without awaiting. Each deep-analysis call hits the Python sidecar for SERP analysis. With 20+ pages, this spawns 20+ parallel sidecar connections, which will silently fail or time out. There is no queue, no retry, no concurrency limit.  
**Fix:** Add sequential processing or a semaphore-style concurrency limit (e.g. max 3 parallel). Or use a proper job queue.  
**Effort:** 2 · **Impact:** 4 · **Risk:** 4 → **Priority: 40**

---

### B-5 · `pages/api/searchconsole.ts` (old API) still called by 3 pages
**Files:**  
- `pages/sites/[domain]/content-audit.tsx:75` — `fetch('/api/searchconsole?domain=...')`  
- `pages/sites/[domain]/performance.tsx:1101, 1110` — same  
- `pages/sites/[domain]/recommendations.tsx:741` — same  

**What:** The new GSC architecture lives under `pages/api/gsc/` (accounts, callback, connect, pages). But three pages still call the old `api/searchconsole.ts` route, which has a completely separate auth code path. Any future auth refactor to the new `gsc/` folder will silently break these three pages.  
**Fix:** Migrate these three callers to the appropriate `gsc/` endpoints.  
**Effort:** 2 · **Impact:** 3 · **Risk:** 4 → **Priority: 35**

---

## 🟡 DEAD CODE — delete immediately

### D-1 · `components/articles/OutlinePanel.tsx` — never imported
**Confirmed:** `grep -r "OutlinePanel" pages components` returns zero production imports.  
**What:** Old outline sidebar (Tailwind dark-theme design, pre-redesign). All functionality superseded by `ResearchOutlinePanel.tsx`.  
**Action:** Delete file.  
**Effort:** 1 · **Impact:** 1 · **Risk:** 1 → clean up

---

### D-2 · `components/common/TopBar.tsx` — never imported in production
**Confirmed:** Only import is `__tests__/components/Topbar.test.tsx`.  
**What:** Old topbar with mobile menu using `authClient.signOut()`. Replaced by `GlobalTopbar.tsx`.  
**Action:** Delete file. Update or delete the test.  
**Effort:** 1 · **Impact:** 1 · **Risk:** 1 → clean up

---

### D-3 · `pages/api/test-r2.ts` — self-described dead file
**File content comment:** "DELETE THIS FILE after confirming R2 works."  
**Action:** Delete file.  
**Effort:** 1 · **Impact:** 1 · **Risk:** 1 → clean up

---

### D-4 · `pages/sites/[domain]/index.tsx` — redirect-only dead page
**What:** Page immediately calls `router.replace('/sites/${domain}/performance')`. Has 15+ component imports (KeywordsTable, AddKeywords, DomainHeader, Footer, etc.) that are all dead weight since the component renders nothing except the redirect.  
**Action:** Replace entire file with a single `export { default as getServerSideProps }` redirect, or keep only the router.replace + null return.  
**Effort:** 1 · **Impact:** 1 · **Risk:** 1 → clean up

---

### D-5 · `pages/sites/[domain]/topical-map.tsx` — "Coming soon" stub
**What:** 100-line file that renders the AppShell + nav + a centered "Coming soon" message. No logic.  
**Action:** Keep if the feature is planned; otherwise delete and remove the nav link.  
**Effort:** 1 · **Impact:** 2 · **Risk:** 1 → evaluate

---

## 🟠 DUPLICATE CODE — DRY violations

### DUP-1 · `countOccurrences()` — 4 copies of the same function
**Canonical:** `lib/contentScore.ts` (exported)  
**Copies:**
- `pages/api/articles/ask-surfy.ts` — local inline copy
- `pages/api/articles/deep-analysis.ts` — local inline copy  
- `pages/api/articles/import.ts` line 122 — local inline copy

**Fix:** Delete the 3 local copies, import from `lib/contentScore`.  
**Effort:** 1 · **Impact:** 2 · **Risk:** 3 (diverging implementations) → **Priority: 25**

---

### DUP-2 · `ScoreGauge` — 4–5 versions of the same component
**Canonical:** `components/articles/ScoreGauge.tsx`  
**Copies:**
- `components/articles/ArticleList.tsx:56` — inline `ScoreGauge`
- `pages/dashboard/index.tsx:68` — inline `ScoreGauge`
- `components/articles/ResearchOutlinePanel.tsx:55` — `MiniGauge` (different shape: semi-circle, but same purpose)
- `pages/sites/[domain]/recommendations.tsx:54` — `GaugeArc` (half-circle variant)

**Fix:** Canonical `ScoreGauge` already supports `compact` prop. For half-circle variants, add a `variant="arc"` prop to canonical, then replace all inline copies.  
**Effort:** 2 · **Impact:** 2 · **Risk:** 2 → **Priority: 16**

---

### DUP-3 · `fetchPlain` / `fetchWithHttp` — HTTP fetch helper duplicated 3×
**Copies:**
- `pages/api/articles/auto-optimize.ts` lines 22–44 — `fetchPlain` (Playwright-less version, no retry)
- `pages/api/articles/deep-analysis.ts` lines ~22 — `fetchPlain` (similar)
- `pages/api/articles/import.ts` lines 13–120 — `fetchWithHttp` (longer, includes Puppeteer bypass + retries)

**Fix:** Move the canonical version (import.ts has the most complete one) to `lib/fetchPage.ts`, export it, import in all three files.  
**Effort:** 2 · **Impact:** 2 · **Risk:** 3 (bug in one doesn't fix others) → **Priority: 25**

---

### DUP-4 · `relativeTime` / `timeAgo` / `formatRelativeDate` — 3+ time formatters
**Copies:**
- `pages/dashboard/index.tsx` — `formatRelativeDate()`
- `pages/sites/[domain]/recommendations.tsx` — `timeAgo()`  
- `pages/sites/[domain]/activity-log.tsx` — `relativeTime()`

**Fix:** Consolidate into `lib/formatDate.ts`.  
**Effort:** 1 · **Impact:** 1 · **Risk:** 1 → quick win

---

## 🏗️ GOD FILES — architectural debt

### G-1 · `pages/sites/[domain]/performance.tsx` — 2,789 lines
**Contains:** GSC data fetching, keyword position chart, filter/sort logic, content score table, query table, all chart rendering, all filter dropdowns, page-level modals — all in one component.  
**Impact:** Impossible to modify without risking unrelated regressions. Takes ~5 seconds to open in editor. Every change touches 1000+ lines of context.  
**Proposed split:**
- `components/performance/KeywordChart.tsx` — position chart
- `components/performance/QueryTable.tsx` — query table + filters
- `components/performance/PageTable.tsx` — pages table
- `hooks/usePerformanceData.ts` — all data fetching + transformation
**Effort:** 4 · **Impact:** 5 · **Risk:** 3 → **Priority: 25** (high effort but high payoff)

---

### G-2 · `pages/sites/[domain]/recommendations.tsx` — 1,360 lines
**Contains:** GaugeArc, DeltaDown, SortUpDown, SkeletonRows, filtering, keyword modal, keyword update logic, fetchArticle content scoring — all inline.  
**Impact:** Inline `GaugeArc` at line 54 is a 4th copy of ScoreGauge. Inline `timeAgo` is a 3rd copy. Every recommendation-table change has to navigate 1,300 lines.  
**Proposed split:**
- `components/recommendations/RecommendationTable.tsx`
- `components/recommendations/KeywordEditModal.tsx`
- `hooks/useRecommendations.ts`
**Effort:** 3 · **Impact:** 3 · **Risk:** 2 → **Priority: 18**

---

### G-3 · `pages/articles/[id]/index.tsx` — 1,279 lines
**What:** The article editor page handles: article loading, save logic, accept/reject, auto-optimize SSE streaming, internal links insertion (ProseMirror position mapping 130+ lines), image generation polling, Pixabay modal wiring, AI visibility, score computation. All in one component.  
**Impact:** `handleInsertLinks` alone is ~120 lines of complex ProseMirror position math. Very hard to test. Any panel refactor risks the entire editor.  
**Proposed split:**
- `hooks/useArticleSave.ts`
- `hooks/useAutoOptimize.ts`
- `hooks/useInternalLinkInsertion.ts` (the ProseMirror logic)
- `hooks/useImageGeneration.ts`
**Effort:** 4 · **Impact:** 4 · **Risk:** 3 → **Priority: 21**

---

## 🧩 ARCHITECTURE ISSUES

### A-1 · Dual GSC auth paths — `api/searchconsole.ts` vs `api/gsc/`
**What:** Two separate, parallel GSC authentication code paths. `api/searchconsole.ts` (95 lines, old) vs the new `api/gsc/accounts.ts`, `gsc/callback.ts`, `gsc/connect.ts`, `gsc/pages.ts`. Three pages still call the old path (see B-5). The old `api/sites.ts` also does GSC site listing independently.  
**Risk:** Any credential rotation or OAuth token refresh fix applied to the new path will leave the old path broken. Auth bugs will manifest on Performance, Recommendations, Content Audit pages only.  
**Fix:** Migrate old callers (3 pages) to the new `gsc/` endpoints, then delete `api/searchconsole.ts`.  
**Effort:** 2 · **Impact:** 3 · **Risk:** 4 → **Priority: 35**

---

### A-2 · Inconsistent shell: 5 pages still use legacy `DomainHeader` + `Footer`
**Files using legacy shell:**
- `pages/sites/[domain]/audit.tsx`
- `pages/sites/[domain]/console.tsx`
- `pages/sites/[domain]/ideas.tsx`
- `pages/sites/[domain]/insight.tsx`
- `pages/sites/[domain]/index.tsx`

**What:** New pages use `AppShell` + `DomainSubLayout` (dark sidebar + content area). Old pages use `DomainHeader` + `Footer` (old light Tailwind header). Users see visually different shells depending on which sub-page they navigate to.  
**Fix:** Migrate the 5 old pages to the `AppShell` + `DomainSubLayout` pattern.  
**Effort:** 2 · **Impact:** 3 · **Risk:** 2 → **Priority: 25**

---

### A-3 · `configure.tsx` uses `DashboardLayout` instead of `AppShell`
**File:** `pages/sites/configure.tsx`  
**What:** Site configuration is a one-time-wizard-style flow, but it uses `DashboardLayout` (the dashboard/articles shell) instead of `AppShell` (the full site shell). This makes it look like an article page rather than a sites tool.  
**Fix:** Migrate to `AppShell` or a dedicated wizard layout.  
**Effort:** 1 · **Impact:** 2 · **Risk:** 1 → low priority

---

### A-4 · `pages/api/articles/backfill.ts` — unclear role
**What:** File exists but wasn't audited in depth. Likely a migration script masquerading as an API route. Needs review.  
**Action:** Read file, determine if it's a one-off migration that should be deleted or a legitimate scheduled operation.  
**Effort:** 1 · **Impact:** 2 · **Risk:** 2 → evaluate

---

### A-5 · Onboarding checklist hardcoded in Polish
**File:** `pages/dashboard/index.tsx` lines 238–241  
**What:** `checklistSteps` labels are Polish: "Podłącz swoje konto Google Search Console", "Skonfiguruj chociaż jedną domenę z GSC". Everything else on the dashboard is English. This will confuse non-Polish users if the app is ever shared.  
**Fix:** Use English labels (or add i18n if needed).  
**Effort:** 1 · **Impact:** 2 · **Risk:** 1 → quick win

---

### A-6 · `cron.ts` vs `cron/daily.ts` — two separate cron handlers
**Files:**
- `pages/api/cron.ts` — keyword position refresh
- `pages/api/cron/daily.ts` — auto-generate articles  
**What:** Two separate endpoints doing cron work with no shared scheduling infrastructure. Easy to miss when configuring hosting cron jobs. No retry logic, no failure alerting, no run history.  
**Fix:** Consolidate under `pages/api/cron/` with a dispatcher, or document clearly.  
**Effort:** 2 · **Impact:** 2 · **Risk:** 2 → low priority

---

## 📊 FEATURE GAPS vs SurferSEO

| Feature | SurferSEO | This app | Gap |
|---|---|---|---|
| Content score real-time | ✅ Live as you type | ✅ Live | None |
| SERP competitor analysis | ✅ Full SERP grid | ✅ Deep analysis | Close |
| AI-generated outlines | ✅ | ✅ | Close |
| PAA questions | ✅ Shown in research | ⚠️ Data exists, not shown in research panel | Tracked in impl plan |
| Topical authority map | ✅ Cluster view | ❌ "Coming soon" stub | Missing |
| Keyword research | ✅ Built-in explorer | ❌ Not present | Missing |
| Internal linking assistant | ✅ Smart suggestions | ✅ exists (`InternalLinksPanel`) | Close |
| AI Visibility / GEO | ✅ Perplexity/Claude/Gemini checks | ✅ `ai-visibility.ts` exists | Step missing from progress UI (B-1) |
| Version history | ✅ | ✅ `VersionHistoryPanel` | Close |
| Auto-optimize | ✅ | ✅ `auto-optimize.ts` | Close |
| Team / collaboration | ✅ Multi-user, comments | ❌ Single user only | Missing |
| WordPress / CMS publish | ✅ Direct publish | ⚠️ `publish-targets.ts` exists but limited | Partial |
| Content audit (site-wide) | ✅ Full audit grid | ⚠️ `content-audit.tsx` is 300 lines, basic | Partial |
| Keyword tracking (rank) | ✅ | ⚠️ Legacy `audit.tsx`/`console.tsx`/`ideas.tsx` (old shell) | Partial |
| GSC performance charts | ✅ | ✅ `performance.tsx` 2789 lines | Done but God file |

---

## Prioritized Remediation Plan

### Phase 1 — Quick wins (1–2 days, high ROI)

| # | Item | Action | Est. |
|---|---|---|---|
| 1 | **B-3** Dashboard SurferSEO links | Replace 4 hardcoded cards | 30 min |
| 2 | **B-1** Missing `ai_visibility` step | Add 1 line to STEPS array | 5 min |
| 3 | **D-1** Delete OutlinePanel.tsx | `git rm` | 5 min |
| 4 | **D-2** Delete TopBar.tsx + test | `git rm` | 10 min |
| 5 | **D-3** Delete test-r2.ts | `git rm` | 5 min |
| 6 | **D-4** Slim sites/[domain]/index.tsx | Keep only router.replace | 15 min |
| 7 | **A-5** Polish labels → English | Edit 2 strings | 5 min |
| 8 | **DUP-4** Consolidate time formatters | Create `lib/formatDate.ts` | 30 min |
| 9 | **DUP-1** Remove 3 `countOccurrences` copies | Import from lib | 30 min |

---

### Phase 2 — Bug fixes & DRY (3–5 days)

| # | Item | Action | Est. |
|---|---|---|---|
| 10 | **B-2** `onFeaturedImageChange` wiring | `updateFeaturedImage` helper (impl plan Task 9) | 1 hr |
| 11 | **B-4** analyze-batch concurrency | Add max-3 sequential loop | 1 hr |
| 12 | **B-5 / A-1** Migrate 3 pages off old GSC API | Update fetch URLs + delete `api/searchconsole.ts` | 2–3 hr |
| 13 | **DUP-3** Extract `fetchPage` to `lib/fetchPage.ts` | Move + import | 1 hr |
| 14 | **DUP-2** Consolidate ScoreGauge variants | Add `variant` prop to canonical | 2 hr |

---

### Phase 3 — Architecture (1–2 weeks)

| # | Item | Action | Est. |
|---|---|---|---|
| 15 | **A-2** Migrate 5 old pages to AppShell | Convert shell per page | 1 day |
| 16 | **G-2** Split recommendations.tsx | Extract 3 components | 2 days |
| 17 | **G-3** Split article editor page | Extract 4 hooks | 2 days |
| 18 | **G-1** Split performance.tsx | Extract 4 components | 3 days |

---

### Phase 4 — Features (ongoing)

| # | Item |
|---|---|
| 19 | Topical Map — implement or remove stub |
| 20 | PAA Questions tab in Research Panel (impl plan Task 7) |
| 21 | Team / multi-user support |
| 22 | Keyword research tool |
| 23 | Cron infrastructure cleanup |

---

## Summary

| Category | Items found |
|---|---|
| Critical bugs | 5 |
| Dead code | 5 |
| Duplicate code | 4 |
| God files | 3 |
| Architecture issues | 6 |
| Feature gaps vs SurferSEO | 6 significant |

**Most urgent single fix:** Remove SurferSEO branding from the dashboard (B-3). Users will immediately notice competitor branding.  
**Highest risk if ignored:** `onFeaturedImageChange` bug (B-2) — silently loses featured image changes; and the dual GSC auth paths (A-1/B-5) — any auth improvement to the new path breaks 3 pages invisibly.  
**Best ROI effort:** Phase 1 quick wins — 9 items in ~2 hours total, remove substantial clutter.
