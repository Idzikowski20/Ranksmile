import React, { useEffect, useRef, useState } from 'react';

const font = 'var(--font-family-primary)';

const InboxIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M2.5 12H5.88197C6.56717 12 7.19357 12.3871 7.5 13C7.80643 13.6129 8.43283 14 9.11803 14H14.882C15.5672 14 16.1936 13.6129 16.5 13C16.8064 12.3871 17.4328 12 18.118 12H21.5M8.96656 4H15.0334C16.1103 4 16.6487 4 17.1241 4.16396C17.5445 4.30896 17.9274 4.5456 18.2451 4.85675C18.6043 5.2086 18.8451 5.6902 19.3267 6.65337L21.4932 10.9865C21.6822 11.3645 21.7767 11.5535 21.8434 11.7515C21.9026 11.9275 21.9453 12.1085 21.971 12.2923C22 12.4992 22 12.7105 22 13.1331V15.2C22 16.8802 22 17.7202 21.673 18.362C21.3854 18.9265 20.9265 19.3854 20.362 19.673C19.7202 20 18.8802 20 17.2 20H6.8C5.11984 20 4.27976 20 3.63803 19.673C3.07354 19.3854 2.6146 18.9265 2.32698 18.362C2 17.7202 2 16.8802 2 15.2V13.1331C2 12.7105 2 12.4992 2.02897 12.2923C2.05471 12.1085 2.09744 11.9275 2.15662 11.7515C2.22326 11.5535 2.31776 11.3645 2.50675 10.9865L4.67331 6.65337C5.1549 5.69019 5.3957 5.2086 5.75495 4.85675C6.07263 4.5456 6.45551 4.30896 6.87589 4.16396C7.35125 4 7.88969 4 8.96656 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{ width: 36, height: 20, borderRadius: 9999, background: on ? '#783AFB' : '#E4E4E7', position: 'relative', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, transition: 'background 150ms ease' }}
  >
    <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 9999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 150ms ease' }} />
  </button>
);

/** Notifications inbox button + dropdown (mockup, empty state). */
const TopbarInbox = () => {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        aria-label="Toggle notifications inbox"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#9F9FA9', opacity: hover ? 0.8 : 1, transition: 'opacity 150ms ease' }}
      >
        <InboxIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Inbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            zIndex: 200,
            width: 380,
            maxWidth: 'calc(100vw - 24px)',
            background: '#fff',
            border: '1px solid #E4E4E7',
            borderRadius: 16,
            boxShadow: '0px 16px 40px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            animation: 'growOut 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top right',
            fontFamily: font,
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
              <button type="button" aria-label="More" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#52525C', display: 'inline-flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              </button>
            </div>
          </div>

          {/* Empty state */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 20px 56px' }}>
            <span style={{ color: '#18181B' }}><InboxIcon size={32} /></span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#3F3F47' }}>There are currently no notifications</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopbarInbox;
