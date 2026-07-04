// Phase-2 audit enrichment: turn the stubbed competitor bars into REAL data. Reads the
// selected competitors for (domain, keyword) from the shared store (scanning them if the
// store is empty), fetches + analyzes each selected competitor page with the SAME analyzer
// used for "You" (apples-to-apples factors), and pulls NLP terms from /analyze-serp.
// Injected into computeAudit; any failure degrades to null → placeholder result.
import { getCompetitors, scanCompetitors } from './competitorScan';
import { fetchPage, extractFactorValues, RealAuditData } from './auditCompute';
import { callSidecar } from './sidecar';
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

export async function enrichAudit(domainId: number, url: string, keyword: string): Promise<RealAuditData | null> {
   const language = langOf(keyword);
   await ensureCompetitorsTables();

   let comps = await getCompetitors(domainId, keyword).catch(() => []);
   if (!comps.length) comps = await scanCompetitors(domainId, keyword, language).catch(() => []);

   let ownHost = '';
   try { ownHost = bareHost(new URL(url).hostname); } catch { ownHost = ''; }

   const selected = comps
      .filter((c) => c.selected)
      .filter((c) => competitorHost(c.domain || '', c.url) !== ownHost) // don't compare the page to itself
      .slice(0, MAX_COMPETITORS);
   if (!selected.length) return null;

   // Fetch + analyze each selected competitor page in parallel; skip failures.
   const analyzed = await Promise.all(selected.map(async (c) => {
      try {
         const { html, timing } = await fetchPage(c.url);
         const m = extractFactorValues(html, c.url, keyword, timing);
         let domain = c.domain || '';
         if (!domain) { try { domain = new URL(c.url).hostname; } catch { domain = c.url; } }
         return { domain, rank: c.position, values: m.values, contentScore: m.contentScore };
      } catch { return null; }
   }));
   const competitors = analyzed.filter((x): x is NonNullable<typeof x> => x !== null);
   if (!competitors.length) return null;

   let terms: { term: string; target_count: number }[] = [];
   try {
      const serp = await callSidecar<{ terms?: { term: string; target_count: number }[] }>('/analyze-serp', { keyword, language }, 60000);
      terms = Array.isArray(serp?.terms) ? serp.terms : [];
   } catch { terms = []; }

   return { competitors, terms };
}
