# SERP Research Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-warm competitor outlines during deep analysis, redesign ResearchOutlinePanel with SERP Insights + gap analysis + PAA tab, and add a hover panel to the FeaturedImageBlock.

**Architecture:** Nine tasks. Tasks 1–2 are standalone server-side changes. Task 3 creates a testable utility file. Tasks 4–7 build up ResearchOutlinePanel incrementally (rename → SERP Insights → gap analysis → PAA). Task 8 wires new props from the article page. Task 9 extends FeaturedImageBlock in ArticleEditor.

**Tech Stack:** Next.js API routes (TypeScript), React 18, TipTap, Jest + @testing-library/react

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `pages/api/articles/deep-analysis.ts` | Modify | Fire `/competitor-outlines` sidecar as background promise after Step 5; await + write to DB before `res.end()` |
| `pages/api/articles/generate-outline.ts` | Modify | Accept `currentHeadings` in request body; add to DeepSeek prompt |
| `lib/researchUtils.ts` | Create | `jaccardSimilarity`, `classifyHeadingStatus`, `isPaaCovered`, `computeSerpInsights` — pure, tested |
| `__tests__/components/ResearchUtils.test.ts` | Create | Unit tests for the four utility functions |
| `components/articles/ResearchOutlinePanel.tsx` | Modify | New props, rename labels, remove per-comp buttons, SERP Insights, gap analysis, PAA tab |
| `pages/articles/[id]/index.tsx` | Modify | Add `editorHeadings` state, wire `onHeadingsChange`, pass new props to `ResearchOutlinePanel` |
| `components/articles/ArticleEditor.tsx` | Modify | Extend `FeaturedImageBlock` with hover panel; add `updateFeaturedImage` helper |

---

