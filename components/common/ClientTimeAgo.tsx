import React, { useEffect, useState } from 'react';
import { timeAgo } from '../../lib/formatDate';

type ClientTimeAgoProps = {
  date: string;
  title?: string;
  className?: string;
  fallback?: React.ReactNode;
};

const ClientTimeAgo = ({ date, title, className, fallback = '' }: ClientTimeAgoProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {mounted ? <span title={title}>{timeAgo(date)}</span> : fallback}
    </span>
  );
};

export default ClientTimeAgo;
