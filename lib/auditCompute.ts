// Audit compute. `extractFactorValues` pulls the same per-factor numbers from any page
// (used for BOTH the audited page "You" and each competitor page). `buildAuditResult`
// composes them: with `real` competitor data (phase 2) it renders real competitor bars +
// suggested ranges + NLP terms (placeholder:false); without it (phase 1 / unit tests) it
// falls back to a deterministic, clearly-labelled placeholder. Pure — no network here.
import { load } from 'cheerio';
import { assertPublicUrl } from './ssrfGuard';
import { countOccurrences, ScoreData, computeContentScore } from './contentScore';
import { plainText, wordCount } from './optimizationPlanner';
import {
   AuditResult, AuditFactor, AuditCompetitor, AuditInternalLink, AuditTerm,
} from './auditTypes';

export interface FetchTiming { ttfbMs: number; loadMs: number; }

/** Per-competitor page analysis fed into buildAuditResult in phase 2. */
export interface CompetitorPage { domain: string; rank: number; values: Record<string, number>; contentScore: number; }
export interface RealAuditData { competitors: CompetitorPage[]; terms: { term: string; target_count: number }[]; }

/** Extracted numbers for one page keyed by factor key + the bits used elsewhere. */
export interface PageMetrics {
   values: Record<string, number>;
   internalLinks: AuditInternalLink[];
   contentScore: number;
   bodyText: string;
}

// Generic local-estimate targets used only for the placeholder content score (no
// competitor data). Real content score in phase 2 uses competitor-derived targets.
const LOCAL_TARGETS: Omit<ScoreData, 'terms'> = {
   words_target: 1500, words_min: 900, words_max: 2000,
   headings_target: 12, headings_min: 8, headings_max: 30,
   paragraphs_target: 20, paragraphs_min: 12, paragraphs_max: 40,
   competitor_count: 0,
};

const STUB_LABELS = ['detektywsigma.pl', 'www.infor.pl', 'cyberacademy.com.pl'];
const STUB_RANKS = [1, 4, 10];

// Deterministic per-factor spread so placeholder bars vary but never change between renders.
function keySeed(key: string): number {
   let h = 0;
   for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 97;
   return h / 97;
}

function stub(you: number, key: string): { competitors: AuditCompetitor[]; suggestedMin: number; suggestedMax: number } {
   const s = keySeed(key);
   const mults = [1.1 + s * 0.4, 0.9 - s * 0.3, 0.7 + s * 0.2];
   const competitors = STUB_LABELS.map((label, i) => ({ label, rank: STUB_RANKS[i], value: Math.max(0, Math.round(you * mults[i])) }));
   const base = you > 0 ? you : 10;
   return { competitors, suggestedMin: Math.round(base * 0.6), suggestedMax: Math.round(base * 1.4) };
}

/** Suggested range = the competitor value spread (padded when they all agree). */
function rangeFrom(values: number[]): { suggestedMin: number; suggestedMax: number } {
   const min = Math.min(...values);
   const max = Math.max(...values);
   if (min === max) return { suggestedMin: Math.round(min * 0.8), suggestedMax: Math.round(min * 1.2) || 1 };
   return { suggestedMin: Math.round(min), suggestedMax: Math.round(max) };
}

interface FactorDef {
   key: string;
   section: string;
   unit?: string;
   label: (v: number) => string;
   message: (v: number) => string;
   verdict?: (v: number) => 'ok' | 'warn' | 'info'; // overrides the default within-range check
}

