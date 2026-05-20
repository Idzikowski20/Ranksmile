# Article Editor AI — Sub-project A1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend auto-optimize into a 3-phase pipeline (NLP → Humanizer → FAQ/PAA), add Brand Voice per domain, and add a SERP Fit score gauge to ContentScorePanel.

**Architecture:** Brand Voice is stored as a new `brand_voice` column in the `domain` table; it flows from DomainSettings UI → PUT /api/domains → stored in DB → read when the article editor calls POST /api/articles/auto-optimize. The auto-optimize route gains two new sequential phases after NLP optimization: a humanizer DeepSeek call and a Serper PAA + DeepSeek FAQ call. SERP Fit is computed client-side in ContentScorePanel from the already-loaded `competitor_outlines_cache` field on the article and the live editor text.

**Tech Stack:** Next.js 13 (App Router–free), Sequelize + SQLite, Umzug migrations, TipTap editor, React (hooks), DeepSeek API, Serper.dev API

---

## File Map

| File | Action |
|------|--------|
| `database/migrations/1748100000000-add-domain-brand-voice-field.js` | Create: Umzug migration adding `brand_voice` column to `domain` table |
| `database/models/domain.ts` | Modify: add `brand_voice` Sequelize column |
| `types.d.ts` | Modify: add `brand_voice` to `DomainType` and `DomainSettings` |
| `pages/api/domains.ts` | Modify: read + write `brand_voice` in `updateDomain` |
| `components/domains/DomainSettings.tsx` | Modify: add "Brand Voice" tab with textarea |
| `pages/api/articles/auto-optimize.ts` | Modify: accept `brandVoice`, add humanizer + FAQ phases |
| `pages/articles/[id]/index.tsx` | Modify: expose `competitor_outlines_cache` on Article type, pass `brandVoice` to auto-optimize fetch |
| `python-sidecar/analyzers/serp_analyzer.py` | Modify: add `word_count` to competitor outline output |
| `components/articles/ContentScorePanel.tsx` | Modify: accept `competitorCache` prop, compute + render SERP Fit gauge |

---

## Task 1: DB migration — add brand_voice column

**Files:**
- Create: `database/migrations/1748100000000-add-domain-brand-voice-field.js`

- [ ] **Step 1: Create the migration file**

```js
// database/migrations/1748100000000-add-domain-brand-voice-field.js
// Migration: Adds brand_voice field to domain table for AI prompt personalisation.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tableDefinition = await queryInterface.describeTable('domain');
            if (tableDefinition && !tableDefinition.brand_voice) {
               await queryInterface.addColumn(
                  'domain',
                  'brand_voice',
                  { type: Sequelize.DataTypes.TEXT, allowNull: true, defaultValue: '' },
                  { transaction: t },
               );
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tableDefinition = await queryInterface.describeTable('domain');
            if (tableDefinition && tableDefinition.brand_voice) {
               await queryInterface.removeColumn('domain', 'brand_voice', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
```

- [ ] **Step 2: Verify migration appears as pending**

Open browser → navigate to `/api/dbmigrate` (GET).  
Expected: `{"hasMigrations": true}`

- [ ] **Step 3: Run the migration**

Open browser → POST to `/api/dbmigrate` (can use curl or browser devtools):

```bash
curl -s -X POST http://localhost:3000/api/dbmigrate \
  -H "Content-Type: application/json" \
  --cookie "appSession=..." | cat
```

Expected: `{"migrated": true}`

Alternatively, restart the Next.js dev server and navigate to the domain settings — the migration runs on startup if you add it to the existing migration runner.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/1748100000000-add-domain-brand-voice-field.js
git commit -m "feat: add brand_voice migration for domain table"
```

---

## Task 2: Domain model + global types

**Files:**
- Modify: `database/models/domain.ts`
- Modify: `types.d.ts`

- [ ] **Step 1: Add brand_voice column to Sequelize model**

In `database/models/domain.ts`, after the `subdomain_matching` column (line ~55), add:

```typescript
   @Column({ type: DataType.TEXT, allowNull: true, defaultValue: '' })
   brand_voice!: string;
