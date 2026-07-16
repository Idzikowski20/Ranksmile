// POST /api/articles/import
// Scrapes a URL (with Puppeteer fallback for SPAs), extracts content, builds NLP ScoreData
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import * as cheerio from 'cheerio';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { firstAccessibleDomainId, verifyDomainOwnershipById } from '../../../utils/verifyDomainOwnership';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import type { ScoreData, NlpTerm } from '../../../lib/contentScore';
import { uploadImageFromUrl } from '../../../lib/uploadToBlob';
import { renderPage } from '../../../utils/spaScraper';
import { getErrorMessage } from '../../../lib/errors';
import { countOccurrences } from '../../../lib/contentScore';
import { assertPublicUrl } from '../../../lib/ssrfGuard';
import { isSidecarConfigured } from '../../../lib/sidecar';
import { publicAppUrl } from '../../../lib/serviceUrls';

class BlockedUrlError extends Error {}

const FETCH_HEADERS = {
   'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
   'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
};

async function assertImportUrl(url: string): Promise<void> {
   try {
      await assertPublicUrl(url);
   } catch (err) {
      throw new BlockedUrlError(getErrorMessage(err) || 'Blocked URL');
   }
}

async function fetchWithHttp(url: string): Promise<{ html: string; finalUrl: string }> {
   let currentUrl = url;
   for (let hop = 0; hop < 5; hop += 1) {
      await assertImportUrl(currentUrl);
      const res = await fetch(currentUrl, {
         headers: FETCH_HEADERS,
         redirect: 'manual',
         signal: AbortSignal.timeout(10000),
      });
      if (res.status >= 300 && res.status < 400) {
         const location = res.headers.get('location');
         if (!location) break;
         currentUrl = new URL(location, currentUrl).href;
         continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return { html: new TextDecoder('utf-8').decode(buf), finalUrl: currentUrl };
   }
   throw new Error('Too many redirects');
}

async function fetchWithPuppeteer(url: string): Promise<{ html: string; finalUrl: string }> {
   await assertImportUrl(url);
   const rendered = await renderPage(url, 30_000);
   await assertImportUrl(rendered.url);
   return { html: rendered.html, finalUrl: rendered.url };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const {
      url,
      keywords = [],
      country = 'PL',
      device = 'Desktop',
      domainId: bodyDomainId,
      startAnalysis = false,
      extractOnly = false,
   } = req.body;

   if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
   }

   const userId = await getCurrentUserId(req, res);
   let domainId = Number(bodyDomainId) || 0;
   if (domainId) {
      const owned = await verifyDomainOwnershipById(domainId, userId ? String(userId) : null);
      if (owned === null) return res.status(404).json({ error: 'Domain not found' });
      if (owned === false) return res.status(403).json({ error: 'Access denied.' });
      domainId = owned.ID;
   } else {
      const fallback = await firstAccessibleDomainId(userId ? String(userId) : null);
      if (!fallback) return res.status(403).json({ error: 'No accessible domain to create the article under.' });
      domainId = fallback;
   }

   try {
      await assertPublicUrl(url);
   } catch (e) {
      return res.status(400).json({ error: getErrorMessage(e) || 'Invalid or blocked URL' });
   }

   try {
      // Try plain HTTP first — cheaper, and paywalled sites (e.g. Piano/Onet) often include
      // the full article in the raw server HTML before JS strips it for non-subscribers.
      let html = '';
      let pageUrl = url;
      try {
         const fetched = await fetchWithHttp(url);
         html = fetched.html;
         pageUrl = fetched.finalUrl;
         const quickWc = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
         console.log(`[import] HTTP fetch: ${html.length} chars, ~${quickWc} words`);
         if (quickWc < 300) {
            console.log('[import] HTTP fetch too short, falling back to Puppeteer');
            html = '';
         }
      } catch (e) {
         if (e instanceof BlockedUrlError) return res.status(400).json({ error: getErrorMessage(e) || 'Blocked URL' });
         console.log(`[import] HTTP fetch failed (${getErrorMessage(e)}), falling back to Puppeteer`);
      }

      // Fallback to Puppeteer for SPAs and sites requiring JS rendering
      if (!html) {
         console.log(`[import] Fetching with Puppeteer: ${pageUrl}`);
         try {
            const rendered = await fetchWithPuppeteer(pageUrl);
            html = rendered.html;
            pageUrl = rendered.finalUrl;
            console.log(`[import] Puppeteer fetched ${html.length} chars`);
         } catch (fetchErr) {
            return res.status(400).json({ error: `Could not fetch URL: ${getErrorMessage(fetchErr) || 'unknown'}` });
         }
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
         try { return src.startsWith('http') ? src : new URL(src, pageUrl).href; } catch { return ''; }
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
      let bestEl: cheerio.AnyNode = $('body')[0]!;
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
      console.log(`[import] Best container: <${'tagName' in bestEl ? (bestEl.tagName || bestEl.name || 'body') : 'body'}> class="${$(bestEl).attr('class') || ''}" — ${bestWordCount} words`);

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
         const tag: string = 'tagName' in el ? String((el as cheerio.Element).tagName || (el as cheerio.Element).name || '') : '';
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

      // Fallback: extract text from leaf <div> elements (e.g. sites using div.body-text instead of <p>)
      if (contentParts.length <= 2) {
         $body.find('div').each((_, el) => {
            if (seen.has(el)) return;
            // Skip container divs — only pick up leaf/near-leaf text divs
            if ($(el).children('div, article, section, p').length > 0) return;
            const text = $(el).text().replace(/\s+/g, ' ').trim();
            const wc = text.split(/\s+/).filter(Boolean).length;
            if (wc >= 8) {
               $(el).find('*').each((__, child) => { seen.add(child); });
               seen.add(el);
               contentParts.push(`<p>${text}</p>`);
            }
         });
      }

      console.log(`[import] Extracted ${contentParts.length} content parts, ${wordCount} words`);

      // Fallback: chunk plain text into paragraphs
      const contentHtml = contentParts.length > 2
         ? contentParts.join('\n')
         : plainText.match(/[^\n]{80,}/g)?.map(c => `<p>${c.trim()}</p>`).join('\n') || `<p>${title}</p>`;

      // Extract-only mode — the Content Editor imports directly into the current
      // (already-created) article, so we just return the parsed HTML and metadata
      // without creating a new article row.
      if (extractOnly) {
         return res.status(200).json({ contentHtml, title, metaTitle, metaDescription });
      }

      // Count meaningful paragraphs from scraped page
      const paragraphCount = $body.find('p').filter((_, el) => {
         return $(el).text().trim().split(/\s+/).length >= 3;
      }).length;

      // Build NLP terms from provided keywords only — Surfer-style entity lists come from
      // deep-analysis (competitor corpus). Import-time n-gram extraction produced Polish
      // stopwords ("oraz", "jest") instead of phrases like "prywatny detektyw".
      const kwTerms: NlpTerm[] = (keywords as string[]).map((kw: string) => {
         const freq = countOccurrences(plainText, kw);
         return {
            term: kw.toLowerCase().trim(),
            target_count: Math.max(2, freq > 0 ? Math.ceil(freq * 1.5) : 3),
         };
      });

      const allTerms: NlpTerm[] = kwTerms.map((t) => ({
         ...t,
         current_count: countOccurrences(plainText, t.term),
      }));

      // Placeholder targets until deep analysis finishes — avoid inflated pre-analysis scores.
      const wordsTarget = wordCount;
      const headingsTarget = headingTexts.length;
      const paragraphsTarget = paragraphCount;
      const scoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number } = {
         terms: allTerms,
         words_target: wordsTarget,
         words_min: Math.max(1, Math.floor(wordCount * 0.5)),
         words_max: Math.max(wordCount + 500, 2000),
         headings_target: headingsTarget,
         headings_min: Math.max(1, headingTexts.length),
         headings_max: Math.max(headingTexts.length + 5, 20),
         paragraphs_target: paragraphsTarget,
         paragraphs_min: Math.max(1, paragraphCount),
         paragraphs_max: Math.max(paragraphCount + 10, 30),
         competitor_count: 0,
         scoring_model: 'legacy',
         _heading_count: headingTexts.length,
         _paragraph_count: paragraphCount,
      };
      // No _computed_score here — gauge updates after deep analysis applies competitor benchmarks.

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

      const langMap: Record<string, string> = {
         PL: 'pl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl', PT: 'pt',
         US: 'en', GB: 'en',
      };
      const language = langMap[(country as string || 'US').toUpperCase()] || 'en';
      const runAnalysis = Boolean(startAnalysis) && isSidecarConfigured();
      const articleStatus = runAnalysis ? 'analyzing' : 'draft';

      // Save draft article (or analyzing placeholder when editor will run deep analysis in background)
      const insertReplacements = [
         domainId,
         title,
         slug,
         contentHtml,
         (keywords as string[])[0] || title,
         metaTitle,
         metaDescription,
         url,
         language,
         JSON.stringify(scoreData),
         wordCount,
         featuredImageUrl,
         articleStatus,
      ];
      let articleId: number | undefined;
      if (process.env.DATABASE_URL) {
         const articleIdSql = await getArticleIdSql();
         const rows = await db.query<{ id: number }>(
            `INSERT INTO articles
               (domain_id, title, slug, content, target_keyword, meta_title, meta_description,
                meta_url, language, score_data, word_count, featured_image, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING ${articleIdSql} AS id`,
            { replacements: insertReplacements, type: QueryTypes.SELECT },
         );
         articleId = rows[0]?.id;
      } else {
         const [newId] = await db.query(
            `INSERT INTO articles
               (domain_id, title, slug, content, target_keyword, meta_title, meta_description,
                meta_url, language, score_data, word_count, featured_image, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            { replacements: insertReplacements, type: QueryTypes.INSERT },
         );
         articleId = newId as unknown as number;
      }
      if (!articleId) {
         return res.status(500).json({ error: 'Article created but id was not returned' });
      }

      // Auto-enrich keywords in background (fire-and-forget)
      if (keywords.length > 0) {
         const baseUrl = publicAppUrl();
         fetch(`${baseUrl}/api/articles/${articleId}/keywords/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               keywords: keywords as string[],
               targetKeyword: (keywords as string[])[0] || title,
               plainText,
            }),
         }).catch(() => {}); // fire-and-forget
      }

      return res.status(200).json({ articleId });
   } catch (error) {
      console.error('[import] error:', error);
      return res.status(500).json({ error: getErrorMessage(error) || 'Import failed' });
   }
}
