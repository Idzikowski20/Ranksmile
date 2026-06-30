import type { PageSnap, SnapMap } from './gscDrops';

type RawItem = { page: string; clicks: number; impressions: number; position: number };

/** 'YYYY-MM-DD' Monday (UTC) of the PREVIOUS full week relative to `now`. */
export function weekStartFor(now: Date): string {
   const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
   const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
   d.setUTCDate(d.getUTCDate() - (isoDow - 1)); // this week's Monday
   d.setUTCDate(d.getUTCDate() - 7);            // previous week's Monday
   return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' a given number of weeks offset from a 'YYYY-MM-DD' week_start. */
export function shiftWeek(weekStart: string, weeks: number): string {
   const d = new Date(`${weekStart}T00:00:00Z`);
   d.setUTCDate(d.getUTCDate() + weeks * 7);
   return d.toISOString().slice(0, 10);
}

/** Collapse per-(page,device,country) rows into one snapshot per page. */
export function aggregateSevenDays(items: RawItem[]): SnapMap {
   const acc = new Map<string, { clicks: number; impressions: number; wpos: number; sumpos: number; n: number }>();
   for (const it of items) {
      const page = it.page || '/';
      const cur = acc.get(page) || { clicks: 0, impressions: 0, wpos: 0, sumpos: 0, n: 0 };
      cur.clicks += it.clicks || 0;
      cur.impressions += it.impressions || 0;
      cur.wpos += (it.position || 0) * (it.impressions || 0);
      cur.sumpos += it.position || 0;
      cur.n += 1;
      acc.set(page, cur);
   }
   const out: SnapMap = new Map();
   for (const [page, v] of acc) {
      const position = v.impressions > 0 ? v.wpos / v.impressions : (v.n > 0 ? v.sumpos / v.n : 0);
      out.set(page, { clicks: v.clicks, impressions: v.impressions, position } as PageSnap);
   }
   return out;
}