## Task 1: Background competitor cache in deep-analysis.ts

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts` (around line 465 and line 683)

- [ ] **Step 1: Locate the insertion points**

  Open `pages/api/articles/deep-analysis.ts`. Find:
  - Line ~465: `sse(res, 'progress', { step: 'serp', status: 'done' });` — this is the end of Step 5; insert the background promise start here.
  - Line ~683: `sse(res, 'done', { articleId, aiVisibilitySummary });` — insert the await + DB write before this line.

- [ ] **Step 2: Declare the background promise after Step 5 SERP**

  After the line `sse(res, 'progress', { step: 'serp', status: 'done' });` (still inside the main `try` block), add:

  ```typescript
  // ── Background: competitor outlines cache (runs during Steps 6-9) ──
  const competitorOutlinesPromise = (async () => {
    const kw = (keywords as string[])[0] || title;
    const lang = country === 'PL' ? 'pl' : 'en';
    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    const axiosLib = require('axios');
    const r = await axiosLib.post(
      `${sidecarUrl}/competitor-outlines`,
      { keyword: kw, language: lang, num: 5 },
      { timeout: 60000 },
    );
    return r.data;
  })().catch((err: any) => {
    console.warn('[deep-analysis] competitor outlines cache failed:', err.message);
    return null;
  });
  ```

- [ ] **Step 3: Await the promise and write to DB before `done`**

  Find `sse(res, 'done', { articleId, aiVisibilitySummary });` and insert directly before it:

  ```typescript
  // ── Await competitor outlines + cache (non-fatal) ──────────────────
  try {
    const outlinesData = await competitorOutlinesPromise;
    if (outlinesData?.competitors?.length) {
      await db.query(
        `UPDATE articles SET competitor_outlines_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [JSON.stringify(outlinesData), articleId] },
      );
      console.log(`[deep-analysis] cached ${outlinesData.competitors.length} competitor outlines for article ${articleId}`);
    }
  } catch (e: any) {
    console.warn('[deep-analysis] competitor outlines DB cache write failed:', e.message);
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "deep-analysis"
  ```
  Expected: no errors referencing `deep-analysis.ts`.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add pages/api/articles/deep-analysis.ts
  git commit -m "feat: pre-warm competitor outlines cache during deep analysis"
  ```

---

## Task 2: Add currentHeadings to generate-outline prompt

**Files:**
- Modify: `pages/api/articles/generate-outline.ts`

- [ ] **Step 1: Extend the request body type and destructuring**

  Replace the current destructuring (around line 14):
  ```typescript
  const { keyword, competitors = [], language = 'pl' } = req.body as {
    keyword: string;
    competitors: CompetitorOutline[];
    language?: string;
  };
  ```
  With:
  ```typescript
  const { keyword, competitors = [], language = 'pl', currentHeadings = [] } = req.body as {
    keyword: string;
    competitors: CompetitorOutline[];
    language?: string;
    currentHeadings?: Array<{ level: number; text: string }>;
  };
  ```

- [ ] **Step 2: Add currentHeadings context to the prompt**

  After `const lang = language === 'pl' ? 'Polish' : 'English';`, add:

  ```typescript
  const currentHeadingsSummary = (currentHeadings as Array<{ level: number; text: string }>).length > 0
    ? `\nCURRENT ARTICLE HEADINGS (already written — do NOT repeat these):\n${(currentHeadings as Array<{ level: number; text: string }>).map((h) => `H${h.level}: ${h.text}`).join('\n')}\n\nFOCUS: Generate a complete outline that emphasises the MISSING topics — sections not yet covered by the current article.\n`
    : '';
  ```

  Then inside the prompt template, after `COMPETITOR OUTLINES:` block and before `TASK:`, add `${currentHeadingsSummary}`.

  Full prompt becomes:
  ```typescript
  const prompt = `You are an expert SEO content strategist. Analyze these competitor outlines for the keyword "${keyword}" and create a UNIQUE, ORIGINAL article outline.

COMPETITOR OUTLINES:
${competitorSummary || 'No competitor data available — use your expertise for this keyword.'}
${currentHeadingsSummary}
TASK:
1. Identify the most important topics covered across competitors (their "median" structure)
2. Create an ORIGINAL outline covering the same important topics but with UNIQUE headings — never copy wording from competitors
3. Improve on competitors: fill gaps they missed, reorder for better flow, add value
4. Target ~${avgHeadings} headings total (H1 + H2 + H3 mix)
5. Language: ${lang}

OUTPUT FORMAT — strictly follow this, one heading per line, no other text:
H1: [title]
H2: [section]
H3: [subsection]
H2: [section]
...`;
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "generate-outline"
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add pages/api/articles/generate-outline.ts
  git commit -m "feat: pass currentHeadings to generate-outline prompt for gap-aware outlines"
  ```

---

## Task 3: Create researchUtils.ts with tested utility functions

**Files:**
- Create: `lib/researchUtils.ts`
- Create: `__tests__/components/ResearchUtils.test.ts`

- [ ] **Step 1: Write the failing tests first**

  Create `__tests__/components/ResearchUtils.test.ts`:

  ```typescript
  import {
    jaccardSimilarity,
    classifyHeadingStatus,
    isPaaCovered,
    computeSerpInsights,
  } from '../../lib/researchUtils';

  describe('jaccardSimilarity', () => {
    it('returns 0 for completely different strings', () => {
      expect(jaccardSimilarity('apple orange', 'banana grape')).toBe(0);
    });

    it('returns 1 for identical strings', () => {
      expect(jaccardSimilarity('machine learning guide', 'machine learning guide')).toBe(1);
    });

    it('returns ~0.5 for 50% overlap', () => {
      // words > 3 chars: 'machine', 'learning' overlap; 'guide' vs 'tools' differ
      const result = jaccardSimilarity('machine learning guide', 'machine learning tools');
      expect(result).toBeGreaterThanOrEqual(0.49);
      expect(result).toBeLessThanOrEqual(0.51);
    });

    it('ignores words with 3 or fewer characters', () => {
      // 'the', 'and', 'of' are short — stripped. Result based on longer words only.
      expect(jaccardSimilarity('the and of', 'the and of')).toBe(0);
    });
  });

  describe('classifyHeadingStatus', () => {
    const currentHeadings = [
      { level: 2, text: 'Introduction to machine learning' },
      { level: 2, text: 'Deep learning fundamentals' },
    ];

    it('returns "covered" when overlap >= 50%', () => {
      expect(classifyHeadingStatus({ level: 2, text: 'machine learning introduction' }, currentHeadings)).toBe('covered');
    });

    it('returns "expand" when overlap is 20-49%', () => {
      // 'learning' overlaps; other words differ
      expect(classifyHeadingStatus({ level: 2, text: 'learning basics overview practical' }, currentHeadings)).toBe('expand');
    });

    it('returns "missing" when overlap < 20%', () => {
      expect(classifyHeadingStatus({ level: 2, text: 'natural language processing text' }, currentHeadings)).toBe('missing');
    });

    it('returns "missing" when currentHeadings is empty', () => {
      expect(classifyHeadingStatus({ level: 2, text: 'anything here' }, [])).toBe('missing');
    });
  });

  describe('isPaaCovered', () => {
    const currentHeadings = [
      { level: 2, text: 'machine learning algorithms explained' },
    ];

    it('returns true when question overlaps a heading >= 50%', () => {
      expect(isPaaCovered('What are machine learning algorithms?', currentHeadings)).toBe(true);
    });

    it('returns false when no heading overlaps >= 50%', () => {
      expect(isPaaCovered('How do neural networks process images?', currentHeadings)).toBe(false);
    });

    it('returns false when currentHeadings is empty', () => {
      expect(isPaaCovered('anything', [])).toBe(false);
    });
  });

  describe('computeSerpInsights', () => {
    const competitors = [
      { url: 'a', title: 'A', favicon: '', heading_count: 5, word_count: 1000, headings: [{ level: 2, text: 'machine learning basics guide' }, { level: 2, text: 'project management tools best' }] },
      { url: 'b', title: 'B', favicon: '', heading_count: 5, word_count: 2000, headings: [{ level: 2, text: 'machine learning basics guide' }, { level: 2, text: 'project management tools list' }] },
      { url: 'c', title: 'C', favicon: '', heading_count: 5, word_count: 3000, headings: [{ level: 2, text: 'machine learning basics tutorial' }, { level: 2, text: 'project management tools comparison' }] },
    ];

    it('computes average word count', () => {
      const { avgWordCount } = computeSerpInsights(competitors);
      expect(avgWordCount).toBe(2000);
    });

    it('returns words appearing in >= 3 competitors', () => {
      const { commonTopics } = computeSerpInsights(competitors);
      expect(commonTopics).toContain('machine');
      expect(commonTopics).toContain('learning');
      expect(commonTopics).toContain('basics');
      expect(commonTopics).toContain('project');
      expect(commonTopics).toContain('management');
      expect(commonTopics).toContain('tools');
    });

    it('excludes words appearing in < 3 competitors', () => {
      const { commonTopics } = computeSerpInsights(competitors);
      // 'guide' appears in only 2 competitors
      expect(commonTopics).not.toContain('guide');
    });

    it('returns empty arrays for no competitors', () => {
      const { avgWordCount, commonTopics } = computeSerpInsights([]);
      expect(avgWordCount).toBe(0);
      expect(commonTopics).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

  ```bash
  cd ~/Desktop/serpbear && npx jest __tests__/components/ResearchUtils.test.ts --no-coverage 2>&1 | tail -10
  ```
  Expected: `Cannot find module '../../lib/researchUtils'`

- [ ] **Step 3: Create lib/researchUtils.ts**

  ```typescript
  // lib/researchUtils.ts
  // Pure utility functions for ResearchOutlinePanel — Jaccard similarity,
  // heading gap classification, PAA coverage, and SERP Insights computation.

  import type { CompetitorOutline } from '../components/articles/ResearchOutlinePanel';

  /**
   * Jaccard similarity between two strings based on words with length > 3.
   * Returns 0–1.
   */
  export function jaccardSimilarity(a: string, b: string): number {
    const words = (s: string) =>
      new Set(s.toLowerCase().replace(/[^a-ząćęłńóśźża-z\s]/gi, '').split(/\s+/).filter((w) => w.length > 3));
    const setA = words(a);
    const setB = words(b);
    if (setA.size === 0 && setB.size === 0) return 0;
    const intersection = new Set([...setA].filter((w) => setB.has(w)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  /**
   * Classify a generated heading against the current article headings.
   * Uses Jaccard similarity: >= 50% → covered, 20–49% → expand, < 20% → missing.
   * When currentHeadings is empty all headings are 'missing' (new article).
   */
  export function classifyHeadingStatus(
    heading: { level: number; text: string },
    currentHeadings: Array<{ level: number; text: string }>,
  ): 'covered' | 'expand' | 'missing' {
    if (currentHeadings.length === 0) return 'missing';
    const maxOverlap = Math.max(...currentHeadings.map((ch) => jaccardSimilarity(heading.text, ch.text)));
    if (maxOverlap >= 0.5) return 'covered';
    if (maxOverlap >= 0.2) return 'expand';
    return 'missing';
  }

  /**
   * Check whether a PAA question is covered by any current heading (Jaccard >= 50%).
   */
  export function isPaaCovered(
    question: string,
    currentHeadings: Array<{ level: number; text: string }>,
  ): boolean {
    return currentHeadings.some((h) => jaccardSimilarity(question, h.text) >= 0.5);
  }

  /**
   * Compute SERP Insights from competitor data.
   * - avgWordCount: mean of competitor word_count values
   * - commonTopics: words (length > 3) appearing in >= 3 competitors, sorted by frequency desc
   */
  export function computeSerpInsights(competitors: CompetitorOutline[]): {
    avgWordCount: number;
    commonTopics: string[];
  } {
    if (competitors.length === 0) return { avgWordCount: 0, commonTopics: [] };

    const avgWordCount = Math.round(
      competitors.reduce((s, c) => s + (c.word_count ?? 0), 0) / competitors.length,
    );

    // word → Set of competitor indices
    const wordCompetitors = new Map<string, Set<number>>();
    competitors.forEach((comp, idx) => {
      comp.headings.forEach((h) => {
        const words = h.text
          .toLowerCase()
          .replace(/[^a-ząćęłńóśźża-z\s]/gi, '')
          .split(/\s+/)
          .filter((w) => w.length > 3);
        words.forEach((w) => {
          if (!wordCompetitors.has(w)) wordCompetitors.set(w, new Set());
          wordCompetitors.get(w)!.add(idx);
        });
      });
    });

    const threshold = Math.min(3, competitors.length);
    const commonTopics = Array.from(wordCompetitors.entries())
      .filter(([, comps]) => comps.size >= threshold)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([word]) => word);

    return { avgWordCount, commonTopics };
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd ~/Desktop/serpbear && npx jest __tests__/components/ResearchUtils.test.ts --no-coverage 2>&1 | tail -15
  ```
  Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add lib/researchUtils.ts __tests__/components/ResearchUtils.test.ts
  git commit -m "feat: add research utility functions with tests (Jaccard, gap analysis, PAA coverage)"
  ```

---

## Task 4: ResearchOutlinePanel — rename labels + remove per-competitor buttons + new props

**Files:**
- Modify: `components/articles/ResearchOutlinePanel.tsx`

- [ ] **Step 1: Add new props to the Props interface**

  Replace:
  ```typescript
  interface Props {
    keyword: string;
    articleId?: number;
    language?: string;
    onClose: () => void;
    onInsertOutline: (headings: Array<{ level: number; text: string }>) => void;
    onAiActivity?: (active: boolean) => void;
  }
  ```
  With:
  ```typescript
  interface Props {
    keyword: string;
    articleId?: number;
    language?: string;
    onClose: () => void;
    onInsertOutline: (headings: Array<{ level: number; text: string }>) => void;
    onAiActivity?: (active: boolean) => void;
    currentHeadings?: Array<{ level: number; text: string }>;
    currentWordCount?: number;
    paaQuestions?: string[];
  }
  ```

- [ ] **Step 2: Destructure the new props in the component**

  Replace:
  ```typescript
  const ResearchOutlinePanel: React.FC<Props> = ({
    keyword,
    articleId,
    language = 'pl',
    onClose,
    onInsertOutline,
    onAiActivity,
  }) => {
  ```
  With:
  ```typescript
  const ResearchOutlinePanel: React.FC<Props> = ({
    keyword,
    articleId,
    language = 'pl',
    onClose,
    onInsertOutline,
    onAiActivity,
    currentHeadings = [],
    currentWordCount,
    paaQuestions = [],
  }) => {
  ```

- [ ] **Step 3: Rename the panel header**

  Replace:
  ```typescript
  <span style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>Research & Create Outline</span>
  ```
  With:
  ```typescript
  <span style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>SERP Research</span>
  ```

- [ ] **Step 4: Rename section header "AI-Generated Outline" → "Generated Outline"**

  Replace:
  ```typescript
  <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>AI-Generated Outline</span>
  ```
  With:
  ```typescript
  <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>Generated Outline</span>
  ```

- [ ] **Step 5: Change button label based on article content**

  Replace:
  ```typescript
  {isGenerating ? 'Generating…' : 'Generate Outline'}
  ```
  With:
  ```typescript
  {isGenerating ? 'Generating…' : currentHeadings.length > 0 ? 'Analyze & Improve' : 'Create Outline'}
  ```

- [ ] **Step 6: Remove per-competitor Insert + Copy buttons**

  Find the expanded competitor card section (starting `{isExpanded && (`). Inside it, remove the entire action div at the bottom — the `<div style={{ display: 'flex', gap: 8, marginTop: 4, ...` block that contains the "Insert outline" and clipboard copy buttons. The expanded section should end at the divider line after the headings:

  Remove this block entirely:
  ```typescript
  <div style={{ height: 1, background: '#f4f4f5', marginTop: 4 }} />
  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', justifyContent: 'space-between' }}>
    <button
      type="button"
      onClick={() => onInsertOutline(comp.headings)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
        background: 'transparent', color: '#52525c', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
        boxShadow: 'inset 0 0 0 1px #e4e4e7', transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#09090b'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
    >
      Insert outline
    </button>
    <button
      type="button"
      onClick={() => {
        const text = comp.headings.map((h) => `${'  '.repeat(h.level - 1)}${h.text}`).join('\n');
        navigator.clipboard.writeText(text);
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6, border: 'none',
        background: 'transparent', color: '#52525c', cursor: 'pointer', padding: 0,
        boxShadow: 'inset 0 0 0 1px #e4e4e7', transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#09090b'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
      </svg>
    </button>
  </div>
  ```

  Also remove the top divider just above it (the one with `marginTop: 4`).

- [ ] **Step 7: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "ResearchOutlinePanel"
  ```
  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add components/articles/ResearchOutlinePanel.tsx
  git commit -m "feat: rename panel to SERP Research, adaptive button label, remove per-competitor action buttons"
  ```

---

## Task 5: ResearchOutlinePanel — SERP Insights section

**Files:**
- Modify: `components/articles/ResearchOutlinePanel.tsx`

- [ ] **Step 1: Import computeSerpInsights**

  Add to the imports at the top of `ResearchOutlinePanel.tsx`:

  ```typescript
  import { computeSerpInsights } from '../../lib/researchUtils';
  ```

- [ ] **Step 2: Add the SERP Insights section above "Competitors' Outlines"**

  Find the divider `<div style={{ height: 1, background: '#f4f4f5', flexShrink: 0 }} />` and the section `{/* ── Competitors' Outlines ── */}`. Insert the SERP Insights block between them:

  ```tsx
  {/* ── SERP Insights ─────────────────────────────────────── */}
  {!loading && competitors.length > 0 && (() => {
    const { avgWordCount, commonTopics } = computeSerpInsights(competitors);
    const visibleTopics = commonTopics.slice(0, 6);
    const hiddenCount = Math.max(0, commonTopics.length - 6);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>SERP Insights</span>

        {/* Word count comparison */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 0,
            border: '1px solid #f4f4f5', borderRadius: 8, overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, padding: '10px 14px', borderRight: '1px solid #f4f4f5' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#9f9fa9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Avg. competitor</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>{avgWordCount.toLocaleString()} words</div>
          </div>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#9f9fa9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Your article</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: currentWordCount !== undefined && currentWordCount < avgWordCount * 0.7 ? '#ef4444' : '#09090b' }}>
              {currentWordCount !== undefined ? currentWordCount.toLocaleString() : '—'} words
            </div>
          </div>
        </div>

        {/* Common topics */}
        {visibleTopics.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#9f9fa9', marginBottom: 6 }}>
              Common topics (≥3/{competitors.length} competitors)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visibleTopics.map((topic) => (
                <span
                  key={topic}
                  style={{
                    display: 'inline-block', padding: '3px 9px',
                    borderRadius: 9999, fontSize: 12, fontWeight: 500,
                    background: '#f4f4f5', color: '#3f3f47',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  {topic}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 500, background: '#f4f4f5', color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>
                  +{hiddenCount} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  })()}
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "ResearchOutlinePanel"
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add components/articles/ResearchOutlinePanel.tsx
  git commit -m "feat: add SERP Insights section with avg word count and common topics"
  ```

---

## Task 6: ResearchOutlinePanel — gap analysis on generated outline

**Files:**
- Modify: `components/articles/ResearchOutlinePanel.tsx`

- [ ] **Step 1: Import classifyHeadingStatus**

  Update the import line added in Task 5:
  ```typescript
  import { computeSerpInsights, classifyHeadingStatus } from '../../lib/researchUtils';
  ```

- [ ] **Step 2: Pass currentHeadings to the generate-outline API call**

  Find `handleGenerateOutline` and update the `fetch` body from:
  ```typescript
  body: JSON.stringify({ keyword, competitors, language }),
  ```
  To:
  ```typescript
  body: JSON.stringify({ keyword, competitors, language, currentHeadings }),
  ```

- [ ] **Step 3: Replace plain heading display with classified display**

  Find the `{/* Heading list */}` section inside the generated outline preview (the `generatedHeadings.map` block). Replace the map contents:

  Current:
  ```tsx
  {generatedHeadings.map((h, i) => (
    <div
      key={i}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 6,
        paddingLeft: headingIndent(h.level),
        fontSize: 13, lineHeight: '18px',
        color: h.level === 1 ? '#09090b' : '#3f3f47',
        fontWeight: h.level <= 2 ? 500 : 400,
      }}
    >
      <span style={{ color: '#9f9fa9', fontSize: 11, minWidth: 16, paddingTop: 3, flexShrink: 0 }}>
        {headingTag(h.level)}
      </span>
      <span>{h.text}</span>
    </div>
  ))}
  ```

  Replace with:
  ```tsx
  {generatedHeadings.map((h, i) => {
    const status = classifyHeadingStatus(h, currentHeadings);
    const dotColor = status === 'covered' ? '#1ab25e' : status === 'expand' ? '#efa00d' : '#ef4444';
    const textColor = status === 'covered' ? '#9f9fa9' : status === 'expand' ? '#3f3f47' : '#09090b';
    const fontWeight = status === 'missing' && h.level <= 2 ? 700 : h.level <= 2 ? 500 : 400;
    return (
      <div
        key={i}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          paddingLeft: headingIndent(h.level),
          fontSize: 13, lineHeight: '18px',
        }}
      >
        <span style={{ color: '#9f9fa9', fontSize: 11, minWidth: 16, paddingTop: 3, flexShrink: 0 }}>
          {headingTag(h.level)}
        </span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 6 }} />
        <span style={{ color: textColor, fontWeight }}>{h.text}</span>
      </div>
    );
  })}
  ```

- [ ] **Step 4: Add a legend below the outline preview header**

  Find the preview header `<div style={{ padding: '10px 12px 8px', background: '#f8f8f9', ...` section and add a legend row after the "Generated outline · N headings" span (still inside the header div):

  ```tsx
  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
    {[
      { color: '#1ab25e', label: 'Covered' },
      { color: '#efa00d', label: 'Expand' },
      { color: '#ef4444', label: 'Missing' },
    ].map(({ color, label }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
      </div>
    ))}
  </div>
  ```

  Note: only show this legend when `currentHeadings.length > 0`. Wrap it:
  ```tsx
  {currentHeadings.length > 0 && (
    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
      {/* ... legend pills ... */}
    </div>
  )}
  ```

- [ ] **Step 5: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "ResearchOutlinePanel"
  ```
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add components/articles/ResearchOutlinePanel.tsx
  git commit -m "feat: gap analysis on generated outline — covered/expand/missing status dots"
  ```

---

## Task 7: ResearchOutlinePanel — PAA Questions tab

**Files:**
- Modify: `components/articles/ResearchOutlinePanel.tsx`

- [ ] **Step 1: Import isPaaCovered**

  Update the import:
  ```typescript
  import { computeSerpInsights, classifyHeadingStatus, isPaaCovered } from '../../lib/researchUtils';
  ```

- [ ] **Step 2: Replace the "Questions coming soon" placeholder**

  Find:
  ```tsx
  {tab === 'questions' && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
      <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#9f9fa9" strokeWidth={1}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeWidth={2} />
      </svg>
      <span style={{ fontSize: 14, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>Questions coming soon</span>
    </div>
  )}
  ```

  Replace with:
  ```tsx
  {tab === 'questions' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>People Also Ask</span>
      <span style={{ fontSize: 13, color: '#52525c' }}>
        Coverage based on your current headings
      </span>

      {paaQuestions.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>
            No PAA questions found — run deep analysis to fetch them.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {paaQuestions.map((q, i) => {
            const covered = isPaaCovered(q, currentHeadings);
            return (
              <div
                key={i}
                style={{
                  border: '1px solid #f4f4f5',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>❓</span>
                  <span style={{ fontSize: 13, color: '#3f3f47', lineHeight: '18px', fontWeight: 500 }}>{q}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 22 }}>
                  <div
                    style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: covered ? '#1ab25e' : '#ef4444',
                    }}
                  />
                  <span style={{ fontSize: 12, color: covered ? '#1ab25e' : '#ef4444', fontWeight: 500 }}>
                    {covered ? 'Covered' : 'Not covered'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "ResearchOutlinePanel"
  ```
  Expected: no errors.

- [ ] **Step 4: Run all tests to verify nothing broke**

  ```bash
  cd ~/Desktop/serpbear && npx jest --no-coverage --ci 2>&1 | tail -15
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add components/articles/ResearchOutlinePanel.tsx
  git commit -m "feat: PAA questions tab with coverage status against current headings"
  ```

---

## Task 8: Wire new props to ResearchOutlinePanel in the article page

**Files:**
- Modify: `pages/articles/[id]/index.tsx`

- [ ] **Step 1: Add editorHeadings state and HeadingItem import**

  At the top of the file, find the `ArticleEditor` dynamic import and ensure `HeadingItem` type is available. Add:
  ```typescript
  import type { HeadingItem } from '../../../components/articles/ArticleEditor';
  ```
  (This type is already exported from ArticleEditor — `export interface HeadingItem { level: number; text: string; pos: number; }`)

  In the component body, after the `[wordCount, setWordCount]` state (around line 111), add:
  ```typescript
  const [editorHeadings, setEditorHeadings] = useState<HeadingItem[]>([]);
  ```

- [ ] **Step 2: Wire onHeadingsChange on ArticleEditor**

  Find the `<ArticleEditor` JSX block (around line 893). Add the `onHeadingsChange` prop:
  ```tsx
  <ArticleEditor
    editorRef={editorRef}
    content={article.content || ''}
    keyword={article.target_keyword}
    metaTitle={article.meta_title}
    metaDescription={article.meta_description}
    scoreData={scoreData}
    internalArticles={internalArticles}
    reviewMode={!!linkBar}
    onAiActivity={setSurfyAiActive}
    onChange={handleEditorChange}
    onMetaTitleChange={handleMetaTitleChange}
    onMetaDescriptionChange={handleMetaDescriptionChange}
    initialFeaturedImage={featuredImage}
    onFeaturedImageChange={setFeaturedImage}
    onHeadingsChange={setEditorHeadings}
  />
  ```

- [ ] **Step 3: Pass new props to ResearchOutlinePanel**

  Find the `<ResearchOutlinePanel` JSX block (around line 1025). Replace:
  ```tsx
  <ResearchOutlinePanel
    keyword={article.target_keyword || ''}
    articleId={article.id}
    language={article.target_keyword ? 'pl' : 'en'}
    onClose={() => setShowResearchPanel(false)}
    onInsertOutline={handleInsertOutline}
    onAiActivity={setResearchAiActive}
  />
  ```
  With:
  ```tsx
  <ResearchOutlinePanel
    keyword={article.target_keyword || ''}
    articleId={article.id}
    language={article.target_keyword ? 'pl' : 'en'}
    onClose={() => setShowResearchPanel(false)}
    onInsertOutline={handleInsertOutline}
    onAiActivity={setResearchAiActive}
    currentHeadings={editorHeadings.map((h) => ({ level: h.level, text: h.text }))}
    currentWordCount={wordCount}
    paaQuestions={scoreData.paa_questions}
  />
  ```

- [ ] **Step 4: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -E "articles/\[id\]|ResearchOutlinePanel"
  ```
  Expected: no errors in these files.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add pages/articles/\[id\]/index.tsx
  git commit -m "feat: wire editorHeadings, wordCount, paaQuestions into ResearchOutlinePanel"
  ```

---

## Task 9: FeaturedImageBlock hover panel + onFeaturedImageChange bug fix

**Files:**
- Modify: `components/articles/ArticleEditor.tsx`

- [ ] **Step 1: Extend FeaturedImageBlock props interface**

  Replace:
  ```typescript
  const FeaturedImageBlock = ({
    imageUrl, imageAlt,
  }: {
    imageUrl?: string;
    imageAlt?: string;
  }) => {
  ```
  With:
  ```typescript
  const FeaturedImageBlock = ({
    imageUrl, imageAlt, keyword,
    onImageChange, onImageRemove,
  }: {
    imageUrl?: string;
    imageAlt?: string;
    keyword?: string;
    onImageChange?: (img: { url: string; alt: string }) => void;
    onImageRemove?: () => void;
  }) => {
  ```

- [ ] **Step 2: Add state variables to FeaturedImageBlock**

  Inside `FeaturedImageBlock`, after `const [collapsed, setCollapsed] = useState(false);`, add:

  ```typescript
  const [isHovered, setIsHovered] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [altText, setAltText] = useState(imageAlt || '');
  const featuredFileInputRef = useRef<HTMLInputElement>(null);

  // Sync altText when parent provides a new image with a different alt (e.g. AI generate)
  useEffect(() => {
    setAltText(imageAlt || '');
  }, [imageAlt]);
  ```

  `useRef` and `useEffect` are already imported at the top of `ArticleEditor.tsx` — no import changes needed.

- [ ] **Step 3: Add handleAiGenerate function to FeaturedImageBlock**

  Inside the component body, add:

  ```typescript
  const handleAiGenerate = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: prompt, title: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onImageChange?.({ url: data.url, alt: data.alt || prompt });
        setAiPrompt('');
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setIsGenerating(false);
    }
  };
  ```

- [ ] **Step 4: Replace the image markup in FeaturedImageBlock with the hover panel**

  Replace the current `{!collapsed && (...)}` block with:

  ```tsx
  {!collapsed && (
    <div
      style={{ background: '#fff', borderBottom: '1px solid #e4e4e7', padding: '16px 16px 12px', marginBottom: 8 }}
    >
      {/* Image container with hover overlay */}
      <div
        style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={imageUrl}
          alt={altText || 'Featured image'}
          style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
        />

        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: isHovered ? 'auto' : 'none',
          }}
        />

        {/* Bottom toolbar */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(9,9,11,0.88)',
            transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
            borderRadius: '0 0 8px 8px',
            padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          {/* AI prompt row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="18" height="18" viewBox="0 0 19 20" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1.92383 5.67187C1.92383 3.60081 3.60276 1.92188 5.67383 1.92188H14.3279C16.399 1.92188 18.0779 3.60081 18.0779 5.67188V14.326C18.0779 16.397 16.399 18.076 14.3279 18.076H5.67383C3.60276 18.076 1.92383 16.397 1.92383 14.326V5.67187Z" fill="white" />
              <path d="M6.15039 7.05909C6.15039 6.55062 6.15039 6.29639 6.30835 6.13843C6.46631 5.98047 6.72054 5.98047 7.22901 5.98047H7.56271C8.07118 5.98047 8.32541 5.98047 8.48337 6.13843C8.64133 6.29639 8.64133 6.55062 8.64133 7.05909V10.4451C8.64133 10.9535 8.64133 11.2078 8.48337 11.3657C8.32541 11.5237 8.07118 11.5237 7.56272 11.5237H7.22901C6.72054 11.5237 6.46631 11.5237 6.30835 11.3657C6.15039 11.2078 6.15039 10.9535 6.15039 10.4451V7.05909Z" fill="black" />
              <path d="M11.3164 7.05909C11.3164 6.55062 11.3164 6.29639 11.4744 6.13843C11.6323 5.98047 11.8866 5.98047 12.395 5.98047H12.7287C13.2372 5.98047 13.4914 5.98047 13.6494 6.13843C13.8073 6.29639 13.8073 6.55062 13.8073 7.05909V10.4451C13.8073 10.9535 13.8073 11.2078 13.6494 11.3657C13.4914 11.5237 13.2372 11.5237 12.7287 11.5237H12.395C11.8866 11.5237 11.6323 11.5237 11.4744 11.3657C11.3164 11.2078 11.3164 10.9535 11.3164 10.4451V7.05909Z" fill="black" />
            </svg>
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(aiPrompt || keyword || ''); }}
              placeholder="Describe the image you want to generate…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', outline: 'none',
                borderRadius: 5, padding: '4px 8px', fontSize: 12, color: '#fff',
                fontFamily: 'var(--font-family-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => handleAiGenerate(aiPrompt || keyword || '')}
              disabled={isGenerating}
              style={{
                width: 26, height: 26, borderRadius: 5, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {isGenerating ? (
                <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Regenerate */}
            <button
              type="button"
              onClick={() => handleAiGenerate(altText || keyword || '')}
              disabled={isGenerating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 5, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                fontSize: 12, cursor: isGenerating ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-family-primary)',
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Regenerate
            </button>

            {/* Pixabay */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('surfer:open-pixabay', {
                  detail: { onSelect: (img: { url: string; alt: string }) => { onImageChange?.(img); } },
                }));
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 5, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Pixabay
            </button>

            {/* Upload */}
            <input
              ref={featuredFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  onImageChange?.({ url: reader.result as string, alt: altText || keyword || '' });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => featuredFileInputRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 5, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
              }}
            >
              Upload
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Remove */}
            <button
              type="button"
              onClick={onImageRemove}
              title="Remove featured image"
              style={{
                width: 26, height: 26, borderRadius: 5, border: 'none',
                background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Alt text row — always visible when image exists */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#9f9fa9', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>Alt</span>
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Alt text…"
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 12,
            color: '#374151', fontFamily: 'var(--font-family-primary)',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  )}
  ```

- [ ] **Step 5: Add updateFeaturedImage helper in ArticleEditor**

  Inside the `ArticleEditor` component body, after the `featuredImage` state declaration (line ~337), add:

  ```typescript
  const updateFeaturedImage = (img: { url: string; alt: string } | null) => {
    setFeaturedImage(img);
    onFeaturedImageChange?.(img);
  };
  ```

- [ ] **Step 6: Update the FeaturedImageBlock call site to use new props**

  Find the `<FeaturedImageBlock` JSX (around line 600) and replace:
  ```tsx
  <FeaturedImageBlock
    imageUrl={featuredImage?.url}
    imageAlt={featuredImage?.alt}
  />
  ```
  With:
  ```tsx
  <FeaturedImageBlock
    imageUrl={featuredImage?.url}
    imageAlt={featuredImage?.alt}
    keyword={keyword}
    onImageChange={(img) => updateFeaturedImage(img)}
    onImageRemove={() => updateFeaturedImage(null)}
  />
  ```

- [ ] **Step 7: TypeScript check**

  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep "ArticleEditor"
  ```
  Expected: no errors.

- [ ] **Step 8: Run all tests**

  ```bash
  cd ~/Desktop/serpbear && npx jest --no-coverage --ci 2>&1 | tail -15
  ```
  Expected: all tests pass.

- [ ] **Step 9: Commit**

  ```bash
  cd ~/Desktop/serpbear
  git add components/articles/ArticleEditor.tsx
  git commit -m "feat: FeaturedImageBlock hover panel with AI/Pixabay/Upload/Remove; fix onFeaturedImageChange callback"
  ```

---

## Post-implementation verification

- [ ] Run full TypeScript check across all changed files:
  ```bash
  cd ~/Desktop/serpbear && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
  ```
  Expected: zero errors in the modified files (pre-existing errors in `pages/sites/[domain]/` are unrelated and can be ignored).

- [ ] Run full test suite:
  ```bash
  cd ~/Desktop/serpbear && npx jest --no-coverage --ci 2>&1 | tail -5
  ```
  Expected: all tests pass.