const FACTOR_DEFS: FactorDef[] = [
   { key: 'word_count_body', section: 'Word count', label: (v) => `${v} words in body`, message: (v) => `Your web page has ${v} words in body.` },
   { key: 'h2_h6_words', section: 'Word count', label: (v) => `${v} words in h2 to h6`, message: (v) => `Your web page has ${v} words in headings.` },
   { key: 'p_words', section: 'Word count', label: (v) => `${v} words in paragraphs`, message: (v) => `Your web page has ${v} words in paragraphs.` },
   { key: 'strong_b_words', section: 'Word count', label: (v) => `${v} words in strong, b`, message: (v) => `Your web page has ${v} words in strong/b.` },

   { key: 'exact_kw_title', section: 'Exact keywords', label: (v) => `${v} exact keyword in title`, message: () => 'Exact keyword occurrences in the title.' },
   { key: 'exact_kw_body', section: 'Exact keywords', label: (v) => `${v} exact keywords in body`, message: () => 'Exact keyword occurrences in the body.' },
   { key: 'exact_kw_h1', section: 'Exact keywords', label: (v) => `${v} exact keyword in h1`, message: () => 'Exact keyword occurrences in the H1.' },

   { key: 'partial_kw_per100', section: 'Partial keywords', label: (v) => `${v} partial keywords per 100 words in body`, message: () => 'Partial keyword density per 100 words in the body.' },

   { key: 'h1_count', section: 'Page structure', label: (v) => `${v} h1 element${v === 1 ? '' : 's'}`, message: () => "It's optimal to have exactly one h1 that includes the exact keyword.", verdict: (v) => (v === 1 ? 'ok' : 'warn') },
   { key: 'h2_h6_count', section: 'Page structure', label: (v) => `${v} h2 to h6 elements`, message: () => 'Number of h2–h6 heading elements.' },
   { key: 'p_count', section: 'Page structure', label: (v) => `${v} paragraph elements`, message: () => 'Number of paragraph elements.' },
   { key: 'img_count', section: 'Page structure', label: (v) => `${v} image elements`, message: () => 'Number of image elements.' },
   { key: 'strong_b_count', section: 'Page structure', label: (v) => `${v} strong, b elements`, message: () => 'Number of strong/b elements.' },

   { key: 'title_chars', section: 'Title and meta description length', unit: 'chars', label: (v) => `${v} characters in title`, message: (v) => `Your title has ${v} characters (suggested 55–70).` },
   { key: 'meta_desc_chars', section: 'Title and meta description length', unit: 'chars', label: (v) => `${v} characters in meta description`, message: (v) => `Your meta description has ${v} characters (optimal 130–150).` },

   { key: 'ttfb', section: 'Time to first byte', unit: 'ms', label: (v) => `${v}ms to first byte`, message: () => 'Time to first byte.', verdict: () => 'ok' },
   { key: 'load_time', section: 'Load time (ms)', unit: 'ms', label: (v) => `${v}ms to load the page`, message: () => 'Total page load time.', verdict: () => 'ok' },
];

