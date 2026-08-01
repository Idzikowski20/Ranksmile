import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from 'react-query';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId } from '../../lib/activeWorkspace';

const font = 'var(--font-family-primary)';

export type WpConnection = { id: number; site_url: string; org_name: string | null; integrated_by_email: string | null; created_at: string };

/** "a few seconds ago" / "3 minutes ago" / "2 days ago". */
const relTime = (iso: string): string => {
   const then = new Date(iso.includes('T') || iso.includes('Z') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
   if (Number.isNaN(then)) return '';
   const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
   if (s < 45) return 'a few seconds ago';
   const m = Math.floor(s / 60);
   if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
   const h = Math.floor(m / 60);
   if (h < 24) return `${h === 1 ? 'an' : h} hour${h === 1 ? '' : 's'} ago`;
   const d = Math.floor(h / 24);
   return `${d} day${d === 1 ? '' : 's'} ago`;
};

const GlobeIcon = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke="#718096" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="#718096" strokeWidth="1.6" strokeLinecap="round" />
   </svg>
);
const KebabIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6.75a.75.75 0 1 1 0-1.5a.75.75 0 0 1 0 1.5m0 6a.75.75 0 1 1 0-1.5a.75.75 0 0 1 0 1.5m0 6a.75.75 0 1 1 0-1.5a.75.75 0 0 1 0 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const PlugIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7V4m6 3V4M7.5 7h9v3a4.5 4.5 0 0 1-9 0V7ZM12 14.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

type Props = {
   /** Rendered when the workspace has no WordPress connections. */
   emptyState?: React.ReactNode;
};

/** The "Accounts connected" table (domain / integrated / integrated-by + disconnect),
 *  shared by the WordPress Integration page and the WordPress settings panel. */
const WpConnectionsTable = ({ emptyState }: Props) => {
   const router = useRouter();
   const queryClient = useQueryClient();
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);
   const { data: wsData } = useWorkspaces();
   const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);

   const [menuFor, setMenuFor] = useState<number | null>(null);
   const [busyId, setBusyId] = useState<number | null>(null);

   const { data, isLoading } = useQuery(
      ['wpConnections', activeWsId],
      async () => {
         const res = await fetch(`/api/wordpress/connections?workspaceId=${activeWsId}`);
         if (!res.ok) throw new Error('Failed to load connections');
         return res.json() as Promise<{ connections: WpConnection[] }>;
      },
      { enabled: !!activeWsId },
   );
   const connections = data?.connections || [];

   const disconnect = async (id: number) => {
      setMenuFor(null);
      setBusyId(id);
      try {
         const res = await fetch('/api/wordpress/connections', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, workspaceId: activeWsId }) });
         if (!res.ok) throw new Error();
         await queryClient.invalidateQueries(['wpConnections', activeWsId]);
         toast.success('Account disconnected.');
      } catch {
         toast.error('Could not disconnect. Please try again.');
      } finally {
         setBusyId(null);
      }
   };

   const th: React.CSSProperties = {
      textAlign: 'left', padding: 16, fontSize: 14, fontWeight: 500, color: 'var(--koala-text-secondary, #575757)',
      textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #F4F4F5', whiteSpace: 'nowrap' };
   const td: React.CSSProperties = { padding: 16, fontSize: 14, color: '#18181B', verticalAlign: 'middle' };
   const kebabBtn: React.CSSProperties = {
      border: 'none', background: '#F4F4F5', color: '#18181B', borderRadius: 8, padding: 8, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms ease' };
   const skeleton: React.CSSProperties = { height: 14, borderRadius: 6, background: '#F4F4F5' };

   if (!isLoading && connections.length === 0) {
      return <>{emptyState ?? null}</>;
   }

   return (
      <div style={{ overflowX: 'auto', fontFamily: font }}>
         <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font }}>
            <thead>
               <tr>
                  <th style={{ ...th, width: '45%' }}>Domain name</th>
                  <th style={th}>Integrated</th>
                  <th style={th}>Integrated by</th>
                  <th style={{ ...th, width: 50 }} aria-label="Actions" />
               </tr>
            </thead>
            <tbody>
               {isLoading ? (
                  [0, 1].map((i) => (
                     <tr key={i}>
                        <td style={td}><div style={{ ...skeleton, width: '60%' }} /></td>
                        <td style={td}><div style={{ ...skeleton, width: 90 }} /></td>
                        <td style={td}><div style={{ ...skeleton, width: 140 }} /></td>
                        <td style={td} />
                     </tr>
                  ))
               ) : (
                  connections.map((c) => (
                     <tr key={c.id} style={{ opacity: busyId === c.id ? 0.5 : 1 }}>
                        <td style={td}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <GlobeIcon />
                              <span style={{ fontWeight: 500, color: '#2F2F34', wordBreak: 'break-all' }}>{c.site_url}</span>
                           </div>
                        </td>
                        <td style={td}>{relTime(c.created_at)}</td>
                        <td style={td}>{c.integrated_by_email || c.org_name || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', position: 'relative' }}>
                           <button
                              type="button"
                              aria-label="Actions"
                              aria-haspopup="menu"
                              aria-expanded={menuFor === c.id}
                              disabled={busyId === c.id}
                              style={kebabBtn}
                              onClick={() => setMenuFor((v) => (v === c.id ? null : c.id))}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                           >
                              <KebabIcon />
                           </button>

                           {menuFor === c.id && (
                              <>
                                 <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
                                 <div
                                    role="menu"
                                    style={{
                                       position: 'absolute', top: 'calc(100% + 4px)', right: 16, zIndex: 150, minWidth: 200,
                                       background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 12, padding: 6,
                                       boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)',
                                       animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: 'top right' }}
                                 >
                                    <button
                                       type="button"
                                       role="menuitem"
                                       onClick={() => disconnect(c.id)}
                                       style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 12px', fontFamily: font, fontSize: 14, fontWeight: 500, color: '#18181B', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms ease' }}
                                       onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                                       onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                    >
                                       <PlugIcon />
                                       Disconnect account
                                    </button>
                                 </div>
                              </>
                           )}
                        </td>
                     </tr>
                  ))
               )}
            </tbody>
         </table>
      </div>
   );
};

export default WpConnectionsTable;