```

The full tail of the class should look like:

```typescript
   @Column({ type: DataType.STRING, allowNull: true, defaultValue: '' })
   subdomain_matching!: string;

   @Column({ type: DataType.TEXT, allowNull: true, defaultValue: '' })
   brand_voice!: string;

   // Auth0 user ID — null oznacza domenę "wspólną" (legacy / nie przypisaną)
   @Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
   userId!: string | null;
```

- [ ] **Step 2: Add brand_voice to DomainType and DomainSettings in types.d.ts**

In `types.d.ts`, extend `DomainType` (around line 26) to add:

```typescript
   brand_voice?: string,
```

Extend `DomainSettings` (around line 92) to add:

```typescript
   brand_voice?: string,
```

The updated `DomainSettings` type should be:

```typescript
type DomainSettings = {
   notification_interval: string,
   notification_emails: string,
   search_console?: DomainSearchConsole,
   scrape_strategy?: ScrapeStrategy | '',
   scrape_pagination_limit?: number,
   scrape_smart_full_fallback?: boolean,
   subdomain_matching?: string,
   brand_voice?: string,
}
```

- [ ] **Step 3: Commit**

```bash
git add database/models/domain.ts types.d.ts
git commit -m "feat: add brand_voice to Domain model and types"
```

---

## Task 3: Domain API — read and write brand_voice

**Files:**
- Modify: `pages/api/domains.ts`

- [ ] **Step 1: Update updateDomain to read and save brand_voice**

In `pages/api/domains.ts`, in the `updateDomain` function (around line 134), the destructure currently is:

```typescript
   const {
      notification_interval, notification_emails, search_console,
      scrape_strategy, scrape_pagination_limit, scrape_smart_full_fallback,
      subdomain_matching,
   } = req.body as DomainSettings;
```

Add `brand_voice`:

```typescript
   const {
      notification_interval, notification_emails, search_console,
      scrape_strategy, scrape_pagination_limit, scrape_smart_full_fallback,
      subdomain_matching, brand_voice,
   } = req.body as DomainSettings;
```

Then in the `domainToUpdate.set({...})` call (around line 154), add:

```typescript
         subdomain_matching: subdomain_matching || '',
         brand_voice: brand_voice ?? '',
```

The full `set` call should become:

```typescript
         domainToUpdate.set({
            notification_interval,
            notification_emails,
            search_console: JSON.stringify(search_console),
            scrape_strategy: scrape_strategy || '',
            scrape_pagination_limit: scrape_pagination_limit || 0,
            scrape_smart_full_fallback: !!scrape_smart_full_fallback,
            subdomain_matching: subdomain_matching || '',
            brand_voice: brand_voice ?? '',
         });
```

- [ ] **Step 2: Verify manually**

Open browser devtools, navigate to a domain's settings page, check that domain data loads without errors (console should be clean).

- [ ] **Step 3: Commit**

```bash
git add pages/api/domains.ts
git commit -m "feat: persist brand_voice in domain settings API"
```

---

## Task 4: DomainSettings UI — Brand Voice tab

**Files:**
- Modify: `components/domains/DomainSettings.tsx`

- [ ] **Step 1: Add "brandvoice" tab to currentTab state type and add it to the tab list**

In `DomainSettings.tsx`, the state type on line 23 is `'notification'|'searchconsole'|'scraping'`. Change it to:

```typescript
   const [currentTab, setCurrentTab] = useState<'notification'|'searchconsole'|'scraping'|'brandvoice'>('scraping');
```

In the `domainSettings` initial state (around line 25), add:

```typescript
      brand_voice: (domain && (domain as any).brand_voice) || '',
