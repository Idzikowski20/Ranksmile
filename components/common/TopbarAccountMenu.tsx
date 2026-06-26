import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Icon from './Icon';
import { authClient } from '../../lib/auth/client';
import { useOrganization } from '../../services/organization';

type GscAccountSummary = {
   picture: string;
   email: string;
};

const font = 'var(--font-family-primary)';

/** Organization avatar: the uploaded logo, or the first letter of its name. */
const OrgBadge = ({ size, logo, initial }: { size: number; logo: string; initial: string }) => (
   <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: 6, background: '#E1DBFE', color: '#09090B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0, overflow: 'hidden', textTransform: 'uppercase' }}
   >
      {logo ? <img alt="" src={logo} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} /> : initial}
   </span>
);

const CheckIcon = () => (
   <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
   </svg>
);

const MenuItem = ({ icon, label, onClick, href }: { icon?: React.ReactNode; label: string; onClick?: () => void; href?: string }) => {
   const [hover, setHover] = useState(false);
   const style: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
      padding: '8px 12px', borderRadius: 6, cursor: 'pointer', color: '#2F2F34',
      fontFamily: font, fontSize: 14, fontWeight: 500, textDecoration: 'none', textAlign: 'left',
      background: hover ? '#F8F8F9' : 'transparent', border: 'none', transition: 'background 120ms ease',
   };
   const inner = (<>{icon}<span>{label}</span></>);
   if (href) {
      return (
         <a href={href} role="menuitem" style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{inner}</a>
      );
   }
   return (
      <button type="button" role="menuitem" style={style} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{inner}</button>
   );
};

const TopbarAccountMenu = () => {
   const router = useRouter();
   const [mounted, setMounted] = useState(false);
   const [open, setOpen] = useState(false);
   const [imgError, setImgError] = useState(false);
   const [profileHover, setProfileHover] = useState(false);
   const [orgHover, setOrgHover] = useState(false);
   const [gscAccount, setGscAccount] = useState<GscAccountSummary | null>(null);
   const ref = useRef<HTMLDivElement | null>(null);
   const session = authClient.useSession?.();
   const { data: org } = useOrganization();
   const orgName = org?.name || 'Organization';
   const orgInitial = (org?.name || '').charAt(0).toUpperCase() || 'O';
   const orgLogo = org?.logoUrl || '';
   const email = mounted ? (session?.data?.user?.email ?? '') : '';
   const name = mounted ? (session?.data?.user?.name ?? email) : '';
   const initials = name ? name.charAt(0).toUpperCase() : '?';
   const accountPicture = gscAccount?.picture || '';
   const accountLabel = gscAccount?.email || email;
   const accountInitials = accountLabel ? accountLabel.charAt(0).toUpperCase() : initials;

   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (!mounted) return undefined;
      const onPointerDown = (event: MouseEvent) => {
         if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onPointerDown);
      return () => document.removeEventListener('mousedown', onPointerDown);
   }, [mounted]);

   useEffect(() => {
      if (!mounted) return undefined;
      let alive = true;
      const loadGoogleAccount = async () => {
         try {
            const response = await fetch('/api/gsc/accounts', { credentials: 'include' });
            if (!response.ok) return;
            const data = await response.json();
            const firstAccount = data?.accounts?.[0];
            if (alive && firstAccount) {
               setGscAccount({
                  picture: firstAccount.picture || '',
                  email: firstAccount.email || '',
               });
            }
         } catch {
            // fall back to Neon Auth initials
         }
      };

      loadGoogleAccount();
      return () => {
         alive = false;
      };
   }, [mounted]);

   return (
      <div className="topbar-account" ref={ref}>
         <button
            type="button"
            className="topbar-avatar-trigger"
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
         >
            <span
               aria-hidden="true"
               style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 2, paddingLeft: 8, background: '#18181B', borderRadius: 9999 }}
            >
               <OrgBadge size={20} logo={orgLogo} initial={orgInitial} />
               <span className="topbar-avatar topbar-avatar-large topbar-avatar-trigger-photo">
                  {accountPicture && !imgError ? (
                     <img
                        alt=""
                        src={accountPicture}
                        className="topbar-avatar-image"
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                     />
                  ) : (
                     <span>{accountInitials}</span>
                  )}
               </span>
            </span>
         </button>

         {open && (
            <div className="topbar-account-menu motion-scale-in" role="menu" style={{ width: 320, borderRadius: 12, padding: 4, transformOrigin: 'top right' }}>
               {/* Account / email */}
               <a
                  href="/settings/profile"
                  role="menuitem"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 6, textDecoration: 'none', background: profileHover ? '#F8F8F9' : 'transparent', transition: 'background 120ms ease' }}
                  onMouseEnter={() => setProfileHover(true)}
                  onMouseLeave={() => setProfileHover(false)}
               >
                  <span className="topbar-avatar topbar-avatar-large topbar-avatar-trigger-photo" aria-hidden="true">
                     {accountPicture && !imgError ? (
                        <img
                           alt=""
                           src={accountPicture}
                           className="topbar-avatar-image"
                           referrerPolicy="no-referrer"
                           onError={() => setImgError(true)}
                        />
                     ) : (
                        <span>{accountInitials}</span>
                     )}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                     <span style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accountLabel}</span>
                  </div>
               </a>

               <div style={{ height: 1, background: '#F4F4F5', margin: '4px -4px' }} />

               <MenuItem icon={<Icon type="settings-alt" size={20} />} label="Settings" onClick={() => router.push('/settings')} />

               <div style={{ padding: '12px 12px 4px', fontFamily: font, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#18181B' }}>
                  Organization
               </div>

               <div
                  role="menuitem"
                  aria-selected="true"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#2F2F34', background: orgHover ? '#F8F8F9' : 'transparent', transition: 'background 120ms ease' }}
                  onMouseEnter={() => setOrgHover(true)}
                  onMouseLeave={() => setOrgHover(false)}
               >
                  <OrgBadge size={24} logo={orgLogo} initial={orgInitial} />
                  <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName}</span>
                  <span style={{ marginLeft: 'auto', color: '#18181B', display: 'inline-flex' }}><CheckIcon /></span>
               </div>

               <div style={{ height: 1, background: '#F4F4F5', margin: '4px -4px' }} />

               <MenuItem
                  icon={<Icon type="logout" size={20} />}
                  label="Log out"
                  onClick={async () => {
                     await authClient.signOut();
                     window.location.href = '/auth/sign-in';
                  }}
               />
            </div>
         )}
      </div>
   );
};

export default TopbarAccountMenu;
