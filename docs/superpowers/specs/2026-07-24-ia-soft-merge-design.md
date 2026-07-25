# IA Soft Merge — Design Spec v2

**Date:** 2026-07-24  
**Status:** Approved direction; v2 incorporates migration-contract review  
**Approach:** IA **migration** (canonical routes + registry + redirects), not only nav rename.

## Goal

One clear job per primary nav entry. One **canonical route** per surface. Desktop / Mobile / Topbar / Command Palette share one registry. Legacy paths migrate via unlink → redirect → delete.

## Confirmed today (redirect safety)

`/sites/[domain]/rank-tracking` **already is** Search Intelligence / Organic Research (DataForSEO Labs UI), **not** the Ranksmile keyword tracker.

Canonical tracker remains `/sites/[domain]/keyword-tracker`.

Therefore redirect:

`/rank-tracking` → `/search-intelligence`

is semantically correct (same product surface, new name). It does **not** send users from tracker → organic.

## Non-goals (explicit)

- Merging Recommendations ↔ Content Audit UI
- Merging Topic Research ↔ Topical Map into one page
- Renaming `pages/api/rank-tracking/*`
- Nested `/search-intelligence/organic` + `/search-intelligence/rank-tracking` routes in v1 (tabs + two canonicals instead)
- Feature Engine / Action[] rewiring across Recs & Content Audit
- New DomainSnapshot type (constraint only: AI Vis pages keep sharing existing snapshot/query key)
- Visx/heatmap cut (separate PR after IA)
- Sidebar regroup into Discover/Create/Optimize/Measure (mental model only)

---

## Mental model (docs only — not nav)

```
DISCOVER:  Search Intelligence, Keyword Research, Topic Research, Topical Map
CREATE:    Recommendations, Articles
OPTIMIZE:  Content Audit, Recommendations, Site Audit (+ Audit URL)
MEASURE:   Performance, Rank Tracking, AI Visibility
```

Every primary surface answers:

1. User job?  
2. Primary input?  
3. Primary output?  
4. Next actions?

| Surface | Job | Input | Output | Next actions |
|---------|-----|-------|--------|--------------|
| Performance | How is traffic doing? | Domain + GSC | Charts / KPIs | Fix via Recs / Audit |
| Site Audit | What’s wrong technically? | Domain crawl | Issues | Fix / Audit URL |
| Audit URL | Analyze one page | URL | On-page report | Optimize / Write |
| Recommendations | What should I do? | Domain signals | Action list | Create / Optimize |
| Content Audit | Which content needs care? | Articles + GSC | Portfolio flags | Optimize / Prune / Refresh |
| Topical Map | What topics to cover? | Domain clusters | Map | Run research / Write |
| Search Intelligence (Organic) | What does Google show for the domain? | Domain + DFS | Keywords / SERP / traffic | Track / Create / Optimize |
| Rank Tracking | What do we monitor over time? | Tracked set | Positions / history | Add keywords / refresh |
| Keyword Research | Find new phrases | Seed | Research job | Track / Write |
| Topic Research | Research a topic | Topic | Brief / job | Write |
| AI Visibility | How do AIs mention us? | Domain snapshot | Score / sources / prompts | Improve coverage / Write |
| Activity Log | What happened? | Domain activity | Timeline | Open article |

---

## Canonical route contract

Every primary nav item has **exactly one** canonical route. Legacy routes: redirect, deep-link-only, or delete (after redirect period).

| Surface | Canonical route | Purpose | Legacy |
|---------|-----------------|---------|--------|
| Performance | `/sites/{slug}/performance` | GSC performance | `/console`, `/insight` → redirect |
| Site Audit | `/sites/{slug}/site-audit` | Technical crawl | — |
| Audit URL | `/sites/{slug}/audit-tool` | One-off URL audit | Deep-link + Site Audit CTA only; not Tools nav |
| Recommendations | `/sites/{slug}/recommendations` | Decide actions | `/ideas` → redirect |
| Content Audit | `/sites/{slug}/content-audit` | Content portfolio | `/audit` → redirect |
| Topical Map | `/sites/{slug}/topical-map` | Topic coverage | — |
| Search Intelligence (Organic Research) | `/sites/{slug}/search-intelligence` | DFS organic dataset | `/rank-tracking` → redirect |
| Rank Tracking | `/sites/{slug}/keyword-tracker` | Tracked keywords | — (no rename) |
| Activity Log | `/sites/{slug}/activity-log` | Activity timeline | — |
| Keyword Research | `/sites/{slug}/keyword-research` | Seed research | — |
| Topic Research | `/sites/{slug}/topic-research` | Topic research jobs | — |
| AI Vis * | `/sites/{slug}/ai-visibility/*` | Unchanged | — |

**Rule:** Do not keep two page files rendering the same surface. Canonical page + redirect only.

---

## Search Intelligence IA

Product split (must stay clear):

| Tab | Meaning | Route |
|-----|---------|-------|
| **Organic Research** | What Google shows for the domain (DFS) | `/search-intelligence` (default) |
| **Rank Tracking** | What we monitor over time | `/keyword-tracker` |

v1 UI (soft):

