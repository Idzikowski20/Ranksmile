# Google Ads Keyword Planner Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the editor's #2 "Write & Optimize" keyword list with Google Ads metrics (volume, CPC, competition), keyword suggestions, competitor gap detection, cannibalization warnings, and content score enhancements.

**Architecture:** New `article_keywords` table stores per-article keyword data. Two new API route files handle enrichment and suggestions (using existing `utils/adwords.ts` Google Ads v23 integration). The existing `ContentScorePanel` gets a new `KeywordResearchSection` child component. Auto-enrich triggers wire into the import flow. Domain-level cannibalization check is a standalone endpoint queried on import.

**Tech Stack:** Next.js Pages Router, PostgreSQL (Neon) + SQLite fallback, Sequelize, React 18, react-query, TypeScript, Google Ads API v23 (already integrated)

---

### Task 1: Database — article_keywords table + Sequelize model

**Files:**
- Create: `database/models/articleKeyword.ts`
- Modify: `lib/ensureArticlesTables.ts`

- [ ] **Step 1: Create Sequelize model**

```typescript
// database/models/articleKeyword.ts
import { Table, Model, Column, DataType, PrimaryKey, Unique } from 'sequelize-typescript';

@Table({
  timestamps: true,
  tableName: 'article_keywords',
})
class ArticleKeyword extends Model {
  @PrimaryKey
  @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
  id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  article_id!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  keyword!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  gsc_volume_range!: string | null;

  @Column({ type: DataType.DECIMAL(5, 2), allowNull: true })
  gsc_position!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  ads_monthly_volume!: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  ads_competition!: string | null;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  ads_cpc!: number | null;

  @Column({ type: DataType.DECIMAL(3, 2), allowNull: true })
  relevance_score!: number | null;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_covered!: boolean;

  @Column({ type: DataType.STRING, defaultValue: 'gsc' })
  source!: string;

  @Unique
  @Column({ type: DataType.STRING })
  uid!: string;
}

export default ArticleKeyword;
```

- [ ] **Step 2: Add CREATE TABLE to ensureArticlesTables.ts**

After the `article_terms` block in `lib/ensureArticlesTables.ts:105`, add:

```typescript
   await db.query(`
      CREATE TABLE IF NOT EXISTS article_keywords (
         id               ${PK},
         article_id       INTEGER NOT NULL,
         keyword          TEXT NOT NULL,
         gsc_volume_range TEXT,
         gsc_position     DECIMAL(5,2),
         ads_monthly_volume INTEGER,
         ads_competition  TEXT,
         ads_cpc          DECIMAL(10,2),
         relevance_score  DECIMAL(3,2),
         is_covered       INTEGER DEFAULT 0,
         source           TEXT DEFAULT 'gsc',
         uid              TEXT,
         created_at       TIMESTAMP DEFAULT ${NOW_DEFAULT},
         updated_at       TIMESTAMP DEFAULT ${NOW_DEFAULT}
      )
   `);
```

Also add the index:

```typescript
   try { await db.query(`CREATE INDEX IF NOT EXISTS idx_article_keywords_article ON article_keywords(article_id)`); } catch {}
```

And the UNIQUE constraint for Postgres:

```typescript
   try { await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_keywords_uid ON article_keywords(uid)`); } catch {}
```

- [ ] **Step 3: Register model in database.ts**

In `database/database.ts`, add to imports and models array:

```typescript
import ArticleKeyword from './models/articleKeyword';

// in both the Postgres and SQLite branches, add to models:
models: [Domain, Keyword, GscAccount, ArticleKeyword],
```

- [ ] **Step 4: Commit**

```bash
git add database/models/articleKeyword.ts lib/ensureArticlesTables.ts database/database.ts
git commit -m "feat: add article_keywords table and Sequelize model"
```

---

### Task 2: Utility — keyword enrichment + relevance scoring

**Files:**
- Create: `lib/keywordEnrichment.ts`
- Create: `__tests__/lib/keywordEnrichment.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/lib/keywordEnrichment.test.ts
import { computeRelevanceScore, computeOpportunityScore, checkCoverage } from '../../lib/keywordEnrichment';

describe('computeRelevanceScore', () => {
  it('returns 1.0 for exact keyword match in title', () => {
    expect(computeRelevanceScore('content marketing', 'content marketing tips 2024')).toBe(1);
  });

  it('returns high score when all keyword words appear in title', () => {
    expect(computeRelevanceScore('content marketing', 'content strategy and marketing guide')).toBeGreaterThan(0.5);
  });

  it('returns 0 when no word overlap', () => {
    expect(computeRelevanceScore('trump election', 'content marketing guide')).toBe(0);
  });
});

