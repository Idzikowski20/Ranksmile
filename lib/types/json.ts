/** Parse a DB JSON column or stringified JSON safely. */
export function parseJsonish<T>(v: unknown): T | null {
   if (v == null) return null;
   if (typeof v === 'object') return v as T;
   if (typeof v === 'string') {
      try { return JSON.parse(v) as T; } catch { return null; }
   }
   return null;
}