```

So the full initializer becomes:

```typescript
   const [domainSettings, setDomainSettings] = useState<DomainSettings>(() => ({
      notification_interval: domain && domain.notification_interval ? domain.notification_interval : 'never',
      notification_emails: domain && domain.notification_emails ? domain.notification_emails : '',
      search_console: domain && domain.search_console ? JSON.parse(domain.search_console) : {
         property_type: 'domain', url: '', client_email: '', private_key: '',
      },
      scrape_strategy: (domain && domain.scrape_strategy as ScrapeStrategy | '' | undefined) || '',
      scrape_pagination_limit: (domain && domain.scrape_pagination_limit) || 0,
      scrape_smart_full_fallback: (domain && domain.scrape_smart_full_fallback) || false,
      subdomain_matching: (domain && domain.subdomain_matching) || '',
      brand_voice: (domain && (domain as any).brand_voice) || '',
   }));
```

- [ ] **Step 2: Add Brand Voice tab button in the tabs list**

Find the `<ul>` of tabs (around line 84). After the Search Console `<li>`, add a new `<li>`:

```tsx
                     <li
                     className={`${tabStyle} ${currentTab === 'brandvoice' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'}`}
                     onClick={() => setCurrentTab('brandvoice')}>
                        ✍️ Brand Voice
                     </li>
```

- [ ] **Step 3: Add Brand Voice tab content panel**

Inside the `<div>` that conditionally renders tab content (after the `{currentTab === 'searchconsole' && ...}` block), add:

```tsx
                  {currentTab === 'brandvoice' && (
                     <div className="mb-4">
                        <label className='mb-1 font-semibold inline-block text-sm text-gray-700'>
                           Brand Voice
                        </label>
                        <p className='text-xs text-gray-400 mb-2'>
                           Describe your writing style, tone, target audience, and any rules the AI must follow.
                           This is injected into every AI prompt during auto-optimize.
                        </p>
                        <textarea
                           className='w-full border border-gray-200 rounded-md p-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 resize-none'
                           rows={5}
                           maxLength={2000}
                           placeholder='e.g. "Friendly but authoritative tone, targeting Polish small business owners. Avoid jargon. Use short sentences. Always recommend consulting a professional."'
                           value={domainSettings.brand_voice || ''}
                           onChange={(e) => setDomainSettings({ ...domainSettings, brand_voice: e.target.value })}
                        />
                        <p className='text-xs text-gray-400 text-right mt-1'>
                           {(domainSettings.brand_voice || '').length} / 2000
                        </p>
                     </div>
                  )}
```

- [ ] **Step 4: Verify in browser**

Open Domain Settings modal → click "✍️ Brand Voice" tab → type something → click Save.  
In devtools Network tab, confirm the PUT request to `/api/domains?domain=...` includes `brand_voice` in the body.  
Reopen the modal → confirm the value persisted (it should re-render from the invalidated query).

- [ ] **Step 5: Commit**

```bash
git add components/domains/DomainSettings.tsx
git commit -m "feat: add Brand Voice textarea in domain settings"
```

---

## Task 5: Article page — expose competitor cache + pass brandVoice

**Files:**
- Modify: `pages/articles/[id]/index.tsx`

- [ ] **Step 1: Add competitor_outlines_cache to the Article interface**

In `pages/articles/[id]/index.tsx`, find the `Article` interface (around line 26). Add the field:

```typescript
interface Article {
  id: number;
  domain_id: number;
  title: string;
  content: string;
  status: string;
  target_keyword: string;
  meta_title: string;
  meta_description: string;
  meta_url: string;
  schema_json: string;
  score_data: string;
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  competitor_outlines_cache: string | null;
}
```

- [ ] **Step 2: Pass brandVoice to handleAutoOptimize**

In `handleAutoOptimize` (around line 499), find the `fetch('/api/articles/auto-optimize', ...)` call body:

```typescript
        body: JSON.stringify({ content: preHtml, scoreData, keyword: article?.target_keyword, articleId: article?.id }),
```

Replace with (lookup brand_voice from the domain matching article.domain_id):

```typescript
        body: JSON.stringify({
          content: preHtml,
          scoreData,
          keyword: article?.target_keyword,
          articleId: article?.id,
          brandVoice: domains.find((d) => d.ID === article?.domain_id)?.brand_voice ?? '',
        }),
