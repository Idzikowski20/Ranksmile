// POST /api/articles/deep-analysis
// SSE-streamed article import with progress events.
// Creates skeleton article immediately (status='analyzing'), then runs all steps
// sequentially sending progress events. Atomic: only marks 'draft' if all steps succeed.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import * as cheerio from 'cheerio';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import type { ScoreData, NlpTerm } from '../../../lib/contentScore';
import { computeContentScore } from '../../../lib/contentScore';
import { uploadImageFromUrl } from '../../../lib/uploadToBlob';
import { dedupeUsefulTerms } from '../../../lib/articleTerms';
import { computeAiSearchScore, AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { getArticleIdSql } from '../../../lib/articleSql';
import { renderPage } from '../../../utils/spaScraper';

// Try plain HTTP fetch first (fast). Falls back to Puppeteer if the content
// looks like a JS-rendered SPA (fewer than 200 words extracted from body).
const FETCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchPlain(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': FETCH_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchWithPuppeteer(url: string): Promise<string> {
  const rendered = await renderPage(url, 30_000);
  return rendered.html;
}

// Smart fetch: plain HTTP first, Puppeteer if content looks JS-rendered
async function fetchPage(url: string): Promise<string> {
  let html: string;
  try {
    html = await fetchPlain(url);
    // Quick quality check: if body has enough visible text, skip Puppeteer
    const bodyText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 200) {
      console.log(`[deep-analysis] plain fetch ok (${wordCount} words)`);
      return html;
    }
    console.log(`[deep-analysis] plain fetch thin (${wordCount} words), trying Puppeteer`);
  } catch (e: any) {
    console.log(`[deep-analysis] plain fetch failed (${e?.message}), trying Puppeteer`);
  }
  return fetchWithPuppeteer(url);
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','was','are','were','be','been','has','have','had','do','does','did','will',
  'would','could','should','may','might','shall','this','that','these','those','it',
  'its','i','you','we','they','he','she','his','her','our','their','your','my','me',
  'him','us','them','as','if','so','not','no','nor','yet','both','either','each',
  'few','more','most','some','any','all','than','then','when','where','who','which',
  'what','how','why','also','just','even','still','very','too','only','while','about',
  'after','before','over','under','again','further','once','here','there','into',
  'through','during','until','against','among','throughout','despite','towards','upon',
  'whether','per','across','along','following','via','without','up','down','out','off',
  'around','away','above','below','can','get','got','use','used','using','make','made',
  'take','taken','come','came','see','seen','know','known','think','thought','want',
  'like','look','go','going','gone','give','given','said','say','says','new','one',
  'two','three','four','five','six','seven','eight','nine','ten','first','last','next',
  'aby','ale','albo','ani','bez','bo','by','byc','byl','byla','bylo','byly','czy',
  'dla','do','gdy','gdzie','ich','im','jest','jesli','juz','kiedy','kto','ktora',
  'ktore','ktory','lub','ma','mial','miec','mnie','moze','mozna','na','nad','nam',
  'nas','nie','nim','niz','oraz','po','pod','przed','przez','przy','sa','sie','sobie',
  'tak','takze','tego','tej','ten','teraz','tez','to','tych','tym','u','w','we','z',
  'za','ze','zeby','warto','nalezy','czasem','sytuacja','informacje',
]);

