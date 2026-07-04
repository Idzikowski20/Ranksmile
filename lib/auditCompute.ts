// Phase-1 audit compute. The `you` column is REAL — extracted from the fetched page
// HTML with cheerio + lib/contentScore. Competitor bars + suggested ranges are a
// deterministic, clearly-labelled placeholder (placeholder:true) until phase 2 wires
// real DataForSEO SERP data. buildAuditResult is pure (no network) so it is unit-tested.
import { load } from 'cheerio';
import { assertPublicUrl } from './ssrfGuard';
import { countOccurrences, ScoreData, computeContentScore } from './contentScore';
import { plainText, wordCount } from './optimizationPlanner';
import {
   AuditResult, AuditFactor, AuditCompetitor, AuditInternalLink,
} from './auditTypes';

export interface FetchTiming { ttfbMs: number; loadMs: number; }

// Generic local-estimate targets (no competitor data in phase 1). Same spirit as the
// app's "0 = local estimate" content-score mode.
const LOCAL_TARGETS: Omit<ScoreData, 'terms'> = {
   words_target: 1500, words_min: 900, words_max: 2000,
   headings_target: 12, headings_min: 8, headings_max: 30,
   paragraphs_target: 20, paragraphs_min: 12, paragraphs_max: 40,
   competitor_count: 0,
};

const STUB_LABELS = ['detektywsigma.pl', 'www.infor.pl', 'cyberacademy.com.pl'];
const STUB_RANKS = [1, 4, 10];

// Deterministic per-factor spread so the placeholder bars vary but never change between
// renders. Derived from the factor key so tests are stable.
function keySeed(key: string): number {
   let h = 0;
   for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 97;
   return h / 97; // 0..1
}

function stub(you: number, key: string): { competitors: AuditCompetitor[]; suggestedMin: number; suggestedMax: number } {
   const s = keySeed(key);
   const mults = [1.1 + s * 0.4, 0.9 - s * 0.3, 0.7 + s * 0.2];
   const competitors = STUB_LABELS.map((label, i) => ({
      label, rank: STUB_RANKS[i], value: Math.max(0, Math.round(you * mults[i])),
   }));
   const base = you > 0 ? you : 10;
   return {
      competitors,
      suggestedMin: Math.round(base * 0.6),
      suggestedMax: Math.round(base * 1.4),
   };
}

function factor(
   key: string, section: string, label: string, you: number,
   opts: { unit?: string; message: string; verdict?: 'ok' | 'warn' | 'info' } = { message: '' },
): AuditFactor {
   const { competitors, suggestedMin, suggestedMax } = stub(you, key);
   const within = you >= suggestedMin && you <= suggestedMax;
   return {
      key, section, label, you, competitors, suggestedMin, suggestedMax,
      unit: opts.unit,
      verdict: opts.verdict ?? (within ? 'ok' : 'warn'),
      message: opts.message,
      placeholder: true,
   };
}

