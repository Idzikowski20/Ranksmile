// POST /api/articles/import
// Scrapes a URL (with Puppeteer fallback for SPAs), extracts content, builds NLP ScoreData
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import * as cheerio from 'cheerio';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import type { ScoreData, NlpTerm } from '../../../lib/contentScore';
import { computeContentScore } from '../../../lib/contentScore';
import { uploadImageFromUrl } from '../../../lib/uploadToBlob';

async function fetchWithPuppeteer(url: string): Promise<string> {
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const puppeteer = require('puppeteer-core');
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const chromium = require('@sparticuz/chromium-min');

   let executablePath: string;
   try {
      // Try local Chrome/Chromium first (dev environment)
      const { execSync } = require('child_process');
      const candidates = [
         'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
         'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
         '/usr/bin/google-chrome',
         '/usr/bin/chromium-browser',
         '/usr/bin/chromium',
      ];
      executablePath = candidates.find(p => {
         try { require('fs').accessSync(p); return true; } catch { return false; }
      }) || await chromium.executablePath();
   } catch {
      executablePath = await chromium.executablePath();
   }

   const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
   });

   try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait for content to render
      await page.waitForSelector('p, article, h1', { timeout: 8000 }).catch(() => {});
      return await page.content();
   } finally {
      await browser.close();
   }
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
]);

