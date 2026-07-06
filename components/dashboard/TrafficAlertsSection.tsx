import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Badge } from '../core';
import { Flex, Stack, Container } from '../core/layout';
import { Text } from '../core/text';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId } from '../../lib/activeWorkspace';
import SectionHeader from './SectionHeader';

// Mirrors the /api/gsc/traffic-alerts response (no `any` — project rule).
type AlertEntry = { page: string; prevPos: number | null; nowPos: number | null };
type DomainAlerts = { domain: string; tiers: { droppedInTop10: AlertEntry[]; droppedATier: AlertEntry[]; outOfIndex: AlertEntry[]; growth: AlertEntry[] }; hasDrops: boolean };
type AlertsResponse = { collecting: boolean; domains: DomainAlerts[] };
type DropRow = AlertEntry & { domain: string; label: string };

const AlertIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
    <Stack gap="lg">
      <SectionHeader icon={<AlertIcon />} label="Traffic alerts" />
      <Container border="md" radius="2xl" overflow="hidden">
        {/* eslint-disable-next-line no-nested-ternary */}
        {state.collecting ? (
          <Container padding="2xl">
            <Text as="p" size="md" variant="muted">
              Collecting Search Console data — your first weekly report needs two weeks of history.
            </Text>
          </Container>
        ) : drops.length === 0 ? (
          <Container padding="2xl">
            <Text as="p" size="md" variant="muted">No ranking drops this week.</Text>
          </Container>
        ) : (
          <Stack>
            {drops.map((e, i) => (
              <Flex
                key={`${e.domain}-${e.page}-${i}`}
                className="traffic-alert-row"
                align="center"
                justify="between"
                gap="xl"
                paddingTop="lg"
                paddingBottom="lg"
                paddingLeft="xl"
                paddingRight="xl"
                borderTop={i === 0 ? undefined : 'md'}
              >
                <Flex align="center" gap="md" minWidth={0}>
                  <img
                    alt=""
                    width={16}
                    height={16}
                    className="rounded flex-shrink-0"
                    src={`https://www.google.com/s2/favicons?domain=${e.domain}&sz=32`}
                  />
                  <Text as="span" size="md" ellipsis>{e.page}</Text>
                </Flex>
                <Flex align="center" gap="lg" flexShrink={0}>
                  <Text as="span" size="sm" variant="muted" tabular wrap="nowrap">
                    {e.prevPos == null ? '—' : Math.round(e.prevPos)}
                    <span className="text-gray-40 mx-1">→</span>
                    {e.nowPos == null ? 'out' : Math.round(e.nowPos)}
                  </Text>
                  <Badge variant="danger">{e.label}</Badge>
                </Flex>
              </Flex>
            ))}
          </Stack>
        )}
      </Container>
    </Stack>
  );
};

export default TrafficAlertsSection;
