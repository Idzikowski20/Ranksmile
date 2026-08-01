import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { StatusIndicator } from '../koala/core';
import { ListWidget } from '../koala/product';
import { Flex } from '../koala/core/layout';
import { Text } from '../koala/core/text';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId } from '../../lib/activeWorkspace';
import DomainFavicon from '../common/DomainFavicon';

// Mirrors the /api/gsc/traffic-alerts response (no `any` — project rule).
type AlertEntry = { page: string; prevPos: number | null; nowPos: number | null };
type DomainAlerts = { domain: string; tiers: { droppedInTop10: AlertEntry[]; droppedATier: AlertEntry[]; outOfIndex: AlertEntry[]; growth: AlertEntry[] }; hasDrops: boolean };
type AlertsResponse = { collecting: boolean; domains: DomainAlerts[] };
type DropRow = AlertEntry & { domain: string; label: string };

const dropSeverityVariant = (label: string): 'danger' | 'warning' | 'success' => {
  if (label === 'Out of index' || label === 'Dropped in top 10') return 'danger';
  if (label === 'Dropped a tier') return 'warning';
  return 'success';
};

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

  if (state.collecting) {
    return (
      <ListWidget
        title="Traffic alerts"
        items={[
          <Text key="collecting" as="p" size="md" variant="muted">
            Collecting Search Console data — your first weekly report needs two weeks of history.
          </Text>,
        ]}
      />
    );
  }

  if (drops.length === 0) {
    return (
      <ListWidget
        title="Traffic alerts"
        items={[<Text key="none" as="p" size="md" variant="muted">No ranking drops this week.</Text>]}
      />
    );
  }

  return (
    <ListWidget
      title="Traffic alerts"
      items={drops.slice(0, 3).map((e, i) => (
        <Flex
          key={`${e.domain}-${e.page}-${i}`}
          className="traffic-alert-row"
          align="center"
          justify="between"
          gap="xl"
          style={{ width: '100%' }}
        >
          <Flex align="center" gap="md" minWidth={0}>
            <DomainFavicon domain={e.domain} size={16} />
            <Text as="span" size="md" ellipsis>{e.page}</Text>
          </Flex>
          <Flex align="center" gap="lg" flexShrink={0}>
            <Text as="span" size="sm" variant="muted" tabular wrap="nowrap">
              {e.prevPos == null ? '—' : Math.round(e.prevPos)}
              <span className="text-gray-40 mx-1">→</span>
              {e.nowPos == null ? 'out' : Math.round(e.nowPos)}
            </Text>
            <Flex align="center" gap="sm">
              <StatusIndicator variant={dropSeverityVariant(e.label)} aria-label={e.label} />
              <Text as="span" size="sm" wrap="nowrap">{e.label}</Text>
            </Flex>
          </Flex>
        </Flex>
      ))}
    />
  );
};

export default TrafficAlertsSection;
