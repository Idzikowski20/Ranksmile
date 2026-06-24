import React, { useEffect, useState } from 'react';
import Skeleton from './Skeleton';

const font = 'var(--font-family-primary)';

const ArrowUpRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, verticalAlign: 'sub' }}>
    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

const DashboardGreeting = ({ clicksTotal, deltaPct, hasData, loading, clicksHref }: Props) => {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { setHour(new Date().getHours()); }, []);

  const up = deltaPct >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 600, color: '#09090b', fontFamily: font }}>
        {timeGreeting(hour)}
      </div>

      <div style={{ textAlign: 'left', fontSize: 20, lineHeight: '28px', color: '#52525C', fontFamily: font }}>
        {loading ? (
          <Skeleton width="min(420px, 80%)" height={20} radius={6} style={{ margin: '4px 0' }} />
        ) : hasData ? (
          <span>
            Your site received{' '}
            <strong style={{ color: '#000' }}>
              <a
                href={clicksHref}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
              >
                {clicksTotal} {clicksTotal === 1 ? 'click' : 'clicks'}
                <ArrowUpRight />
              </a>
            </strong>
            {' '}—a {Math.abs(deltaPct)}% {up ? 'increase' : 'decrease'} over the last 30 days.
          </span>
        ) : (
          <span>
            Connect{' '}
            <a href="/settings/google_search_console" style={{ color: '#000', textDecoration: 'underline', textUnderlineOffset: '0.05em' }}>
              Google Search Console
            </a>
            {' '}to start tracking your clicks.
          </span>
        )}
      </div>
    </div>
  );
};

export default DashboardGreeting;