```

- [ ] **Step 3: Pass competitorCache to ContentScorePanel**

Find the `<ContentScorePanel ...>` JSX (around line 1019). Add the new prop:

```tsx
              <ContentScorePanel
                plainText={plainText}
                wordCount={wordCount}
                headingCount={headingCount}
                scoreData={scoreData}
                internalLinksCount={(editorHtml.match(/<a\s[^>]*href=/gi) || []).length}
                onAutoOptimize={() => handleAutoOptimize()}
                isAutoOptimizing={isAutoOptimizing}
                onResearchOutline={() => setShowResearchPanel(true)}
                onInternalLinks={() => setShowInternalLinksPanel(true)}
                competitorCache={article?.competitor_outlines_cache ?? null}
              />
```

- [ ] **Step 4: Commit**

```bash
git add pages/articles/\[id\]/index.tsx
git commit -m "feat: expose competitor_outlines_cache on Article, pass brandVoice to auto-optimize"
```

---

## Task 6: Auto-optimize pipeline — Humanizer phase

**Files:**
- Modify: `pages/api/articles/auto-optimize.ts`

- [ ] **Step 1: Add brandVoice to the handler body destructure**

In `auto-optimize.ts`, find the destructure (around line 144):

```typescript
  const { content, scoreData, keyword, articleId }:
    { content: string; scoreData?: ScoreData; keyword?: string; articleId?: number } = req.body;
```

Replace with:

```typescript
  const { content, scoreData, keyword, articleId, brandVoice }:
    { content: string; scoreData?: ScoreData; keyword?: string; articleId?: number; brandVoice?: string } = req.body;
```

- [ ] **Step 2: Build the brand voice appendix helper (add near top of handler, after the destructure)**

After `const apiKey = process.env.DEEPSEEK_API_KEY;` add:

```typescript
  const brandVoiceBlock = brandVoice?.trim()
    ? `\n\nBrand Voice Guidelines (follow strictly):\n${brandVoice.trim()}`
    : '';
```

- [ ] **Step 3: Inject brandVoiceBlock into the existing NLP optimization system prompt**

Find the line (around line 266):
```typescript
    const systemPrompt = `You are an expert SEO content optimizer...
```

The prompt ends with:
```typescript
OUTPUT FORMAT: Return ONLY the complete optimized HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.`;
```

Change the closing to inject brand voice before the OUTPUT FORMAT line:

```typescript
OUTPUT FORMAT: Return ONLY the complete optimized HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.${brandVoiceBlock}`;
```

- [ ] **Step 4: Add humanizer phase after the NLP optimize block**

After the block that produces `let optimized = ...` and strips markdown fences (around line 311), add the humanizer phase. Insert this code block right after `console.log('[auto-optimize] optimized content length:', optimized.length);`:

```typescript
    // ── Phase 2: Humanize ──────────────────────────────────────────
    sse(res, 'progress', { message: 'Humanizing content…' });

    const humanizeSystemPrompt = `You are an expert content editor. Your job is to rewrite the article to sound authentically human — natural, confident, and engaging.

RULES:
- Keep the SAME LANGUAGE as the input article (auto-detect)
- Preserve ALL headings, links (<a> tags), images (<img>), and HTML structure
- Remove AI-sounding filler phrases ("It's worth noting that", "In today's world", "Furthermore", "In conclusion", "Delve into")
- Vary sentence length — mix short punchy sentences with longer ones
- Add concrete specifics where generic phrases exist
- Keep every NLP keyword that was injected — do NOT remove them
- Do NOT shorten the article — you may expand thin paragraphs slightly
- Do NOT change meta title/description${brandVoiceBlock}

OUTPUT FORMAT: Return ONLY the complete rewritten HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.`;

    const humanizeRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 32000,
        temperature: 0.6,
        messages: [
          { role: 'system', content: humanizeSystemPrompt },
          { role: 'user', content: `Humanize this article:\n\n${optimized}` },
        ],
      }),
    });

    if (humanizeRes.ok) {
      const humanizeData = await humanizeRes.json();
      const humanized = (humanizeData.choices?.[0]?.message?.content || '').trim()
        .replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      if (humanized && humanized.length > 50) {
        console.log('[auto-optimize] humanizer OK, content length:', humanized.length);
        optimized = humanized;
      } else {
        console.log('[auto-optimize] humanizer returned empty/short — keeping NLP optimized version');
      }
    } else {
      console.log('[auto-optimize] humanizer failed HTTP', humanizeRes.status, '— continuing without humanization');
    }
```

