import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { authClient } from '../../lib/auth/client';
import { useWorkspaces } from '../../services/workspaces';
import { useOrganization } from '../../services/organization';

const font = 'var(--font-family-primary)';

/** Landing the WP plugin opens (?token=&url=) to authorise a WordPress connection. */
const WordPressConnect: NextPage = () => {
   const router = useRouter();
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   const session = authClient.useSession?.();
   const email = mounted ? (session?.data?.user?.email ?? '') : '';
   const { data: wsData } = useWorkspaces();
   const { data: org } = useOrganization();

   const token = mounted ? (router.query.token as string | undefined) : undefined;
   const siteUrl = mounted ? (router.query.url as string | undefined) : undefined;

   const workspaces = wsData?.workspaces || [];
   const [workspaceId, setWorkspaceId] = useState<number | null>(null);
   useEffect(() => {
      if (workspaceId == null && workspaces.length) setWorkspaceId(wsData?.activeId ?? workspaces[0].id);
   }, [workspaces, wsData, workspaceId]);

   const [state, setState] = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');
   const [errorMsg, setErrorMsg] = useState('');

   const host = useMemo(() => {
      try { return siteUrl ? new URL(siteUrl).host : ''; } catch { return siteUrl || ''; }
   }, [siteUrl]);

   const connect = async () => {
      if (!token || !siteUrl || !workspaceId) return;
      setState('connecting');
      setErrorMsg('');
      try {
         const res = await fetch('/api/wordpress/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, siteUrl, workspaceId, orgName: org?.name || '' }),
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok || !data?.connected) { setErrorMsg(data?.error || 'Connection failed.'); setState('error'); return; }
         setState('done');
      } catch {
         setErrorMsg('Connection failed.'); setState('error');
      }
   };

   const card: React.CSSProperties = {
      width: 'min(460px, 100%)', background: '#fff', border: '1px solid #F4F4F5', borderRadius: 16,
      padding: 28, boxShadow: '0 18px 48px rgba(17,24,39,0.10)', fontFamily: font,
   };
   const btn = (disabled: boolean): React.CSSProperties => ({
      width: '100%', height: 44, borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: '#18181B', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: font, opacity: disabled ? 0.5 : 1,
      transition: 'background 150ms ease',
   });

   const notReady = !token || !siteUrl;

   return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f8f9ff', padding: 16 }}>
         <Head><title>Connect WordPress — Surfer</title></Head>
         <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
               <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: '#783AFB', display: 'grid', placeItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
               </span>
               <span style={{ fontSize: 18, fontWeight: 700, color: '#18181B' }}>Connect WordPress</span>
            </div>

            {notReady ? (
               <p style={{ fontSize: 14, color: '#52525C', lineHeight: 1.6 }}>This page is opened from the WordPress plugin. Missing connection token — start the connection from your WordPress admin (Surfer → Connect).</p>
            ) : !email ? (
               <>
                  <p style={{ fontSize: 14, color: '#52525C', lineHeight: 1.6, marginBottom: 16 }}>Sign in to authorise connecting <strong style={{ color: '#18181B' }}>{host}</strong>.</p>
                  <a href={`/auth/sign-in?next=${encodeURIComponent(router.asPath)}`} style={{ ...btn(false), display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Sign in</a>
               </>
            ) : state === 'done' ? (
               <div style={{ fontSize: 14, color: '#18181B', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 8 }}>✅ <strong>{host}</strong> is connected.</p>
                  <p style={{ color: '#52525C' }}>You can close this tab and return to WordPress.</p>
               </div>
            ) : (
               <>
                  <p style={{ fontSize: 14, color: '#52525C', lineHeight: 1.6, marginBottom: 16 }}>
                     Connect <strong style={{ color: '#18181B' }}>{host}</strong> to your account ({email}). The plugin will be able to import and publish content for the selected workspace.
                  </p>

                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#18181B', marginBottom: 6 }}>Workspace</label>
                  <select
                     value={workspaceId ?? ''}
                     onChange={(e) => setWorkspaceId(Number(e.target.value))}
                     style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #D4D4D8', fontFamily: font, fontSize: 14, color: '#18181B', background: '#fff', marginBottom: 18 }}
                  >
                     {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>

                  {state === 'error' && <p style={{ fontSize: 13, color: '#FF6F77', marginBottom: 12 }}>{errorMsg}</p>}

                  <button
                     type="button"
                     onClick={connect}
                     disabled={state === 'connecting' || !workspaceId}
                     style={btn(state === 'connecting' || !workspaceId)}
                     onMouseEnter={(e) => { if (state !== 'connecting' && workspaceId) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
                     onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#18181B'; }}
                  >
                     {state === 'connecting' ? 'Connecting…' : 'Connect'}
                  </button>
               </>
            )}
         </div>
      </div>
   );
};

export default WordPressConnect;
