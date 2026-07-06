import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {Stack} from '../core/layout';
import {Text, Heading} from '../core/text';
import {Button} from '../core';
import Skeleton from './Skeleton';

const timeGreeting = (hour: number | null): string => {
  if (hour === null) return 'Welcome back!';
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
};

interface Props {
  clicksTotal: number;
  deltaPct: number;
  hasData: boolean;
  loading: boolean;
  clicksHref: string;
}

const DashboardGreeting = ({clicksTotal, deltaPct, hasData, loading, clicksHref}: Props) => {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { setHour(new Date().getHours()); }, []);

  const up = deltaPct >= 0;

  return (
    <Stack gap="2xl">
      <Heading as="h2" size="2xl">{timeGreeting(hour)}</Heading>
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
