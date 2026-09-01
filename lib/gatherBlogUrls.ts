// lib/gatherBlogUrls.ts
import { QueryTypes } from 'sequelize';
import db from '../database/database';
import { matchesBlogPath, normalizeBlogPaths } from './blogPaths';
import { fetchSitemapUrls } from './fetchSitemapUrls';

/**
 * Candidate page URLs for a domain to audit. With blog_paths set, narrowed to those
 * sections; with none set, the WHOLE sitemap is returned so a freshly-added domain
 * gets every page scanned + scored out of the box (capped downstream by MAX_CRAWL_URLS).
 */
export async function gatherBlogUrls(domainId: number, domainName: string): Promise<string[]> {
   const rows = await db.query<{ blog_paths: string | null }>(
      `SELECT blog_paths FROM domain WHERE "ID" = ?`,
      { replacements: [domainId], type: QueryTypes.SELECT },
   );
   let segments: string[] = [];
   try { segments = normalizeBlogPaths(JSON.parse(rows[0]?.blog_paths || '[]')); } catch { segments = []; }

   const urls = await fetchSitemapUrls(domainName);
   const seen = new Set<string>();
   const out: string[] = [];
   const push = (u: string) => {
      const key = u.split('#')[0].split('?')[0];
      if (seen.has(key)) return;
      seen.add(key);
      out.push(key);
   };
   for (const u of urls) {
      // blog_paths narrows the audit to those sections; with none set, audit everything.
      if (segments.length > 0 && !matchesBlogPath(u, segments)) continue;
      push(u);
   }
   // Flat URL structures (posts at domain root) often have a category path that matches
   // zero posts — fall back to the full sitemap so setup still audits real pages.
   if (segments.length > 0 && out.length === 0) {
      for (const u of urls) push(u);
   }
   return out;
}