- [ ] **Step 5: Verify the humanizer runs**

With the dev server running, open an article, click Auto-Optimize, and watch the progress bar in devtools console. You should see:
- `[auto-optimize] DeepSeek response status: 200`
- `Humanizing content…` progress event in the browser SSE log

- [ ] **Step 6: Commit**

```bash
git add pages/api/articles/auto-optimize.ts
git commit -m "feat: add humanizer phase to auto-optimize pipeline"
```

---

## Task 7: Auto-optimize pipeline — FAQ/PAA phase

**Files:**
- Modify: `pages/api/articles/auto-optimize.ts`

- [ ] **Step 1: Add the FAQ phase after the humanizer block**

After the humanizer block added in Task 6 (after `optimized = humanized` / the closing `}`), add:

```typescript
    // ── Phase 3: FAQ / People Also Ask ────────────────────────────
    if (keyword) {
      sse(res, 'progress', { message: 'Fetching People Also Ask…' });

      const serperKey = process.env.SERPER_API_KEY;
      let faqHtml = '';

      if (serperKey) {
        try {
          const serperRes = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': serperKey },
            body: JSON.stringify({ q: keyword, gl: 'pl', hl: 'pl', num: 10 }),
          });

          if (serperRes.ok) {
            const serperData = await serperRes.json();
            const paaQuestions: string[] = (serperData.peopleAlsoAsk || [])
              .slice(0, 5)
              .map((item: any) => item.question as string)
              .filter(Boolean);

            console.log('[auto-optimize] PAA questions:', paaQuestions.length, paaQuestions.slice(0, 3));

            if (paaQuestions.length) {
              sse(res, 'progress', { message: `Writing answers to ${paaQuestions.length} FAQ questions…` });

              const faqSystemPrompt = `You are an SEO content writer writing FAQ answers for a web article. 
Write concise but complete answers (2-4 sentences each) for each question.
Answer in the SAME LANGUAGE as the questions.
Format output as ONLY an HTML block — no preamble:

<h2>FAQ</h2>
<div class="faq-section">
  <div class="faq-item">
    <h3>[Question 1]</h3>
    <p>[Answer 1]</p>
  </div>
  ... (one faq-item per question)
</div>