- Shared tab chrome on both pages: `[ Organic Research ] [ Rank Tracking ]`
- Organic page = today’s SI content
- Rank Tracking tab / “Open Rank Tracking” → `/keyword-tracker` (same chrome, Rank tab active)
- **Not** a buried single CTA; tabs make Rank Tracking a first-class sibling under the SI product

Deferred: nested URLs `/search-intelligence/organic` + `/search-intelligence/rank-tracking` if tabs prove insufficient.

API namespace `rank-tracking` stays.

---

## Site Audit vs Audit URL

| | Site Audit | Audit URL |
|--|------------|-----------|
| Job | Entire site technical health | One specific page |
| Entry | SEO nav → Site Audit | Contextual action on Site Audit only |
| Copy | “Analyze your entire website” | “Analyze one specific page” |
| Route | `/site-audit` | `/audit-tool` (+ `/audit-tool/[id]`) |

Tools nav: **no** Audit Tool.

---

## Topical Map ↔ Topic Research ownership

| | Topical Map | Topic Research |
|--|------------|----------------|
| Job | What should we cover? | How do we research it? |
| Flow | Topic → **Run research** → Topic Research job → brief → Write | Job list / detail |

Do not merge pages in this initiative.

---

## Navigation registry (technical #1)

Single source for all chrome:

```
lib/navigation/
  siteNavigation.ts    # SEO / Tools / AI Vis / Content entries
  routeAliases.ts      # legacy → canonical redirects map
  navigationTypes.ts   # NavigationItem type
```

Consumers (must import registry — no parallel hardcoded maps):

- `SentryNav`
- `MobileBottomNav`
- `TopbarSearch` (command palette)

Optional later: breadcrumbs.

`routeAliases.ts` drives Next redirects (or thin redirect pages) for legacy paths.

---

## Legacy migration matrix

| Old | New | Phase A | Phase B | Phase C |
|-----|-----|---------|---------|---------|
| `/sites/.../rank-tracking` | `/search-intelligence` | — | 308 redirect | delete old page file |
| `/sites/.../console` | `/performance` | unlink DomainHeader | 308 | delete |
| `/sites/.../insight` | `/performance` | unlink | 308 | delete |
| `/sites/.../ideas` | `/recommendations` | unlink | 308 | delete |
| `/sites/.../audit` | `/content-audit` | unlink | 308 | delete |

DomainHeader legacy links removed in Phase A. Do **not** hard-delete page code until Phase C after redirects exist.

---

## AI Visibility constraint

Do not change IA. All AI Vis pages must keep using the **same** existing domain snapshot / query key (no divergent live vs stale snapshots across Overview vs Sources). No new DomainSnapshot abstraction in this initiative unless one already exists and is unused.

---

## Implementation phases

### Phase 0 — Inventory
Route inventory, nav inventory, legacy inventory, inbound links from DomainHeader / SI / Tools, analytics event names if any.

### Phase 1 — Canonical routes + registry
Add `lib/navigation/*`. Define canonical hrefs + aliases. **No user-facing nav change yet** (or wire registry behind same labels).

### Phase 2 — Navigation parity
Point SentryNav, MobileBottomNav, TopbarSearch at registry. Tools without Audit Tool. SEO includes SI at `/search-intelligence` path once Phase 3 lands (or temporary dual until rename).

### Phase 3 — Search Intelligence
- Rename page → `search-intelligence.tsx`
- Shared Organic / Rank Tracking tabs
- Redirect `/rank-tracking` → `/search-intelligence`
- Preserve API namespace

### Phase 4 — Audit URL
- Site Audit contextual **Audit URL**
- Remove Tools → Audit Tool
- Preserve `/audit-tool` deep links

### Phase 5 — Legacy
Unlink (if anything left) → redirects live → monitor → delete old pages/components

### Phase 6 — Verification
Tests below. Charts/deps cut = separate PR after this.

---

## Definition of done (tests)

1. **Nav parity:** Desktop SEO item hrefs === Mobile SEO item hrefs (same canonicals). Tools likewise.
2. **Registry:** TopbarSearch destinations for those items match registry.
3. **Canonical:** Each primary nav id maps to exactly one canonical path.
4. **Redirect:** `GET .../rank-tracking` → 308 `.../search-intelligence`.
5. **Legacy:** No legacy page linked from primary nav or DomainHeader.
6. **Discoverability:** SI tabs ↔ Rank Tracking; Site Audit → Audit URL; Topical Map → Topic Research.
7. **No dual render:** Only one page module for Organic Research surface.

Minimal automated check: unit/snapshot of registry export + one redirect test (Next redirect config or thin page). Prefer one registry assert over many UI snapshots.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Bookmark confusion SI vs tracker | Confirmed `/rank-tracking` = organic; tabs label both jobs |
| Tools users looking for Audit Tool | Site Audit copy + Audit URL CTA |
| Nav drift regresses | Single registry + parity test |
| Premature legacy delete | Phase A→B→C |

## Deferred

- Nested SI URLs
- Recs ↔ Content Audit shared Action layer
- API rename
- Chart kit consolidation
- Discover/Create/Optimize/Measure sidebar
