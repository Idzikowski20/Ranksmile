# Google Ads Keyword Planner Integration

**Date:** 2026-05-22
**Status:** design-approved
**Branch:** codex/auth

## Motivation

The editor's #2 "Write & Optimize" panel already shows keywords with GSC volume ranges (e.g., `trump 40/27–59`), but the data is noisy — random query tails the page happens to rank for ("zo nierzy", "kongresmenow") — and lacks Ads metrics (CPC, competition, exact monthly volume).

Google Ads API v23 is already integrated (`utils/adwords.ts`, `/api/adwords`, `/api/ideas`). This spec wires it into the article editor and domain workflows.

## Features

### 1. Enriched Keywords in #2 "Write & Optimize"

Replace raw GSC keyword pills with Ads-enriched data:

- **Filtering:** Drop keywords whose relevance score (AI-computed vs article topic) falls below threshold
- **Metrics:** Show `monthly volume | competition (LOW/MED/HIGH) | CPC` from Ads
- **Coverage badge:** Per keyword — `✅ in text` / `⚠️ low density` / `❌ missing`

New button at bottom of keyword list: **"+ Suggest keywords from Ads"**

### 2. Keyword Suggestions

`POST /api/articles/keywords/suggest`

- Takes: article `target_keyword` + existing keywords + domain seed keywords
- Calls: `getAdwordsKeywordIdeas()` (already exists in `utils/adwords.ts`)
- Returns: deduplicated list of new keywords with Ads metrics + AI relevance score
- Client: appends to keyword list with visual "new" badge, user accepts/rejects each

### 3. Opportunity Score per Keyword

Each keyword in the enriched list gets a composite score combining:
- **Visibility gap** (GSC position — higher position = more room to grow)
- **Volume potential** (Ads monthly volume — higher = more traffic)
- **Competition** (Ads competition LOW → easier to rank)
- **Current coverage** (is the keyword already in the article text?)

Formula: `opportunity = (1 - position/inv_norm) * vol_norm * (1 - comp_weight) * (1 - coverage_bonus)`

Displayed as a 1-3 dot indicator next to each keyword pill (🟢 high / 🟡 medium / ⚪ low opportunity).

### 4. Keyword Gap vs Competition

Per-article analysis comparing existing keywords against SERP top 3 competitors:

`GET /api/articles/[id]/keywords/gap`

- Uses `competitor_outlines_cache` (already stored in DB from deep-analysis)
- Cross-references competitor headings/topics with article keywords
- Returns: "competitors rank for these 12 keywords you don't"

Shown inline in the keyword list (gap keywords marked with "competitor" badge).

### 5. Cannibalization Detection (Import Flow)

`GET /api/domains/[slug]/cannibalization?keyword=X`

- Scans `article_keywords` for keyword overlap between articles on same domain
- On article import (`ImportContentModal`): if a keyword appears in 2+ articles, show warning banner
- Also shown on `/sites/[domain]/` overview (if that page is reintroduced) or as a dedicated section in the keyword research panel

### 6. Content Brief Generator (New Article Flow)

When creating a new article:

- User enters target keyword
- Backend fetches keyword ideas from Ads + GSC data for the domain
- Returns a checklist: "Must-have keywords", "Secondary keywords", "Long-tail opportunities"
- Checklist visible as structured data in the editor for reference

### 7. Content Score Enhancement

Add `keyword_coverage` dimension to `computeContentScore()`:
- For each `article_keyword` with `is_covered = true` → +points
- Missing high-volume keywords → penalty
- Weight: ~10% of total score

### 8. Internal Linking Enhancement

Enhance existing InternalLinksPanel with shared-keyword detection:
- Two articles sharing 3+ keywords → strong link suggestion
- Show shared keyword count on each link suggestion

## Data Model

New table `article_keywords`:

```sql
CREATE TABLE article_keywords (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  gsc_volume_range TEXT,
  gsc_position DECIMAL(5,2),
  ads_monthly_volume INTEGER,
  ads_competition TEXT,          -- LOW / MEDIUM / HIGH
  ads_cpc DECIMAL(10,2),
  relevance_score DECIMAL(3,2),
  is_covered BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'gsc',    -- 'gsc', 'ads_suggestion', 'manual'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, keyword)
);
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/articles/[id]/keywords` | GET | Get enriched keywords for article |
| `/api/articles/[id]/keywords/enrich` | POST | Enrich existing keywords with Ads metrics |
| `/api/articles/[id]/keywords/suggest` | POST | Fetch new keyword suggestions from Ads |
| `/api/articles/[id]/keywords/gap` | GET | Keyword gap vs SERP competitors |
| `/api/articles/[id]/keywords` | PUT | Update keyword (toggle covered, set relevance) |
| `/api/domains/[slug]/cannibalization` | GET | Detect keyword overlap between articles |

## Auto-Enrich Triggers

Keywords are enriched in these moments:

1. **Article import** — after GSC keywords are fetched, batch-enrich via Ads API, save to `article_keywords`
2. **Article create** — after first save, fetch Ads keyword ideas for the target keyword
3. **Explicit "Suggest" button** — user-initiated in the editor

## UI Changes

### ContentScorePanel (#2 Write & Optimize)

- Keyword pills gain: Ads metrics row, coverage dot, relevance filter
- New button at bottom: "+ Suggest keywords from Ads"
- New keywords appear with "new" badge, user clicks to accept/dismiss

### New file: `components/articles/KeywordResearchSection.tsx`

Extracted keyword logic from ContentScorePanel into its own component to keep files focused.

### ImportContentModal

- After import completes: shows cannibalization warnings if applicable

### InternalLinksPanel

- Each link suggestion shows shared keyword count

### Content Score (`lib/contentScore.ts`)

- `computeContentScore()` gets optional `keywordCoverage` param

## Files Changed

| File | Change |
|------|--------|
| `database/models/article.ts` | Add `article_keywords` table definition |
| `pages/api/articles/[id]/keywords.ts` | NEW — CRUD for article keywords |
| `pages/api/articles/[id]/keywords/enrich.ts` | NEW — enrich with Ads |
| `pages/api/articles/[id]/keywords/suggest.ts` | NEW — suggest from Ads |
| `pages/api/articles/[id]/keywords/gap.ts` | NEW — competitor gap |
| `pages/api/domains/[slug]/cannibalization.ts` | NEW — cannibalization check |
| `components/articles/KeywordResearchSection.tsx` | NEW — extracted keyword list component |
| `components/articles/ContentScorePanel.tsx` | Use KeywordResearchSection, replace old keyword list |
| `components/articles/ImportContentModal.tsx` | Add cannibalization warning |
| `components/articles/InternalLinksPanel.tsx` | Show shared keyword count |
| `lib/contentScore.ts` | Add `keywordCoverage` dimension |
| `utils/adwords.ts` | Optionally add keyword enrichment helper |

## Migration

```sql
CREATE TABLE IF NOT EXISTS article_keywords (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  gsc_volume_range TEXT,
  gsc_position DECIMAL(5,2),
  ads_monthly_volume INTEGER,
  ads_competition TEXT,
  ads_cpc DECIMAL(10,2),
  relevance_score DECIMAL(3,2),
  is_covered BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'gsc',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, keyword)
);
```