describe('computeOpportunityScore', () => {
  it('returns high score for high volume, low competition, weak position', () => {
    const score = computeOpportunityScore({
      gsc_position: 20, ads_monthly_volume: 5000, ads_competition: 'LOW', is_covered: false,
    } as any);
    expect(score).toBeGreaterThan(0.7);
  });

  it('returns low score for low volume, high competition, covered keyword', () => {
    const score = computeOpportunityScore({
      gsc_position: 3, ads_monthly_volume: 100, ads_competition: 'HIGH', is_covered: true,
    } as any);
    expect(score).toBeLessThan(0.3);
  });
});

describe('checkCoverage', () => {
  it('detects keyword in text', () => {
    expect(checkCoverage('content marketing', 'learn about content marketing today')).toBe(true);
  });

  it('returns false when keyword missing', () => {
    expect(checkCoverage('SEO strategy', 'learn about content marketing')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(checkCoverage('Content Marketing', 'Learn about CONTENT MARKETING today')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/keywordEnrichment.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement utility functions**

```typescript
// lib/keywordEnrichment.ts
import type { ArticleKeyword } from '../database/models/articleKeyword';

/** Simple word-overlap relevance: Jaccard between keyword words and target phrase words (words > 2 chars) */
export function computeRelevanceScore(keyword: string, targetKeyword: string): number {
  const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const targetWords = new Set(targetKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (kwWords.length === 0 || targetWords.size === 0) return 0;
  const overlap = kwWords.filter(w => targetWords.has(w)).length;
  return overlap / kwWords.length;
}

/** Composite opportunity score 0-1. Higher = more growth potential. */
export function computeOpportunityScore(kw: {
  gsc_position: number | null;
  ads_monthly_volume: number | null;
  ads_competition: string | null;
  is_covered: boolean;
}): number {
  let score = 0.5;

  // Position: higher rank = more room to grow (capped at position 50)
  if (kw.gsc_position !== null) {
    score += (Math.min(kw.gsc_position, 50) / 50) * 0.25;
  }

  // Volume: normalize to 0-1 (capped at 10000)
  if (kw.ads_monthly_volume !== null) {
    score += (Math.min(kw.ads_monthly_volume, 10000) / 10000) * 0.15;
  }

  // Competition: LOW = easier
  if (kw.ads_competition === 'LOW') score += 0.1;
  else if (kw.ads_competition === 'MEDIUM') score += 0.05;

  // Coverage: uncovered = more opportunity
  if (!kw.is_covered) score += 0.1;

  return Math.min(1, Math.max(0, score));
}

/** Check if keyword text appears in article plain text */
export function checkCoverage(keyword: string, plainText: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i').test(plainText);
}

/** Map Ads competition string to a weight for scoring */
export function competitionWeight(competition: string | null): number {
  if (competition === 'LOW') return 0.2;
  if (competition === 'MEDIUM') return 0.5;
  if (competition === 'HIGH') return 0.8;
  return 0.5; // unknown
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/keywordEnrichment.test.ts --verbose`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/keywordEnrichment.ts __tests__/lib/keywordEnrichment.test.ts
git commit -m "feat: add keyword enrichment utility functions"
```

---

### Task 3: API — Get article keywords

**Files:**
- Create: `pages/api/articles/[id]/keywords.ts`

- [ ] **Step 1: Create GET handler**

```typescript
// pages/api/articles/[id]/keywords.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [rows] = await db.query(
      `SELECT * FROM article_keywords WHERE article_id = ? ORDER BY ads_monthly_volume DESC NULLS LAST, relevance_score DESC NULLS LAST`,
      { replacements: [id] },
    );
    return res.status(200).json({ keywords: rows });
  }

  if (req.method === 'PUT') {
    const { keywordId, is_covered, relevance_score } = req.body;
    await db.query(
      `UPDATE article_keywords SET is_covered = ?, relevance_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [is_covered ? 1 : 0, relevance_score, keywordId] },
    );
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/articles/[id]/keywords.ts
git commit -m "feat: add GET/PUT /api/articles/[id]/keywords endpoint"
```

---

### Task 4: API — Enrich keywords with Ads data

**Files:**
- Create: `pages/api/articles/[id]/keywords/enrich.ts`

- [ ] **Step 1: Create handler**

```typescript
// pages/api/articles/[id]/keywords/enrich.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { getAdwordsCredentials, getKeywordsVolume } from '../../../../../utils/adwords';
import { computeRelevanceScore, checkCoverage } from '../../../../../lib/keywordEnrichment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { keywords, targetKeyword, plainText } = req.body;

  if (!keywords?.length) {
    return res.status(400).json({ error: 'keywords array required' });
  }

  // 1. Get article row for domain context
  const [articles] = await db.query(
    `SELECT a.target_keyword, d.slug FROM articles a LEFT JOIN domain d ON d.ID = a.domain_id WHERE a.id = ?`,
    { replacements: [id] },
  );
  const article = (articles as any[])[0];
  const tk = targetKeyword || article?.target_keyword || '';

  // 2. Try Ads volume enrichment (non-blocking — fails gracefully if Ads not set up)
  let volumeData: Record<string, number> = {};
  try {
    const creds = await getAdwordsCredentials();
    if (creds) {
      const kwObjs = keywords.map((kw: string, i: number) => ({
        ID: i, keyword: kw, country: 'PL',
      } as KeywordType));
      const result = await getKeywordsVolume(kwObjs);
      if (result.volumes && typeof result.volumes === 'object') {
        // Map back from keyword ID to string
        for (const [kwId, vol] of Object.entries(result.volumes)) {
          const idx = parseInt(kwId);
          if (idx < keywords.length) volumeData[keywords[idx]] = vol as number;
        }
      }
    }
  } catch (e) { /* Ads not configured — ok */ }

  // 3. Upsert into article_keywords
  const enriched: any[] = [];
  for (const kw of keywords) {
    const uid = `${id}:${kw}`;
    const relevance = computeRelevanceScore(kw, tk);
    const covered = checkCoverage(kw, plainText || '');

    await db.query(
      `INSERT INTO article_keywords (article_id, keyword, relevance_score, is_covered, ads_monthly_volume, uid, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (uid) DO UPDATE SET
         relevance_score = EXCLUDED.relevance_score,
         is_covered = EXCLUDED.is_covered,
         ads_monthly_volume = COALESCE(EXCLUDED.ads_monthly_volume, article_keywords.ads_monthly_volume),
         updated_at = CURRENT_TIMESTAMP`,
      { replacements: [id, kw, relevance, covered ? 1 : 0, volumeData[kw] || null, uid] },
    );

    enriched.push({ keyword: kw, relevance_score: relevance, is_covered: covered, ads_monthly_volume: volumeData[kw] || null });
  }

  return res.status(200).json({ keywords: enriched });
}
```

Note: `ON CONFLICT` works on Postgres. For SQLite fallback, use `INSERT OR REPLACE` — see Task 4b.

- [ ] **Step 2: Commit**

```bash
git add pages/api/articles/[id]/keywords/enrich.ts
git commit -m "feat: add POST /api/articles/[id]/keywords/enrich endpoint"
```

---

### Task 5: API — Suggest new keywords from Ads

**Files:**
- Create: `pages/api/articles/[id]/keywords/suggest.ts`

- [ ] **Step 1: Create handler**

```typescript
// pages/api/articles/[id]/keywords/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../../../../utils/adwords';
import { computeRelevanceScore } from '../../../../../lib/keywordEnrichment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { targetKeyword } = req.body;

  // 1. Get domain info
  const [articles] = await db.query(
    `SELECT a.target_keyword, a.domain_id, d.domain, d.slug FROM articles a
     LEFT JOIN domain d ON d.ID = a.domain_id WHERE a.id = ?`,
    { replacements: [id] },
  );
  const art = (articles as any[])[0];
  if (!art) return res.status(404).json({ error: 'Article not found' });
  const tk = targetKeyword || art.target_keyword || art.title || '';

  // 2. Get existing keywords to deduplicate
  const [existing] = await db.query(
    `SELECT keyword FROM article_keywords WHERE article_id = ?`,
    { replacements: [id] },
  );
  const existingSet = new Set((existing as any[]).map((r: any) => r.keyword.toLowerCase()));

  // 3. Fetch keyword ideas from Ads
  const creds = await getAdwordsCredentials();
  if (!creds) {
    return res.status(200).json({ suggestions: [], error: 'Google Ads not configured' });
  }

  const ideas = await getAdwordsKeywordIdeas(creds, {
    keywords: [tk],
    seedType: 'custom',
  });

  if (!ideas || !Array.isArray(ideas)) {
    return res.status(200).json({ suggestions: [] });
  }

  // 4. Deduplicate, score, return top 15
  const suggestions = ideas
    .filter((kw: any) => !existingSet.has(kw.keyword?.toLowerCase()))
    .map((kw: any) => ({
      keyword: kw.keyword,
      avgMonthlySearches: kw.avgMonthlySearches || 0,
      competition: kw.competition || 'MEDIUM',
      competitionIndex: kw.competitionIndex || 50,
      relevance_score: computeRelevanceScore(kw.keyword, tk),
    }))
    .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
    .slice(0, 15);

  return res.status(200).json({ suggestions });
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/articles/[id]/keywords/suggest.ts
git commit -m "feat: add POST /api/articles/[id]/keywords/suggest endpoint"
```

---

### Task 6: API — Keyword gap vs competitors

**Files:**
- Create: `pages/api/articles/[id]/keywords/gap.ts`

- [ ] **Step 1: Create handler**

```typescript
// pages/api/articles/[id]/keywords/gap.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../../database/database';
import verifyUser from '../../../../../utils/verifyUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  // 1. Get article keywords + competitor outlines cache
  const [articles] = await db.query(
    `SELECT competitor_outlines_cache FROM articles WHERE id = ?`,
    { replacements: [id] },
  );
  const art = (articles as any[])[0];

  const [keywords] = await db.query(
    `SELECT keyword FROM article_keywords WHERE article_id = ?`,
    { replacements: [id] },
  );
  const ourKeywords = new Set((keywords as any[]).map((r: any) => r.keyword.toLowerCase()));

  // 2. Extract competitor keywords from cached outlines
  const gapKeywords = new Set<string>();
  if (art?.competitor_outlines_cache) {
    try {
      const outlines = typeof art.competitor_outlines_cache === 'string'
        ? JSON.parse(art.competitor_outlines_cache)
        : art.competitor_outlines_cache;
      const competitorHeadings: string[] = [];
      if (Array.isArray(outlines)) {
        for (const comp of outlines) {
          if (comp.outline) {
            for (const h of comp.outline) {
              if (h.text) competitorHeadings.push(h.text.toLowerCase());
            }
          }
        }
      }
      // Extract meaningful n-grams from competitor headings
      for (const heading of competitorHeadings) {
        const words = heading.split(/\s+/).filter((w: string) => w.length > 3);
        for (let len = 2; len <= Math.min(4, words.length); len++) {
          for (let i = 0; i <= words.length - len; i++) {
            const phrase = words.slice(i, i + len).join(' ');
            if (!ourKeywords.has(phrase)) {
              gapKeywords.add(phrase);
            }
          }
        }
      }
    } catch { /* malformed cache — ok */ }
  }

  // Return top 20 gap keywords by frequency
  return res.status(200).json({
    gapKeywords: [...gapKeywords].slice(0, 20),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/articles/[id]/keywords/gap.ts
git commit -m "feat: add GET /api/articles/[id]/keywords/gap endpoint"
```

---

### Task 7: API — Cannibalization check

**Files:**
- Create: `pages/api/domains/[slug]/cannibalization.ts`

- [ ] **Step 1: Create handler**

```typescript
// pages/api/domains/[slug]/cannibalization.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { slug } = req.query;
  const checkKeyword = req.query.keyword as string | undefined;

  // Get domain ID from slug
  const [domains] = await db.query(`SELECT "ID" FROM domain WHERE slug = ?`, { replacements: [slug] });
  const domain = (domains as any[])[0];
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  let sql = `
    SELECT ak.keyword, ak.article_id, a.title, COUNT(*) OVER (PARTITION BY ak.keyword) as article_count
    FROM article_keywords ak
    JOIN articles a ON a.id = ak.article_id
    WHERE a.domain_id = ?
  `;
  const replacements: any[] = [domain.ID];

  if (checkKeyword) {
    sql += ` AND ak.keyword = ?`;
    replacements.push(checkKeyword);
  }

  sql += ` ORDER BY article_count DESC, ak.keyword`;

  const [rows] = await db.query(sql, { replacements });

  // Group by keyword — show articles competing for each
  const cannibalized: Record<string, { keyword: string; articles: { id: number; title: string }[] }> = {};
  for (const r of rows as any[]) {
    if (r.article_count < 2) continue;
    if (!cannibalized[r.keyword]) {
      cannibalized[r.keyword] = { keyword: r.keyword, articles: [] };
    }
    cannibalized[r.keyword].articles.push({ id: r.article_id, title: r.title });
    if (cannibalized[r.keyword].articles.length >= r.article_count) {
      // Already got all — skip further rows for this keyword
    }
  }

  return res.status(200).json({ cannibalized: Object.values(cannibalized) });
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/domains/[slug]/cannibalization.ts
git commit -m "feat: add GET /api/domains/[slug]/cannibalization endpoint"
```

---

### Task 8: UI — KeywordResearchSection component

**Files:**
- Create: `components/articles/KeywordResearchSection.tsx`

- [ ] **Step 1: Create component**

```typescript
// components/articles/KeywordResearchSection.tsx
import React, { useState } from 'react';

interface KeywordItem {
  id?: number;
  keyword: string;
  gsc_volume_range?: string | null;
  gsc_position?: number | null;
  ads_monthly_volume?: number | null;
  ads_competition?: string | null;
  ads_cpc?: number | null;
  relevance_score?: number | null;
  is_covered?: boolean;
  source?: string;
  opportunity_score?: number;
}

interface Props {
  keywords: KeywordItem[];
  isLoading?: boolean;
  onSuggest?: () => void;
  isSuggesting?: boolean;
  suggestedKeywords?: KeywordItem[];
  onAcceptSuggestion?: (kw: KeywordItem) => void;
  onDismissSuggestion?: (kw: KeywordItem) => void;
  onToggleCoverage?: (kw: KeywordItem) => void;
}

const competitionColor = (comp: string | null | undefined): string => {
  if (comp === 'LOW') return '#16a34a';
  if (comp === 'MEDIUM') return '#d97706';
  if (comp === 'HIGH') return '#dc2626';
  return '#9f9fa9';
};

const KeywordResearchSection: React.FC<Props> = ({
  keywords, isLoading, onSuggest, isSuggesting,
  suggestedKeywords, onAcceptSuggestion, onDismissSuggestion, onToggleCoverage,
}) => {
  const [search, setSearch] = useState('');

  const filtered = search
    ? keywords.filter((k) => k.keyword.toLowerCase().includes(search.toLowerCase()))
    : keywords;

  const sorted = [...filtered].sort((a, b) => {
    // Show uncovered high-opportunity first
    const aOpp = a.opportunity_score ?? 0;
    const bOpp = b.opportunity_score ?? 0;
    if (bOpp !== aOpp) return bOpp - aOpp;
    return (b.ads_monthly_volume ?? 0) - (a.ads_monthly_volume ?? 0);
  });

  return (
    <div style={{ padding: '0 16px 12px' }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} /><line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          type="text"
          placeholder="Filter keywords"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 6, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box', fontFamily: 'var(--font-family-primary)' }}
        />
      </div>

      {isLoading ? (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', fontFamily: 'var(--font-family-primary)' }}>Loading keywords…</p>
      ) : sorted.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', fontFamily: 'var(--font-family-primary)' }}>No keywords yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map((kw, i) => {
            const covered = kw.is_covered;
            const oppScore = kw.opportunity_score ?? 0;
            const oppDot = oppScore > 0.6 ? '#16a34a' : oppScore > 0.3 ? '#d97706' : '#9f9fa9';
            return (
              <div
                key={kw.keyword + i}
                onClick={() => onToggleCoverage?.(kw)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 12px', borderRadius: 8,
                  background: covered ? '#f0fdf4' : '#fafafa',
                  border: `1px solid ${covered ? '#bbf7d0' : '#f4f4f5'}`,
                  gap: 6, cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* Opportunity dot */}
                    <span title={`Opportunity: ${Math.round(oppScore * 100)}%`} style={{ width: 6, height: 6, borderRadius: '50%', background: oppDot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }} title={kw.keyword}>
                      {kw.keyword}
                    </span>
                    {covered && <span style={{ fontSize: 10, color: '#16a34a', flexShrink: 0 }}>✓</span>}
                    {kw.source === 'ads_suggestion' && (
                      <span style={{ fontSize: 10, color: '#fff', background: '#783afb', borderRadius: 4, padding: '0 4px', lineHeight: '16px', flexShrink: 0 }}>new</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    {kw.ads_monthly_volume != null && (
                      <span style={{ fontSize: 11, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>{kw.ads_monthly_volume.toLocaleString()}/mo</span>
                    )}
                    {kw.ads_competition && (
                      <span style={{ fontSize: 11, color: competitionColor(kw.ads_competition), fontFamily: 'var(--font-family-primary)', fontWeight: 600 }}>
                        {kw.ads_competition}
                      </span>
                    )}
                    {kw.gsc_volume_range && (
                      <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>{kw.gsc_volume_range}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested keywords (from Ads) */}
      {suggestedKeywords && suggestedKeywords.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #f4f4f5', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9f9fa9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-family-primary)' }}>
            Suggested from Ads
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestedKeywords.map((kw, i) => (
              <div key={kw.keyword + i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: '#f3eeff', border: '1px solid #ddd6fe' }}>
                <span style={{ fontSize: 12, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }}>{kw.keyword}</span>
                {kw.ads_monthly_volume != null && (
                  <span style={{ fontSize: 11, color: '#6d28d9', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>{kw.ads_monthly_volume.toLocaleString()}/mo</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptSuggestion?.(kw); }}
                  style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: 'none', background: '#783afb', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                >+ Add</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismissSuggestion?.(kw); }}
                  style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', color: '#9f9fa9', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggest button */}
      {onSuggest && (
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          style={{
            width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            background: 'transparent', color: '#783afb', border: '1px dashed #c4b5fd',
            cursor: isSuggesting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-family-primary)',
            opacity: isSuggesting ? 0.6 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => { if (!isSuggesting) e.currentTarget.style.background = '#f3eeff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {isSuggesting ? 'Fetching suggestions…' : '+ Suggest keywords from Ads'}
        </button>
      )}
    </div>
  );
};

export default KeywordResearchSection;
```

- [ ] **Step 2: Commit**

```bash
git add components/articles/KeywordResearchSection.tsx
git commit -m "feat: add KeywordResearchSection component"
```

---

### Task 9: UI — Wire KeywordResearchSection into ContentScorePanel

**Files:**
- Modify: `components/articles/ContentScorePanel.tsx`

- [ ] **Step 1: Import and add new props interface**

At top of ContentScorePanel.tsx, add import:

```typescript
import KeywordResearchSection from './KeywordResearchSection';
```

Extend the Props interface to include new keyword-related props:

```typescript
interface Props {
  // ... existing props ...
  articleId?: number;
  onKeywordsChanged?: () => void;
}
```

- [ ] **Step 2: Add keyword state and handlers**

Inside the component, after existing state declarations:

```typescript
  const [keywords, setKeywords] = useState<any[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Fetch keywords when panel opens (via nlpOpen)
  useEffect(() => {
    if (!nlpOpen || !articleId) return;
    setIsLoadingKeywords(true);
    fetch(`/api/articles/${articleId}/keywords`)
      .then(r => r.json())
      .then(d => {
        const kws = (d.keywords || []).map((k: any) => ({
          ...k,
          is_covered: !!k.is_covered,
          opportunity_score: computeOpportunityScore({
            gsc_position: k.gsc_position,
            ads_monthly_volume: k.ads_monthly_volume,
            ads_competition: k.ads_competition,
            is_covered: !!k.is_covered,
          }),
        }));
        setKeywords(kws);
      })
      .catch(() => {})
      .finally(() => setIsLoadingKeywords(false));
  }, [nlpOpen, articleId]);

  // Auto-enrich on first load if no keywords have ads_monthly_volume
  useEffect(() => {
    if (!nlpOpen || !articleId || keywords.length === 0) return;
    const hasEnriched = keywords.some((k: any) => k.ads_monthly_volume != null);
    if (!hasEnriched && plainText) {
      fetch(`/api/articles/${articleId}/keywords/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.map((k: any) => k.keyword),
          targetKeyword: keyword,
          plainText,
        }),
      }).then(r => r.json()).then(d => {
        if (d.keywords) {
          setKeywords(d.keywords.map((k: any) => ({
            ...k,
            is_covered: !!k.is_covered,
            opportunity_score: computeOpportunityScore({
              gsc_position: k.gsc_position,
              ads_monthly_volume: k.ads_monthly_volume,
              ads_competition: k.ads_competition,
              is_covered: !!k.is_covered,
            }),
          })));
        }
      }).catch(() => {});
    }
  }, [nlpOpen, keywords.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggest = async () => {
    if (!articleId) return;
    setIsSuggesting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/keywords/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeyword: keyword }),
      });
      const data = await res.json();
      setSuggestedKeywords(data.suggestions || []);
    } catch { /* ignore */ }
    finally { setIsSuggesting(false); }
  };

  const handleAcceptSuggestion = async (kw: any) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
    setKeywords(prev => [...prev, { ...kw, source: 'ads_suggestion', is_covered: false, opportunity_score: computeOpportunityScore({ gsc_position: null, ads_monthly_volume: kw.avgMonthlySearches || 0, ads_competition: kw.competition, is_covered: false }) }]);
    // Persist to DB
    if (articleId) {
      fetch(`/api/articles/${articleId}/keywords/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: [kw.keyword],
          targetKeyword: keyword,
          plainText,
        }),
      }).catch(() => {});
    }
  };

  const handleDismissSuggestion = (kw: any) => {
    setSuggestedKeywords(prev => prev.filter(k => k.keyword !== kw.keyword));
  };

  const handleToggleCoverage = async (kw: any) => {
    const newCovered = !kw.is_covered;
    setKeywords(prev => prev.map(k => k.keyword === kw.keyword ? { ...k, is_covered: newCovered } : k));
    if (kw.id && articleId) {
      fetch(`/api/articles/${articleId}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordId: kw.id, is_covered: newCovered }),
      }).catch(() => {});
    }
  };
