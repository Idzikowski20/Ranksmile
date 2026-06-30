export type PageSnap = { clicks: number; impressions: number; position: number };
export type SnapMap = Map<string, PageSnap>; // page path -> snapshot
export type DropEntry = { page: string; prevPos: number | null; nowPos: number | null; clicks: number; prevClicks: number };
export type DropResult = {
   tiers: { droppedInTop10: DropEntry[]; droppedATier: DropEntry[]; outOfIndex: DropEntry[]; growth: DropEntry[] };
   summary: { clicks: number; prevClicks: number; impressions: number; prevImpressions: number; pagesFell: number; pagesGrew: number };
   hasDrops: boolean;
};

const block = (pos: number) => Math.floor((pos - 1) / 10); // 1-10 -> 0, 11-20 -> 1, ...

/** Compare this week's per-page snapshot to last week's; bucket pages by threshold transition.
 *  Position semantics: lower = better (GSC average rank). */
export function computeDrops(now: SnapMap, prev: SnapMap): DropResult {
   const tiers: DropResult['tiers'] = { droppedInTop10: [], droppedATier: [], outOfIndex: [], growth: [] };
   let clicks = 0; let impressions = 0; let prevClicks = 0; let prevImpressions = 0; let pagesFell = 0; let pagesGrew = 0;

   for (const [, s] of now) { clicks += s.clicks; impressions += s.impressions; }
   for (const [, s] of prev) { prevClicks += s.clicks; prevImpressions += s.impressions; }

   const pages = new Set<string>([...now.keys(), ...prev.keys()]);
   for (const page of pages) {
      const n = now.get(page);
      const p = prev.get(page);
      const entry = (): DropEntry => ({ page, prevPos: p ? p.position : null, nowPos: n ? n.position : null, clicks: n ? n.clicks : 0, prevClicks: p ? p.clicks : 0 });

      if (p && !n) { tiers.outOfIndex.push(entry()); pagesFell += 1; continue; }
      if (!p && n) { if (n.position <= 50) tiers.growth.push(entry()); pagesGrew += 1; continue; }
      if (!p || !n) continue;

      if (n.position > p.position) {
         pagesFell += 1;
         if (p.position <= 10) tiers.droppedInTop10.push(entry());
         else if (p.position <= 50 && block(n.position) !== block(p.position)) tiers.droppedATier.push(entry());
      } else if (n.position <= p.position - 2) {
         pagesGrew += 1;
         if (n.position <= 50) tiers.growth.push(entry());
      }
   }

   const hasDrops = tiers.droppedInTop10.length + tiers.droppedATier.length + tiers.outOfIndex.length > 0;
   return { tiers, summary: { clicks, prevClicks, impressions, prevImpressions, pagesFell, pagesGrew }, hasDrops };
}
