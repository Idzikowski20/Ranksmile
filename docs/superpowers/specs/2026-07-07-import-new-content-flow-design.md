# Import Content & New Content — Flow Unification Design

**Date:** 2026-07-07  
**Status:** Draft — awaiting review  
**Scope:** Option C — full UX pass (flow correctness + shared UI + legacy migration)

---

## Problem

Two product flows share infrastructure but diverge in UX, backend, and routing:

| Flow | Intended path | Current gaps |
|------|---------------|--------------|
| **Import content** | URL → deep analysis → editor with full HTML | Missing domain picker; legacy `/api/articles/import` still used from Recommendations; dead `ImportContentModal` misleads |
| **New content** | Keyword → deep analysis → wizard → generate/editor | Works end-to-end; minor gaps (language param, error back link, duplicated shell UI) |

After the redirect fix (`flow=import` → editor, `flow=new` → wizard), the **routing split is correct**. Remaining work is **data correctness**, **UX consistency**, and **backend consolidation**.

---

## Goals

1. **Import** always uses deep-analysis pipeline (fetch + SERP + score), lands in editor with scraped content.
2. **New content** always uses keyword-mode deep-analysis, then multi-step wizard — never editor until user chooses write/generate.
3. **One visual system** for entry pages and wizard (shared shell + step sidebar).
4. **Workspace-aware domain** on both flows (explicit domainId, not `firstAccessibleDomainId` surprise).
5. **Remove dead code** (`ImportContentModal`, `GenerateModal`) and migrate Recommendations off legacy import API.

## Non-goals

- Changing TipTap editor behavior
- Redesigning Content Score panel
- Multi-keyword deep analysis (still primary keyword only — document in UI)

---

## Architecture

### Flow registry — `lib/articleFlow.ts`

Single source of truth for flows, query params, and redirects.

```ts
type ArticleFlow = 'import' | 'new';

const FLOWS = {
  import: {
    entryPath: '/articles/import',
    steps: ['entry', 'deep-analysis', 'editor'],
    deepAnalysisBody: (p) => ({ url, keywords, country, domainId, flow: 'import' }),
    onComplete: (articleId) => `/articles/${articleId}`,
  },
  new: {
    entryPath: '/articles/new',
    steps: ['entry', 'deep-analysis', 'content-type', 'context', 'writing-mode', 'generating'],
    deepAnalysisBody: (p) => ({ keywords, country, language, domainId, flow: 'new' }),
    onComplete: (articleId) => `/articles/content-type?articleId=${articleId}`,
  },
};
```

Helpers: `buildDeepAnalysisUrl(flow, params)`, `resolveBackPath(flow)`, `isWizardArticle(article)`.

### Shared UI — `components/articles/ArticleFlowShell.tsx`

Replaces duplicated layout in `import.tsx`, `new.tsx`, and extends `WizardShell`.

```
┌─────────────────────────────────────────────────────────────┐
│ ArticleFlowShell                                            │
│ ┌──────────────────────────────┬──────────────────────────┐ │
│ │ Main panel (576px col)       │ Step sidebar (312px)     │ │
│ │ - title, description         │ - numbered steps         │ │
│ │ - form / wizard content      │ - active / done / pending│ │
│ │ - footer (Next / Back)       │ - flow-specific labels   │ │
│ └──────────────────────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Import sidebar:** `1 Keywords & URL` → `2 Deep analysis` (step 2 active on deep-analysis page via shared step config)
- **New sidebar:** `1 Keyword` → `2 Deep analysis` → `3 Content type` → `4 Context` → `5 Writing mode` → `6 Generate` (wizard pages pass `currentStep`)

Design tokens from `design.md`: `#f8f9ff` bg, `#E4E4E7` borders, `#783AFB` active step, inline styles.

### Shared form — `components/articles/ArticleEntryForm.tsx`

| Field | Import | New |
|-------|--------|-----|
| Domain | required dropdown | required dropdown |
| Keywords | optional multi | required multi + tracked |
| URL | required | hidden |
| Country | selector | derived from language |
| Language | hidden (from country) | dropdown |

Default domain: active workspace domain via `resolveActiveDomain` + `useWorkspaces`.

Default country: **PL** everywhere (UI + API fallback).

---

## Backend changes

### `POST /api/articles/deep-analysis`

- Accept optional `language` (keyword + URL modes); use when provided, else `langForCountry(country)`.
- **Require `domainId`** for new article creation (both modes). Return 400 if missing — forces UI fix.
- Keep URL mode pipeline unchanged (sidecar).
- Keep keyword mode unchanged (analyze-serp).