function extractTopWords(text: string, topN: number): Array<{ term: string; count: number }> {
  const lower = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const freq: Record<string, number> = {};

  const words = lower.match(/\b[a-zÀ-ſ]{3,}\b/g) || [];
  for (const w of words) {
    if (!STOP_WORDS.has(w) && isNaN(Number(w))) freq[w] = (freq[w] || 0) + 1;
  }

  const sentences = lower.split(/[.!?\n]+/);
  for (const sentence of sentences) {
    const tokens = sentence.match(/\b[a-zÀ-ſ]{2,}\b/g) || [];
    for (let i = 0; i < tokens.length - 1; i++) {
      if (STOP_WORDS.has(tokens[i]) || STOP_WORDS.has(tokens[i + 1])) continue;
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
    for (let i = 0; i < tokens.length - 2; i++) {
      const stopCount = [tokens[i], tokens[i + 1], tokens[i + 2]].filter((t) => STOP_WORDS.has(t)).length;
      if (stopCount > 0) continue;
      const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      freq[trigram] = (freq[trigram] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}

function countOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(escaped, 'gi'));
  return matches ? matches.length : 0;
}

function sse(res: NextApiResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Flush chunk immediately so the browser receives it without buffering
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

// ── Steps definitions (shared with frontend) ──────────────────────────
export const DEEP_ANALYSIS_STEPS = [
  { key: 'fetch',     label: 'Fetching page content…' },
  { key: 'metadata',  label: 'Extracting title and metadata…' },
  { key: 'structure', label: 'Analyzing content structure…' },
  { key: 'nlp',       label: 'Extracting keywords and NLP terms…' },
  { key: 'serp',      label: 'Analyzing SERP competitors…' },
  { key: 'score',     label: 'Computing content score…' },
  { key: 'image',     label: 'Uploading featured image…' },
  { key: 'save',      label: 'Saving article…' },
  { key: 'ai_visibility', label: 'Checking AI Search visibility...' },
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[deep-analysis] handler invoked', req.method);
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    console.log('[deep-analysis] auth failed:', authorized);
    return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, keywords = [], country = 'US', device = 'Desktop', articleId: existingArticleId, domainId: reqDomainId } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');

  // Force-flush headers to prevent buffering in Next.js dev server
  res.status(200);
  if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
  // Write priming comment to force socket flush
  res.write(':ok\n\n');

  // ── Create or reuse article ─────────────────────────────────────────
  let articleId: number;
  let articleDomain = '';
  const articleIdSql = await getArticleIdSql();

  if (existingArticleId) {
    // Reuse existing article — fetch its domain
    articleId = existingArticleId;
    const [rows] = await db.query(
      `SELECT a.domain_id, d.domain FROM articles a LEFT JOIN domain d ON d."ID" = a.domain_id WHERE a.${articleIdSql} = ?`,
      { replacements: [existingArticleId] },
    );
    const existing = (rows as any[])[0];
    articleDomain = existing?.domain || '';
    await db.query(`UPDATE articles SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`, { replacements: [articleId] });
    sse(res, 'created', { articleId });
  } else {
    try {
      let domainId: number;
      let domain = '';
      if (reqDomainId) {
        const [domains] = await db.query('SELECT "ID", domain FROM domain WHERE "ID" = ?', { replacements: [reqDomainId] });
        domainId = (domains as any[])[0]?.ID || 1;
        domain = (domains as any[])[0]?.domain || '';
      } else {
        const [domains] = await db.query('SELECT "ID", domain FROM domain LIMIT 1', { replacements: [] });
        domainId = (domains as any[])[0]?.ID || 1;
        domain = (domains as any[])[0]?.domain || '';
      }
      articleDomain = domain;

      const skeletonSlug = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 60);
      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING ${articleIdSql} AS id`,
          {
            replacements: [domainId, url, skeletonSlug, url, (keywords as string[])[0] || ''],
            type: QueryTypes.SELECT,
          },
        );
        articleId = rows[0]?.id;
      } else {
        const [newArticleId] = await db.query(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          {
            replacements: [domainId, url, skeletonSlug, url, (keywords as string[])[0] || ''],
            type: QueryTypes.INSERT,
          },
        );
        articleId = newArticleId as unknown as number;
      }
      if (!articleId) throw new Error('Failed to resolve inserted article id');
      sse(res, 'created', { articleId });
    } catch (err: any) {
      console.error('[deep-analysis] Skeleton insert failed:', err.message);
      sse(res, 'error', { step: 'save', message: 'Failed to initialize analysis' });
      return res.end();
    }
  }

  // Helper to update article status/progress — non-fatal if fails
  async function updateArticle(fields: Record<string, any>) {
    try {
      // Drop undefined values — Sequelize positional (?) replacements break on undefined
      const clean = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(clean).length === 0) return;
      const sets = Object.keys(clean).map((k) => `${k} = ?`).join(', ');
      const values = Object.values(clean).map((v) => (v === undefined ? null : v));
      await db.query(
        `UPDATE articles SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
        { replacements: [...values, articleId] },
      );
    } catch (e: any) {
      console.error('[deep-analysis] updateArticle error:', e.message);
    }
  }

  try {
    // ── Step 1: Fetch page ─────────────────────────────────────────
    sse(res, 'progress', { step: 'fetch', status: 'running' });
    await updateArticle({ title: url });
    let html: string;
    try {
      html = await fetchPage(url);
    } catch (fetchErr: any) {
      await updateArticle({ status: 'error', content: `Fetch error: ${fetchErr?.message || 'unknown'}` });
      sse(res, 'error', { step: 'fetch', message: `Could not fetch URL: ${fetchErr?.message || 'unknown'}` });
      return res.end();
    }
    sse(res, 'progress', { step: 'fetch', status: 'done' });

    // ── Step 2: Metadata ───────────────────────────────────────────
    sse(res, 'progress', { step: 'metadata', status: 'running' });
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, .sidebar, #sidebar, .ad, .advertisement, .cookie-banner, noscript, iframe').remove();

    const title = $('h1').first().text().trim()
      || $('meta[property="og:title"]').attr('content')?.trim()
      || $('title').text().trim()
      || url;
    const metaTitle = $('title').text().trim()
      || $('meta[property="og:title"]').attr('content')?.trim()
      || title;
    const metaDescription = $('meta[name="description"]').attr('content')?.trim()
      || $('meta[property="og:description"]').attr('content')?.trim()
      || '';

    // Slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 80);

    await updateArticle({ title: title || url, meta_title: metaTitle || title || url, meta_description: metaDescription || '', slug: slug || 'article' });
    sse(res, 'progress', { step: 'metadata', status: 'done' });

    // ── Step 3: Content structure ──────────────────────────────────
    sse(res, 'progress', { step: 'structure', status: 'running' });

    // Featured image
    const toAbsUrl = (src: string) => {
      if (!src) return '';
      if (src.startsWith('data:')) return '';
      try { return src.startsWith('http') ? src : new URL(src, url).href; } catch { return ''; }
    };
    const rawFeaturedImage = $('meta[property="og:image"]').attr('content')?.trim()
      || $('meta[name="twitter:image"]').attr('content')?.trim()
      || (() => {
        let found = '';
        $('img').each((_, el) => {
          if (found) return;
          const src = $(el).attr('src') || '';
          const w = parseInt($(el).attr('width') || '0', 10);
          const h = parseInt($(el).attr('height') || '0', 10);
          if (!src || src.startsWith('data:')) return;
          if ((w && w < 100) || (h && h < 100)) return;
          found = src;
        });
        return found;
      })() || '';
    const featuredImage = toAbsUrl(rawFeaturedImage);

    // Content container detection
    const candidateSelectors = [
      'article', '[role="main"]', 'main',
      '.post-content', '.entry-content', '.article-content', '.article-body',
      '.content-body', '.blog-content', '.post-body', '.page-content',
      '.single-content', '.text-content', '.rich-text', '.prose',
      '#content', '#main-content', '#post-content', '#article-body',
      '.content', '.main', '#main',
    ];
    let bestEl: any = $('body')[0];
    let bestWordCount = 0;
    for (const sel of candidateSelectors) {
      $(sel).each((_, el) => {
        const wc = $(el).text().replace(/\s+/g, ' ').trim().split(' ').length;
        if (wc > bestWordCount) { bestWordCount = wc; bestEl = el; }
      });
    }
    $('div, section').each((_, el) => {
      const pCount = $(el).find('p').length;
      const wc = $(el).text().replace(/\s+/g, ' ').trim().split(' ').length;
      if (pCount >= 3 && wc > bestWordCount) { bestWordCount = wc; bestEl = el; }
    });

    const $body = $(bestEl);
    const plainText = $body.text().replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    const headingTexts: string[] = [];
    $('h1, h2, h3, h4').each((_, el) => {
      const t = $(el).text().trim();
      if (t) headingTexts.push(t);
    });

    const seen = new WeakSet();
    const contentParts: string[] = [];
    $body.find('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote').each((_, el) => {
      if (seen.has(el)) return;
      const tag: string = (el as any).name || '';
      if (!tag) return;
      $(el).find('*').each((__, child) => { seen.add(child); });
      seen.add(el);
      if (/^h[1-6]$/.test(tag)) {
        const text = $(el).text().trim();
        if (text) contentParts.push(`<${tag}>${text}</${tag}>`);
      } else if (tag === 'p') {
        const text = $(el).text().trim();
        if (text.split(/\s+/).length >= 3) contentParts.push(`<p>${text}</p>`);
      } else if (tag === 'ul' || tag === 'ol') {
        const items = $(el).children('li').map((_, li) => {
          const t = $(li).text().trim();
          return t ? `<li>${t}</li>` : '';
        }).get().filter(Boolean).join('');
        if (items) contentParts.push(`<${tag}>${items}</${tag}>`);
      } else if (tag === 'blockquote') {
        const text = $(el).text().trim();
        if (text) contentParts.push(`<blockquote><p>${text}</p></blockquote>`);
      }
    });

    const contentHtml = contentParts.length > 2
      ? contentParts.join('\n')
      : plainText.match(/[^\n]{80,}/g)?.map(c => `<p>${c.trim()}</p>`).join('\n') || `<p>${title}</p>`;

    const paragraphCount = $body.find('p').filter((_, el) => {
      return $(el).text().trim().split(/\s+/).length >= 3;
    }).length;

    await updateArticle({ word_count: wordCount });
    sse(res, 'progress', { step: 'structure', status: 'done' });

    // ── Step 4: NLP terms ─────────────────────────────────────────
    sse(res, 'progress', { step: 'nlp', status: 'running' });
    const kwTerms: NlpTerm[] = (keywords as string[]).map((kw: string) => {
      const freq = countOccurrences(plainText, kw);
      return { term: kw, target_count: Math.max(2, freq > 0 ? Math.ceil(freq * 1.5) : 3) };
    });
    const kwSet = new Set((keywords as string[]).map((k: string) => k.toLowerCase()));
    const extracted = extractTopWords(plainText, 30)
      .filter(({ term }) => !kwSet.has(term))
      .slice(0, 20)
      .map(({ term, count }) => ({ term, target_count: Math.max(2, Math.ceil(count * 1.2)) }));
    const allTerms: NlpTerm[] = dedupeUsefulTerms([...kwTerms, ...extracted]).map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    sse(res, 'progress', { step: 'nlp', status: 'done' });

    // ── Step 5: SERP competitor analysis (optional, non-fatal) ────
    sse(res, 'progress', { step: 'serp', status: 'running' });
    let serpCompetitors: any[] = [];
    let serpPaaQuestions: string[] = [];
    // Competitor-derived targets (null = no data, fall back to local estimates in Step 6)
    let serpWordsTarget: number | null = null;
    let serpWordsMin: number | null = null;
    let serpWordsMax: number | null = null;
    let serpHeadingsTarget: number | null = null;
    let serpHeadingsMin: number | null = null;
    let serpHeadingsMax: number | null = null;
    let serpParagraphsTarget: number | null = null;
    let serpParagraphsMin: number | null = null;
    let serpParagraphsMax: number | null = null;
    try {
      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
      const axios = require('axios');
      const serpRes = await axios.post(`${sidecarUrl}/analyze-serp`, {
        keyword: (keywords as string[])[0] || title,
        language: country === 'PL' ? 'pl' : 'en',
      }, { timeout: 30000 });
      serpCompetitors = Array.isArray(serpRes.data?.competitors) ? serpRes.data.competitors.slice(0, 5) : [];
      serpPaaQuestions = Array.isArray(serpRes.data?.paa_questions) ? serpRes.data.paa_questions : [];
      // Capture competitor-derived structural targets
      if (serpRes.data?.words_target) {
        serpWordsTarget = serpRes.data.words_target;
        serpWordsMin = serpRes.data.words_min ?? null;
        serpWordsMax = serpRes.data.words_max ?? null;
        serpHeadingsTarget = serpRes.data.headings_target ?? null;
        serpHeadingsMin = serpRes.data.headings_min ?? null;
        serpHeadingsMax = serpRes.data.headings_max ?? null;
        serpParagraphsTarget = serpRes.data.paragraphs_target ?? null;
        serpParagraphsMin = serpRes.data.paragraphs_min ?? null;
        serpParagraphsMax = serpRes.data.paragraphs_max ?? null;
      }
      if (serpRes.data?.terms?.length) {
        // Merge SERP terms into our NLP terms (avoiding duplicates)
        const existingTerms = new Set(allTerms.map((t) => t.term.toLowerCase()));
        for (const t of serpRes.data.terms) {
          if (!existingTerms.has(t.term.toLowerCase())) {
            allTerms.push({ term: t.term, target_count: Math.max(2, t.target_count || 3), current_count: countOccurrences(plainText, t.term) });
          }
        }
      }
    } catch (serpErr: any) {
      console.warn('[deep-analysis] SERP analysis skipped:', serpErr?.message);
    }
    sse(res, 'progress', { step: 'serp', status: 'done' });

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

    // ── Step 6: Score data ────────────────────────────────────────
    sse(res, 'progress', { step: 'score', status: 'running' });
    const usefulTerms = dedupeUsefulTerms(allTerms).map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    // Use competitor-derived targets when available; fall back to article-based estimates
    const wordsTarget = serpWordsTarget ?? Math.max(1000, Math.ceil(wordCount * 1.5));
    const headingsTarget = serpHeadingsTarget ?? Math.max(5, Math.ceil(headingTexts.length * 2.5));
    const paragraphsTarget = serpParagraphsTarget ?? Math.max(15, Math.ceil(paragraphCount * 2.5));
    const scoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number } = {
      terms: usefulTerms,
      words_target: wordsTarget,
      words_min: serpWordsMin ?? Math.max(600, Math.ceil(wordCount * 0.9)),
      words_max: serpWordsMax ?? Math.max(2000, Math.ceil(wordCount * 2.5)),
      headings_target: headingsTarget,
      headings_min: serpHeadingsMin ?? Math.max(2, Math.ceil(headingTexts.length * 1.5)),
      headings_max: serpHeadingsMax ?? Math.max(10, Math.ceil(headingsTarget * 1.5)),
      paragraphs_target: paragraphsTarget,
      paragraphs_min: serpParagraphsMin ?? Math.max(5, Math.ceil(paragraphCount * 1.5)),
      paragraphs_max: serpParagraphsMax ?? Math.max(20, Math.ceil(paragraphsTarget * 1.5)),
      _heading_count: headingTexts.length,
      _paragraph_count: paragraphCount,
      competitor_count: serpWordsTarget !== null ? serpCompetitors.length : 0,
      ...(serpPaaQuestions.length ? { paa_questions: serpPaaQuestions } : {}),
    };
    scoreData._computed_score = computeContentScore(
      plainText, wordCount, headingTexts.length, scoreData, paragraphCount, undefined,
      contentHtml, (keywords as string[])[0] || title,
    );
    await db.query('DELETE FROM article_terms WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
    await db.query('DELETE FROM article_competitors WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
    for (const term of usefulTerms) {
      await db.query(
        `INSERT INTO article_terms
           (article_id, term, term_type, source, current_count, target_min, target_max, importance, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        {
          replacements: [
            articleId,
            term.term,
            (term as any).term_type || 'topic',
            'serp',
            term.current_count || 0,
            Math.max(1, Math.round(term.target_count * 0.7)),
            Math.max(1, Math.round(term.target_count * 1.5)),
            (term as any).importance || term.target_count || 1,
          ],
        },
      ).catch(() => {});
    }
    for (const competitor of serpCompetitors) {
      await db.query(
        `INSERT INTO article_competitors
           (article_id, url, domain, title, snippet, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        {
          replacements: [
            articleId,
            competitor.url || '',
            competitor.domain || '',
            competitor.title || '',
            competitor.snippet || '',
          ],
        },
      ).catch(() => {});
    }
    sse(res, 'progress', { step: 'score', status: 'done' });

    // ── Step 7: Image upload ──────────────────────────────────────
    sse(res, 'progress', { step: 'image', status: 'running' });
    let featuredImageUrl: string | null = null;
    if (featuredImage) {
      try {
        featuredImageUrl = await uploadImageFromUrl(featuredImage, slug || 'article');
      } catch (imgErr: any) {
        console.warn('[deep-analysis] Image upload skipped:', imgErr?.message);
      }
    }
    sse(res, 'progress', { step: 'image', status: 'done' });

    // ── Step 8: Save — finalize article ───────────────────────────
    sse(res, 'progress', { step: 'save', status: 'running' });
    const computedScore = (scoreData as any)?._computed_score ?? 0;
    await db.query(
      `UPDATE articles SET
         content = ?,
         target_keyword = COALESCE(NULLIF(?, ''), target_keyword),
         score_data = ?,
         content_score = ?,
         featured_image = ?,
         status = 'draft',
         updated_at = CURRENT_TIMESTAMP
       WHERE ${articleIdSql} = ?`,
      {
        replacements: [
          contentHtml ?? '',
          (keywords as string[])[0] || '',
          JSON.stringify(scoreData) ?? '{}',
          computedScore,
          featuredImageUrl ?? null,
          articleId,
        ],
      },
    );
    sse(res, 'progress', { step: 'save', status: 'done' });

    // AI Search visibility is part of deep-analysis, but non-fatal for import.
    sse(res, 'progress', { step: 'ai_visibility', status: 'running' });
    let aiVisibilitySummary: (AiVisibilitySummary & { score?: number }) | null = null;
    try {
      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
      const competitorDomains = Array.from(new Set(
        serpCompetitors
          .map((competitor) => competitor.domain || (competitor.url ? new URL(competitor.url).hostname.replace(/^www\./, '') : ''))
          .filter(Boolean),
      ));
      const sidecarRes = await fetch(`${sidecarUrl}/ai-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: (keywords as string[])[0] || title,
          own_domain: articleDomain,
          competitor_domains: competitorDomains,
          article_content: `${metaTitle || ''}\n${metaDescription || ''}\n${contentHtml || ''}`,
        }),
        signal: AbortSignal.timeout(60000),
      } as RequestInit);

      if (!sidecarRes.ok) throw new Error(await sidecarRes.text());
      const sidecarData = await sidecarRes.json();
      const summary: AiVisibilitySummary = {
        prompts_total: sidecarData.prompts_total || 0,
        prompts_cited: sidecarData.prompts_cited || 0,
        competitor_citations: sidecarData.competitor_citations || 0,
        extractability_score: sidecarData.extractability_score || 0,
        citations: sidecarData.citations || [],
      };
      const aiScore = computeAiSearchScore(summary);
      let runId: number | undefined;
      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO ai_visibility_runs
             (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           RETURNING id`,
          {
            replacements: [
              articleId,
              (keywords as string[])[0] || title || '',
              aiScore,
              summary.prompts_total,
              summary.prompts_cited,
              summary.competitor_citations,
              JSON.stringify(summary),
            ],
            type: QueryTypes.SELECT,
          },
        );
        runId = rows[0]?.id;
      } else {
        const [insertedRunId] = await db.query(
          `INSERT INTO ai_visibility_runs
             (article_id, target_keyword, score, prompts_total, prompts_cited, competitor_citations, summary_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          {
            replacements: [
              articleId,
              (keywords as string[])[0] || title || '',
              aiScore,
              summary.prompts_total,
              summary.prompts_cited,
              summary.competitor_citations,
              JSON.stringify(summary),
            ],
            type: QueryTypes.INSERT,
          },
        );
        runId = insertedRunId as unknown as number;
      }
      if (!runId) throw new Error('Failed to resolve AI visibility run id');

      for (const citation of summary.citations) {
        await db.query(
          `INSERT INTO ai_visibility_citations
             (run_id, prompt, answer, cited_url, cited_domain, is_own_domain, is_competitor, sentiment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          {
            replacements: [
              runId,
              citation.prompt,
              citation.answer || '',
              citation.cited_url || '',
              citation.cited_domain || '',
              citation.is_own_domain ? 1 : 0,
              citation.is_competitor ? 1 : 0,
              '',
            ],
          },
        );
      }
      aiVisibilitySummary = { ...summary, score: aiScore };
      sse(res, 'ai_visibility', { summary: aiVisibilitySummary, warning: sidecarData.warning || null });
      sse(res, 'progress', { step: 'ai_visibility', status: 'done' });
    } catch (aiErr: any) {
      console.warn('[deep-analysis] AI visibility skipped:', aiErr?.message);
      sse(res, 'progress', { step: 'ai_visibility', status: 'warning', message: aiErr?.message || 'AI visibility skipped' });
    }

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

    // ── Done! ─────────────────────────────────────────────────────
    sse(res, 'done', { articleId, aiVisibilitySummary });

  } catch (error: any) {
    console.error('[deep-analysis] Unexpected error:', error);
    await updateArticle({ status: 'error', content: `Unexpected error: ${error?.message || 'Import failed'}` }).catch(() => {});
    sse(res, 'error', { step: 'save', message: error?.message || 'Import failed' });
  }

  res.end();
}
