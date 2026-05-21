# Keyword Suggestion Dropdown — Design Spec
Date: 2026-05-19

## Overview
Add a keyword suggestion dropdown to every keyword input field in the articles section. When a user types ≥3 characters, a dropdown appears showing keyword suggestions with difficulty bar and monthly volume — identical to SurferSEO's implementation.

## Scope
Three locations:
1. `pages/articles/import.tsx` — Keyword field
2. Article editor (`pages/articles/[id]/index.tsx`) — target keyword field
3. `components/articles/GenerateModal.tsx` — keyword field

## Data Source: Google Ads API (Hybrid fallback)
- **Primary**: `getAdwordsKeywordIdeas` from `utils/adwords.ts` — returns `avgMonthlySearches` + `competitionIndex`
- **Fallback**: If Google Ads not configured, use Google Suggest (free, no auth) — returns keyword list only, no volume/difficulty columns shown
- Users are prompted to connect Google Ads on registration (existing Settings flow)

## Backend: `/api/articles/keyword-suggest`

**Method**: GET  
**Query params**: `q` (string, required), `country` (string, default `US`)  
**Response (with Google Ads)**:
```json
{
  "suggestions": [
    { "keyword": "jak pozycjonować stronę", "volume": 210, "competitionIndex": 45 },
    { "keyword": "jak pozycjonować stronę w google", "volume": 110000, "competitionIndex": 72 }
  ],
  "hasVolumeData": true
}
```
**Response (without Google Ads / fallback)**:
```json
{
  "suggestions": [
    { "keyword": "jak pozycjonować stronę" },
    { "keyword": "jak pozycjonować stronę w google" }
  ],
  "hasVolumeData": false
}
```
**Error**: 400 if `q` missing, 200 with empty array if no results.

### Google Suggest fallback endpoint
`https://suggestqueries.google.com/complete/search?client=firefox&q={q}&hl=pl`  
Returns a JSON array — second element is the suggestions array.

## Shared Component: `KeywordSuggestInput`

**Location**: `components/articles/KeywordSuggestInput.tsx`

**Props**:
```ts
interface Props {
  keywords: string[];           // currently selected keywords (pills)
  onAdd: (kw: string) => void;  // called when user selects/adds a keyword
  onRemove: (kw: string) => void;
  country?: string;             // passed to API for locale-aware results
  placeholder?: string;
}
```

**Behavior**:
- Renders selected keywords as dark pills (matching existing import.tsx style)
- Input field inline — user types here
- Debounce: 350ms after last keystroke before calling API
- Min length: 3 characters to trigger fetch
- Keyboard: Enter/comma → add current input; ArrowDown/Up → navigate list; Escape → close
- Click outside → close dropdown
- Clicking a suggestion → `onAdd(keyword)`, input clears
- "Add X" row at bottom → always shown, allows adding exact typed phrase

## Dropdown UI

### With volume data (`hasVolumeData: true`)
```
┌────────────────────────────────────────────────────────┐
│ Keyword                        Difficulty    Volume     │  ← header row
├────────────────────────────────────────────────────────┤
│ jak pozycjonować stronę        ████░         210        │  ← highlighted (hover/focus)
│ jak pozycjonować stronę w g…   ████░         110.0k     │
│ jak pozycjonować bloga         ██░░░         74.0k      │
│ Add "jak pozy"                                          │  ← manual add row
└────────────────────────────────────────────────────────┘
```

### Without volume data (`hasVolumeData: false`)
- Header row hidden
- Only keyword column visible
- Small tooltip icon next to first row: "Połącz Google Ads w Settings aby zobaczyć dane"

### Difficulty bar (matches SurferSEO CSS)
- Container: `width: 24px, height: 6px, overflow: hidden, position: relative`
- Fill: `::after` pseudo-element, `position: absolute, top: 0, left: 0, height: 6px`
- Width of fill = `competitionIndex`% of 24px
- Color:
  - 0–33 → `#22c55e` (green)
  - 34–66 → `#f59e0b` (yellow/orange)  
  - 67–100 → `#ef4444` (red)

### Volume formatting
- < 1000 → as-is: `210`, `2,400`
- ≥ 1000 → `k` format: `110.0k`, `673.0k`

### Styling
- Dropdown: white background, `border: 1px solid #E4E4E7`, `border-radius: 8px`, `box-shadow: 0px 4px 16px rgba(0,0,0,0.08)`
- Max height: 450px, scrollable
- Row height: 36px, padding `8px 12px`
- Hover/focused row: `background: #FFF7ED` (beige, matching SurferSEO)
- Header: `font-size: 13px, color: #9F9FA9, font-weight: 500`
- Keyword text: `font-size: 14px, color: #2F2F34, font-weight: 500`
- Volume: `font-size: 14px, color: #2F2F34, text-align: right, width: 72px`
- Difficulty column: `width: 72px`
- Z-index: 50 (above other content)

## Integration Points

### `import.tsx`
Replace the existing keyword input + tags section with `<KeywordSuggestInput>`.  
Pass `country` state from the country selector.

### `pages/articles/[id]/index.tsx` (editor)
The target keyword field (currently a plain `<input>`) becomes `<KeywordSuggestInput>` with `keywords={[article.target_keyword]}` and single-select mode (max 1 keyword).

### `components/articles/GenerateModal.tsx`
Replace keyword input with `<KeywordSuggestInput>`. Pass domain country if available.

## Error Handling
- API timeout (>5s) → show cached/empty suggestions, no error shown to user
- Google Ads API error → silently fall back to Google Suggest
- Network offline → show only "Add X" row

## Out of Scope
- Caching suggestions in database
- Showing trend graphs
- Bulk keyword import