### Deprecate `POST /api/articles/import`

**Migration:** `pages/sites/[domain]/recommendations.tsx` `handleOptimize`:

- Instead of sync POST to `/api/articles/import`, navigate to:
  ```
  /articles/deep-analysis?flow=import&url=…&keywords=…&domainId=…&country=…
  ```
  OR reuse inline SSE pattern from `handleCreateArticleForKeyword` (already in same file).

Recommendation: **navigate to deep-analysis page** for consistent UX (user sees progress steps). Spinner on row until navigation.

After migration + test: delete `pages/api/articles/import.ts` and tests that depend on it.

---

## Page-by-page changes

### `pages/articles/import.tsx`

- Use `ArticleFlowShell` + `ArticleEntryForm` (mode=`import`).
- Pass `domainId`, `flow=import` to deep-analysis.
- Remove duplicated COUNTRIES/layout code.

### `pages/articles/new.tsx`

- Same shell + form (mode=`new`).
- Keep tracked keywords section (new-only).
- Pass `language`, `domainId`, `flow=new`.

### `pages/articles/deep-analysis.tsx`

- Use `ArticleFlowShell` with sidebar step 2 active.
- Back button: `resolveBackPath(flow)` → import or new entry.
- Redirect on done: from `articleFlow.ts` (already partially implemented).

### Wizard pages (`content-type`, `context`, `writing-mode`, `generating`)

- Wrap in `ArticleFlowShell` with sidebar showing steps 3–6.
- Pass `flow=new` in query where needed for back navigation.
- Keep `content-type` guard: `meta_url` → redirect to editor.

### `pages/articles/index.tsx`

- Split New Content button: primary → new; chevron menu → Import content (optional).
- Wire `selectedDomainId` to article list filter (optional quick win in same PR).

### `components/articles/ArticleList.tsx`

- Empty state cards: New content | Import from URL | Content audit (correct links from `startLinks`).

### Dead code removal

- Delete `components/articles/ImportContentModal.tsx`
- Delete `components/articles/GenerateModal.tsx` (verify 0 imports)

---

## Error handling

| Scenario | Behavior |
|----------|----------|
| Deep analysis fails | Show error + Back (flow-aware) + Retry |
| No domain selected | Disable Next, inline validation |
| Import URL invalid | Disable Next |
| New content no keywords | Disable Next |
| User hits wizard with imported article (`meta_url`) | Redirect to editor |
| Recommendations optimize without URL | No-op |

---

## Testing plan

1. **Import E2E:** select domain → URL → deep analysis → editor has HTML content + score_data
2. **New E2E:** domain + keyword → deep analysis → content-type → … → generating → editor
3. **Resume:** wizard_state redirects from editor empty draft
4. **Recommendations optimize:** scanned page → deep-analysis UI → editor (not legacy import)
5. **Guards:** import article cannot enter content-type
6. **API:** deep-analysis rejects missing domainId with 400

---

## Implementation phases (for writing-plans)

### Phase 1 — Foundation (blocking)
- `lib/articleFlow.ts`
- `ArticleFlowShell` + step sidebar component
- `ArticleEntryForm`
- Refactor `import.tsx` + `new.tsx`
- domainId required in API + UI

### Phase 2 — Deep analysis & wizard UX
- Refactor `deep-analysis.tsx` to use shell + sidebar
- Add sidebar to wizard steps
- Flow-aware back buttons
- `language` in API

### Phase 3 — Cleanup & migration
- Recommendations → deep-analysis navigation
- Remove legacy import API + modal dead code
- Fix ArticleList empty state + index header

### Phase 4 — Verification
- Manual QA checklist above
- Update/add tests for `articleFlow` helpers and deep-analysis domainId guard

---

## Open decisions (defaults chosen)

| Question | Decision |
|----------|----------|
| Recommendations optimize UX | Navigate to deep-analysis page (not silent inline SSE) |
| domainId required? | Yes — both flows |
| Keep `/api/articles/import` for WP plugin? | Out of scope; grep before delete — keep if v1/wordpress uses it |

---

## Skills for implementation

1. **writing-plans** — bite-sized tasks from this spec
2. **frontend-design** + **design.md** — ArticleFlowShell styling
3. **form-cro** — minimize import form fields, clear labels
4. **onboarding-cro** — wizard step clarity, one goal per step
5. **executing-plans** — phased delivery
