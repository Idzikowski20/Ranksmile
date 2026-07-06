import React from 'react';
import { useRouter } from 'next/router';
import { Flex, Stack } from '../core/layout';
import { Text } from '../core/text';
import { Button } from '../core';
import SectionHeader from './SectionHeader';
import { useOnboardingChecklist } from '../../lib/useOnboardingChecklist';

const GetStartedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3.33789 7C5.06694 4.01099 8.29866 2 12.0001 2C17.5229 2 22.0001 6.47715 22.0001 12C22.0001 17.5228 17.5229 22 12.0001 22C8.29866 22 5.06694 19.989 3.33789 17M12 16L16 12M16 12L12 8M16 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m8.25 4.5l7.5 7.5l-7.5 7.5" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0" />
  </svg>
);

const Ring = ({pct}: {pct: number}) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid place-items-center size-11 shrink-0">
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" stroke="#E4E4E7" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="#1AB25E" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <Text size="xs" bold tabular>{pct}%</Text>
    </span>
  );
};

const GetStartedCard = () => {
  const router = useRouter();
  const {pct, nextStep, loading} = useOnboardingChecklist();
  if (loading || !nextStep) return null;

  const href = nextStep.href || '';

  return (
    <Stack gap="lg">
      <SectionHeader icon={<GetStartedIcon />} label="Get started" />
      <Flex
        align="center"
        justify="between"
        wrap="wrap"
        gap="lg"
        paddingTop="lg"
        paddingRight="2xl"
        paddingBottom="lg"
        paddingLeft="2xl"
        radius="2xl"
        border="md"
        className="dashboard-getstarted-card"
      >
        <Flex align="center" gap="lg" flex="1" className="min-w-0">
          <Ring pct={pct} />
          <Stack className="min-w-0">
            <Text size="xs" bold uppercase variant="muted">Next step</Text>
            <Flex align="center" gap="sm" className="mt-0.5">
              <Text size="lg" bold>{nextStep.label}</Text>
              <Chevron />
              {nextStep.time && (
                <Flex align="center" gap="xs">
                  <ClockIcon />
                  <Text size="md" variant="muted">{nextStep.time}</Text>
                </Flex>
              )}
            </Flex>
          </Stack>
        </Flex>
        {href && (
          <Button
            variant="primary"
            onClick={(e: React.MouseEvent) => { e.preventDefault(); router.push(href); }}
          >
            {nextStep.cta || 'Continue'}
            <Chevron />
          </Button>
        )}
      </Flex>
    </Stack>
  );
};

export default GetStartedCard;
