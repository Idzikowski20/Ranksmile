/**
 * Reading a timestamp column back as a number of milliseconds.
 *
 * Two shapes reach us: node-pg returns a Date, while SQLite returns
 * "YYYY-MM-DD HH:MM:SS" text with no zone — which `new Date(...)` reads in the process
 * timezone. An hour or more of drift, in either direction, on any comparison against
 * Date.now(): long enough to make a fresh single-flight claim look abandoned (so two
 * requests each pay for generation) or a finished phase look live.
 */
export function parseDbTimestamp(v: unknown): number {
   if (!v) return NaN;
   if (v instanceof Date) return v.getTime();
   if (typeof v !== 'string') return NaN;
   const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v.replace(' ', 'T')}Z`;
   return new Date(iso).getTime();
}

export default parseDbTimestamp;
