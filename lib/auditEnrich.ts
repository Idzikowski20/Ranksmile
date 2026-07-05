// Phase-2 audit enrichment: turn the stubbed competitor bars into REAL data. Reads the
// selected competitors for (domain, keyword) from the shared store (scanning them if the
// store is empty), fetches + analyzes each selected competitor page with the SAME analyzer
// used for "You" (apples-to-apples factors), and pulls NLP terms from /analyze-serp.
// Injected into computeAudit; any failure degrades to null → placeholder result.
import { getCompetitors, scanCompetitors } from './competitorScan';
import { fetchPage, extractFactorValues, RealAuditData, RichTerm, auditContentScore, termCoverageFraction } from './auditCompute';
import { getSearchVolumes } from './dataforseo';
import { callSidecar } from './sidecar';
import { isContentCompetitor } from './competitorRelevance';
import { ensureCompetitorsTables } from './ensureCompetitorsTables';

const PL_DIACRITICS = /[ąćęłńóśźż]/i;
const langOf = (kw: string): string => (PL_DIACRITICS.test(kw) ? 'pl' : 'en');

// Cap the competitor page fetches per audit (each is a full HTTP fetch + parse).
const MAX_COMPETITORS = 6;

const bareHost = (h: string): string => h.replace(/^www\./, '');

// A competitor's host: its stored domain, else derived from its URL (so a row with an
// empty domain still gets a real host for the self-comparison filter).
const competitorHost = (domain: string, url: string): string => {
   if (domain) return bareHost(domain);
   try { return bareHost(new URL(url).hostname); } catch { return ''; }
};

export async function enrichAudit(domainId: number, url: string, keyword: string, lang?: string): Promise<RealAuditData | null> {
   // Prefer the audit's picked country language; fall back to a diacritic guess.
   const language = lang || langOf(keyword);
   await ensureCompetitorsTables();

   let comps = await getCompetitors(domainId, keyword).catch(() => []);
   if (!comps.length) comps = await scanCompetitors(domainId, keyword, language).catch(() => []);

   let ownHost = '';
   try { ownHost = bareHost(new URL(url).hostname); } catch { ownHost = ''; }

   const selected = comps
      .filter((c) => c.selected)
      .filter((c) => competitorHost(c.domain || '', c.url) !== ownHost) // don't compare the page to itself
      .filter((c) => isContentCompetitor(c.domain || '', c.url)) // drop junk already stored (pre-filter scans)
      .slice(0, MAX_COMPETITORS);
   if (!selected.length) return null;

   // Fetch + analyze each selected competitor page in parallel; skip failures.
   const analyzed = await Promise.all(selected.map(async (c) => {
      try {
         const { html, timing } = await fetchPage(c.url);
         const m = extractFactorValues(html, c.url, keyword, timing);
         let domain = c.domain || '';
         if (!domain) { try { domain = new URL(c.url).hostname; } catch { domain = c.url; } }
         return { domain, rank: c.position, values: m.values, contentScore: m.contentScore, url: c.url, bodyText: m.bodyText };
      } catch { return null; }
   }));
   const competitors = analyzed.filter((x): x is NonNullable<typeof x> => x !== null);
   if (!competitors.length) return null;

   let terms: RichTerm[] = [];
   try {
      const serp = await callSidecar<{ terms?: RichTerm[] }>('/analyze-serp', { keyword, language }, 60000);
      terms = Array.isArray(serp?.terms) ? serp.terms : [];
   } catch { terms = []; }

   // Search Volume (DataForSEO) for multi-word phrase terms only — mirrors SurferSEO,
   // which shows a volume for phrases and "—" for single words. Best-effort: any failure
   // (unconfigured / API error) just leaves searchVolume null.
   if (terms.length) {
      const phrases = terms.filter((t) => /\s/.test(t.term.trim())).map((t) => t.term);
      // DataForSEO keys volume by COUNTRY (Google Ads geo), not language — map the SERP
      // language to its country so English sites aren't billed against the US market.
      const LANG_COUNTRY: Record<string, string> = { pl: 'PL', en: 'US', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', nl: 'NL', pt: 'PT' };
      const country = LANG_COUNTRY[language.toLowerCase()] || 'US';
      const volumes = await getSearchVolumes(phrases, country).catch(() => ({} as Record<string, number>));
      if (Object.keys(volumes).length) {
         terms = terms.map((t) => ({ ...t, searchVolume: volumes[t.term.toLowerCase()] ?? t.searchVolume ?? null }));
      }
   }

   // Calibrate content scores (coverage-dominated, SurferSEO-style) so "You" and every
   // competitor are scored by the SAME model. Competitor-set averages are shared back so
   // buildAuditResult can score "You" identically. Only when we actually have terms.
   const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
   const avgWords = mean(competitors.map((c) => c.values.word_count_body || 0));
   const avgHeadings = mean(competitors.map((c) => c.values.h2_h6_count || 0));
   const avgPs = mean(competitors.map((c) => c.values.p_count || 0));
   const structFrac = (v: Record<string, number>) => (
      ((avgHeadings > 0 ? Math.min(1, (v.h2_h6_count || 0) / avgHeadings) : 0)
         + (avgPs > 0 ? Math.min(1, (v.p_count || 0) / avgPs) : 0)) / 2
   );

   const outCompetitors = competitors.map(({ bodyText, ...c }) => {
      if (!terms.length) return c;
      const cov = termCoverageFraction(bodyText, terms);
      const wordFrac = avgWords > 0 ? (c.values.word_count_body || 0) / avgWords : 0;
      return { ...c, contentScore: auditContentScore(cov, wordFrac, structFrac(c.values)) };
   });

   return {
      competitors: outCompetitors,
      terms,
      contentTargets: terms.length ? { avgWords, avgHeadings, avgPs } : undefined,
   };
}