function sameSite(linkHost: string, pageHost: string): boolean {
   if (!linkHost) return false;
   const norm = (h: string) => h.replace(/^www\./, '');
   const a = norm(linkHost); const b = norm(pageHost);
   return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** Pure: build the full AuditResult from raw HTML (no network). */
export function buildAuditResult(html: string, url: string, keyword: string, timing: FetchTiming): AuditResult {
   const $ = load(html);
   $('script, style, noscript').remove();

   const title = ($('title').first().text() || '').trim();
   const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();

   const bodyText = plainText($('body').html() || html);
   const bodyWords = wordCount(bodyText);

   const headingText = $('h2, h3, h4, h5, h6').map((_, el) => $(el).text()).get().join(' ');
   const headingWords = wordCount(plainText(headingText));
   const h1Count = $('h1').length;
   const h2h6Count = $('h2, h3, h4, h5, h6').length;

   const pEls = $('p');
   const pCount = pEls.length;
   const pWords = wordCount(plainText(pEls.map((_, el) => $(el).text()).get().join(' ')));

   const imgCount = $('img').length;

   const strongEls = $('strong, b');
   const strongCount = strongEls.length;
   const strongWords = wordCount(plainText(strongEls.map((_, el) => $(el).text()).get().join(' ')));

   // Keyword metrics (inflection-tolerant via countOccurrences).
   const kwExactBody = countOccurrences(bodyText, keyword);
   const kwExactTitle = countOccurrences(title, keyword);
   const kwExactH1 = countOccurrences($('h1').first().text() || '', keyword);
   const tokens = keyword.split(/\s+/).filter(Boolean);
   const kwPartialBody = tokens.reduce((sum, t) => sum + countOccurrences(bodyText, t), 0);
   const partialPer100 = bodyWords > 0 ? Math.round((kwPartialBody / bodyWords) * 10000) / 100 : 0;

   // Internal links found on the page (same registrable site). Phase 1: outbound-derived
   // signal; `linked` marks a link that already points at the audited URL.
   let pageHost = '';
   try { pageHost = new URL(url).hostname; } catch { pageHost = ''; }
   let auditedPath = '';
   try { auditedPath = new URL(url).pathname.replace(/\/+$/, ''); } catch { auditedPath = ''; }
   const seen = new Set<string>();
   const internalLinks: AuditInternalLink[] = [];
   $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let abs: URL;
      try { abs = new URL(href, url); } catch { return; }
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
      if (!sameSite(abs.hostname, pageHost)) return;
      const clean = `${abs.origin}${abs.pathname.replace(/\/+$/, '')}`;
      if (seen.has(clean)) return;
      seen.add(clean);
      internalLinks.push({ url: clean, linked: abs.pathname.replace(/\/+$/, '') === auditedPath });
   });

   const scoreData: ScoreData = { ...LOCAL_TARGETS, terms: [] };
   const contentScore = computeContentScore(
      bodyText, bodyWords, h2h6Count, scoreData, pCount, internalLinks.length, html, keyword,
   );

   const factors: AuditFactor[] = [
      factor('word_count_body', 'Word count', `${bodyWords} words in body`, bodyWords,
         { message: `Your web page has ${bodyWords} words in body.` }),
      factor('h2_h6_words', 'Word count', `${headingWords} words in h2 to h6`, headingWords,
         { message: `Your web page has ${headingWords} words in headings.` }),
      factor('p_words', 'Word count', `${pWords} words in paragraphs`, pWords,
         { message: `Your web page has ${pWords} words in paragraphs.` }),
      factor('strong_b_words', 'Word count', `${strongWords} words in strong, b`, strongWords,
         { message: `Your web page has ${strongWords} words in strong/b.` }),

      factor('exact_kw_title', 'Exact keywords', `${kwExactTitle} exact keyword in title`, kwExactTitle,
         { message: `Exact keyword occurrences in the title.` }),
      factor('exact_kw_body', 'Exact keywords', `${kwExactBody} exact keywords in body`, kwExactBody,
         { message: `Exact keyword occurrences in the body.` }),
      factor('exact_kw_h1', 'Exact keywords', `${kwExactH1} exact keyword in h1`, kwExactH1,
         { message: `Exact keyword occurrences in the H1.` }),

      factor('partial_kw_per100', 'Partial keywords', `${partialPer100} partial keywords per 100 words in body`, partialPer100,
         { message: `Partial keyword density per 100 words in the body.` }),

      factor('h1_count', 'Page structure', `${h1Count} h1 element${h1Count === 1 ? '' : 's'}`, h1Count,
         { message: `It's optimal to have exactly one h1 that includes the exact keyword.`, verdict: h1Count === 1 ? 'ok' : 'warn' }),
      factor('h2_h6_count', 'Page structure', `${h2h6Count} h2 to h6 elements`, h2h6Count,
         { message: `Number of h2–h6 heading elements.` }),
      factor('p_count', 'Page structure', `${pCount} paragraph elements`, pCount,
         { message: `Number of paragraph elements.` }),
      factor('img_count', 'Page structure', `${imgCount} image elements`, imgCount,
         { message: `Number of image elements.` }),
      factor('strong_b_count', 'Page structure', `${strongCount} strong, b elements`, strongCount,
         { message: `Number of strong/b elements.` }),

      factor('title_chars', 'Title and meta description length', `${title.length} characters in title`, title.length,
         { unit: 'chars', message: `Your title has ${title.length} characters (suggested 55–70).` }),
      factor('meta_desc_chars', 'Title and meta description length', `${metaDesc.length} characters in meta description`, metaDesc.length,
         { unit: 'chars', message: `Your meta description has ${metaDesc.length} characters (optimal 130–150).` }),

      factor('ttfb', 'Time to first byte', `${timing.ttfbMs}ms to first byte`, timing.ttfbMs,
         { unit: 'ms', message: `Time to first byte.`, verdict: 'ok' }),
      factor('load_time', 'Load time (ms)', `${timing.loadMs}ms to load the page`, timing.loadMs,
         { unit: 'ms', message: `Total page load time.`, verdict: 'ok' }),
   ];

   const csStub = stub(contentScore, 'content_score');
   return {
      url,
      keyword,
      contentScore,
      contentScoreCompetitors: csStub.competitors,
      contentScoreSuggestedMin: csStub.suggestedMin,
      contentScoreSuggestedMax: csStub.suggestedMax,
      factors,
      internalLinks,
      terms: [], // phase 1: NLP terms come with real SERP data in phase 2
      generatedAt: new Date().toISOString(),
   };
}

/** Fetch the page (SSRF-guarded, timed) and build the audit. */
export async function computeAudit(url: string, keyword: string): Promise<AuditResult> {
   await assertPublicUrl(url);
   const startedAt = Date.now();
   let ttfbMs = 0;
   const resp = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'SerpBearAuditBot/1.0 (+https://serpbear.com)' },
      signal: AbortSignal.timeout(30000),
   });
   ttfbMs = Date.now() - startedAt;
   const html = await resp.text();
   const loadMs = Date.now() - startedAt;
   return buildAuditResult(html, url, keyword, { ttfbMs, loadMs });
}
