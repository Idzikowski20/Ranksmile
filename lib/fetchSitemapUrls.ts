// lib/fetchSitemapUrls.ts — fetch all page URLs from sitemap.xml / sitemap index trees.
import { assertPublicUrl } from './ssrfGuard';

import { SERPBEAR_UA } from './httpConstants';
const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
const MAX_CHILD_SITEMAPS = 12;
const MAX_URLS = 5000;

export type SitemapEntry = {
  url: string;
  sitemapUrl: string;
};

function parseLocs(xml: string): string[] {
   return [...xml.matchAll(LOC_RE)].map((m) => m[1]);
}

async function fetchXml(url: string): Promise<string | null> {
   try {
      await assertPublicUrl(url);
      const r = await fetch(url, { headers: { 'User-Agent': SERPBEAR_UA } });
      if (!r.ok) return null;
      return await r.text();
   } catch {
      return null;
   }
}

function isSitemapIndex(xml: string): boolean {
   return /<sitemapindex/i.test(xml);
}

function isPageUrl(url: string): boolean {
   try {
      const { pathname } = new URL(url);
      if (/\.(xml|xsl)$/i.test(pathname)) return false;
      return true;
   } catch {
      return false;
   }
}

/**
 * Returns deduplicated page URLs from the site's sitemap(s).
 * Follows sitemap indexes into child sitemaps (e.g. Yoast post-sitemap.xml).
 */
export async function fetchSitemapUrls(domainName: string): Promise<string[]> {
   const entries = await fetchSitemapEntries(domainName);
   return entries.map((e) => e.url);
}

/**
 * Like fetchSitemapUrls but keeps the child sitemap file each URL came from.
 */
export async function fetchSitemapEntries(domainName: string): Promise<SitemapEntry[]> {
   const base = domainName.startsWith('http') ? domainName.replace(/\/+$/, '') : `https://${domainName}`;
   const seen = new Set<string>();
   const out: SitemapEntry[] = [];

   const addUrl = (raw: string, sitemapUrl: string) => {
      const key = raw.split('#')[0].split('?')[0];
      if (!isPageUrl(key) || seen.has(key)) return;
      seen.add(key);
      out.push({ url: key, sitemapUrl });
   };

   for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      const rootUrl = `${base}${path}`;
      const rootXml = await fetchXml(rootUrl);
      if (!rootXml) continue;

      const rootLocs = parseLocs(rootXml);
      if (!rootLocs.length) continue;

      if (isSitemapIndex(rootXml)) {
         const childLocs = rootLocs.slice(0, MAX_CHILD_SITEMAPS);
         const childXmls = await Promise.all(childLocs.map((loc) => fetchXml(loc)));
         for (let i = 0; i < childLocs.length; i += 1) {
            const childXml = childXmls[i];
            const childSitemapUrl = childLocs[i];
            if (!childXml) continue;
            for (const loc of parseLocs(childXml)) {
               addUrl(loc, childSitemapUrl);
               if (out.length >= MAX_URLS) return out;
            }
         }
      } else {
         for (const loc of rootLocs) {
            addUrl(loc, rootUrl);
            if (out.length >= MAX_URLS) return out;
         }
      }

      if (out.length) return out;
   }

   return out;
}
