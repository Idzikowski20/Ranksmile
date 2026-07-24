# IA Soft Merge — Design Spec

**Date:** 2026-07-24  
**Status:** Approved (product)  
**Approach:** Soft merge — clarify nav jobs first; keep most routes; cut dead code in follow-up PRs.

## Goal

One clear job per nav entry under SEO / Tools / AI Visibility. Reduce duplicate “keyword / audit / topic” surfaces without a hard page consolidation in v1.

## Non-goals (explicit)

- Merging Recommendations with Content Audit
- Physically merging Topic Research into Topical Map (deep-link only)
- Renaming API `pages/api/rank-tracking/*`
- AI Visibility IA changes beyond hiding “coming soon” stubs
- Visx / heatmap chart kit cut (separate PR after IA lands)
- Article editor split / large file shrink

## §1 Navigation map

### SEO (primary → `/sites/{slug}/performance`)

| Keep | Job |
|------|-----|
| Performance | GSC traffic / goals |
| Site Audit | Technical crawl |
| Recommendations | Optimize URLs + content ideas → editor |
| Content Audit | Content portfolio + pruning |
| Topical Map | Domain topic clusters |
| Search Intelligence | Organic dataset (DataForSEO) + entry to tracker |
| Activity Log | Content activity timeline |

| Not a SEO primary | Instead |
|-------------------|---------|
| Keyword Tracker | Link/section inside Search Intelligence → existing `/keyword-tracker` |
| Legacy console / insight / ideas / audit | Remove from DomainHeader; delete pages in code phase |

### Tools

| Keep | Job |
|------|-----|
| Keyword Research | One-off seed research (not a SI replacement) |
| Topic Research | Research job list; also deep-linked from Topical Map (“Run research”) |

| Remove from Tools | Instead |
|-------------------|---------|
| Audit Tool | Entry only from Site Audit as **Audit URL** (see §2) |

### AI Visibility

Unchanged secondary: Overview, Sources, Competitors, Prompts, Fanout. Setup/manage stay out of secondary. Hide Compare/Responses “coming soon” UI stubs where present.

### Content / Dashboard / Settings

Unchanged in this initiative.

## §2 Audit Tool under Site Audit + SI URL rename

### Audit Tool → Site Audit

- Tools nav: no Audit Tool item.
- Site Audit: action/tab/entry labeled **Audit URL** → existing `audit-tool` + `audit-tool/[id]` flow.
- Route may remain `/sites/{slug}/audit-tool` in v1 (linked only from Site Audit). Optional later alias under `/site-audit/*` is out of scope for v1.

### Search Intelligence URL rename

| Before | After |
|--------|-------|
| `/sites/[domain]/rank-tracking` | `/sites/[domain]/search-intelligence` |

- Move page file `rank-tracking.tsx` → `search-intelligence.tsx`.
- Permanent-or-temporary redirect from `rank-tracking` → `search-intelligence` for bookmarks.
- Update SentryNav, MobileBottomNav, TopbarSearch, SI internal links, tests.
- **Keep** `pages/api/rank-tracking/*` and related lib/services names in v1.

### Keyword Tracker

- Not in SEO primary or Tools.
- Reachable from Search Intelligence (“Tracked keywords”) → `/sites/{slug}/keyword-tracker` (no rename in v1).

## §3 Mobile / Topbar parity

- Mobile SEO sheet matches desktop SEO list (including Site Audit + Search Intelligence at `/search-intelligence`).
- No Keyword Tracker as its own mobile nav row.
- Mobile Tools sheet: Keyword Research + Topic Research only.
- TopbarSearch hrefs match post-rename SentryNav.

## Implementation phases (after plan)

1. **IA nav + SI rename + redirect** — desktop, mobile, topbar.
2. **Audit URL entry on Site Audit**; remove Audit Tool from Tools.
3. **Delete legacy** `console` / `insight` / `ideas` / `audit` + DomainHeader dead links.
4. **Chart/deps cut** (heatmap / visx) — separate PR, not blocking IA.

## Success criteria

1. Desktop + mobile + topbar share one IA map (§1–2).
2. `/rank-tracking` redirects to `/search-intelligence`.
3. Audit Tool not listed under Tools; reachable from Site Audit as Audit URL.
4. Legacy domain pages not linked from DomainHeader.
5. AI Vis secondary unchanged (optional stub hide only).

## Risks

- Bookmarks to `rank-tracking` — mitigated by redirect.
- Users looking for “Audit Tool” in Tools — mitigated by Site Audit entry + optional help copy.
- Keyword Tracker discoverability — mitigated by explicit SI CTA.

## Open items deferred

- Full Topic Research ↔ Topical Map page merge
- Recommendations ↔ Content Audit shared data layer
- API rename `rank-tracking` → `search-intelligence`
- Chart kit consolidation onto chart.js
