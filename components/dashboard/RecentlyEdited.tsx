import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { Flex, Stack } from '../koala/core/layout';
import { Text } from '../koala/core/text';
import { Button, Gauge } from '../koala/core';
import { WidgetShell } from '../koala/product';
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

const Card = ({item, userInitial}: {item: RecentlyEditedItem; userInitial: string}) => {
  const [relTime, setRelTime] = useState('');
  useEffect(() => { setRelTime(relativeTime(item.updatedAt)); }, [item.updatedAt]);

  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/articles/${item.id}`, {method: 'DELETE'});
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Article deleted');
      queryClient.invalidateQueries('dashboardArticles');
    } catch {
      toast.error('Could not delete article');
      setDeleting(false);
    }
  };

  return (
    <Flex
      direction="column"
      gap="lg"
      padding="md"
      radius="2xl"
      border="md"
      className="group relative cursor-pointer border-gray-20 border-solid transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-40 hover:shadow-md"
    >
      <a href={item.href} aria-label={item.title} className="absolute inset-0 rounded-2xl z-[1]" />
      <Flex align="center" justify="between">
        <DocIcon />
        <Gauge score={item.score} size="sm" />
      </Flex>
      <Stack gap="2xs" className="min-w-0">
        <Text as="span" size="md" bold className="leading-snug text-gray-base line-clamp-2">
          {item.title}
        </Text>
        {item.keywords && (
          <Text as="span" size="sm" variant="muted" className="line-clamp-1">
            {item.keywords}
          </Text>
        )}
      </Stack>
      <Flex align="center" gap="xs" className="mt-auto">
        <Flex
          align="center"
          justify="center"
          className="size-lg shrink-0 rounded-full bg-gray-10 text-gray-160 text-xs font-medium uppercase"
        >
          {userInitial}
        </Flex>
        <Text size="sm" variant="muted">{relTime}</Text>
        <Flex className="ml-auto relative z-[2]" ref={menuRef}>
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={deleting}
            className="flex items-center rounded text-gray-60 transition-colors duration-150 hover:text-gray-100"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpen((v) => !v); }}
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <Flex
              direction="column"
              gap="xs"
              padding="xs"
              radius="lg"
              border="md"
              className="absolute right-0 top-[110%] z-[150] min-w-[160px] overflow-hidden bg-white shadow-md animate-[growOut_0.2s_cubic-bezier(0.16,1,0.3,1)]"
            >
              <a
                href={item.href}
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                className="flex w-full items-center gap-sm rounded-md px-2.5 py-2 text-sm text-gray-80 no-underline transition-colors hover:bg-gray-5"
              >
                Open in editor
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                className="flex w-full items-center gap-sm rounded-md px-2.5 py-2 text-sm text-danger border-none bg-transparent cursor-pointer transition-colors hover:bg-danger-muted"
              >
                Delete
              </button>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
};

const CardSkeleton = () => (
  <Flex direction="column" gap="lg" padding="md" radius="2xl" border="md" className="border-gray-20 border-solid">
    <Flex align="center" justify="between">
      <Skeleton width={20} height={20} radius={4} />
      <Skeleton width={36} height={36} radius={9999} />
    </Flex>
    <Flex direction="column" gap="md">
      <Skeleton width="90%" height={14} />
      <Skeleton width="55%" height={12} />
    </Flex>
    <Flex align="center" gap="sm" className="mt-auto">
      <Skeleton width={24} height={24} radius={9999} />
      <Skeleton width={64} height={12} />
    </Flex>
  </Flex>
);

const EmptyState = () => {
  const router = useRouter();
  return (
  <Flex
    direction="column"
    align="center"
    gap="md"
    paddingTop="3xl"
    paddingRight="2xl"
    paddingBottom="3xl"
    paddingLeft="2xl"
    radius="2xl"
    border="md"
    className="border-gray-20 border-solid text-center"
  >
    <Flex
      align="center"
      justify="center"
      className="size-12 rounded-xl bg-gray-5 text-gray-80"
    >
      <DocIcon />
    </Flex>
    <Text size="md" bold>No content yet</Text>
    <Text as="p" size="sm" variant="muted" className="max-w-[380px] leading-relaxed">
      Articles you create or edit will show up here. Open the Content Editor to start writing.
    </Text>
    <Button variant="primary" className="mt-1" onClick={() => router.push('/articles')}>
      Open Content Editor
    </Button>
  </Flex>
  );
};

const RecentlyEdited = ({items, loading}: Props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession?.();
  const name = mounted ? (session?.data?.user?.name ?? session?.data?.user?.email ?? '') : '';
  const userInitial = name ? name.charAt(0).toLowerCase() : '?';

  return (
    <WidgetShell title="Recently edited">
      {loading ? (
        <div className="recently-edited-grid">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="recently-edited-grid">
          {items.map((item) => (
            <Card key={item.id} item={item} userInitial={userInitial} />
          ))}
        </div>
      )}
    </WidgetShell>
  );
};

export default RecentlyEdited;