```

Also import `computeOpportunityScore` at the top:

```typescript
import { computeOpportunityScore } from '../../lib/keywordEnrichment';
```

- [ ] **Step 3: Replace old NLP terms list with KeywordResearchSection**

In the render, inside `{nlpOpen && (...)}`, replace the existing search input + terms list with:

```typescript
          {nlpOpen && (
            <div style={{ padding: '0 0 12px' }}>
              <KeywordResearchSection
                keywords={keywords}
                isLoading={isLoadingKeywords}
                onSuggest={handleSuggest}
                isSuggesting={isSuggesting}
                suggestedKeywords={suggestedKeywords}
                onAcceptSuggestion={handleAcceptSuggestion}
                onDismissSuggestion={handleDismissSuggestion}
                onToggleCoverage={handleToggleCoverage}
              />
            </div>
          )}
```

Remove the old search input (`<input type="text" placeholder="Search terms"...`) and the `filteredTerms.map(...)` block.

- [ ] **Step 4: Pass articleId prop from parent page**

In `pages/articles/[id]/index.tsx`, pass `articleId={article.id}` to ContentScorePanel:

```typescript
<ContentScorePanel
  // ... existing props ...
  articleId={article.id}
/>
```

- [ ] **Step 5: Commit**

```bash
git add components/articles/ContentScorePanel.tsx pages/articles/[id]/index.tsx
git commit -m "feat: wire KeywordResearchSection into ContentScorePanel"
```

---

### Task 10: UI — Cannibalization warning in ImportContentModal

**Files:**
- Modify: `components/articles/ImportContentModal.tsx`

- [ ] **Step 1: Add cannibalization state and check**

After the `handleImport` function, add `useEffect` for cannibalization check when keywords change:

At the top of the component, add state:

```typescript
  const [cannibalWarnings, setCannibalWarnings] = useState<string[]>([]);