Return ONLY the HTML block. No explanation, no markdown fences.${brandVoiceBlock}`;

              const faqRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  max_tokens: 4000,
                  temperature: 0.4,
                  messages: [
                    { role: 'system', content: faqSystemPrompt },
                    { role: 'user', content: `Article keyword: "${keyword}"\n\nQuestions:\n${paaQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` },
                  ],
                }),
              });

              if (faqRes.ok) {
                const faqData = await faqRes.json();
                faqHtml = (faqData.choices?.[0]?.message?.content || '').trim()
                  .replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
                console.log('[auto-optimize] FAQ generated, length:', faqHtml.length);
              } else {
                console.log('[auto-optimize] FAQ DeepSeek failed HTTP', faqRes.status);
              }
            }
          } else {
            console.log('[auto-optimize] Serper PAA failed HTTP', serperRes.status);
          }
        } catch (faqErr: any) {
          console.log('[auto-optimize] FAQ phase error (non-fatal):', faqErr?.message);
        }
      } else {
        console.log('[auto-optimize] No SERPER_API_KEY — skipping FAQ phase');
      }

      if (faqHtml) {
        optimized = optimized.trimEnd() + '\n\n' + faqHtml;
        console.log('[auto-optimize] FAQ block appended, total length:', optimized.length);
      }
    }
```

- [ ] **Step 2: Verify the FAQ phase in browser**

Run an auto-optimize on an article with a keyword set.  
In the browser console you should see progress events: `"Fetching People Also Ask…"` then `"Writing answers to N FAQ questions…"`.  
The final article HTML should end with `<h2>FAQ</h2>` block.

- [ ] **Step 3: Commit**

```bash
git add pages/api/articles/auto-optimize.ts
git commit -m "feat: add FAQ/PAA phase to auto-optimize pipeline"
```

---

## Task 8: Sidecar — add word_count to competitor outlines

**Files:**
- Modify: `python-sidecar/analyzers/serp_analyzer.py`

- [ ] **Step 1: Add word_count to the competitor outline dict**

In `serp_analyzer.py`, find `extract_competitor_outlines` (around line 219). Inside the `results.append({...})` call (around line 263), add `word_count`:

Before the append, extract plain text and word count from soup:

```python
            # Word count from body text
            for tag in soup.select('script, style, nav, footer, header, aside, noscript'):
                tag.decompose()
            body_text = soup.get_text(separator=' ')
            word_count_val = len(body_text.split())

            results.append({
                "url": url,
                "title": page_title or url,
                "serp_title": serp.get("title", ""),
                "snippet": serp.get("snippet", ""),
                "date": serp.get("date", ""),
                "favicon": favicon,
                "headings": headings[:80],
                "heading_count": len(headings),
                "word_count": word_count_val,
            })
```

- [ ] **Step 2: Restart the sidecar and verify**

```bash
# From python-sidecar directory:
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Then test the endpoint:

```bash
curl -s -X POST http://localhost:8001/competitor-outlines \
  -H "Content-Type: application/json" \
  -d '{"keyword": "test", "language": "pl", "num": 2}' | python -m json.tool | grep -E "url|word_count|heading_count"
```

Expected: each competitor entry has `"word_count": <integer>`.

- [ ] **Step 3: Commit**

```bash
git add python-sidecar/analyzers/serp_analyzer.py
git commit -m "feat: add word_count to competitor outlines response"
```

---

## Task 9: ContentScorePanel — SERP Fit gauge

**Files:**
- Modify: `components/articles/ContentScorePanel.tsx`

- [ ] **Step 1: Add competitorCache to Props interface**

At the top of `ContentScorePanel.tsx`, extend the `Props` interface:

```typescript
interface Props {
  plainText: string;
  wordCount: number;
  headingCount: number;
  scoreData: ScoreData;
  internalLinksCount?: number;
  onAutoOptimize?: () => void;
  isAutoOptimizing?: boolean;
  onResearchOutline?: () => void;
  onInternalLinks?: () => void;
  competitorCache?: string | null;
}
```

- [ ] **Step 2: Add computeSerpFit function above the ContentScorePanel component**

Add this function right before the `ContentScorePanel` component definition (around line 204):

```typescript
/* ── SERP Fit Score ─────────────────────────────────────────────── */
function normaliseHeading(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function computeSerpFit(
  articleHtml: string,
  plainText: string,
  wordCount: number,
  scoreData: ScoreData,
  competitorCache: string | null | undefined,
): number {
  if (!competitorCache) return 0;
  let competitors: any[];
  try {
    const parsed = JSON.parse(competitorCache);
    competitors = parsed.competitors || [];
  } catch {
    return 0;
  }
  if (!competitors.length) return 0;

  // Article heading words
  const articleHeadings = new Set<string>();
  const articleHtml2 = articleHtml || '';
  const hMatches = [...articleHtml2.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)];
  for (const m of hMatches) {
    const words = normaliseHeading(m[1].replace(/<[^>]+>/g, ''));
    words.forEach((w) => articleHeadings.add(w));
  }

  // 1. Heading Jaccard — average across all competitors
  let headingJaccardSum = 0;
  let headingJaccardCount = 0;
  for (const comp of competitors) {
    const compHeadings = new Set<string>();
    const headingArr: any[] = comp.headings || [];
    for (const h of headingArr) {
      if ((h.level || 2) <= 3) {
        normaliseHeading(h.text || '').forEach((w) => compHeadings.add(w));
      }
    }
    if (compHeadings.size > 0) {
      headingJaccardSum += jaccard(articleHeadings, compHeadings);
      headingJaccardCount++;
    }
  }
  const headingScore = headingJaccardCount > 0 ? headingJaccardSum / headingJaccardCount : 0;

  // 2. NLP Term Overlap — fraction of scoreData.terms found in article
  const terms = scoreData?.terms || [];
  let nlpScore = 0;
  if (terms.length > 0) {
    const lowerText = plainText.toLowerCase();
    const matched = terms.filter((t) => lowerText.includes(t.term.toLowerCase())).length;
    nlpScore = matched / terms.length;
  }

  // 3. Length Fit
  const competitorWordCounts = competitors
    .map((c) => c.word_count || 0)
    .filter((n) => n > 100);
  let lengthScore = 0;
  if (competitorWordCounts.length > 0) {
    const avg = competitorWordCounts.reduce((a, b) => a + b, 0) / competitorWordCounts.length;
    lengthScore = avg > 0 ? Math.max(0, 1 - Math.abs(wordCount - avg) / avg) : 0;
  }

  const raw = 0.4 * headingScore * 100 + 0.4 * nlpScore * 100 + 0.2 * lengthScore * 100;
  return Math.round(Math.min(raw, 100));
}
```

- [ ] **Step 3: Add a small SerpFitGauge component**

Add this component just before the `ContentScorePanel` function (after `ActionRow`):

```typescript
/* ── SERP Fit small gauge ───────────────────────────────────────── */
const SerpFitGauge = ({ score }: { score: number }) => {
  const [display, setDisplay] = React.useState(0);
  const animRef = React.useRef<number | null>(null);
  const fromRef = React.useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = score;
    if (from === to) return;
    const duration = from === 0 ? 1400 : 600;
    let startTs: number | null = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) { animRef.current = requestAnimationFrame(animate); }
      else { fromRef.current = to; animRef.current = null; }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score]);

  const color = display >= 70 ? '#1ab25e' : display >= 40 ? '#efa00d' : '#d70028';
  const r = 24, sw = 5;
  const circ = Math.PI * r; // half-circle arc length
  const fill = (display / 100) * circ;
  const arcPath = `M ${50 - r} 32 A ${r} ${r} 0 0 1 ${50 + r} 32`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 16px 10px', borderTop: '1px solid #f4f4f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)', marginBottom: 4 }}>
        SERP Fit
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#9f9fa9" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
        </svg>
        <span title="How closely your article's structure matches top-ranking competitors.">
        </span>
      </div>
      <svg viewBox="0 0 100 36" style={{ width: 120, height: 44 }}>
        {/* Track */}
        <path d={arcPath} fill="none" stroke="#e4e4e7" strokeWidth={sw} strokeLinecap="round" />
        {/* Fill */}
        {fill > 0 && (
          <path d={arcPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={`${fill} 9999`} strokeDashoffset={0} />
        )}
        {/* Score text */}
        <text x="50" y="30" textAnchor="middle" fontSize={14} fontWeight={600} fill={color}
          fontFamily="var(--font-family-primary)">{display}</text>
      </svg>
    </div>
  );
};
```

- [ ] **Step 4: Add serpFit state + computation in ContentScorePanel**

In the `ContentScorePanel` component function (around line 205), add to the destructured props:

```typescript
const ContentScorePanel = ({ plainText, wordCount, headingCount, scoreData, internalLinksCount, onAutoOptimize, isAutoOptimizing, onResearchOutline, onInternalLinks, competitorCache }: Props) => {
```

Add state after the existing `const [nlpOpen, setNlpOpen]` line:

```typescript
  const [serpFit, setSerpFit] = useState(0);
```

In the `useEffect` that recomputes the score (around line 215), add serpFit computation:

```typescript
  useEffect(() => {
    if (!scoreData?.terms) return;
    const updated = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    setTerms(updated);
    const paraCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
    setScore(computeScore(plainText, wordCount, headingCount, paraCount, scoreData, internalLinksCount));
    // SERP Fit — computed from competitor cache (requires editorHtml, but we only have plainText here)
    // We pass plainText and wordCount; headings need HTML — we'll get them from scoreData/headingCount approximation
    setSerpFit(computeSerpFit('', plainText, wordCount, scoreData, competitorCache));
  }, [plainText, wordCount, headingCount, scoreData, internalLinksCount, competitorCache]);
```

Note: The `computeSerpFit` call passes an empty string for `articleHtml` because ContentScorePanel only receives `plainText`. The heading Jaccard component will be 0 (no headings to compare) — this is acceptable. To properly support heading Jaccard, pass `editorHtml` as an additional prop. 

**If you want heading Jaccard working**, add `editorHtml?: string` to Props and pass it from the article page:

In `Props`:
```typescript
  editorHtml?: string;
```

In `ContentScorePanel` function signature:
```typescript
const ContentScorePanel = ({ ..., competitorCache, editorHtml }: Props) => {
```

In the `useEffect`:
```typescript
    setSerpFit(computeSerpFit(editorHtml || '', plainText, wordCount, scoreData, competitorCache));
```

And in `pages/articles/[id]/index.tsx`, pass:
```tsx
                editorHtml={editorHtml}
```

- [ ] **Step 5: Render SerpFitGauge below the structure metrics block**

In the JSX of `ContentScorePanel`, find the metrics row (`{/* ── Structure metrics ── */}`, around line 280). Directly after its closing `</div>`, add:

```tsx
      {/* ── SERP Fit Gauge (only when competitor data available) ── */}
      {competitorCache && serpFit !== undefined && (
        <SerpFitGauge score={serpFit} />
      )}
```

- [ ] **Step 6: Verify in browser**

Open an article that has been analyzed (so it has `competitor_outlines_cache`). The ContentScorePanel should show the SERP Fit gauge animating in below the Words/Headings/Paragraphs row.  
Open an article without competitor data — the gauge should be hidden.

- [ ] **Step 7: Commit**

```bash
git add components/articles/ContentScorePanel.tsx pages/articles/\[id\]/index.tsx
git commit -m "feat: add SERP Fit gauge to ContentScorePanel"
```

---

## Task 10: Final integration smoke test

- [ ] **Step 1: Run the dev server and sidecar**

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Python sidecar
cd python-sidecar && uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

- [ ] **Step 2: Verify Brand Voice end-to-end**

1. Go to any domain → click settings → "✍️ Brand Voice" tab
2. Type: `"Friendly, concise. Target Polish SMB owners. Avoid jargon."`
3. Save → confirm toast "Settings Updated!"
4. Open an article on that domain → open devtools Network tab
5. Click Auto-Optimize → in the auto-optimize request body confirm `brandVoice` is present
6. Check console for `[auto-optimize] humanizer OK` log

- [ ] **Step 3: Verify FAQ phase**

After auto-optimize completes, accept the changes.  
Search for `<h2>FAQ</h2>` in the article HTML via devtools → should exist.

- [ ] **Step 4: Verify SERP Fit gauge**

Open an article with a keyword that has been previously analyzed (competitor_outlines_cache populated).  
The right panel should show the SERP Fit semi-circle gauge animating from 0.  
Open another article without competitor data → gauge is absent.

- [ ] **Step 5: Final commit if any fixes were made**

```bash
git add -p
git commit -m "fix: integration fixes from smoke test"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Phase 1 NLP optimization: existing, brand voice injected in Task 6
- ✅ Phase 2 Humanizer: Task 6
- ✅ Phase 3 FAQ/PAA: Task 7
- ✅ Brand Voice migration: Task 1
- ✅ Brand Voice model/types: Task 2
- ✅ Brand Voice API: Task 3
- ✅ Brand Voice UI: Task 4
- ✅ brandVoice passed to auto-optimize: Task 5
- ✅ SERP Fit algorithm: Task 9 (computeSerpFit)
- ✅ SERP Fit gauge UI: Task 9 (SerpFitGauge component)
- ✅ SERP Fit hidden when no competitor data: Task 9 Step 5 conditional
- ✅ word_count in competitor outlines: Task 8

**Type consistency:**
- `competitorCache` prop is `string | null | undefined` everywhere
- `brandVoice` is `string | undefined` in auto-optimize body
- `brand_voice` is `string | undefined` in DomainSettings type
