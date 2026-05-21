import React, { useEffect, useState } from 'react';
import TimeAgo from 'react-timeago';

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
      {mounted ? <TimeAgo title={title} date={date} /> : fallback}
    </span>
  );
};

export default ClientTimeAgo;