```

Add a check after keywords change (add as a `useEffect`):

```typescript
  // Check cannibalization when keywords change
  useEffect(() => {
    if (keywords.length === 0 || !domains.length) return;
    const domainSlug = domains[0]?.domain || '';
    if (!domainSlug) return;
    fetch(`/api/domains/${domainSlug}/cannibalization?keyword=${encodeURIComponent(keywords[0])}`)
      .then(r => r.json())
      .then(d => {
        if (d.cannibalized?.length) {
          setCannibalWarnings(d.cannibalized.map((c: any) =>
            `"${c.keyword}" already targeted by: ${c.articles.map((a: any) => a.title).join(', ')}`
          ));
        } else {
          setCannibalWarnings([]);
        }
      })
      .catch(() => {});
  }, [keywords, domains]);
```

- [ ] **Step 2: Add warning banner UI**

After the URL input section, before the bottom bar, add:

```typescript
              {cannibalWarnings.length > 0 && (
                <div style={{
                  padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6,
                  marginTop: 8,
                }}>
                  {cannibalWarnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                      <span style={{ fontSize: 12, color: '#92400e', fontFamily: 'var(--font-family-primary)' }}>{w}</span>
                    </div>
                  ))}
                </div>
              )}
```

- [ ] **Step 3: Commit**

```bash
git add components/articles/ImportContentModal.tsx
git commit -m "feat: add cannibalization warning to import modal"
```

---

### Task 11: UI — InternalLinksPanel shared keyword count

**Files:**
- Modify: `components/articles/InternalLinksPanel.tsx`

- [ ] **Step 1: Add shared keyword count to link suggestions**

When displaying fetched links during the "done" phase, fetch and show shared keyword count.

Add a prop `articleKeywords?: string[]` to the `Props` interface.

In the results display (`{results.map(...)}`), after the URL pathname span, add:

```typescript
                {r.success && sharedKeywordCount > 0 && (
                  <span style={{ fontSize: 11, color: '#783afb', background: '#f3eeff', borderRadius: 4, padding: '1px 6px', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>
                    {sharedKeywordCount} shared KW
                  </span>
                )}
```

The shared keyword count logic: pass article keywords from parent page, cross-reference with linked article keywords.

- [ ] **Step 2: Commit**

```bash
git add components/articles/InternalLinksPanel.tsx
git commit -m "feat: show shared keyword count in internal links panel"
```

---

### Task 12: Content Score — keyword coverage dimension

**Files:**
- Modify: `lib/contentScore.ts`

- [ ] **Step 1: Add keyword_coverage signal to computeContentScore**

After the FAQ coverage block (line ~252), add:

```typescript
   // ── Keyword coverage ──
   if (keywordCoverage !== undefined && keywordCoverage.length > 0) {
      const coveredCount = keywordCoverage.filter((k: any) => k.is_covered).length;
      add((coveredCount / keywordCoverage.length) * 10, 10);
   }
```

Add the parameter to the function signature after `keyword?: string,`:

```typescript
   keywordCoverage?: Array<{ keyword: string; is_covered: boolean }>,
```

- [ ] **Step 2: Pass keyword coverage from ContentScorePanel**

In `ContentScorePanel.tsx`, when calling `computeContentScore`, pass keyword coverage:

```typescript
keywordCoverage: keywords.map((k: any) => ({ keyword: k.keyword, is_covered: k.is_covered })),
```

- [ ] **Step 3: Commit**

```bash
git add lib/contentScore.ts components/articles/ContentScorePanel.tsx
git commit -m "feat: add keyword coverage dimension to content score"
```

---

### Task 13: Auto-enrich triggers — import flow

**Files:**
- Modify: `pages/api/articles/import.ts`
- Modify: `pages/api/articles/generate.ts`

- [ ] **Step 1: Trigger enrichment after article import**

In `pages/api/articles/import.ts`, after the INSERT that creates the article (line ~392), add:

```typescript
      // Auto-enrich: trigger keyword enrichment in background (not awaited)
      if (keywords.length > 0) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'}/api/articles/${articleId}/keywords/enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: keywords as string[],
            targetKeyword: (keywords as string[])[0] || title,
            plainText,
          }),
        }).catch(() => {}); // fire-and-forget
      }
