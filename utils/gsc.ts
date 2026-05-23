/** Shared GSC (Google Search Console) utility functions */

export function normalizeUrlForMatch(url: string): string {
   try {
      return new URL(url).pathname.toLowerCase().replace(/\/+$/, '') || '/';
   } catch {
      return url.toLowerCase().replace(/\/+$/, '') || '/';
   }
}

export function kwScore(kw: { clicks: number; impressions: number; position: number }): number {
   return kw.clicks * 2 + kw.impressions * 0.1 + (kw.position > 0 ? (1 / kw.position) * 100 : 0);
}
