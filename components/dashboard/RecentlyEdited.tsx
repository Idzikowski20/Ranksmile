import React, { useEffect, useState } from 'react';
import Gauge from '../ui/Gauge';
import Skeleton from './Skeleton';
import { authClient } from '../../lib/auth/client';

export interface RecentlyEditedItem {
  id: string | number;
  title: string;
  keywords: string;
  score: number;
  updatedAt: string;
  href: string;
}

interface Props {
  items: RecentlyEditedItem[];
  loading?: boolean;
}

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DocIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[20px] text-gray-60">
    <path d="M14 2.26953V6.40007C14 6.96012 14 7.24015 14.109 7.45406C14.2049 7.64222 14.3578 7.7952 14.546 7.89108C14.7599 8.00007 15.0399 8.00007 15.6 8.00007H19.7305M16 13H8M16 17H8M10 9H8M14 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H15.2C16.8802 22 17.7202 22 18.362 21.673C18.9265 21.3854 19.3854 20.9265 19.673 20.362C20 19.7202 20 18.8802 20 17.2V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 13C5.5523 13 6 12.5523 6 12C6 11.4477 5.5523 11 5 11C4.4477 11 4 11.4477 4 12C4 12.5523 4.4477 13 5 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Compute relative time string. Call only after mount (SSR-safe). */
function relativeTime(isoStr: string): string {
  const t = new Date(isoStr).getTime();
  if (!t || Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  const hrs = Math.floor(diffMs / 3_600_000);
  if (hrs < 1) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return 'a day ago';
  return `${days} days ago`;
}

const Card = ({ item, userInitial }: { item: RecentlyEditedItem; userInitial: string }) => {
  // SSR-safe: start empty, fill after mount so server + first-client render match
  const [relTime, setRelTime] = useState('');
  useEffect(() => {
    setRelTime(relativeTime(item.updatedAt));
  }, [item.updatedAt]);

  return (
    <div className="border-gray-20 gap-lg p-base hover:border-gray-40 group relative flex cursor-pointer flex-col rounded-2xl border border-solid transition-[transform,box-shadow,border-color] duration-200 ease-out hover:translate-y-[-2px] hover:shadow-md">
      {/* Full-card link overlay */}
      <a
        href={item.href}
        aria-label={item.title}
        className="absolute inset-0 rounded-2xl"
        style={{ zIndex: 1 }}
      />
      {/* Top row: doc icon + score gauge */}
      <div className="flex items-center justify-between">
        <DocIcon />
        {/* Gauge: size="sm" renders the 40×40 ring (close to 36px visual weight) */}
        <Gauge score={item.score} size="sm" />
      </div>
      {/* Title + keywords */}
      <div className="gap-2xs flex flex-col">
        <span
          className="text-md font-semibold leading-snug text-gray-base"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {item.title}
        </span>
        {item.keywords && (
          <span
            className="text-sm text-gray-100"
            style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.keywords}
          </span>
        )}
      </div>
      {/* Footer: avatar + time + dots menu */}
      <div className="gap-xs mt-auto flex items-center">
        <div
          className="text-gray-160 bg-gray-10 inline-flex shrink-0 items-center justify-center rounded-full size-lg text-xs font-medium uppercase"
          aria-hidden="true"
        >
          {userInitial}
        </div>
        <span className="text-gray-60 text-sm">{relTime}</span>
        <button
          type="button"
          aria-label="More options"
          className="text-gray-60 hover:text-gray-100 ml-auto transition-colors duration-150"
          style={{ zIndex: 2, position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <DotsIcon />
        </button>
      </div>
    </div>
  );
};

const CardSkeleton = () => (
  <div className="border-gray-20 gap-lg p-base flex flex-col rounded-2xl border border-solid">
    <div className="flex items-center justify-between">
      <Skeleton width={20} height={20} radius={4} />
      <Skeleton width={36} height={36} radius={9999} />
    </div>
    <div className="flex flex-col" style={{ gap: 8 }}>
      <Skeleton width="90%" height={14} />
      <Skeleton width="55%" height={12} />
    </div>
    <div className="mt-auto flex items-center" style={{ gap: 8 }}>
      <Skeleton width={24} height={24} radius={9999} />
      <Skeleton width={64} height={12} />
    </div>
  </div>
);

const EmptyState = () => (
  <div
    className="border-gray-20 rounded-2xl border border-solid"
    style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: '#F4F4F5', color: '#9F9FA9' }}>
      <DocIcon />
    </span>
    <span className="text-md font-semibold" style={{ color: '#18181B' }}>No content yet</span>
    <span className="text-sm" style={{ color: '#52525C', maxWidth: 380, lineHeight: 1.5 }}>
      Articles you create or edit will show up here. Open the Content Editor to start writing.
    </span>
    <a
      href="/articles"
      style={{ marginTop: 4, padding: '8px 16px', borderRadius: 8, background: '#2F2F34', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'background 150ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
    >
      Open Content Editor
    </a>
  </div>
);

const RecentlyEdited = ({ items, loading }: Props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession?.();
  const name = mounted ? (session?.data?.user?.name ?? session?.data?.user?.email ?? '') : '';
  const userInitial = name ? name.charAt(0).toLowerCase() : '?';

  return (
    <div className="gap-base flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="gap-sm flex items-center" style={{ color: 'var(--gray-base)' }}>
          <ClockIcon />
          <span className="text-md font-semibold">Recently edited</span>
        </div>
      </div>
      {/* eslint-disable-next-line no-nested-ternary */}
      {loading ? (
        <div className="gap-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="gap-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} item={item} userInitial={userInitial} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentlyEdited;
