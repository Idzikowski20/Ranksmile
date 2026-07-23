import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import DomainFavicon from './DomainFavicon';

const InboxIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M2.5 12H5.88197C6.56717 12 7.19357 12.3871 7.5 13C7.80643 13.6129 8.43283 14 9.11803 14H14.882C15.5672 14 16.1936 13.6129 16.5 13C16.8064 12.3871 17.4328 12 18.118 12H21.5M8.96656 4H15.0334C16.1103 4 16.6487 4 17.1241 4.16396C17.5445 4.30896 17.9274 4.5456 18.2451 4.85675C18.6043 5.2086 18.8451 5.6902 19.3267 6.65337L21.4932 10.9865C21.6822 11.3645 21.7767 11.5535 21.8434 11.7515C21.9026 11.9275 21.9453 12.1085 21.971 12.2923C22 12.4992 22 12.7105 22 13.1331V15.2C22 16.8802 22 17.7202 21.673 18.362C21.3854 18.9265 20.9265 19.3854 20.362 19.673C19.7202 20 18.8802 20 17.2 20H6.8C5.11984 20 4.27976 20 3.63803 19.673C3.07354 19.3854 2.6146 18.9265 2.32698 18.362C2 17.7202 2 16.8802 2 15.2V13.1331C2 12.7105 2 12.4992 2.02897 12.2923C2.05471 12.1085 2.09744 11.9275 2.15662 11.7515C2.22326 11.5535 2.31776 11.3645 2.50675 10.9865L4.67331 6.65337C5.1549 5.69019 5.3957 5.2086 5.75495 4.85675C6.07263 4.5456 6.45551 4.30896 6.87589 4.16396C7.35125 4 7.88969 4 8.96656 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FlameIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden="true" style={{ color: '#F29964' }}>
    <path fill="currentColor" fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
  </svg>
);

type Notif = { key: string; domain: string; slug: string; count: number; at: string };

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

const READ_KEY = 'inbox_read';
const loadRead = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
};
const saveRead = (s: Set<string>) => { try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch { /* ignore */ } };

/** Notifications inbox: dark shell popper (same language as OrganizationSwitcher). */
const TopbarInbox = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // On AI Visibility pages skip mount-time /api/articles (15–30s) until the inbox opens.
  const onAiVis = typeof router.pathname === 'string' && router.pathname.includes('/ai-visibility');

  useEffect(() => {
    setRead(loadRead());
  }, []);

  useEffect(() => {
    if (loaded) return undefined;
    if (onAiVis && !open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [dRes, aRes] = await Promise.all([fetch('/api/domains'), fetch('/api/articles')]);
        const dJson = await dRes.json();
        const aJson = await aRes.json();
        const domains: DomainType[] = dJson?.domains || [];
        type InboxArticle = {
          domain_id: number;
          content_score?: number;
          source?: string;
          title?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        const articles: InboxArticle[] = aJson?.articles || [];
        const byDomain = new Map<number, { count: number; at: string }>();
        articles.forEach((a) => {
          const cs = a.content_score ?? 0;
          if (a.source === 'site_context' || !a.title || cs <= 0 || cs >= 70) return;
          const cur = byDomain.get(a.domain_id) || { count: 0, at: '' };
          cur.count += 1;
          const at = a.updated_at || a.created_at || '';
          if (at > cur.at) cur.at = at;
          byDomain.set(a.domain_id, cur);
        });
        const list: Notif[] = domains
          .filter((d) => byDomain.has(d.ID))
          .map((d) => {
            const info = byDomain.get(d.ID)!;
            return { key: `${d.slug}#${info.count}`, domain: d.domain, slug: d.slug, count: info.count, at: info.at };
          })
          .sort((a, b) => (b.at > a.at ? 1 : -1));
        if (!cancelled) {
          setNotifs(list);
          setLoaded(true);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, onAiVis, loaded]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = useMemo(() => notifs.filter((n) => !read.has(n.key)).length, [notifs, read]);
  const visible = unreadOnly ? notifs.filter((n) => !read.has(n.key)) : notifs;
  const metaLabel = unreadCount > 0
    ? `${unreadCount} unread`
    : `${notifs.length} ${notifs.length === 1 ? 'notification' : 'notifications'}`;

  const markRead = (key: string) => {
    setRead((prev) => { const next = new Set(prev); next.add(key); saveRead(next); return next; });
  };
  const markAllRead = () => {
    setRead((prev) => { const next = new Set(prev); notifs.forEach((n) => next.add(n.key)); saveRead(next); return next; });
  };
  const openNotif = (n: Notif) => { markRead(n.key); setOpen(false); router.push(`/sites/${n.slug}/recommendations`); };

  return (
    <div ref={ref} className="global-topbar-btnbar-item">
      <button
        type="button"
        aria-label="Toggle notifications inbox"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="sentry-nav-utilbtn global-topbar-inbox-btn"
      >
        <InboxIcon />
        {unreadCount > 0 && (
          <span className="sentry-inbox-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Inbox"
          className="sentry-org-dropdown sentry-inbox-dropdown motion-scale-in"
        >
          <div className="sentry-inbox-dropdown-header">
            <div className="sentry-inbox-dropdown-title-row">
              <span className="sentry-inbox-dropdown-icon" aria-hidden="true">
                <InboxIcon size={16} />
              </span>
              <div className="sentry-org-dropdown-meta-wrap">
                <span className="sentry-org-dropdown-name">Inbox</span>
                <span className="sentry-org-dropdown-meta">{metaLabel}</span>
              </div>
            </div>
            <div className="sentry-inbox-dropdown-actions">
              <button
                type="button"
                className="sentry-inbox-unread-label"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly((v) => !v)}
              >
                <span className={`sentry-inbox-toggle${unreadOnly ? ' is-on' : ''}`} aria-hidden="true">
                  <span className="sentry-inbox-toggle-knob" />
                </span>
                <span>Unread only</span>
              </button>
              <button
                type="button"
                aria-label="Mark all as read"
                title="Mark all as read"
                onClick={markAllRead}
                className="sentry-inbox-mark-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="sentry-inbox-empty">
              <span className="sentry-inbox-empty-icon" aria-hidden="true"><InboxIcon size={28} /></span>
              <span className="sentry-inbox-empty-text">
                {unreadOnly && notifs.length > 0 ? 'No unread notifications' : 'There are currently no notifications'}
              </span>
            </div>
          ) : (
            <ul className="sentry-org-dropdown-list sentry-inbox-list styled-scrollbar">
              {visible.map((n) => {
                const isRead = read.has(n.key);
                return (
                  <li key={n.key}>
                    <button
                      type="button"
                      onClick={() => openNotif(n)}
                      aria-label={`View recommendations for ${n.domain}`}
                      className={`sentry-inbox-item${isRead ? ' is-read' : ''}`}
                    >
                      <div className="sentry-inbox-item-leading">
                        <DomainFavicon domain={n.domain} size={20} className="sentry-inbox-favicon" />
                        <span className="sentry-inbox-flame"><FlameIcon /></span>
                      </div>
                      <div className="sentry-inbox-item-body">
                        <span className="sentry-inbox-item-eyebrow">New optimization recommendation</span>
                        <span className="sentry-inbox-item-domain">{n.domain}</span>
                        <span className="sentry-inbox-item-copy">
                          You have {n.count} new recommendation{n.count > 1 ? 's' : ''} to optimize your content.
                        </span>
                        <span className="sentry-inbox-item-time">{relTime(n.at)}</span>
                      </div>
                      {!isRead && <span className="sentry-inbox-item-dot" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TopbarInbox;
