import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
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

   // ── styles (design.md tokens, inline) ───────────────────────────────────
   const column: React.CSSProperties = { width: 'min(656px, 100%)', display: 'flex', flexDirection: 'column', gap: 24 };
   const headingWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
   const h1: React.CSSProperties = { margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#18181B' };
   const subtitle: React.CSSProperties = { margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 400, color: '#3F3F47' };
   const listWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
   const buttonRow: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end' };
   const errStyle: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: '18px', color: '#FF6F77' };

   const primaryBtn = (disabled: boolean): React.CSSProperties => ({
      border: 'none', borderRadius: 8, padding: '10px 20px', background: '#18181B', color: '#FFFFFF',
      fontFamily: font, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'background 150ms ease', textDecoration: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
   });
   const setBtnBg = (e: React.MouseEvent<HTMLElement>, c: string) => { (e.currentTarget as HTMLElement).style.background = c; };

   const radioCard = (selected: boolean): React.CSSProperties => ({
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
      padding: 16, borderRadius: 12, background: '#FFFFFF', cursor: 'pointer',
      border: `1px solid ${selected ? '#18181B' : '#D4D4D8'}`,
      boxShadow: selected ? 'inset 0 0 0 1px #18181B' : 'none',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
      fontSize: 14, fontWeight: 500, color: '#18181B',
   });
   const radioRing = (selected: boolean): React.CSSProperties => ({
      width: 18, height: 18, borderRadius: 9999, flexShrink: 0, display: 'grid', placeItems: 'center',
      border: `2px solid ${selected ? '#18181B' : '#9F9FA9'}`, transition: 'border-color 150ms ease',
   });

   const renderBody = () => {
      if (!token || !siteUrl) {
         return (
            <div style={headingWrap}>
               <h1 style={h1}>Connect your WordPress site</h1>
               <p style={subtitle}>This page is opened from the Surfer plugin in your WordPress admin. We couldn’t find a connection token — start the connection again from WordPress (Surfer → Connect).</p>
            </div>
         );
      }

      if (!email) {
         return (
            <>
               <div style={headingWrap}>
                  <h1 style={h1}>Connect your WordPress site</h1>
                  <p style={subtitle}>Sign in to connect <span style={{ color: '#18181B', fontWeight: 500 }}>{siteUrl}</span> to your account.</p>
               </div>
               <div style={buttonRow}>
                  <a
                     href={`/auth/sign-in?next=${encodeURIComponent(router.asPath)}`}
                     style={primaryBtn(false)}
                     onMouseEnter={(e) => setBtnBg(e, '#783AFB')}
                     onMouseLeave={(e) => setBtnBg(e, '#18181B')}
                  >Sign in</a>
               </div>
            </>
         );
      }

      if (state === 'done') {
         return (
            <div style={headingWrap}>
               <h1 style={{ ...h1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                     <circle cx="12" cy="12" r="10" fill="#1AB25E" />
                     <path d="M7.5 12.5l3 3 6-6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  WordPress connected
               </h1>
               <p style={subtitle}><span style={{ color: '#18181B', fontWeight: 500 }}>{siteUrl}</span> is now connected. You can close this tab and return to WordPress.</p>
            </div>
         );
      }

      const busy = state === 'connecting';
      const disabled = busy || !workspaceId;
      return (
         <>
            <div style={headingWrap}>
               <h1 style={h1}>Hi {email}!</h1>
               <p style={subtitle}>Choose the workspace to connect your WordPress site ({siteUrl}) to:</p>
            </div>

            <div style={listWrap} role="radiogroup" aria-label="Workspace">
               {workspaces.map((w) => {
                  const selected = workspaceId === w.id;
                  return (
                     <label key={w.id} style={radioCard(selected)}>
                        <input
                           type="radio"
                           name="workspace"
                           checked={selected}
                           onChange={() => setWorkspaceId(w.id)}
                           style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        <span aria-hidden="true" style={radioRing(selected)}>
                           {selected && <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#18181B' }} />}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                     </label>
                  );
               })}
            </div>

            {state === 'error' && <p style={errStyle}>{errorMsg}</p>}

            <div style={buttonRow}>
               <button
                  type="button"
                  onClick={connect}
                  disabled={disabled}
                  style={primaryBtn(disabled)}
                  onMouseEnter={(e) => { if (!disabled) setBtnBg(e, '#783AFB'); }}
                  onMouseDown={(e) => { if (!disabled) setBtnBg(e, '#4D08B5'); }}
                  onMouseUp={(e) => { if (!disabled) setBtnBg(e, '#783AFB'); }}
                  onMouseLeave={(e) => setBtnBg(e, '#18181B')}
               >{busy ? 'Connecting…' : 'Connect'}</button>
            </div>
         </>
      );
   };

   return (
      <div className="p-sm relative flex flex-col overflow-hidden" style={{ minHeight: '100dvh', fontFamily: font }}>
         <Head><title>Connect WordPress — Surfer</title></Head>
         <div
            className="relative flex-1 overflow-auto rounded-xl [color-scheme:light] bg-white-base"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
         >
            <div style={column}>{renderBody()}</div>
         </div>
      </div>
   );
};

export default WordPressConnect;
