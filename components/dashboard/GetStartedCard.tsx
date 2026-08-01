import React from 'react';
import { useRouter } from 'next/router';
import { Flex, Stack } from '../koala/core/layout';
import { Text } from '../koala/core/text';
import { Button } from '../koala/core';
import { ActionWidget } from '../koala/product';
import { useOnboardingChecklist } from '../../lib/useOnboardingChecklist';

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
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" stroke="var(--koala-border-primary)" />
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="var(--koala-status-success)" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-500" />
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
    <ActionWidget
      title="Get started"
      description={(
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
      )}
      action={href ? (
        <Button
          variant="primary"
          onClick={(e: React.MouseEvent) => { e.preventDefault(); router.push(href); }}
        >
          {nextStep.cta || 'Continue'}
          <Chevron />
        </Button>
      ) : undefined}
    >
      <Flex align="center" gap="lg">
        <Ring pct={pct} />
      </Flex>
    </ActionWidget>
  );
};

export default GetStartedCard;
