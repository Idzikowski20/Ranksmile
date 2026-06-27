// POST /api/articles/auto-optimize
// SSE-streamed: sends progress events then the final optimized HTML.
import type { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import type { ScoreData } from '../../../lib/contentScore';
import { countOccurrences } from '../../../lib/contentScore';
import { getArticleIdSql } from '../../../lib/articleSql';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { enrichTerms, getAiSearchInfo } from '../../../lib/seo/keywordData';
import { persistAiVisibilityRun } from '../../../lib/aiVisibilityStore';

const COUNTRY_FOR_LANG: Record<string, string> = { pl: 'PL', en: 'US', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', nl: 'NL', pt: 'PT' };
import { SIGNAL_TACTICS } from '../../../lib/seo/signalTactics';
import { ANTI_HALLUCINATION_RULES } from '../../../lib/seo/antiHallucinationRules';
import { scoreContent } from '../../../lib/seo/scoreContentClient';

export const config = { api: { responseLimit: '10mb' } };

// Strip LLM meta-chatter that occasionally leaks into the article body:
// a leading "Here is the complete HTML article…" preamble and placeholder
// bylines like "Author: [Editor: insert author name…]".
const LLM_PREAMBLE_RE = /(here'?s?\s+(?:is\s+)?the\s+(?:complete|optimized|updated|full|following)\s+(?:html|article|version|content)\b|below\s+is\s+the\s+(?:optimized|updated|complete)\s+(?:html|article)|no\s+other\s+content\s+has\s+been\s+(?:rewritten|fabricated|changed|altered)|minimal\s+fixes\s+(?:applied|were\s+applied)|the\s+complete\s+html\s+article\s+with|i'?ve\s+(?:applied|made)\s+(?:the\s+)?(?:targeted|minimal|requested)\s+(?:fixes|changes|edits))/i;
const LLM_PLACEHOLDER_RE = /\[(?:editor|insert|author\s+name|update\s+date|date)[^\]]*\]/i;

const stripLlmArtifacts = (html: string): string => {
   let out = html;
   // Drop whole paragraphs/headings that are preamble or contain editor placeholders.
   out = out.replace(/<(p|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, _tag, inner) => {
      const text = String(inner).replace(/<[^>]+>/g, ' ');
      return (LLM_PREAMBLE_RE.test(text) || LLM_PLACEHOLDER_RE.test(text)) ? '' : m;
   });
   // Remove any leading prose before the first remaining tag.
   out = out.replace(/^[^<]*(?=<)/, '');
   // Remove any stray inline bracket placeholders left behind.
   out = out.replace(/\[(?:editor|insert)[^\]]*\]/gi, '');
   return out.replace(/\n{3,}/g, '\n\n').trim();
};

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

function parseCompetitorHtml(html: string, url: string): CompetitorSummary {
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
}

async function scrapeCompetitor(url: string): Promise<CompetitorSummary | null> {
  try {
    const html = await fetchPlain(url, 10000);
    const result = parseCompetitorHtml(html, url);

    // If cheerio found thin content (< 200 words), retry with Puppeteer for JS-rendered pages
    if (result.wordCount < 200 || result.headings.length === 0) {
      try {
        const { renderPage } = await import('../../../utils/spaScraper');
        console.log(`[auto-optimize] thin content (${result.wordCount} words), trying puppeteer for ${url}`);
        const rendered = await renderPage(url, 15000);
        const reParsed = parseCompetitorHtml(rendered.html, rendered.url);
        if (reParsed.wordCount > result.wordCount) {
          console.log(`[auto-optimize] puppeteer improved: ${result.wordCount} -> ${reParsed.wordCount} words`);
          return reParsed;
        }
      } catch (err: any) {
        console.warn('[auto-optimize] puppeteer fallback failed:', err.message);
      }
    }

    return result;
  } catch {
    return null;
  }
}

interface SerpMeta { url: string; snippet: string; serpTitle: string; }

async function getCompetitorData(keyword: string, articleId?: number): Promise<{ urls: string[]; serpMeta: SerpMeta[]; competitors: CompetitorSummary[] }> {
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
        if (urls.length) return { urls, serpMeta, competitors: Array.isArray(parsed._scraped) ? parsed._scraped : [] };
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
      return { urls, serpMeta, competitors: [] };
    }
  } catch {}

  return { urls: [], serpMeta: [], competitors: [] };
}

// ── Internal linking (Surfer "auto internal links") ────────────────────
interface SiteLink { title: string; url: string; }

/** Bare host+path, lowercased — for de-duping link candidates and self-exclusion. */
const normUrl = (u: string) => (u || '').split('#')[0].split('?')[0].replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();

