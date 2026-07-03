/**
 * Pure helpers for brand extraction — split from aiVisibilityBrands so tests can
 * import them without pulling in the ESM-only @ai-sdk/deepseek client.
 */
const SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed']);

export type RawBrand = { brand: string; domain: string; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; quotes: string[] };

export function buildBrandPrompt(answer: string, ownBrand: string): string {
   return [
      'You extract brand/company/product mentions from an AI assistant answer.',
      `The tracked brand is "${ownBrand}".`,
      'Return ONLY a JSON array (no prose). Each item: {"brand": string, "domain": string, "sentiment": "positive"|"neutral"|"negative"|"mixed", "quotes": string[]}.',
      '- brand: canonical display name (e.g. "Wix", not "wix.com").',
      '- domain: the brand\'s main website domain if obvious, else "".',
      '- sentiment: how the answer portrays the brand.',
      '- quotes: up to 3 short verbatim snippets mentioning the brand.',
      'List brands in the order they first appear. Skip generic terms.',
      '',
      'ANSWER:',
      answer.slice(0, 8000),
   ].join('\n');
}

export function parseBrandResponse(raw: unknown): RawBrand[] {
   let v: unknown = raw;
   if (typeof raw === 'string') {
      // Models sometimes wrap JSON in ```json fences — strip to the first [ … ].
      const s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
      const start = s.indexOf('[');
      const end = s.lastIndexOf(']');
      try { v = JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s); } catch { return []; }
   }
   if (!Array.isArray(v)) return [];
   return v
      .filter((b): b is Record<string, unknown> => !!b && typeof (b as { brand?: unknown }).brand === 'string' && !!(b as { brand?: string }).brand)
      .map((b) => ({
         brand: String(b.brand),
         domain: typeof b.domain === 'string' ? b.domain : '',
         sentiment: (typeof b.sentiment === 'string' && SENTIMENTS.has(b.sentiment) ? b.sentiment : 'neutral') as RawBrand['sentiment'],
         quotes: Array.isArray(b.quotes) ? b.quotes.filter((q): q is string => typeof q === 'string').slice(0, 3) : [],
      }));
}
