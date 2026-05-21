// POST /api/articles/auto-optimize
// SSE-streamed: sends progress events then the final optimized HTML.
import type { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import type { ScoreData } from '../../../lib/contentScore';
import { countOccurrences } from '../../../lib/contentScore';
import { getArticleIdSql } from '../../../lib/articleSql';

export const config = { api: { responseLimit: '10mb' } };

// ── SSE helper ─────────────────────────────────────────────────────────
function sse(res: NextApiResponse, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

// ── Competitor scraping ────────────────────────────────────────────────
const FETCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchPlain(url: string, timeoutMs = 10000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': FETCH_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
  } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface CompetitorSummary {
  url: string;
  title: string;
  headings: string[];
  intro: string;
  wordCount: number;
  snippet: string;
  serpTitle: string;
}

async function scrapeCompetitor(url: string): Promise<CompetitorSummary | null> {
  try {
    const html = await fetchPlain(url, 10000);
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, .sidebar, .ad, .cookie-banner, noscript, iframe').remove();

    const title = $('h1').first().text().trim()
      || $('meta[property="og:title"]').attr('content')?.trim()
      || $('title').text().trim()
      || url;

    const headings: string[] = [];
    $('h2, h3').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length > 2) headings.push(t);
    });

    const candidateSelectors = [
      'article', '[role="main"]', 'main',
      '.post-content', '.entry-content', '.article-content', '.article-body',
      '.content-body', '.blog-content', '.post-body', '#content', '#main-content',
    ];
    let bestEl: any = $('body')[0];
    let bestWc = 0;
    for (const sel of candidateSelectors) {
      $(sel).each((_, el) => {
        const wc = $(el).text().replace(/\s+/g, ' ').trim().split(' ').length;
        if (wc > bestWc) { bestWc = wc; bestEl = el; }
      });
    }
    const bodyText = $(bestEl).text().replace(/\s+/g, ' ').trim();
    const words = bodyText.split(/\s+/).filter(Boolean);
    const intro = words.slice(0, 120).join(' ');

    return { url, title, headings: headings.slice(0, 15), intro, wordCount: words.length, snippet: '', serpTitle: '' };
  } catch {
    return null;
  }
}

interface SerpMeta { url: string; snippet: string; serpTitle: string; }

