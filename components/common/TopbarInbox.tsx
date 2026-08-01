import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import styled from '@emotion/styled';
import DomainFavicon from './DomainFavicon';
import { useInbox, useMarkInboxRead } from '../../services/inbox';
import { MenuList } from '../koala/core/menuList';
import MenuListItem from '../koala/core/menuListItem';
import { SegmentedControl } from '../koala/core/segmentedControl';
import { Icon } from '../koala/icons/Icon';
import { EmptyState } from '../koala/feedback';
import { semantic } from '../koala/tokens/semantic';
import { spacing } from '../koala/tokens/spacing';
import { textScale, fontWeight } from '../koala/tokens/typography';

type InboxTab = 'all' | 'unread';

const TriggerBtn = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: ${semantic.text.secondary};
  cursor: pointer;
  &:hover {
    background: ${semantic.background.secondary};
    color: ${semantic.text.primary};
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: ${semantic.text.brand};
  color: #fff;
  font-size: 10px;
  font-weight: ${fontWeight.bold};
  line-height: 16px;
  text-align: center;
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 400;
  width: min(360px, calc(100vw - 24px));
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm};
`;

const MarkAllBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: ${semantic.text.secondary};
  cursor: pointer;
  &:hover {
    background: ${semantic.background.secondary};
    color: ${semantic.text.primary};
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  flex-shrink: 0;
`;

const ItemBtn = styled.button<{ $read: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${spacing.md};
  width: 100%;
  padding: ${spacing.md};
  border: none;
  border-radius: 10px;
  background: ${(p) => (p.$read ? 'transparent' : semantic.background.secondary)};
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  &:hover {
    background: ${semantic.background.secondary};
  }
`;

const ItemBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ItemTitle = styled.span`
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const ItemMeta = styled.span`
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.secondary};
`;

const ItemCopy = styled.span`
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UnreadDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${semantic.text.brand};
  flex-shrink: 0;
  margin-top: 6px;
`;

const relTime = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
};

/** Notifications inbox — Koala MenuList + tabs. */
const TopbarInbox = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>('all');
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useInbox({ enabled: true });
  const markRead = useMarkInboxRead();

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const visibleItems = useMemo(
    () => (tab === 'unread' ? items.filter((n) => !n.isRead) : items),
    [items, tab],
  );

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openNotif = (eventId: string, href: string) => {
    markRead.mutate({ eventIds: [eventId] });
    setOpen(false);
    void router.push(href);
  };

  const markAllRead = () => {
    markRead.mutate({ all: true });
  };

  return (
    <div ref={ref} className="global-topbar-btnbar-item" style={{ position: 'relative' }}>
      <TriggerBtn
        type="button"
        aria-label="Toggle notifications inbox"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="Bell" size={20} weight="bold" />
        {unreadCount > 0 ? <Badge>{unreadCount > 99 ? '99+' : unreadCount}</Badge> : null}
      </TriggerBtn>

      {open ? (
        <Panel>
          <MenuList
            header={(
              <HeaderRow>
                <span>Inbox</span>
                <HeaderActions>
                  <SegmentedControl
                    name="inbox-tab"
                    size="sm"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'unread', label: 'Unread' },
                    ]}
                  />
                  {unreadCount > 0 ? (
                    <MarkAllBtn type="button" aria-label="Mark all as read" title="Mark all as read" onClick={markAllRead}>
                      <Icon name="Checks" size={16} weight="bold" />
                    </MarkAllBtn>
                  ) : null}
                </HeaderActions>
              </HeaderRow>
            )}
            footer={null}
          >
            {isLoading ? (
              <EmptyState title="Loading…" description="Fetching your notifications." />
            ) : visibleItems.length === 0 ? (
              <EmptyState
                icon={<Icon name="Tray" size={28} weight="bold" />}
                title="No notifications"
                description={tab === 'unread' ? 'You have read everything.' : 'There are currently no notifications.'}
              />
            ) : (
              // TODO: virtual list when items > ~100–500
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleItems.map((n) => (
                  <li key={n.eventId}>
                    <ItemBtn
                      type="button"
                      $read={n.isRead}
                      onClick={() => openNotif(n.eventId, n.href)}
                      aria-label={`View recommendations for ${n.domain}`}
                    >
                      <DomainFavicon domain={n.domain} size={20} />
                      <ItemBody>
                        <ItemTitle>{n.title}</ItemTitle>
                        <ItemMeta>{n.domain}</ItemMeta>
                        <ItemCopy>{n.body}</ItemCopy>
                        <ItemMeta>{relTime(n.at)}</ItemMeta>
                      </ItemBody>
                      {!n.isRead ? <UnreadDot aria-hidden="true" /> : null}
                    </ItemBtn>
                  </li>
                ))}
              </ul>
            )}
          </MenuList>
        </Panel>
      ) : null}
    </div>
  );
};

export default TopbarInbox;
