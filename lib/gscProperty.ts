// lib/gscProperty.ts — map a GSC siteUrl to domain.search_console settings.

export type GscPropertySettings = {
   property_type: 'domain' | 'url';
   url: string;
};

/** Parse a GSC site list entry (sc-domain:… or https://…) into stored search_console shape. */
export function parseGscProperty(siteUrl: string): GscPropertySettings {
   const s = siteUrl.trim();
   if (s.startsWith('sc-domain:')) {
      return { property_type: 'domain', url: s };
   }
   if (s.startsWith('http://') || s.startsWith('https://')) {
      return { property_type: 'url', url: s.endsWith('/') ? s : `${s}/` };
   }
   return { property_type: 'domain', url: `sc-domain:${s.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '')}` };
}

/** Merge GSC property into an existing search_console JSON blob (keeps service-account keys if any). */
export function mergeGscProperty(existingJson: string | null | undefined, siteUrl: string): string {
   let base: Record<string, unknown> = {};
   if (existingJson) {
      try { base = JSON.parse(existingJson) as Record<string, unknown>; } catch { base = {}; }
   }
   const prop = parseGscProperty(siteUrl);
   return JSON.stringify({ ...base, ...prop });
}
