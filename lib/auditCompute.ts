// Audit compute. `extractFactorValues` pulls the same per-factor numbers from any page
// (used for BOTH the audited page "You" and each competitor page). `buildAuditResult`
// composes them: with `real` competitor data (phase 2) it renders real competitor bars +
// suggested ranges + NLP terms (placeholder:false); without it (phase 1 / unit tests) it
// falls back to a deterministic, clearly-labelled placeholder. Pure — no network here.
import { load } from 'cheerio';
import { assertPublicUrl } from './ssrfGuard';
import { findTermRangesBatch, ScoreData, computeContentScore } from './contentScore';
import { countOccurrences } from './termMatch';
import {
   auditContentScore,
   termCoverageFraction,
   termRangeCoverageFraction,
   termScoreFraction,
   type RichTerm,
} from './competitorContentScore';
import { plainText, wordCount } from './optimizationPlanner';
import {
   AuditResult, AuditFactor, AuditCompetitor, AuditInternalLink, AuditTerm,
} from './auditTypes';

export type { RichTerm } from './competitorContentScore';
export {
   auditContentScore,
   termCoverageFraction,
   termRangeCoverageFraction,
   termScoreFraction,
} from './competitorContentScore';

export interface FetchTiming { ttfbMs: number; loadMs: number; }

/** Per-competitor page analysis fed into buildAuditResult in phase 2. */
export interface CompetitorPage { domain: string; rank: number; values: Record<string, number>; contentScore: number; url?: string; }

export interface RealAuditData {
   competitors: CompetitorPage[];
   terms: RichTerm[];
   // Competitor-set averages used to score "You" the same way (word/heading/paragraph
   // frac). Set by enrichAudit alongside the calibrated competitor content scores.
   contentTargets?: { avgWords: number; avgHeadings: number; avgPs: number };
}

/**
 * SEO score from audit factor verdicts (Surfer-style on-page checklist).
 * Non-info factors contribute; internal-link gaps apply a logarithmic penalty.
 */
export function computeSeoScoreFromAudit(audit: AuditResult): number {
   const scored = audit.factors.filter((f) => f.verdict !== 'info');
   if (!scored.length) return audit.contentScore;
   let sum = 0;
   for (const f of scored) {
      if (f.verdict === 'ok') { sum += 1; continue; }
      const min = f.suggestedMin ?? 0;
      const max = f.suggestedMax ?? min;
      const span = Math.max(max - min, max * 0.2, 1);
      if (f.you < min) sum += Math.max(0, 1 - (min - f.you) / span);
      else if (f.you > max) sum += Math.max(0, 1 - (f.you - max) / span);
   }
   let base = Math.round((sum / scored.length) * 100);
   const missing = audit.internalLinks?.filter((l) => !l.linked).length ?? 0;
   if (missing > 0) {
      const penalty = Math.min(20, Math.round(Math.log10(missing + 1) * 8));
      base = Math.max(0, base - penalty);
   }
   return base;
}

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
   const competitors = STUB_LABELS.map((label, i) => ({ label, rank: STUB_RANKS[i], value: Math.max(0, Math.round(you * mults[i])), url: `https://${label}` }));
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
   fixedMin?: number; // fixed optimal range (overrides competitor-derived); e.g. title 55–70
   fixedMax?: number; // undefined ⇒ derive both bounds from competitors
   // Range-suffix noun + phrasing appended to the description when real competitor data is
   // present (mirrors SurferSEO exactly): "…, while the suggested range is 2 - 4 exact keywords."
   unitNoun?: string;
   rangeStyle?: 'range' | 'atLeast' | 'single' | 'optimal';
}

const INFO = (): 'info' => 'info';
const singular = (v: number, word: string) => `${word}${v === 1 ? '' : 's'}`;

