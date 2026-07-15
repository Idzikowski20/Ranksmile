import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import DomainFavicon from './DomainFavicon';

const font = 'var(--font-family-primary)';

const InboxIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M2.5 12H5.88197C6.56717 12 7.19357 12.3871 7.5 13C7.80643 13.6129 8.43283 14 9.11803 14H14.882C15.5672 14 16.1936 13.6129 16.5 13C16.8064 12.3871 17.4328 12 18.118 12H21.5M8.96656 4H15.0334C16.1103 4 16.6487 4 17.1241 4.16396C17.5445 4.30896 17.9274 4.5456 18.2451 4.85675C18.6043 5.2086 18.8451 5.6902 19.3267 6.65337L21.4932 10.9865C21.6822 11.3645 21.7767 11.5535 21.8434 11.7515C21.9026 11.9275 21.9453 12.1085 21.971 12.2923C22 12.4992 22 12.7105 22 13.1331V15.2C22 16.8802 22 17.7202 21.673 18.362C21.3854 18.9265 20.9265 19.3854 20.362 19.673C19.7202 20 18.8802 20 17.2 20H6.8C5.11984 20 4.27976 20 3.63803 19.673C3.07354 19.3854 2.6146 18.9265 2.32698 18.362C2 17.7202 2 16.8802 2 15.2V13.1331C2 12.7105 2 12.4992 2.02897 12.2923C2.05471 12.1085 2.09744 11.9275 2.15662 11.7515C2.22326 11.5535 2.31776 11.3645 2.50675 10.9865L4.67331 6.65337C5.1549 5.69019 5.3957 5.2086 5.75495 4.85675C6.07263 4.5456 6.45551 4.30896 6.87589 4.16396C7.35125 4 7.88969 4 8.96656 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FlameIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden="true" style={{ color: '#F97316' }}>
    <path fill="currentColor" fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
  </svg>
);

const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{ width: 36, height: 20, borderRadius: 9999, background: on ? '#F29964' : '#E4E4E7', position: 'relative', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, transition: 'background 150ms ease' }}
  >
    <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 9999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 150ms ease' }} />
  </button>
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

/** Notifications inbox: one card per domain with pending optimization recommendations. */
const TopbarInbox = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRead(loadRead());
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
        if (!cancelled) setNotifs(list);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = useMemo(() => notifs.filter((n) => !read.has(n.key)).length, [notifs, read]);
  const visible = unreadOnly ? notifs.filter((n) => !read.has(n.key)) : notifs;

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
          <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', borderRadius: 9999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center', fontFamily: font }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Inbox"
          style={{
            position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 200,
            width: 392, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 68px)',
            background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16,
            boxShadow: '0px 16px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'growOut 0.18s cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: 'top right', fontFamily: font,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#18181B' }}>Inbox</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Toggle on={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>Unread only</span>
              </div>
              <button type="button" aria-label="Mark all as read" title="Mark all as read" onClick={markAllRead}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#52525C', display: 'inline-flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 20px 56px' }}>
              <span style={{ color: '#18181B' }}><InboxIcon size={32} /></span>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#3F3F47' }}>
                {unreadOnly && notifs.length > 0 ? 'No unread notifications' : 'There are currently no notifications'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px', overflowY: 'auto' }} className="styled-scrollbar">
              {visible.map((n) => {
                const isRead = read.has(n.key);
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => openNotif(n)}
                    aria-label={`View recommendations for ${n.domain}`}
                    style={{
                      display: 'flex', gap: 10, textAlign: 'left', width: '100%', padding: 16,
                      borderRadius: 8, border: '1px solid #E4E4E7', cursor: 'pointer',
                      background: isRead ? '#fff' : '#F8F8F9', transition: 'background 150ms ease, border-color 150ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.borderColor = '#9F9FA9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isRead ? '#fff' : '#F8F8F9'; e.currentTarget.style.borderColor = '#E4E4E7'; }}
                  >
                    {/* favicon + flame */}
                    <div style={{ position: 'relative', width: 24, flexShrink: 0, paddingTop: 6 }}>
                      <DomainFavicon domain={n.domain} size={24} style={{ display: 'block' }} />
                      <span style={{ position: 'absolute', left: 12, top: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, minHeight: 16, borderRadius: 9999, background: '#F8F8F9' }}>
                        <FlameIcon />
                      </span>
                    </div>
                    {/* body */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: '#52525C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>New optimization recommendation</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.domain}</span>
                      </div>
                      <span style={{ fontSize: 14, color: '#18181B', lineHeight: '20px' }}>
                        You have {n.count} new recommendation{n.count > 1 ? 's' : ''} to optimize your content.
                      </span>
                      <span style={{ fontSize: 13, color: '#52525C' }}>{relTime(n.at)}</span>
                    </div>
                    {!isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F29964', flexShrink: 0, marginTop: 6 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopbarInbox;
