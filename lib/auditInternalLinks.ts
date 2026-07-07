// Internal-link OPPORTUNITIES (SurferSEO-style): topically-relevant pages on the SAME
// site that could link to the audited URL. Unlike the audited page's own outbound links,
// this crawls the site (sitemap first, homepage fallback), fetches a bounded set of pages,
// and for each decides: does it already link to the audited URL (green ✓) or is it a
// relevant page that should (red opportunity)? All fetches go through fetchPage, which is
// SSRF-guarded. Best-effort: any failure returns null and the caller degrades gracefully.
import { load } from 'cheerio';
import { fetchPage } from './auditCompute';
import { countOccurrences } from './contentScore';
import { plainText } from './optimizationPlanner';
import { AuditInternalLink } from './auditTypes';

const MAX_FETCH = 18; // bound the crawl — each candidate is a full HTTP fetch + parse
const RELEVANCE_MIN = 0.5; // ≥50% of the keyword's meaningful tokens must appear

const KW_STOP = new Set(['jak', 'co', 'czy', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'w', 'we', 'i', 'na', 'do', 'z', 'ze', 'za', 'o', 'po', 'u', 'mnie', 'ci', 'cię', 'się', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'or', 'is', 'are']);
function keywordTokens(keyword: string): string[] {
   return keyword.toLowerCase().split(/\s+/)
      .map((t) => t.replace(/[^\wąćęłńóśźż]/g, ''))
      .filter((t) => t.length >= 3 && !KW_STOP.has(t));
}

const clean = (url: string): string => { try { const u = new URL(url); return `${u.origin}${u.pathname.replace(/\/+$/, '')}`; } catch { return url; } };

async function fetchHtml(url: string): Promise<string | null> {
   try { const { html } = await fetchPage(url); return html; } catch { return null; }
}

const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;

// Same-site candidate URLs: sitemap.xml (or a sitemap index → its first child sitemaps),
// falling back to the homepage's internal links. Junk paths (assets, feeds, taxonomies)
// are filtered out and the audited URL itself is excluded.
async function collectCandidateUrls(origin: string, auditUrl: string): Promise<string[]> {
   const auditClean = clean(auditUrl);
   const locs: string[] = [];

   const sitemap = await fetchHtml(`${origin}/sitemap.xml`);
   if (sitemap) {
      const entries = [...sitemap.matchAll(LOC_RE)].map((m) => m[1]);
      if (/<sitemapindex/i.test(sitemap)) {
         const children = await Promise.all(entries.slice(0, 3).map(fetchHtml));
         children.forEach((cs) => { if (cs) locs.push(...[...cs.matchAll(LOC_RE)].map((m) => m[1])); });
      } else {
         locs.push(...entries);
      }
   }
   if (!locs.length) {
      const home = await fetchHtml(origin);
      if (home) {
         const $ = load(home);
         $('a[href]').each((_, el) => {
            try { const abs = new URL($(el).attr('href') || '', origin); if (abs.origin === origin) locs.push(abs.toString()); } catch { /* skip */ }
         });
      }
   }

   const out = new Set<string>();
   for (const l of locs) {
      let u: URL;
      try { u = new URL(l); } catch { continue; }
      if (u.origin !== origin) continue;
      if (/\.(jpg|jpeg|png|gif|svg|webp|avif|pdf|css|js|xml|ico|mp4|zip|woff2?)$/i.test(u.pathname)) continue;
      if (/\/(wp-json|wp-admin|feed|tag|category|author|page)\//i.test(u.pathname)) continue;
      const c = clean(u.toString());
      if (c === auditClean) continue;
      out.add(c);
      if (out.size >= 60) break;
   }
   return Array.from(out);
}

export async function findInternalLinkOpportunities(auditUrl: string, keyword: string): Promise<AuditInternalLink[] | null> {
   let origin = '';
   let auditPath = '';
   try { const u = new URL(auditUrl); origin = u.origin; auditPath = u.pathname.replace(/\/+$/, ''); } catch { return null; }

   const candidates = await collectCandidateUrls(origin, auditUrl);
   if (!candidates.length) return null;

   const tokens = keywordTokens(keyword);
   const picked = candidates.slice(0, MAX_FETCH);
   const scored = await Promise.all(picked.map(async (url) => {
      const html = await fetchHtml(url);
      if (!html) return null;
      const $ = load(html);
      $('script, style, noscript').remove();
      const text = plainText($('body').html() || html);
      const title = ($('title').first().text() || '');
      // Topical relevance: share of the keyword's meaningful tokens present (inflection-tolerant).
      const hits = tokens.filter((t) => countOccurrences(text, t) > 0 || countOccurrences(title, t) > 0).length;
      const relevant = tokens.length ? hits / tokens.length >= RELEVANCE_MIN : false;
      // Does this page already link to the audited URL?
      let linked = false;
      $('a[href]').each((_, el) => {
         if (linked) return;
         try { const abs = new URL($(el).attr('href') || '', url); if (abs.origin === origin && abs.pathname.replace(/\/+$/, '') === auditPath) linked = true; } catch { /* skip */ }
      });
      return { url, relevant, linked };
   }));

   // Keep pages that already link (green ✓) or are relevant opportunities (red). Opportunities first.
   const rows = scored
      .filter((x): x is NonNullable<typeof x> => !!x && (x.relevant || x.linked))
      .sort((a, b) => Number(a.linked) - Number(b.linked))
      .map((r) => ({ url: r.url, linked: r.linked }));
   return rows;
}