async function getCompetitorData(keyword: string, articleId?: number): Promise<{ urls: string[]; serpMeta: SerpMeta[] }> {
  if (articleId) {
    try {
      const articleIdSql = await getArticleIdSql();
      const [rows] = await db.query(
        `SELECT competitor_outlines_cache FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
        { replacements: [articleId] },
      );
      const cached = (rows as any[])[0]?.competitor_outlines_cache;
      if (cached) {
        const parsed = JSON.parse(cached);
        const competitors = (parsed.competitors || []).slice(0, 5);
        const urls: string[] = competitors.map((c: any) => c.url).filter(Boolean);
        const serpMeta: SerpMeta[] = competitors.map((c: any) => ({
          url: c.url,
          snippet: c.snippet || '',
          serpTitle: c.serp_title || '',
        }));
        if (urls.length) return { urls, serpMeta };
      }
    } catch {}
  }

  try {
    const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
    const r = await fetch(`${sidecarUrl}/competitor-outlines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, language: 'pl', num: 5 }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined,
    } as RequestInit);
    if (r.ok) {
      const data = await r.json();
      const competitors = (data.competitors || []).slice(0, 5);
      const urls: string[] = competitors.map((c: any) => c.url).filter(Boolean);
      const serpMeta: SerpMeta[] = competitors.map((c: any) => ({
        url: c.url,
        snippet: c.snippet || '',
        serpTitle: c.serp_title || '',
      }));
      if (articleId && urls.length) {
        const articleIdSql = await getArticleIdSql();
        await db.query(
          `UPDATE articles SET competitor_outlines_cache = ?, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify(data), articleId] },
        ).catch(() => {});
      }
      return { urls, serpMeta };
    }
  } catch {}

  return { urls: [], serpMeta: [] };
}

// ── Main handler ───────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, scoreData, keyword, articleId, brandVoice, aiVisibilitySummary }:
    {
      content: string;
      scoreData?: ScoreData;
      keyword?: string;
      articleId?: number;
      brandVoice?: string;
      aiVisibilitySummary?: {
        prompts_total: number;
        prompts_cited: number;
        competitor_citations: number;
        citations: Array<{ prompt: string; cited_domain?: string; answer?: string }>;
      };
    } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  const brandVoiceBlock = brandVoice?.trim()
    ? `\n\nBrand Voice Guidelines (follow strictly):\n${brandVoice.trim()}`
    : '';

  // ── SSE setup ─────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.status(200);
  if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
  res.write(':ok\n\n');

  try {
    // ── Step 1: Gap analysis ───────────────────────────────────────
    sse(res, 'progress', { message: 'Analyzing content gaps…' });

    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const headingCount = (content.match(/<h[1-6][^>]*>/gi) || []).length;
    const paragraphCount = (content.match(/<p[\s>]/gi) || []).length;

    const missingTerms: string[] = [];
    const lowTerms: Array<{ term: string; current: number; target: number }> = [];

    if (scoreData?.terms?.length) {
      for (const t of scoreData.terms) {
        const actual = countOccurrences(plainText, t.term);
        const min = Math.max(1, Math.round(t.target_count * 0.7));
        if (actual === 0) missingTerms.push(t.term);
        else if (actual < min) lowTerms.push({ term: t.term, current: actual, target: t.target_count });
      }
    }

    const wordGap = scoreData?.words_target ? Math.max(0, scoreData.words_target - wordCount) : 0;
    const headingGap = scoreData?.headings_target ? Math.max(0, scoreData.headings_target - headingCount) : 0;
    const paraGap = scoreData?.paragraphs_target ? Math.max(0, scoreData.paragraphs_target - paragraphCount) : 0;

    const gaps: string[] = [];
    if (missingTerms.length)
      gaps.push(`MISSING NLP TERMS — highest priority, MUST be added naturally:\n  ${missingTerms.map((t) => `"${t}"`).join(', ')}`);
    if (lowTerms.length)
      gaps.push(`UNDERUSED NLP TERMS — increase their frequency:\n  ${lowTerms.map((t) => `"${t.term}" (now ${t.current}×, target ~${t.target}×)`).join(', ')}`);
    if (wordGap > 150)
      gaps.push(`WORD COUNT — needs ~${wordGap} more words (currently ${wordCount} / target ${scoreData!.words_target}). Expand existing sections or add new supporting paragraphs.`);
    if (headingGap > 0)
      gaps.push(`HEADINGS — add ${headingGap} more H3 subheadings (currently ${headingCount} / target ${scoreData!.headings_target}). Insert inside existing H2 sections.`);
    if (paraGap > 2)
      gaps.push(`PARAGRAPHS — add ~${paraGap} more paragraphs (currently ${paragraphCount} / target ${scoreData!.paragraphs_target}). Split or expand thin sections.`);

    const gapBlock = gaps.length
      ? `CONTENT GAPS TO FIX:\n${gaps.map((g, i) => `${i + 1}. ${g}`).join('\n\n')}`
      : 'Article is already well-optimized. Improve NLP term density and expand thin sections.';
    const aiSearchBlock = aiVisibilitySummary?.citations?.length
      ? `\n\nAI SEARCH VISIBILITY GAPS:\n${aiVisibilitySummary.citations
        .slice(0, 10)
        .map((c, i) => `${i + 1}. Prompt: "${c.prompt}" | cited: ${c.cited_domain || 'none'} | answer snippet: "${(c.answer || '').slice(0, 180)}"`)
        .join('\n')}\nUse these gaps to add answer-ready sections, definitions, FAQs, and source-worthy statements.`
      : '';

    sse(res, 'progress', {
      message: `Found ${missingTerms.length} missing terms, ${lowTerms.length} underused — ready to fix`,
    });

    // ── Step 2: Fetch competitor URLs ──────────────────────────────
    let competitorBlock = '';
    if (keyword) {
      sse(res, 'progress', { message: 'Looking up competitor pages…' });

      const { urls, serpMeta } = await getCompetitorData(keyword, articleId);
      // Build a lookup map for SERP metadata by URL
      const serpByUrl = new Map(serpMeta.map((m) => [m.url, m]));

      if (urls.length) {
        console.log('[auto-optimize] competitor URLs found:', urls.length);
        urls.forEach((u: string, i: number) => console.log(`[auto-optimize]   competitor ${i + 1}: ${u}`));
        sse(res, 'progress', { message: `Scraping ${urls.length} competitor articles…` });

        // Scrape competitors one-by-one so we can emit per-page progress
        const competitors: CompetitorSummary[] = [];
        await Promise.all(
          urls.map(async (url, i) => {
            const hostname = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();
            sse(res, 'progress', { message: `Reading competitor ${i + 1}/${urls.length}: ${hostname}` });
            const meta = serpByUrl.get(url);
            const result = await scrapeCompetitor(url);
            if (result && result.headings.length > 0) {
              result.snippet = meta?.snippet || '';
              result.serpTitle = meta?.serpTitle || '';
              console.log(`[auto-optimize] competitor ${i + 1} scraped: "${result.title}" (${result.wordCount} words, ${result.headings.length} headings)`);
              console.log(`[auto-optimize]   snippet: ${result.snippet.slice(0, 120)}…`);
              console.log(`[auto-optimize]   headings: ${result.headings.slice(0, 8).join(' | ')}`);
              console.log(`[auto-optimize]   intro: ${result.intro.slice(0, 150)}…`);
              competitors.push(result);
            } else {
              console.log(`[auto-optimize] competitor ${i + 1} skipped: no headings extracted`);
            }
          }),
        );

        if (competitors.length) {
          sse(res, 'progress', { message: `Analyzed ${competitors.length} competitor articles ✓` });

          const lines: string[] = [`TOP ${competitors.length} COMPETITOR ARTICLES FOR "${keyword}":`];
          for (const [i, c] of competitors.entries()) {
            lines.push(`\n--- Competitor ${i + 1}: ${c.title} (${c.wordCount} words) ---`);
            lines.push(`URL: ${c.url}`);
            if (c.snippet) lines.push(`Google snippet: "${c.snippet}"`);
            if (c.headings.length) lines.push(`Headings:\n  • ${c.headings.join('\n  • ')}`);
            if (c.intro) lines.push(`Intro: "${c.intro.slice(0, 200)}…"`);
          }
          competitorBlock = `\n\n${lines.join('\n')}\n\nUse competitor analysis to:\n- Cover topics/sections our article is missing from competitor headings and snippets\n- Match or exceed competitor content depth\n- Do NOT copy text — use their structure and SERP snippet summaries as inspiration only`;
          console.log(`[auto-optimize] competitor block size: ${competitorBlock.length} chars`);
        }
      } else {
        sse(res, 'progress', { message: 'No competitor data available — optimizing from score data only' });
      }
    }

    // ── Step 3: Build prompt & call AI ────────────────────────────
    sse(res, 'progress', { message: 'Sending to AI for optimization…' });
    console.log(`[auto-optimize] gap summary: ${missingTerms.length} missing terms, ${lowTerms.length} underused, wordGap=${wordGap}, headingGap=${headingGap}`);
    console.log(`[auto-optimize] sending to AI: ${wordCount} words, ${headingCount} headings, ${competitorBlock ? 'with' : 'no'} competitor data`);

    const systemPrompt = `You are an expert SEO content optimizer, similar to Surfer SEO's Auto-Optimize feature.

Your task: improve the provided HTML article to increase its content score by addressing the specific gaps listed below. Preserve the article's ORIGINAL MEANING, LANGUAGE, TONE and STRUCTURE.

STRICT RULES:
- Write ONLY in the SAME LANGUAGE as the article (auto-detect — do NOT translate)
- Preserve ALL existing headings, links (<a> tags), images (<img>), and lists
- Do NOT remove or shorten any existing sentences — only ADD or EXPAND
- Add missing NLP terms by weaving them naturally into existing or new sentences
- When adding headings: use H3 inside existing H2 sections only
- Expand thin paragraphs (under 40 words) with relevant, factual supporting sentences
- Do NOT add image tags — leave image placement to the user
- Do NOT change the meta title or meta description
- Keep the human, expert tone — avoid AI-sounding filler phrases

${gapBlock}${competitorBlock}${aiSearchBlock}

OUTPUT FORMAT: Return ONLY the complete optimized HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.${brandVoiceBlock}`;

    console.log('[auto-optimize] calling DeepSeek, content length:', content.length, 'systemPrompt length:', systemPrompt.length);
    const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 32000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Optimize this article:\n\n${content}` },
        ],
      }),
    });

    console.log('[auto-optimize] DeepSeek response status:', aiRes.status);
    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('[auto-optimize] DeepSeek error body:', err.slice(0, 500));
      sse(res, 'error', { message: 'AI request failed: ' + err });
      return res.end();
    }

    const aiData = await aiRes.json();
    console.log('[auto-optimize] DeepSeek finish_reason:', aiData.choices?.[0]?.finish_reason, 'usage:', JSON.stringify(aiData.usage));
    let optimized = (aiData.choices?.[0]?.message?.content || '').trim();
    optimized = optimized.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    console.log('[auto-optimize] optimized content length:', optimized.length);

    if (!optimized || optimized.length < 50) {
      sse(res, 'error', { message: 'AI returned empty response' });
      return res.end();
    }

    // ── Phase 2: Humanize ─────────────────────────────────────────────────
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

    // ── Phase 3: FAQ / People Also Ask ───────────────────────────────────
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

    // ── Insert image placeholders after every 4th H2 heading ──────────────
    const PLACEHOLDER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='380'%3E%3Crect width='800' height='380' fill='%23f3f4f6'/%3E%3Ctext x='400' y='200' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='18'%3E%E2%8F%B3 Generating image...%3C/text%3E%3C/svg%3E";
    const pendingImages: Array<{ idx: number; prompt: string }> = [];
    let h2Counter = 0;
    const optimizedWithImages = optimized.replace(/<\/h2>/gi, (match: string, offset: number, str: string) => {
      h2Counter++;
      if (h2Counter % 4 !== 0) return match;
      // Extract text of the h2 we just closed — look backwards for <h2...>
      const before = str.slice(0, offset);
      const openTag = before.lastIndexOf('<h2');
      const headingHtml = openTag >= 0 ? str.slice(openTag, offset) : '';
      const headingText = headingHtml.replace(/<[^>]+>/g, '').trim().slice(0, 120);
      const idx = pendingImages.length;
      pendingImages.push({ idx, prompt: headingText });
      const imgTag = `<img src="${PLACEHOLDER_SRC}" alt="${headingText.replace(/"/g, '&quot;')}" title="__AIMG_${idx}__" />`;
      return `${match}${imgTag}`;
    });

    console.log('[auto-optimize] sending done event, pendingImages:', pendingImages.length);
    sse(res, 'done', { content: optimizedWithImages, pendingImages });
    console.log('[auto-optimize] done event sent');
  } catch (error: any) {
    console.error('[auto-optimize] caught error:', error?.message, error?.stack?.slice(0, 300));
    sse(res, 'error', { message: error?.message || 'Request failed' });
  }

  res.end();
}
