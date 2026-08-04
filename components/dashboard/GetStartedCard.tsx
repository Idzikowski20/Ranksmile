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

/** Same mark as PublishExportPanel WordPress export button. */
const WpLogo = () => (
  <svg width={18} height={18} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M10 0C4.49 0 0 4.48 0 10s4.49 10 10 10 10-4.49 10-10S15.51 0 10 0ZM1.01 10c0-1.3.28-2.54.78-3.66l4.29 11.75A8.99 8.99 0 0 1 1.01 10ZM10 18.99c-.88 0-1.73-.13-2.54-.37l2.7-7.84 2.76 7.57.06.13c-.93.33-1.93.51-2.98.51Zm1.24-13.2c.54-.03 1.03-.09 1.03-.09.48-.06.43-.77-.06-.74 0 0-1.46.11-2.4.11-.88 0-2.37-.11-2.37-.11-.48-.03-.54.71-.06.74 0 0 .46.06.94.09l1.4 3.84-1.97 5.9L4.48 5.79c.55-.03 1.03-.09 1.03-.09.49-.06.43-.77-.06-.74 0 0-1.45.11-2.39.11-.17 0-.37 0-.58-.01A8.98 8.98 0 0 1 9.99 1c2.34 0 4.47.89 6.07 2.36-.04 0-.08-.01-.12-.01-.88 0-1.51.77-1.51 1.6 0 .74.43 1.37.88 2.11.34.6.74 1.37.74 2.48 0 .77-.29 1.66-.69 2.91l-.89 3-3.23-9.66Zm3.28 11.98 2.75-7.94c.51-1.28.68-2.31.68-3.22 0-.33-.02-.64-.06-.93.7 1.28 1.1 2.75 1.1 4.31a8.99 8.99 0 0 1-4.47 7.78Z"
      fill="currentColor"
    />
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
    <ActionWidget title="Get started">
      <Flex align="center" justify="between" gap="lg" wrap="wrap" className="min-w-0 w-full">
        <Flex align="center" gap="lg" className="min-w-0 flex-1">
          <Ring pct={pct} />
          <Stack className="min-w-0">
            <Text size="xs" bold uppercase variant="muted">Next step</Text>
            <Flex align="center" gap="sm" className="mt-0.5 min-w-0">
              <Text size="lg" bold className="truncate">{nextStep.label}</Text>
              <Chevron />
              {nextStep.time ? (
                <Flex align="center" gap="xs" className="shrink-0">
                  <ClockIcon />
                  <Text size="md" variant="muted">{nextStep.time}</Text>
                </Flex>
              ) : null}
            </Flex>
          </Stack>
        </Flex>

        {href ? (
          <Button
            variant="primary"
            className="shrink-0"
            onClick={(e: React.MouseEvent) => { e.preventDefault(); router.push(href); }}
          >
            {nextStep.key === 'wordpress' ? <WpLogo /> : null}
            {nextStep.cta || 'Continue'}
            <Chevron />
          </Button>
        ) : null}
      </Flex>
    </ActionWidget>
  );
};

export default GetStartedCard;