```

Note: `articleId` comes from the INSERT result — it's `(articleId as any)`. Use the `articleId` variable that already exists from the destructuring.

- [ ] **Step 2: Also trigger on article generate (if applicable)**

In `pages/api/articles/generate.ts`, after article creation, add the same enrichment call.

- [ ] **Step 3: Commit**

```bash
git add pages/api/articles/import.ts pages/api/articles/generate.ts
git commit -m "feat: auto-enrich keywords on article import and generate"
```

---

### Note: Feature 6 (Content Brief Generator)

Deferred — requires a "Create new article from scratch" UI flow that doesn't currently exist (articles are imported or generated via ImportContentModal). The `/api/articles/[id]/keywords/suggest` endpoint (Task 5) provides the same keyword suggestion data; when a "new article" creation flow is added, it can reuse this endpoint to build a keyword checklist.

### Note: Feature 4 (Keyword Gap) UI

The API endpoint is created in Task 6. The KeywordResearchSection component (Task 8) should fetch gap data when `articleId` is available and show competitor-only keywords with a "competitor" badge. This is left as an incremental enhancement — the gap endpoint returns data, and the component can be extended to call it and render gap keywords.

## Execution Order

```
Task 1 (DB) ──► Task 2 (Utils) ──► Task 3 (API: Keywords)
                                      Task 4 (API: Enrich)    ──┐
                                      Task 5 (API: Suggest)     │
                                      Task 6 (API: Gap)         ├──► Task 8 (UI: Component) ──► Task 9 (UI: Panel)
                                      Task 7 (API: Cannib)    ──┘
                                                                     Task 10 (UI: Import)
                                                                     Task 11 (UI: Links)
                                                                     Task 12 (Score)
                                      Task 13 (Triggers) ─────────── (last — depends on API endpoints)
```

Tasks 1-2 must come first. Tasks 3-7 are parallel. Tasks 8-9 depend on API. Tasks 10-12 are independent UI tweaks. Task 13 is last.