async function suggestInternalLinks(
  content: string, keyword: string, articles: SiteLink[], apiKey: string,
): Promise<Array<{ anchorText: string; url: string }>> {
  const trimmed = content.length > 12000 ? `${content.slice(0, 12000)}…` : content;
  const list = articles.map((a, i) => `${i + 1}. URL: ${a.url} | Title: "${a.title}"`).join('\n');
  const prompt = `You are an SEO specialist. Find natural internal-linking opportunities in this article.
ARTICLE KEYWORD: "${keyword}"
ARTICLE CONTENT:
${trimmed}
AVAILABLE PAGES TO LINK TO:
${list}
Rules: the anchor text must appear VERBATIM as plain text in the article; link each page at most once; prefer specific multi-word phrases; only semantically relevant matches.
OUTPUT — JSON array only, no other text: [{"anchorText":"exact phrase from the article","url":"target page url"}]
If none: []`;
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 1500, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const raw: string = data.choices?.[0]?.message?.content || '[]';
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]) as Array<{ anchorText?: string; url?: string }>;
    return parsed.filter((x): x is { anchorText: string; url: string } => !!x.anchorText && !!x.url);
  } catch { return []; }
}

/** Insert up to `max` internal links into <p> text (never inside existing anchors/tags). */
function applyInternalLinks(html: string, links: Array<{ anchorText: string; url: string }>, max: number): { html: string; applied: number } {
  const $ = cheerio.load(html, { decodeEntities: false });
  let applied = 0;
  const usedUrls = new Set<string>();
  for (const link of links) {
    if (applied >= max) break;
    if (usedUrls.has(link.url)) continue;
    let done = false;
    $('p').each((_, el) => {
      if (done) return;
      const $el = $(el);
      const inner = $el.html() || '';
      if (inner.includes(link.url)) return; // already links somewhere in this paragraph
      const safe = link.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // The phrase must exist OUTSIDE any existing <a>…</a> so we don't nest anchors.
      const withoutAnchors = inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '');
      if (!new RegExp(safe).test(withoutAnchors)) return;
      const replaced = inner.replace(new RegExp(safe), `<a href="${link.url}">${link.anchorText}</a>`);
      if (replaced !== inner) { $el.html(replaced); done = true; applied += 1; usedUrls.add(link.url); }
    });
  }
  const body = $('body');
  return { html: body.length ? (body.html() || html) : html, applied };
}

