import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId } from '../../lib/activeWorkspace';

const F = 'var(--font-family-primary)';

// Mirrors the /api/gsc/traffic-alerts response (no `any` — project rule).
type AlertEntry = { page: string; prevPos: number | null; nowPos: number | null };
type DomainAlerts = { domain: string; tiers: { droppedInTop10: AlertEntry[]; droppedATier: AlertEntry[]; outOfIndex: AlertEntry[]; growth: AlertEntry[] }; hasDrops: boolean };
type AlertsResponse = { collecting: boolean; domains: DomainAlerts[] };
type DropRow = AlertEntry & { domain: string; label: string };

const TrafficAlertsSection = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { data: wsData } = useWorkspaces();
  const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const [state, setState] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    if (!wsId) return;
    fetch(`/api/gsc/traffic-alerts?workspaceId=${wsId}`)
      .then((r) => (r.ok ? (r.json() as Promise<AlertsResponse>) : null))
      .then(setState)
      .catch(() => {});
  }, [wsId]);

  if (!state) return null;

  const drops: DropRow[] = state.domains.flatMap((d) => [
    ...d.tiers.droppedInTop10.map((e) => ({ ...e, domain: d.domain, label: 'Dropped in top 10' })),
    ...d.tiers.droppedATier.map((e) => ({ ...e, domain: d.domain, label: 'Dropped a tier' })),
    ...d.tiers.outOfIndex.map((e) => ({ ...e, domain: d.domain, label: 'Out of index' })),
  ]);

  return (
    <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, background: '#fff', padding: 20, fontFamily: F }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#18181B', marginBottom: 12 }}>Traffic alerts</div>
      {state.collecting ? (
        <div style={{ fontSize: 14, color: '#52525C', lineHeight: '20px' }}>Collecting Search Console data — your first weekly report needs two weeks of history.</div>
      ) : drops.length === 0 ? (
        <div style={{ fontSize: 14, color: '#52525C' }}>No ranking drops this week.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drops.map((e, i) => (
            <div key={`${e.domain}-${e.page}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
              <span style={{ color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{e.page}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#52525C', whiteSpace: 'nowrap' }}>{e.prevPos == null ? '—' : Math.round(e.prevPos)} → {e.nowPos == null ? 'out' : Math.round(e.nowPos)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 9999, padding: '1px 8px', whiteSpace: 'nowrap' }}>{e.label}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrafficAlertsSection;