// Full SurferSEO-style factor set. Keyword factors are broken out per content zone
// (body / h2-h6 / paragraphs / img-alt) as raw count + per-100-words density; the
// sub-zone variants are informational (blue "compared pages have …") while the primary
// targets (title/body/h1, body density) and structural factors carry ok/warn verdicts.
const FACTOR_DEFS: FactorDef[] = [
   // ── Word count ──
   { key: 'word_count_body', section: 'Word count', label: (v) => `${v} words in body`, message: (v) => `Your web page has ${v} words in body.`, unitNoun: 'words' },
   { key: 'h2_h6_words', section: 'Word count', label: (v) => `${v} words in h2 to h6`, message: (v) => `Your web page has ${v} words in headings.`, unitNoun: 'words' },
   { key: 'p_words', section: 'Word count', label: (v) => `${v} words in paragraphs`, message: (v) => `Your web page has ${v} words in p.`, unitNoun: 'words' },
   { key: 'strong_b_words', section: 'Word count', label: (v) => `${v} words in strong, b`, message: (v) => `Your web page has ${v} words in strong_and_b.`, unitNoun: 'words' },

   // ── Exact keywords ──
   { key: 'exact_kw_title', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in title`, message: (v) => `Your web page has ${v} exact ${singular(v, 'keyword')} in title.`, fixedMin: 1, fixedMax: 1, unitNoun: 'exact keyword', rangeStyle: 'single' },
   { key: 'exact_kw_body', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in body`, message: (v) => `Your web page has ${v} exact ${singular(v, 'keyword')} in body.`, unitNoun: 'exact keywords' },
   { key: 'exact_kw_h1', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in h1`, message: (v) => `Your web page has ${v} exact ${singular(v, 'keyword')} in h1.`, fixedMin: 1, fixedMax: 1, unitNoun: 'exact keyword', rangeStyle: 'single' },
   { key: 'exact_kw_h2h6', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in h2 to h6`, message: () => '', verdict: INFO },
   { key: 'exact_kw_h2h6_per100', section: 'Exact keywords', label: (v) => `${v} exact keywords per 100 words in h2 to h6`, message: () => '', verdict: INFO },
   { key: 'exact_kw_p', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in paragraphs`, message: () => '', verdict: INFO },
   { key: 'exact_kw_p_per100', section: 'Exact keywords', label: (v) => `${v} exact keywords per 100 words in paragraphs`, message: () => '', verdict: INFO },
   { key: 'exact_kw_img', section: 'Exact keywords', label: (v) => `${v} exact ${singular(v, 'keyword')} in img alt`, message: () => '', verdict: INFO },
   { key: 'exact_kw_img_per100', section: 'Exact keywords', label: (v) => `${v} exact keywords per 100 words in img alt`, message: () => '', verdict: INFO },

   // ── Partial keywords ──
   { key: 'partial_kw_per100', section: 'Partial keywords', label: (v) => `${v} partial keywords per 100 words in body`, message: (v) => `Your web page has ${v} partial keywords per 100 words in body.`, unitNoun: 'partial keywords per 100 words' },
   { key: 'partial_kw_h2h6', section: 'Partial keywords', label: (v) => `${v} partial ${singular(v, 'keyword')} in h2 to h6`, message: () => '', verdict: INFO },
   { key: 'partial_kw_h2h6_per100', section: 'Partial keywords', label: (v) => `${v} partial keywords per 100 words in h2 to h6`, message: () => '', verdict: INFO },
   { key: 'partial_kw_p', section: 'Partial keywords', label: (v) => `${v} partial ${singular(v, 'keyword')} in paragraphs`, message: () => '', verdict: INFO },
   { key: 'partial_kw_p_per100', section: 'Partial keywords', label: (v) => `${v} partial keywords per 100 words in paragraphs`, message: () => '', verdict: INFO },
   { key: 'partial_kw_img', section: 'Partial keywords', label: (v) => `${v} partial ${singular(v, 'keyword')} in img alt`, message: () => '', verdict: INFO },
   { key: 'partial_kw_img_per100', section: 'Partial keywords', label: (v) => `${v} partial keywords per 100 words in img alt`, message: () => '', verdict: INFO },

   // ── Page structure ──
   { key: 'h1_count', section: 'Page structure', label: (v) => `${v} h1 ${singular(v, 'element')}`, message: () => "Regardless of competition, it's optimal to have exactly one h1 element which includes exact keyword.", verdict: (v) => (v === 1 ? 'ok' : 'warn'), fixedMin: 1, fixedMax: 1 },
   { key: 'h2_h6_count', section: 'Page structure', label: (v) => `${v} h2 to h6 elements`, message: (v) => `Your web page has ${v} elements in headings.`, unitNoun: 'elements' },
   { key: 'p_count', section: 'Page structure', label: (v) => `${v} paragraph elements`, message: (v) => `Your web page has ${v} elements in p.`, verdict: (v) => (v >= 25 ? 'ok' : 'warn'), unitNoun: 'elements', rangeStyle: 'atLeast' },
   { key: 'img_count', section: 'Page structure', label: (v) => `${v} image ${singular(v, 'element')}`, message: (v) => `Your web page has ${v} images in img.`, fixedMin: 3, fixedMax: 6, unitNoun: 'images' },
   { key: 'strong_b_count', section: 'Page structure', label: (v) => `${v} strong, b elements`, message: (v) => `Your web page has ${v} elements in strong_and_b.`, unitNoun: 'elements' },

   // ── Title and meta description length (fixed optimal ranges) ──
   { key: 'title_chars', section: 'Title and meta description length', unit: 'chars', label: (v) => `${v} characters in title`, message: (v) => `Your web page has ${v} characters in title.`, fixedMin: 55, fixedMax: 70, unitNoun: 'characters' },
   { key: 'meta_desc_chars', section: 'Title and meta description length', unit: 'chars', label: (v) => `${v} characters in meta description`, message: (v) => `Your meta description has ${v} characters.`, fixedMin: 130, fixedMax: 150, unitNoun: 'characters', rangeStyle: 'optimal' },

   // ── Timing ──
   { key: 'ttfb', section: 'Time to first byte', unit: 'ms', label: (v) => `${v}ms to first byte`, message: () => 'Your web page TTFB is within the optimal range.', verdict: () => 'ok' },
   { key: 'load_time', section: 'Load time (ms)', unit: 'ms', label: (v) => `${v}ms to load the page`, message: () => 'Your web page load time is within the optimal range.', verdict: () => 'ok' },
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

   const headingText = plainText($('h2, h3, h4, h5, h6').map((_, el) => $(el).text()).get().join(' '));
   const headingWords = wordCount(headingText);
   const h1Count = $('h1').length;
   const h2h6Count = $('h2, h3, h4, h5, h6').length;

   const pEls = $('p');
   const pCount = pEls.length;
   const pText = plainText(pEls.map((_, el) => $(el).text()).get().join(' '));
   const pWords = wordCount(pText);

   const imgEls = $('img');
   const imgCount = imgEls.length;
   const imgAltText = imgEls.map((_, el) => $(el).attr('alt') || '').get().join(' ').trim();
   const imgAltWords = wordCount(imgAltText);
   const strongEls = $('strong, b');
   const strongCount = strongEls.length;
   const strongWords = wordCount(plainText(strongEls.map((_, el) => $(el).text()).get().join(' ')));

   // Exact + partial keyword occurrences per content zone (body / h2-h6 / paragraphs /
   // img-alt), each as a raw count and a per-100-words density — mirrors SurferSEO's
   // factor breakdown so the audit surfaces the same requirement rows.
   const tokens = keyword.split(/\s+/).filter(Boolean);
   const exact = (text: string) => countOccurrences(text, keyword);
   const partial = (text: string) => tokens.reduce((sum, t) => sum + countOccurrences(text, t), 0);
   const per100 = (count: number, words: number) => (words > 0 ? Math.round((count / words) * 10000) / 100 : 0);

   const kwExactBody = exact(bodyText);
   const kwExactTitle = exact(title);
   const kwExactH1 = exact($('h1').first().text() || '');
   const kwExactH2h6 = exact(headingText);
   const kwExactP = exact(pText);
   const kwExactImg = exact(imgAltText);
   const kwPartialBody = partial(bodyText);
   const kwPartialH2h6 = partial(headingText);
   const kwPartialP = partial(pText);
   const kwPartialImg = partial(imgAltText);

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
      exact_kw_title: kwExactTitle, exact_kw_body: kwExactBody, exact_kw_h1: kwExactH1,
      exact_kw_h2h6: kwExactH2h6, exact_kw_h2h6_per100: per100(kwExactH2h6, headingWords),
      exact_kw_p: kwExactP, exact_kw_p_per100: per100(kwExactP, pWords),
      exact_kw_img: kwExactImg, exact_kw_img_per100: per100(kwExactImg, imgAltWords),
      partial_kw_per100: per100(kwPartialBody, bodyWords),
      partial_kw_h2h6: kwPartialH2h6, partial_kw_h2h6_per100: per100(kwPartialH2h6, headingWords),
      partial_kw_p: kwPartialP, partial_kw_p_per100: per100(kwPartialP, pWords),
      partial_kw_img: kwPartialImg, partial_kw_img_per100: per100(kwPartialImg, imgAltWords),
      h1_count: h1Count, h2_h6_count: h2h6Count, p_count: pCount, img_count: imgCount, strong_b_count: strongCount,
      title_chars: title.length, meta_desc_chars: metaDesc.length,
      ttfb: timing.ttfbMs, load_time: timing.loadMs,
   };
   return { values, internalLinks, contentScore, bodyText };
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// Full SurferSEO-style description, built where the range is known. Info factors show no
// description; timing/h1 factors keep their self-contained sentence; everything else gets
// the exact "…, while the suggested range is X - Y <noun>." suffix (real data only — the
// phase-1 placeholder range is intentionally not stated as fact).
function buildDescription(def: FactorDef, you: number, min: number, max: number, placeholder: boolean, verdict: 'ok' | 'warn' | 'info'): string {
   const base = def.message(you);
   if (verdict === 'info') return '';
   if (placeholder || !def.unitNoun) return base;
   const trimmed = base.replace(/\.\s*$/, '');
   const noun = def.unitNoun;
   switch (def.rangeStyle) {
      case 'single': return `${trimmed}, while the suggested is ${fmtNum(min)} ${noun}.`;
      case 'atLeast': return `${trimmed}, while the suggested range is at least ${fmtNum(min)} ${noun}.`;
      case 'optimal': return `${trimmed}, while the optimal range is ${fmtNum(min)} - ${fmtNum(max)} ${noun}.`;
      default: return `${trimmed}, while the suggested range is ${fmtNum(min)} - ${fmtNum(max)} ${noun}.`;
   }
}

function assembleFactor(def: FactorDef, you: number, real?: RealAuditData): AuditFactor {
   const fixed = def.fixedMin !== undefined;
   let competitors: AuditCompetitor[];
   let suggestedMin: number;
   let suggestedMax: number;
   let placeholder: boolean;
   if (real && real.competitors.length) {
      competitors = real.competitors.map((c) => ({ label: c.domain, rank: c.rank, value: c.values[def.key] ?? 0, url: c.url }));
      // Fixed-target factors (title/meta/h1/img/exact-kw-title…) keep their optimal range
      // regardless of competition; everything else derives the range from the peer spread.
      ({ suggestedMin, suggestedMax } = fixed
         ? { suggestedMin: def.fixedMin as number, suggestedMax: def.fixedMax as number }
         : rangeFrom(competitors.map((c) => c.value)));
      placeholder = false;
   } else {
      const s = stub(you, def.key);
      competitors = s.competitors;
      ({ suggestedMin, suggestedMax } = fixed
         ? { suggestedMin: def.fixedMin as number, suggestedMax: def.fixedMax as number }
         : { suggestedMin: s.suggestedMin, suggestedMax: s.suggestedMax });
      placeholder = true;
   }
   const within = you >= suggestedMin && you <= suggestedMax;
   const verdict = def.verdict ? def.verdict(you) : (within ? 'ok' : 'warn');
   return {
      key: def.key, section: def.section, unit: def.unit,
      label: def.label(you), message: buildDescription(def, you, suggestedMin, suggestedMax, placeholder, verdict),
      you, competitors, suggestedMin, suggestedMax,
      verdict,
      placeholder,
   };
}

// SurferSEO tab bucket: all-numeric → number, multi-word → phrase, single token → word.
function termType(term: string): AuditTerm['type'] {
   if (/^[\s\d.,%-]+$/.test(term)) return 'number';
   return /\s/.test(term.trim()) ? 'phrase' : 'word';
}

// One highlighted example: the window of text around a match, snapped to word
// boundaries and ellipsis-padded (SurferSEO shows "… text <mark>term</mark> text …").
function exampleWindow(text: string, s: number, e: number): string {
   const WIN = 90;
   let start = Math.max(0, s - WIN);
   let end = Math.min(text.length, e + WIN);
   while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
   while (end < text.length && !/\s/.test(text[end])) end += 1;
   return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

// Map sidecar NLP terms to the SurferSEO "Terms to Use" rows: real per-page count (You),
// distinct inflected forms, example sentences, a competitor-derived suggested range, and an
// Add/Remove/OK action. `findTermRangesBatch` gives inflection-tolerant match ranges in one
// pass, so You / forms / examples all stay consistent with the editor's term highlighting.
function mapTerms(terms: RichTerm[], bodyText: string): AuditTerm[] {
   const batch = findTermRangesBatch(bodyText, terms.map((t) => t.term));
   return terms.map((t, idx) => {
      const rs = batch[idx]?.ranges ?? [];
      const you = rs.length;
      const variants = Array.from(new Set(rs.map(([s, e]) => bodyText.slice(s, e).trim()).filter(Boolean)));
      const examples = rs.slice(0, 3).map(([s, e]) => exampleWindow(bodyText, s, e));
      const sMin = Math.max(1, t.suggested_min ?? Math.max(1, t.target_count));
      const sMax = Math.max(sMin, t.suggested_max ?? t.target_count);
      const suggested = sMin === sMax ? String(sMin) : `${sMin}-${sMax}`;
      const action: AuditTerm['action'] = you < sMin ? 'add' : (you > sMax ? 'remove' : 'ok');
      const relevance = Math.round(Math.min(1, Math.max(0, t.relevance ?? 1)) * 100);
      return {
         term: t.term, forms: variants.length, variants, examples,
         you, suggested, relevance, searchVolume: t.searchVolume ?? null,
         action, nlp: true, type: termType(t.term),
      };
   });
}

/** Compose the AuditResult. Pass `real` (phase 2) for real competitor bars/ranges/terms and
 *  `internalLinksOverride` for crawled internal-link opportunities (else the audited page's
 *  own same-site links are used as a fallback). */
export function buildAuditResult(html: string, url: string, keyword: string, timing: FetchTiming, real?: RealAuditData, internalLinksOverride?: AuditInternalLink[]): AuditResult {
   const page = extractFactorValues(html, url, keyword, timing);
   const factors = FACTOR_DEFS.map((def) => assembleFactor(def, page.values[def.key], real));

   // "You" content score: calibrated (coverage-dominated) when real competitor data +
   // suggested terms are available, so it's comparable to the calibrated competitor bars;
   // otherwise the phase-1 estimate from extractFactorValues.
   let youScore = page.contentScore;
   if (real && real.terms.length && real.contentTargets) {
      const { avgWords, avgHeadings, avgPs } = real.contentTargets;
      const cov = termScoreFraction(page.bodyText, real.terms);
      const wordFrac = avgWords > 0 ? page.values.word_count_body / avgWords : 0;
      const structFrac = ((avgHeadings > 0 ? Math.min(1, page.values.h2_h6_count / avgHeadings) : 0)
         + (avgPs > 0 ? Math.min(1, page.values.p_count / avgPs) : 0)) / 2;
      youScore = auditContentScore(cov, wordFrac, structFrac);
   }

   let csCompetitors: AuditCompetitor[];
   let csMin: number;
   let csMax: number;
   if (real && real.competitors.length) {
      csCompetitors = real.competitors.map((c) => ({ label: c.domain, rank: c.rank, value: c.contentScore, url: c.url }));
      ({ suggestedMin: csMin, suggestedMax: csMax } = rangeFrom(csCompetitors.map((c) => c.value)));
   } else {
      const s = stub(page.contentScore, 'content_score');
      csCompetitors = s.competitors; csMin = s.suggestedMin; csMax = s.suggestedMax;
   }

   return {
      url,
      keyword,
      contentScore: youScore,
      contentScoreCompetitors: csCompetitors,
      contentScoreSuggestedMin: csMin,
      contentScoreSuggestedMax: csMax,
      factors,
      internalLinks: internalLinksOverride !== undefined ? internalLinksOverride : page.internalLinks,
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
   findLinks?: (url: string, keyword: string) => Promise<AuditInternalLink[] | null>,
): Promise<AuditResult> {
   const { html, timing } = await fetchPage(url);
   let real: RealAuditData | null = null;
   if (enrich) {
      try { real = await enrich(url, keyword, html); } catch { real = null; }
   }
   let links: AuditInternalLink[] | null = null;
   if (findLinks) {
      try { links = await findLinks(url, keyword); } catch { links = null; }
   }
   return buildAuditResult(html, url, keyword, timing, real ?? undefined, links ?? undefined);
}
