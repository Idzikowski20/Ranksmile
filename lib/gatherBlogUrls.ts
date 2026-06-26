// lib/gatherBlogUrls.ts
import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { matchesBlogPath } from './blogPaths';

const UA = 'Mozilla/5.0 (compatible; SerpBearBot/1.0)';

async function sitemapUrls(domainName: string): Promise<string[]> {
   const base = domainName.startsWith('http') ? domainName : `https://${domainName}`;
   for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      try {
         const r = await fetch(`${base}${path}`, { headers: { 'User-Agent': UA } });
         if (!r.ok) continue;
         const xml = await r.text();
         const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
         if (locs.length) return locs;
      } catch { /* next */ }
   }
   return [];
}

/** All candidate blog-post URLs for a domain, filtered by its blog_paths. Empty if none set. */
export async function gatherBlogUrls(domainId: number, domainName: string): Promise<string[]> {
   const rows = await db.query<{ blog_paths: string | null }>(
      `SELECT blog_paths FROM domain WHERE "ID" = ?`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   let segments: string[] = [];
   try { segments = JSON.parse(rows[0]?.blog_paths || '[]'); } catch { segments = []; }
   if (segments.length === 0) return [];

   const urls = await sitemapUrls(domainName);
   const seen = new Set<string>();
   const out: string[] = [];
   for (const u of urls) {
      if (!matchesBlogPath(u, segments)) continue;
      const key = u.split('#')[0].split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
   }
   return out;
}
