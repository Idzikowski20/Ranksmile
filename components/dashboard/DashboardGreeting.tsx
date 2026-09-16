import React from 'react';
import Link from 'next/link';
import { Stack } from '../koala/core/layout';
import { Text, Heading } from '../koala/core/text';
import Skeleton from './Skeleton';

interface Props {
  /** First name when we have one; the greeting works without it. */
  name: string;
  clicksTotal: number;
  deltaPct: number;
  hasData: boolean;
  loading: boolean;
  clicksHref: string;
}

const DashboardGreeting = ({ name, clicksTotal, deltaPct, hasData, loading, clicksHref }: Props) => {
  const up = deltaPct >= 0;
  const greeting = name ? `Hi ${name}, welcome back 👋` : 'Welcome back 👋';

  return (
    <Stack gap="2xl">
      <Heading as="h2" size="2xl">{greeting}</Heading>
      {loading ? (
        <Skeleton width="min(420px, 80%)" height={20} radius={6} />
      ) : hasData ? (
        <Text as="div" size="lg" variant="muted">
          Your site received{' '}
          <Link href={clicksHref} passHref>
            <a className="font-semibold text-inherit hover:underline">
              {clicksTotal} {clicksTotal === 1 ? 'click' : 'clicks'}
            </a>
          </Link>
          {' '}—a {Math.abs(deltaPct)}% {up ? 'increase' : 'decrease'} over the last 30 days.
        </Text>
      ) : (
        <Text as="div" size="lg" variant="muted">
          Connect{' '}
          <Link href="/settings/google_search_console" passHref>
            <a className="font-semibold text-inherit hover:underline">Google Search Console</a>
          </Link>
          {' '}to start tracking your clicks.
        </Text>
      )}
    </Stack>
  );
};

export default DashboardGreeting;