/** FAQPage JSON-LD from the article's FAQ section (Q = <h3>, A = following <p>). */
function buildFaqSchema(html: string): string {
  const h2s: Array<{ index: number; end: number; text: string }> = [];
  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let mm: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((mm = h2Re.exec(html))) h2s.push({ index: mm.index, end: mm.index + mm[0].length, text: mm[1].replace(/<[^>]+>/g, '').trim() });
  const faqIdx = h2s.findIndex((h) => /faq|najczęściej zadawane|frequently asked/i.test(h.text));
  if (faqIdx === -1) return '';
  const sectionEnd = faqIdx + 1 < h2s.length ? h2s[faqIdx + 1].index : html.length;
  const section = html.slice(h2s[faqIdx].end, sectionEnd);
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const qa: Array<{ q: string; a: string }> = [];
  const pairRe = /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*(?:<\/div>\s*<div[^>]*>\s*)?<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let p: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((p = pairRe.exec(section))) {
    const q = strip(p[1]); const a = strip(p[2]);
    if (q && a) qa.push({ q, a });
  }
  if (!qa.length) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

// ── Main handler ───────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, scoreData, keyword, articleId, brandVoice, aiVisibilitySummary, articleTitle, articleMetaDescription, gaps: clientScoreGaps }:
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
        citations: Array<{ prompt: string; cited_domain?: string; answer?: string; is_own_domain?: boolean }>;
      };
      articleTitle?: string;
      articleMetaDescription?: string;
      gaps?: Array<{ label: string; points: number; hint: string }>;
    } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  // Only this article's owner may optimize-and-persist it. articleId is optional —
  // when absent the handler never touches a stored row, so there is nothing to guard.
  if (articleId !== undefined) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  // Protect existing <img> tags from the LLM passes (models routinely drop or mangle them).
  // Swap each for a short token the model keeps verbatim, then restore the originals at the end.
  const preservedImages: string[] = [];
  const imagesProtected = content.replace(/<img\b[^>]*>/gi, (tag) => {
    const i = preservedImages.length;
    preservedImages.push(tag);
    return `@@KEEPIMG${i}@@`;
  });
  const hadImages = preservedImages.length > 0;
  const IMG_TOKEN_RULE = hadImages
    ? "\n- Preserve every @@KEEPIMGn@@ placeholder token EXACTLY as written (e.g. @@KEEPIMG0@@) — never remove, reorder, translate, or alter them; they mark the user's existing images."
    : '';

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
      ? `\n\nAI SEARCH — COVER EVERY QUESTION BELOW (these drive LLM citations; you MUST leave NONE uncovered):\n${aiVisibilitySummary.citations
        .slice(0, 25)
        .map((c, i) => `${i + 1}. "${c.prompt}" | currently cited: ${c.cited_domain || 'none'}${c.is_own_domain ? ' (us ✓)' : ''} | competitor answer: "${(c.answer || '').slice(0, 180)}"`)
        .join('\n')}\n\nFor EVERY question above, ensure the article contains a concise, directly-quotable answer (1–3 sentences) under the most relevant heading: definition-first, factual, self-contained, so an LLM can lift it as a citation. Prefer specifics (numbers, named entities, steps) over vague phrasing. Add an FAQ section using any still-uncovered questions verbatim as H3s with crisp answers — do not skip any.`
      : '';

    sse(res, 'progress', {
      message: `Found ${missingTerms.length} missing terms, ${lowTerms.length} underused — ready to fix`,
    });

    if (aiSearchBlock) {
      const uncovered = Math.max(0, (aiVisibilitySummary?.prompts_total ?? 0) - (aiVisibilitySummary?.prompts_cited ?? 0));
      sse(res, 'progress', {
        message: uncovered > 0
          ? `Answering ${uncovered} AI-search question${uncovered > 1 ? 's' : ''} to earn LLM citations…`
          : 'Reinforcing answer-ready facts for AI search…',
      });
    }

    // ── Step 1.5: Pre-score ranking signals ───────────────────────
    let preScoreData: { ranking_score: number; ranking_signals: any } | null = null;
    let signalImprovementBlock = '';
    try {
      sse(res, 'progress', { message: 'Analyzing ranking signals…' });
      preScoreData = await scoreContent(
        content,
        keyword || '',
        {
          terms: scoreData?.terms || [],
          words_target: scoreData?.words_target || 2200,
          headings_target: scoreData?.headings_target || 15,
          paragraphs_target: scoreData?.paragraphs_target || 20,
        },
        articleTitle || '',
        articleMetaDescription || ''
      );
      if (preScoreData) {
        console.log('[auto-optimize] pre-score:', preScoreData.ranking_score);

        if (preScoreData?.ranking_signals?.signals?.length) {
          const weakSignals = [...preScoreData.ranking_signals.signals]
            .sort((a: any, b: any) => a.score - b.score)
            .slice(0, 3);

          signalImprovementBlock = `\n\nRANKING SCORE TARGET: 90-100/100 (current prediction: ${preScoreData.ranking_score}/100).\nFocus especially on improving these weak ranking signals:\n` +
            weakSignals.map((s: any, i: number) =>
              `${i + 1}. ${s.name} (current: ${s.score}/100, verdict: ${s.verdict}): ${s.recommendation || ''}\n   HOW TO FIX: ${SIGNAL_TACTICS[s.name] || 'Improve this signal.'}`
            ).join('\n\n') +
            `\n\nIMPORTANT: Your optimization MUST demonstrably improve these signals to reach the 90-100 target range.`;
        }
      }
    } catch (err: any) {
      console.log('[auto-optimize] pre-score failed (non-fatal):', err.message);
    }

    // ── Step 2: Fetch competitor URLs ──────────────────────────────
    let competitorBlock = '';
    if (keyword) {
      sse(res, 'progress', { message: 'Looking up competitor pages…' });

      const { urls, serpMeta, competitors: cachedComps } = await getCompetitorData(keyword, articleId);
      // Build a lookup map for SERP metadata by URL
      const serpByUrl = new Map(serpMeta.map((m) => [m.url, m]));

      if (urls.length) {
        console.log('[auto-optimize] competitor URLs found:', urls.length);
        urls.forEach((u: string, i: number) => console.log(`[auto-optimize]   competitor ${i + 1}: ${u}`));

        // Reuse the previously-scraped competitor summaries when available — repeat
        // optimizes then skip the network scrape entirely (URLs were already cached).
        let competitors: CompetitorSummary[] = cachedComps;
        if (competitors.length) {
          sse(res, 'progress', { message: `Using cached competitor analysis (${competitors.length}) ✓` });
        } else {
          sse(res, 'progress', { message: `Scraping ${urls.length} competitor articles…` });
          competitors = [];
          // Scrape competitors in parallel; emit per-page progress
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
                competitors.push(result);
              } else {
                console.log(`[auto-optimize] competitor ${i + 1} skipped: no headings extracted`);
              }
            }),
          );
          // Persist the scraped summaries so the next optimize run reuses them.
          if (articleId && competitors.length) {
            try {
              const aidSql = await getArticleIdSql();
              const [crows] = await db.query(`SELECT competitor_outlines_cache FROM articles WHERE ${aidSql} = ? LIMIT 1`, { replacements: [articleId] });
              let obj: any = {};
              try { obj = JSON.parse((crows as any[])[0]?.competitor_outlines_cache || '{}'); } catch { obj = {}; }
              obj._scraped = competitors;
              await db.query(`UPDATE articles SET competitor_outlines_cache = ? WHERE ${aidSql} = ?`, { replacements: [JSON.stringify(obj), articleId] }).catch(() => {});
            } catch { /* cache write is best-effort */ }
          }
        }

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

    // Build protected terms list for the humanizer pass
    const protectedTerms = [...missingTerms, ...lowTerms.map((t) => t.term)];
    const protectedTermsBlock = protectedTerms.length
      ? `\n- USE THESE NLP TERMS VERBATIM — do not paraphrase, inflect, or substitute synonyms for: ${protectedTerms.map((t) => `"${t}"`).join(', ')}`
      : '';

    // Score gaps from the editor's "What's missing" view — the exact slots still losing points.
    // This is the single most important instruction — placed first in the prompt body below.
    const scoreGapsBlock = Array.isArray(clientScoreGaps) && clientScoreGaps.length
      ? `★★★ TOP PRIORITY — "WHAT'S MISSING": the article is losing these exact points and you MUST fully resolve EVERY one of them in this pass. Prioritise this above all else:\n${clientScoreGaps.map((g) => `- [+${g.points} pts] ${g.label}: ${g.hint}`).join('\n')}\n\n`
      : '';

    const systemPrompt = `You are an expert SEO content optimizer, similar to Surfer SEO's Auto-Optimize feature.

Your task: improve the provided HTML article to increase its content score by addressing the specific gaps listed below. Preserve the article's ORIGINAL MEANING, LANGUAGE, TONE and STRUCTURE.

STRICT RULES:
- Write ONLY in the SAME LANGUAGE as the article (auto-detect — do NOT translate)
- Preserve ALL existing headings, links (<a> tags), images (<img>), and lists
- Do NOT remove or shorten any existing sentences — only ADD or EXPAND
- Add missing NLP terms by weaving them naturally into existing or new sentences — use them in their EXACT written form, no inflection or synonyms
- When adding headings: use H3 inside existing H2 sections only
- Ensure the target keyword "${keyword || ''}" appears verbatim in at least one H2 heading
- Keep each paragraph between 40–80 words; split any paragraph that exceeds 100 words
- Include at least ONE real HTML list: a <ul> or <ol> containing 3 OR MORE <li> items. Never fake a list with inline separators (e.g. "A | B | C", dashes, or bullets inside a <p>) — it must be actual <ul>/<ol><li> markup
- Add 2–3 external links to authoritative sources (Wikipedia, industry associations, .gov/.edu) as inline citations — use <a href="URL" target="_blank" rel="noopener noreferrer">anchor text</a>
- Do NOT add image tags — leave image placement to the user
- Do NOT change the meta title or meta description
- Keep the human, expert tone — avoid AI-sounding filler phrases${protectedTermsBlock}${IMG_TOKEN_RULE}

${scoreGapsBlock}${gapBlock}${signalImprovementBlock}${competitorBlock}${aiSearchBlock}

OUTPUT FORMAT: Return ONLY the complete optimized HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.${brandVoiceBlock}\n\n${ANTI_HALLUCINATION_RULES}`;

    // ── FAQ in parallel ───────────────────────────────────────────────────
    // The FAQ (PAA fetch + answer generation) depends only on the keyword, not the
    // optimized body — kick it off now so it overlaps the rewrite + humanize passes.
    // Merged after humanize, unless the article already contains an FAQ.
    const extractFaqQuestions = (htmlStr: string): string[] => {
      const h2s: Array<{ index: number; end: number; text: string }> = [];
      const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
      let mm: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((mm = h2Re.exec(htmlStr))) {
        h2s.push({ index: mm.index, end: mm.index + mm[0].length, text: mm[1].replace(/<[^>]+>/g, '').trim() });
      }
      const faqIdx = h2s.findIndex((h) => /faq|najczęściej zadawane|frequently asked/i.test(h.text));
      if (faqIdx === -1) return [];
      const sectionEnd = faqIdx + 1 < h2s.length ? h2s[faqIdx + 1].index : htmlStr.length;
      const section = htmlStr.slice(h2s[faqIdx].end, sectionEnd);
      return [...section.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)]
        .map((x) => x[1].replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .slice(0, 8);
    };

    // Skip generation if the source already has an FAQ (the optimizer preserves it).
    const sourceHasFaq = keyword ? extractFaqQuestions(content).length > 0 : false;
    const faqPromise: Promise<{ html: string; questions: string[] }> = (keyword && !sourceHasFaq)
      ? (async () => {
        let paaQuestions: string[] = Array.isArray(scoreData?.paa_questions)
          ? scoreData!.paa_questions.filter(Boolean).slice(0, 6)
          : [];
        if (!paaQuestions.length && process.env.SERPER_API_KEY) {
          try {
            const serperRes = await fetch('https://google.serper.dev/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
              body: JSON.stringify({ q: keyword, gl: 'pl', hl: 'pl', num: 10 }),
            });
            if (serperRes.ok) {
              const serperData = await serperRes.json();
              paaQuestions = (serperData.peopleAlsoAsk || []).slice(0, 5).map((item: any) => item.question as string).filter(Boolean);
            }
          } catch (faqErr: any) { console.log('[auto-optimize] Serper PAA error (non-fatal):', faqErr?.message); }
        }
        if (!paaQuestions.length) return { html: '', questions: [] };
        const faqSystemPrompt = `You are an SEO content writer adding ONE FAQ section to a web article.
Write a concise, complete answer (2-4 sentences) for EACH question provided.
RULES:
- Detect the article's language from the keyword and content, and write the ENTIRE FAQ (questions AND answers) in THAT language
- If a question is in a different language, TRANSLATE it naturally into the article's language and use the translation as the <h3> — keep its original meaning
- Naturally repeat the key words from each question inside its answer so the topic is unmistakably covered
- Answer EVERY question in the list — do not skip any
Format output as ONLY this HTML block — no preamble:

<h2>FAQ</h2>
<div class="faq-section">
  <div class="faq-item">
    <h3>[question in the article's language]</h3>
    <p>[answer]</p>
  </div>
</div>

Return ONLY the HTML block. No explanation, no markdown fences.${brandVoiceBlock}\n\n${ANTI_HALLUCINATION_RULES}`;
        try {
          const faqRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'deepseek-chat',
              max_tokens: 4000,
              temperature: 0.4,
              messages: [
                { role: 'system', content: faqSystemPrompt },
                { role: 'user', content: `Article keyword: "${keyword}"\n\nQuestions (answer each in the article's language):\n${paaQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` },
              ],
            }),
          });
          if (faqRes.ok) {
            const faqData = await faqRes.json();
            const faqHtml = (faqData.choices?.[0]?.message?.content || '').trim().replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            if (faqHtml) return { html: faqHtml, questions: extractFaqQuestions(faqHtml) };
          } else {
            console.log('[auto-optimize] FAQ DeepSeek failed HTTP', faqRes.status);
          }
        } catch (faqErr: any) { console.log('[auto-optimize] FAQ phase error (non-fatal):', faqErr?.message); }
        return { html: '', questions: [] };
      })()
      : Promise.resolve({ html: '', questions: [] });

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
          { role: 'user', content: `Optimize this article:\n\n${imagesProtected}` },
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
    optimized = stripLlmArtifacts(optimized);
    console.log('[auto-optimize] optimized content length:', optimized.length);

    if (!optimized || optimized.length < 50) {
      sse(res, 'error', { message: 'AI returned empty response' });
      return res.end();
    }

    // ── Phase 2: Humanize ─────────────────────────────────────────────────
    sse(res, 'progress', { message: 'Humanizing content…' });

    const humanizeProtectedBlock = protectedTerms.length
      ? `\n- Do NOT change or paraphrase these exact strings — preserve them verbatim: ${protectedTerms.map((t) => `"${t}"`).join(', ')}`
      : '';

    const humanizeSystemPrompt = `You are an expert content editor. Your job is to rewrite the article to sound authentically human — natural, confident, and engaging.

RULES:
- Keep the SAME LANGUAGE as the input article (auto-detect)
- Preserve ALL headings, links (<a> tags), images (<img>), and HTML structure
- Remove AI-sounding filler phrases ("It's worth noting that", "In today's world", "Furthermore", "In conclusion", "Delve into")
- Vary sentence length — mix short punchy sentences with longer ones
- Add concrete specifics where generic phrases exist
- Keep every NLP keyword that was injected — do NOT remove them${humanizeProtectedBlock}${IMG_TOKEN_RULE}
- Do NOT shorten the article — you may expand thin paragraphs slightly
- Do NOT change meta title/description${brandVoiceBlock}

OUTPUT FORMAT: Return ONLY the complete rewritten HTML article. No explanation, no markdown code fences, no comments. Raw HTML only.\n\n${ANTI_HALLUCINATION_RULES}`;

    const humanizeRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 32000,
        temperature: 0.4,
        messages: [
          { role: 'system', content: humanizeSystemPrompt },
          { role: 'user', content: `Humanize this article:\n\n${optimized}` },
        ],
      }),
    });

    if (humanizeRes.ok) {
      const humanizeData = await humanizeRes.json();
      const humanized = stripLlmArtifacts((humanizeData.choices?.[0]?.message?.content || '').trim()
        .replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim());
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
    // The FAQ was generated in parallel (faqPromise, started before the rewrite). Merge it
    // now unless the optimized article already contains an FAQ section.
    let resolvedPaaQuestions: string[] = [];
    if (keyword) {
      const existingFaq = extractFaqQuestions(optimized);
      if (existingFaq.length) {
        resolvedPaaQuestions = existingFaq;
        console.log('[auto-optimize] reusing existing FAQ —', existingFaq.length, 'questions; skipping generation');
      } else {
        const faq = await faqPromise;
        if (faq.html) {
          optimized = optimized.trimEnd() + '\n\n' + faq.html;
          resolvedPaaQuestions = faq.questions;
          console.log('[auto-optimize] FAQ appended;', resolvedPaaQuestions.length, 'questions resolved');
        }
      }
    }

    // ── Phase 6: Post-score verification with retry loop ──────────
    let postScore: number | null = null;
    let postSignals: any = null;
    let scoreDelta: number | null = null;
    let attempts = 1;
    const MAX_ATTEMPTS = 3;
    let prevPost: number | null = null;

    while (attempts <= MAX_ATTEMPTS) {
      try {
        sse(res, 'progress', { message: `Verifying ranking score (attempt ${attempts}/${MAX_ATTEMPTS})…` });
        const scoreResult = await scoreContent(optimized, keyword || '',
          {
            terms: scoreData?.terms || [],
            words_target: scoreData?.words_target || 2200,
            headings_target: scoreData?.headings_target || 15,
            paragraphs_target: scoreData?.paragraphs_target || 20,
          },
          articleTitle || '',
          articleMetaDescription || ''
        );

        if (scoreResult) {
          postScore = scoreResult.ranking_score;
          postSignals = scoreResult.ranking_signals;
          if (preScoreData?.ranking_score != null) {
            scoreDelta = postScore - preScoreData.ranking_score;
          }
          console.log('[auto-optimize] post-score:', postScore, 'delta:', scoreDelta, 'attempt:', attempts);

          const sign = scoreDelta !== null ? (scoreDelta > 0 ? '+' : '') : '';
          const targetMsg = postScore >= 90 ? ' TARGET 90-100 ACHIEVED!' : postScore >= 80 ? ' Close to target range' : '';
          sse(res, 'progress', {
            message: `Score: ${preScoreData?.ranking_score ?? '?'} → ${postScore} (${sign}${scoreDelta ?? '?'})${targetMsg}`,
          });

          if (postScore >= 90 || !postSignals?.signals?.length) break;

          // Diminishing returns: the previous full-article patch barely moved the score and
          // we're already in a solid range — another ~16k-token patch isn't worth the wait.
          if (prevPost !== null && postScore - prevPost < 2 && postScore >= 80) {
            console.log('[auto-optimize] stopping early — patch gain', postScore - prevPost, '< 2 at', postScore);
            break;
          }
          prevPost = postScore;

          if (attempts < MAX_ATTEMPTS) {
            const weakSignals = [...(postSignals?.signals || [])]
              .sort((a: any, b: any) => a.score - b.score)
              .slice(0, 2);

            const patchPrompt = `The article scored ${postScore}/100 (target: 90-100). The weakest signals are:
${weakSignals.map((s: any) => `${s.name}: ${s.score}/100 — ${s.recommendation || 'needs improvement'}`).join('\n')}

Make TARGETED, MINIMAL improvements to fix ONLY these weaknesses. Do NOT rewrite the entire article.
${ANTI_HALLUCINATION_RULES}

Return the complete HTML with targeted fixes applied.`;

            sse(res, 'progress', { message: `Targeted patch to improve ${weakSignals.map((s: any) => s.name).join(', ')}…` });

            if (!process.env.DEEPSEEK_API_KEY) {
              console.log('[auto-optimize] skipping targeted patch — missing DEEPSEEK_API_KEY');
              break;
            }
            const patchRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: 16384,
                temperature: 0.2,
                messages: [{ role: 'user', content: `ARTICLE:\n${optimized}\n\n${patchPrompt}` }],
              }),
            });

            if (patchRes.ok) {
              const patchData = await patchRes.json();
              const raw = patchData.choices?.[0]?.message?.content || '';
              const cleaned = raw.replace(/```html?\n?/g, '').replace(/```\n?/g, '').trim();
              if (cleaned) optimized = cleaned;
            }
          }
        }
      } catch (err: any) {
        console.log('[auto-optimize] post-score failed (non-fatal):', err.message);
        break;
      }
      attempts++;
    }

    // ── Internal linking: link to the domain's other pages ─────────
    if (articleId) {
      try {
        const articleIdSql = await getArticleIdSql();
        const [drow] = await db.query(`SELECT domain_id, publish_url, meta_url FROM articles WHERE ${articleIdSql} = ? LIMIT 1`, { replacements: [articleId] });
        const self = (drow as any[])[0] || {};
        const domainId = self.domain_id;
        if (domainId) {
          // Sibling articles that have a public URL…
          const [artRows] = await db.query(
            `SELECT title, publish_url, meta_url FROM articles
             WHERE domain_id = ? AND ${articleIdSql} <> ? AND title IS NOT NULL
             ORDER BY updated_at DESC LIMIT 40`,
            { replacements: [domainId, articleId] },
          );
          // …plus every page the scan audited (whole-site coverage, with real titles).
          const [auditRows] = await db.query(
            `SELECT url, title FROM page_audits
             WHERE domain_id = ? AND fetch_status = 'OK' AND title IS NOT NULL AND url IS NOT NULL
             ORDER BY last_audited_at DESC LIMIT 100`,
            { replacements: [domainId] },
          );

          const seen = new Set<string>();
          const ownUrl = normUrl(self.publish_url || self.meta_url || '');
          if (ownUrl) seen.add(ownUrl);
          const candidates: SiteLink[] = [];
          const pushCand = (title: unknown, url: unknown) => {
            const t = String(title || '').trim();
            const u = String(url || '').trim();
            const key = normUrl(u);
            if (!t || !u || !key || seen.has(key) || candidates.length >= 60) return;
            seen.add(key);
            candidates.push({ title: t, url: u });
          };
          for (const a of artRows as any[]) pushCand(a.title, a.publish_url || a.meta_url);
          for (const a of auditRows as any[]) pushCand(a.title, a.url);
          if (candidates.length) {
            sse(res, 'progress', { message: 'Adding internal links…' });
            const links = await suggestInternalLinks(optimized, keyword || '', candidates, apiKey);
            if (links.length) {
              const { html: linked, applied: linkCount } = applyInternalLinks(optimized, links, 5);
              optimized = linked;
              console.log('[auto-optimize] internal links applied:', linkCount, 'of', links.length);
              if (linkCount) sse(res, 'progress', { message: `Added ${linkCount} internal link${linkCount > 1 ? 's' : ''} ✓` });
            }
          }
        }
      } catch (err: any) {
        console.log('[auto-optimize] internal linking failed (non-fatal):', err?.message);
      }
    }

    // ── FAQ structured data (FAQPage JSON-LD) for rich results + AI citations ──
    if (resolvedPaaQuestions.length && !optimized.includes('"FAQPage"')) {
      const faqSchema = buildFaqSchema(optimized);
      if (faqSchema) {
        optimized = `${optimized.trimEnd()}\n${faqSchema}`;
        console.log('[auto-optimize] FAQ JSON-LD schema appended');
      }
    }

    // ── Meta title & description optimization ─────────────────────
    let suggestedMetaTitle = '';
    let suggestedMetaDescription = '';

    if (keyword) {
      try {
        sse(res, 'progress', { message: 'Optimizing meta title & description…' });

        const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
        const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const pageTitle = articleTitle || (titleMatch ? titleMatch[1] : '') || (h1Match ? h1Match[1] : '') || keyword;
        const currentDesc = articleMetaDescription || '';

        const metaPrompt = `Generate an SEO-optimized meta title and meta description for this article.

Keyword: "${keyword}"
Current title: "${pageTitle}"
Current meta description: "${currentDesc}"

Rules:
- Title: 50-60 characters, include the keyword near the beginning, compelling and click-worthy
- Description: 140-160 characters, summarize the article value proposition, include a call-to-action
- Write in the SAME LANGUAGE as the article title

Return ONLY a JSON object:
{"title": "the optimized title", "description": "the optimized meta description"}`;

        const metaRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 500,
            temperature: 0.3,
            messages: [{ role: 'user', content: metaPrompt }],
          }),
        });

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const raw = (metaData.choices?.[0]?.message?.content || '').trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.title && parsed.title !== pageTitle) suggestedMetaTitle = parsed.title;
            if (parsed.description && parsed.description !== currentDesc) suggestedMetaDescription = parsed.description;
          } catch {
            const tMatch = raw.match(/["']?title["']?\s*:\s*["']([^"']+)["']/i);
            const dMatch = raw.match(/["']?description["']?\s*:\s*["']([^"']+)["']/i);
            if (tMatch) suggestedMetaTitle = tMatch[1];
            if (dMatch) suggestedMetaDescription = dMatch[1];
          }
          if (suggestedMetaTitle || suggestedMetaDescription) {
            console.log('[auto-optimize] meta suggestions:', suggestedMetaTitle.slice(0, 60), '|', suggestedMetaDescription.slice(0, 60));
          }
        }
      } catch (err: any) {
        console.log('[auto-optimize] meta generation failed (non-fatal):', err.message);
      }
    }

    // ── Restore the user's original images (and re-append any the model dropped) ──
    if (hadImages) {
      const usedImg = new Set<number>();
      optimized = optimized.replace(/@@KEEPIMG(\d+)@@/g, (_m: string, i: string) => {
        usedImg.add(Number(i));
        return preservedImages[Number(i)] ?? '';
      });
      const droppedImgs = preservedImages.filter((_, i) => !usedImg.has(i));
      if (droppedImgs.length) {
        console.log('[auto-optimize] re-appending', droppedImgs.length, 'image(s) the model dropped');
        optimized = optimized.trimEnd() + '\n' + droppedImgs.join('\n');
      }
    }

    // ── Phase 7: Image Placeholders ───────────────────────────────
    // Only inject AI placeholder images when the article has none of its own — never replace the
    // user's existing images with generated ones.
    const PLACEHOLDER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='380'%3E%3Crect width='800' height='380' fill='%23f3f4f6'/%3E%3Ctext x='400' y='200' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='18'%3E%E2%8F%B3 Generating image...%3C/text%3E%3C/svg%3E";
    const pendingImages: Array<{ idx: number; prompt: string }> = [];
    let h2Counter = 0;
    const optimizedWithImages = hadImages ? optimized : optimized.replace(/<\/h2>/gi, (match: string, offset: number, str: string) => {
      h2Counter++;
      if (h2Counter % 4 !== 0) return match;
      const before = str.slice(0, offset);
      const openTag = before.lastIndexOf('<h2');
      const headingHtml = openTag >= 0 ? str.slice(openTag, offset) : '';
      const headingText = headingHtml.replace(/<[^>]+>/g, '').trim().slice(0, 120);
      const idx = pendingImages.length;
      pendingImages.push({ idx, prompt: headingText });
      const imgTag = `<img src="${PLACEHOLDER_SRC}" alt="${headingText.replace(/"/g, '&quot;')}" title="__AIMG_${idx}__" />`;
      return `${match}${imgTag}`;
    });

    // ── Phase 8: Save content + ranking score to article ──────────
    if (articleId && postScore !== null) {
      try {
        const articleIdSql = await getArticleIdSql();
        await db.query(
          `UPDATE articles SET content = ?, ranking_score = ?, ranking_signals = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
          { replacements: [optimizedWithImages, postScore, JSON.stringify(postSignals), articleId] }
        );
        console.log('[auto-optimize] saved content + ranking_score to article:', postScore);
      } catch (err: any) {
        console.log('[auto-optimize] failed to save to article:', err.message);
      }
    }

    // Persist the FAQ's resolved (article-language) questions so the saved/listed score credits the FAQ.
    if (articleId && resolvedPaaQuestions.length && scoreData) {
      try {
        const articleIdSql = await getArticleIdSql();
        await db.query(
          `UPDATE articles SET score_data = ? WHERE ${articleIdSql} = ?`,
          { replacements: [JSON.stringify({ ...scoreData, paa_questions: resolvedPaaQuestions }), articleId] },
        );
      } catch (err: any) {
        console.log('[auto-optimize] failed to persist resolved PAA questions:', err.message);
      }
    }

    // ── Phase 9: Refresh entity list + AI Search from DataForSEO ───
    // The user expects auto-optimize to grow a thin keyword list and re-check the
    // AI-search questions against the new content. Best-effort; no-op without DataForSEO.
    let refreshedTerms: Array<{ term: string; target_count: number }> | undefined;
    let refreshedAiSummary: any;
    if (articleId && keyword) {
      try {
        const articleIdSql = await getArticleIdSql();
        const [rows] = await db.query(
          `SELECT a.language, d.domain FROM articles a LEFT JOIN domain d ON d."ID" = a.domain_id WHERE a.${articleIdSql} = ? LIMIT 1`,
          { replacements: [articleId] },
        );
        const meta = (rows as any[])[0] || {};
        const lang = meta.language || 'pl';
        const country = COUNTRY_FOR_LANG[lang] || 'US';
        const optimizedText = optimizedWithImages.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

        // Grow the entity list if it's thin.
        const existingTerms = (scoreData?.terms || []) as Array<{ term: string; target_count: number }>;
        if (existingTerms.length < 60) {
          sse(res, 'progress', { message: 'Pulling more keywords from DataForSEO…' });
          const { terms: extra } = await enrichTerms({ keyword, country, languageCode: lang, limit: 90 });
          if (extra.length) {
            const seen = new Set(existingTerms.map((t) => (t.term || '').toLowerCase()));
            const merged = [...existingTerms];
            for (const t of extra) {
              if (merged.length >= 100) break;
              if (!seen.has(t.term.toLowerCase())) { merged.push(t); seen.add(t.term.toLowerCase()); }
            }
            refreshedTerms = merged.map((t) => ({ ...t, current_count: countOccurrences(optimizedText, t.term) } as any));
            await db.query(`UPDATE articles SET score_data = ? WHERE ${articleIdSql} = ?`, {
              replacements: [JSON.stringify({ ...scoreData, terms: refreshedTerms }), articleId],
            }).catch(() => {});
          }
        }

        // Re-evaluate AI Search questions against the freshly optimized content.
        sse(res, 'progress', { message: 'Re-checking AI-search coverage…' });
        let ownDomain = '';
        try { ownDomain = meta.domain ? new URL(`https://${meta.domain}`).hostname.replace(/^www\./, '') : ''; } catch { /* ignore */ }
        const aiSummary = await getAiSearchInfo({ keyword, articleText: optimizedText, ownDomain, country, languageCode: lang });
        if (aiSummary && aiSummary.citations.length) {
          await persistAiVisibilityRun(articleId, keyword, aiSummary);
          refreshedAiSummary = aiSummary;
        }
      } catch (err: any) {
        console.log('[auto-optimize] DataForSEO refresh failed (non-fatal):', err?.message);
      }
    }

    // Competitor outlines (with headings) for the editor's Competitors panel — read from the
    // cache getCompetitorData populated this run, so the panel fills in right after optimize.
    let competitorOutlines: any[] | null = null;
    if (articleId) {
      try {
        const aidSql = await getArticleIdSql();
        const [orows] = await db.query(`SELECT competitor_outlines_cache FROM articles WHERE ${aidSql} = ? LIMIT 1`, { replacements: [articleId] });
        const parsed = JSON.parse((orows as any[])[0]?.competitor_outlines_cache || '{}');
        if (Array.isArray(parsed.competitors) && parsed.competitors.length) competitorOutlines = parsed.competitors;
      } catch { /* ignore */ }
    }

    console.log('[auto-optimize] sending done event, pendingImages:', pendingImages.length);
    sse(res, 'done', {
      content: optimizedWithImages,
      pendingImages,
      ...(competitorOutlines ? { competitorOutlines } : {}),
      ...(refreshedTerms ? { updatedTerms: refreshedTerms } : {}),
      ...(refreshedAiSummary ? { aiSummary: refreshedAiSummary } : {}),
      ...(resolvedPaaQuestions.length ? { paaQuestions: resolvedPaaQuestions } : {}),
      ...(suggestedMetaTitle ? { suggestedMetaTitle } : {}),
      ...(suggestedMetaDescription ? { suggestedMetaDescription } : {}),
      ...(postScore !== null ? {
        preScore: preScoreData?.ranking_score ?? null,
        preSignals: preScoreData?.ranking_signals ?? null,
        postScore,
        postSignals,
        scoreDelta,
        attempts,
      } : {}),
    });
    console.log('[auto-optimize] done event sent');
  } catch (error: any) {
    console.error('[auto-optimize] caught error:', error?.message, error?.stack?.slice(0, 300));
    sse(res, 'error', { message: error?.message || 'Request failed' });
  }

  res.end();
}
