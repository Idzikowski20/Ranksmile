import React, { useEffect, useState } from 'react';
import { timeAgo } from '../../lib/formatDate';

type ClientTimeAgoProps = {
  date: string;
  title?: string;
  className?: string;
  fallback?: React.ReactNode;
};

/** Refresh cadence: every 30s under an hour old, then every 5 minutes. */
function refreshMs(date: string): number {
  const age = Math.abs(Date.now() - new Date(date).getTime());
  return age < 3600_000 ? 30_000 : 300_000;
}

const ClientTimeAgo = ({ date, title, className, fallback = '' }: ClientTimeAgoProps) => {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setText(timeAgo(date));
      timer = setTimeout(tick, refreshMs(date));
    };
    tick();
    return () => clearTimeout(timer);
  }, [date]);

  return (
    <span className={className} suppressHydrationWarning>
      {text === null ? fallback : <span title={title}>{text}</span>}
    </span>
  );
};

export default ClientTimeAgo;