function sameSite(linkHost: string, pageHost: string): boolean {
   if (!linkHost) return false;
   const norm = (h: string) => h.replace(/^www\./, '');
   const a = norm(linkHost); const b = norm(pageHost);
   return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** Pull every per-factor number (+ internal links + content score) from a page's HTML. */
export function extractFactorValues(html: string, url: string, keyword: string, timing: FetchTiming): PageMetrics {
   const $ = load(html);
   $('script, style, noscript').remove();

   const title = ($('title').first().text() || '').trim();
   const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();

   const bodyText = plainText($('body').html() || html);
   const bodyWords = wordCount(bodyText);

   const headingWords = wordCount(plainText($('h2, h3, h4, h5, h6').map((_, el) => $(el).text()).get().join(' ')));
   const h1Count = $('h1').length;
   const h2h6Count = $('h2, h3, h4, h5, h6').length;

   const pEls = $('p');
   const pCount = pEls.length;
   const pWords = wordCount(plainText(pEls.map((_, el) => $(el).text()).get().join(' ')));

   const imgCount = $('img').length;
   const strongEls = $('strong, b');
   const strongCount = strongEls.length;
   const strongWords = wordCount(plainText(strongEls.map((_, el) => $(el).text()).get().join(' ')));

   const kwExactBody = countOccurrences(bodyText, keyword);
   const kwExactTitle = countOccurrences(title, keyword);
   const kwExactH1 = countOccurrences($('h1').first().text() || '', keyword);
   const tokens = keyword.split(/\s+/).filter(Boolean);
   const kwPartialBody = tokens.reduce((sum, t) => sum + countOccurrences(bodyText, t), 0);
   const partialPer100 = bodyWords > 0 ? Math.round((kwPartialBody / bodyWords) * 10000) / 100 : 0;

   // Internal links (same registrable site). `linked` marks a link already pointing at the audited URL.
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
   const contentScore = computeContentScore(bodyText, bodyWords, h2h6Count, scoreData, pCount, internalLinks.length, html, keyword);

   const values: Record<string, number> = {
      word_count_body: bodyWords, h2_h6_words: headingWords, p_words: pWords, strong_b_words: strongWords,
      exact_kw_title: kwExactTitle, exact_kw_body: kwExactBody, exact_kw_h1: kwExactH1, partial_kw_per100: partialPer100,
      h1_count: h1Count, h2_h6_count: h2h6Count, p_count: pCount, img_count: imgCount, strong_b_count: strongCount,
      title_chars: title.length, meta_desc_chars: metaDesc.length,
      ttfb: timing.ttfbMs, load_time: timing.loadMs,
   };
   return { values, internalLinks, contentScore, bodyText };
}

function assembleFactor(def: FactorDef, you: number, real?: RealAuditData): AuditFactor {
   let competitors: AuditCompetitor[];
   let suggestedMin: number;
   let suggestedMax: number;
   let placeholder: boolean;
   if (real && real.competitors.length) {
      competitors = real.competitors.map((c) => ({ label: c.domain, rank: c.rank, value: c.values[def.key] ?? 0 }));
      ({ suggestedMin, suggestedMax } = rangeFrom(competitors.map((c) => c.value)));
      placeholder = false;
   } else {
      ({ competitors, suggestedMin, suggestedMax } = stub(you, def.key));
      placeholder = true;
   }
   const within = you >= suggestedMin && you <= suggestedMax;
   return {
      key: def.key, section: def.section, unit: def.unit,
      label: def.label(you), message: def.message(you),
      you, competitors, suggestedMin, suggestedMax,
      verdict: def.verdict ? def.verdict(you) : (within ? 'ok' : 'warn'),
      placeholder,
   };
}

function mapTerms(terms: { term: string; target_count: number }[], bodyText: string): AuditTerm[] {
   return terms.map((t) => {
      const you = countOccurrences(bodyText, t.term);
      const target = Math.max(1, t.target_count);
      const action: AuditTerm['action'] = you < target ? 'add' : (you > target * 3 ? 'remove' : 'ok');
      return { term: t.term, forms: 1, you, suggested: String(target), relevance: 100, searchVolume: null, action, nlp: true };
   });
}

/** Compose the AuditResult. Pass `real` (phase 2) for real competitor bars/ranges/terms. */
export function buildAuditResult(html: string, url: string, keyword: string, timing: FetchTiming, real?: RealAuditData): AuditResult {
   const page = extractFactorValues(html, url, keyword, timing);
   const factors = FACTOR_DEFS.map((def) => assembleFactor(def, page.values[def.key], real));

   let csCompetitors: AuditCompetitor[];
   let csMin: number;
   let csMax: number;
   if (real && real.competitors.length) {
      csCompetitors = real.competitors.map((c) => ({ label: c.domain, rank: c.rank, value: c.contentScore }));
      ({ suggestedMin: csMin, suggestedMax: csMax } = rangeFrom(csCompetitors.map((c) => c.value)));
   } else {
      const s = stub(page.contentScore, 'content_score');
      csCompetitors = s.competitors; csMin = s.suggestedMin; csMax = s.suggestedMax;
   }

   return {
      url,
      keyword,
      contentScore: page.contentScore,
      contentScoreCompetitors: csCompetitors,
      contentScoreSuggestedMin: csMin,
      contentScoreSuggestedMax: csMax,
      factors,
      internalLinks: page.internalLinks,
      terms: real ? mapTerms(real.terms, page.bodyText) : [],
      generatedAt: new Date().toISOString(),
   };
}

/** Fetch a page (SSRF-guarded, manual redirects re-validated each hop), timed. */
export async function fetchPage(url: string): Promise<{ html: string; timing: FetchTiming }> {
   const headers = { 'User-Agent': 'SerpBearAuditBot/1.0 (+https://serpbear.com)' };
   const startedAt = Date.now();
   let current = url;
   let resp: Awaited<ReturnType<typeof fetch>> | null = null;
   for (let hop = 0; hop < 5; hop += 1) {
      await assertPublicUrl(current);
      resp = await fetch(current, { redirect: 'manual', headers, signal: AbortSignal.timeout(30000) });
      if (resp.status >= 300 && resp.status < 400) {
         const loc = resp.headers.get('location');
         if (!loc) break;
         current = new URL(loc, current).toString();
         continue;
      }
      break;
   }
   if (!resp) throw new Error('Audit fetch produced no response');
   if (resp.status >= 300 && resp.status < 400) throw new Error('Too many redirects');
   const ttfbMs = Date.now() - startedAt;
   const html = await resp.text();
   const loadMs = Date.now() - startedAt;
   return { html, timing: { ttfbMs, loadMs } };
}

/**
 * Full audit: fetch + analyze the page, then (phase 2) enrich with real competitor data
 * from the SERP. `enrich` is injected (lib/auditSerp) so this stays free of the sidecar
 * dependency and remains easy to reason about; a null/failed enrich degrades to the
 * placeholder result rather than failing the audit.
 */
export async function computeAudit(
   url: string,
   keyword: string,
   enrich?: (url: string, keyword: string, youHtml: string) => Promise<RealAuditData | null>,
): Promise<AuditResult> {
   const { html, timing } = await fetchPage(url);
   let real: RealAuditData | null = null;
   if (enrich) {
      try { real = await enrich(url, keyword, html); } catch { real = null; }
   }
   return buildAuditResult(html, url, keyword, timing, real ?? undefined);
}
