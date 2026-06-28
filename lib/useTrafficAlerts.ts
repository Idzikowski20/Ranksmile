import { useEffect, useMemo, useState } from 'react';

type AlertEntry = { page: string; prevPos: number | null; nowPos: number | null };
type DomainAlerts = { domain: string; tiers: { droppedInTop10: AlertEntry[]; droppedATier: AlertEntry[]; outOfIndex: AlertEntry[]; growth: AlertEntry[] }; hasDrops: boolean };
export type TrafficAlerts = { collecting: boolean; domains: DomainAlerts[] };

/** Fetch this week's GSC drop alerts for a workspace; exposes the set of dropped page paths. */
export function useTrafficAlerts(workspaceId: number | null | undefined): { data: TrafficAlerts | null; droppedPaths: Set<string> } {
   const [data, setData] = useState<TrafficAlerts | null>(null);
   useEffect(() => {
      if (!workspaceId) return;
      fetch(`/api/gsc/traffic-alerts?workspaceId=${workspaceId}`)
         .then((r) => (r.ok ? (r.json() as Promise<TrafficAlerts>) : null))
         .then(setData)
         .catch(() => {});
   }, [workspaceId]);

   const droppedPaths = useMemo(() => {
      const s = new Set<string>();
      if (data) {
         for (const d of data.domains) {
            for (const t of [d.tiers.droppedInTop10, d.tiers.droppedATier, d.tiers.outOfIndex]) {
               for (const e of t) s.add(e.page);
            }
         }
      }
      return s;
   }, [data]);

   return { data, droppedPaths };
}