function extractTopWords(text: string, topN: number): Array<{ term: string; count: number }> {
   const lower = text.toLowerCase();
   const freq: Record<string, number> = {};

   // Extract meaningful single words (3+ chars, not stop words, not numbers-only)
   const words = lower.match(/\b[a-zÀ-ſ]{3,}\b/g) || [];
   for (const w of words) {
      if (!STOP_WORDS.has(w) && isNaN(Number(w))) freq[w] = (freq[w] || 0) + 1;
   }

   // Extract bigrams and trigrams — split into sentences first
   const sentences = lower.split(/[.!?\n]+/);
   for (const sentence of sentences) {
      const tokens = sentence.match(/\b[a-zÀ-ſ]{2,}\b/g) || [];
      // Bigrams
      for (let i = 0; i < tokens.length - 1; i++) {
         if (STOP_WORDS.has(tokens[i]) && STOP_WORDS.has(tokens[i + 1])) continue;
         const bigram = `${tokens[i]} ${tokens[i + 1]}`;
         freq[bigram] = (freq[bigram] || 0) + 1;
      }
      // Trigrams
      for (let i = 0; i < tokens.length - 2; i++) {
         const stopCount = [tokens[i], tokens[i + 1], tokens[i + 2]].filter((t) => STOP_WORDS.has(t)).length;
         if (stopCount >= 2) continue;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { url, keywords = [], country = 'US', device = 'Desktop' } = req.body;

   if (!url) {
      return res.status(400).json({ error: 'url is required' });
   }

   try {
      // Always use Puppeteer — handles both SPA (React/Vue/Vite) and regular HTML.
      // Puppeteer renders JavaScript before returning HTML, just like a real browser.
      console.log(`[import] Fetching with Puppeteer: ${url}`);
      let html = '';
      try {
         html = await fetchWithPuppeteer(url);
         console.log(`[import] Puppeteer fetched ${html.length} chars`);
      } catch (fetchErr: any) {
         return res.status(400).json({ error: `Could not fetch URL: ${fetchErr?.message || 'unknown'}` });
      }

      const $ = cheerio.load(html);

      // Strip clutter
      $('script, style, nav, footer, header, aside, .sidebar, #sidebar, .ad, .advertisement, .cookie-banner, noscript, iframe').remove();

      // Metadata
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

      // Featured image — og:image first, fallback to first meaningful <img>
      // Always resolve to absolute URL using the scraped page's URL as base.
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

      // Find best content container by scoring candidates on word count.
      // This handles sites with arbitrary nesting depths.
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

      // Score every candidate
      for (const sel of candidateSelectors) {
         $(sel).each((_, el) => {
            const wc = $(el).text().replace(/\s+/g, ' ').trim().split(' ').length;
            if (wc > bestWordCount) {
               bestWordCount = wc;
               bestEl = el;
            }
         });
      }

      // Also try scoring all <div> and <section> elements by paragraph density
      $('div, section').each((_, el) => {
         const pCount = $(el).find('p').length;
         const wc = $(el).text().replace(/\s+/g, ' ').trim().split(' ').length;
         // Favour elements with multiple paragraphs and high word count
         const score = wc + pCount * 30;
         if (pCount >= 3 && wc > bestWordCount) {
            bestWordCount = wc;
            bestEl = el;
         }
      });

      const $body = $(bestEl);
      console.log(`[import] Best container: <${(bestEl as any).name || 'body'}> class="${$(bestEl).attr('class') || ''}" — ${bestWordCount} words`);

      // Plain text for NLP analysis
      const plainText = $body.text().replace(/\s+/g, ' ').trim();
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;

      // Headings (from the whole page for structure targets)
      const headingTexts: string[] = [];
      $('h1, h2, h3, h4').each((_, el) => {
         const t = $(el).text().trim();
         if (t) headingTexts.push(t);
      });

      // Build clean HTML by flattening all block-level descendants.
      // Use a Set to skip elements already covered by an ancestor we serialised.
      const seen = new WeakSet();
      const contentParts: string[] = [];

      $body.find('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote').each((_, el) => {
         if (seen.has(el)) return;
         const tag: string = (el as any).name || '';
         if (!tag) return;

         // Mark all descendants so we don't double-emit their text
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

      console.log(`[import] Extracted ${contentParts.length} content parts, ${wordCount} words`);

      // Fallback: chunk plain text into paragraphs
      const contentHtml = contentParts.length > 2
         ? contentParts.join('\n')
         : plainText.match(/[^\n]{80,}/g)?.map(c => `<p>${c.trim()}</p>`).join('\n') || `<p>${title}</p>`;

      // Count meaningful paragraphs from scraped page
      const paragraphCount = $body.find('p').filter((_, el) => {
         return $(el).text().trim().split(/\s+/).length >= 3;
      }).length;

      // Build NLP terms from provided keywords — target 50% MORE occurrences than source
      // so a freshly imported article doesn't immediately satisfy every term.
      const kwTerms: NlpTerm[] = (keywords as string[]).map((kw: string) => {
         const freq = countOccurrences(plainText, kw);
         return {
            term: kw,
            target_count: Math.max(2, freq > 0 ? Math.ceil(freq * 1.5) : 3),
         };
      });

      // Extract additional NLP terms — target 20% more than source uses
      const kwSet = new Set((keywords as string[]).map((k: string) => k.toLowerCase()));
      const extracted = extractTopWords(plainText, 30)
         .filter(({ term }) => !kwSet.has(term))
         .slice(0, 20)
         .map(({ term, count }) => ({
            term,
            target_count: Math.max(2, Math.ceil(count * 1.2)),
         }));

      // Store initial current_count from the scraped text so the list view
      // can show a meaningful (non-zero) score without opening the editor first.
      const allTerms: NlpTerm[] = [...kwTerms, ...extracted].map((t) => ({
         ...t,
         current_count: countOccurrences(plainText, t.term),
      }));

      // Build ASPIRATIONAL ScoreData targets — set higher than the source article so
      // freshly imported content starts at ~40-60 pts and must be improved to reach 100.
      const wordsTarget = Math.max(1000, Math.ceil(wordCount * 1.5));
      const headingsTarget = Math.max(5, Math.ceil(headingTexts.length * 2.5));
      const paragraphsTarget = Math.max(15, Math.ceil(paragraphCount * 2.5));
      const scoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number } = {
         terms: allTerms,
         words_target: wordsTarget,
         words_min: Math.max(600, Math.ceil(wordCount * 0.9)),
         words_max: Math.max(2000, Math.ceil(wordCount * 2.5)),
         headings_target: headingsTarget,
         headings_min: Math.max(2, Math.ceil(headingTexts.length * 1.5)),
         headings_max: Math.max(10, Math.ceil(headingsTarget * 1.5)),
         paragraphs_target: paragraphsTarget,
         paragraphs_min: Math.max(5, Math.ceil(paragraphCount * 1.5)),
         paragraphs_max: Math.max(20, Math.ceil(paragraphsTarget * 1.5)),
         _heading_count: headingTexts.length,
         _paragraph_count: paragraphCount,
      };
      scoreData._computed_score = computeContentScore(plainText, wordCount, headingTexts.length, scoreData, paragraphCount);

      // Get first available domain
      const [domains] = await db.query('SELECT ID FROM domain LIMIT 1', { replacements: [] });
      const domainId = (domains as any[])[0]?.ID || 1;

      // Slug from title
      const slug = title
         .toLowerCase()
         .replace(/[^a-z0-9\s-]/g, '')
         .trim()
         .replace(/\s+/g, '-')
         .substring(0, 80);

      // Upload featured image to Vercel Blob (now that we have the slug for a nice filename)
      const featuredImageUrl = featuredImage
         ? await uploadImageFromUrl(featuredImage, slug || 'article')
         : null;

      // Save draft article
      const [articleId] = await db.query(
         `INSERT INTO articles
            (domain_id, title, slug, content, target_keyword, meta_title, meta_description,
             score_data, word_count, featured_image, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`,
         {
            replacements: [
               domainId,
               title,
               slug,
               contentHtml,
               (keywords as string[])[0] || title,
               metaTitle,
               metaDescription,
               JSON.stringify(scoreData),
               wordCount,
               featuredImageUrl,
            ],
            type: QueryTypes.INSERT,
         },
      );

      return res.status(200).json({ articleId });
   } catch (error: any) {
      console.error('[import] error:', error);
      return res.status(500).json({ error: error?.message || 'Import failed' });
   }
}
