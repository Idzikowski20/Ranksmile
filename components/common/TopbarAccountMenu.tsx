import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Icon from './Icon';
import { authClient } from '../../lib/auth/client';

type GscAccountSummary = {
   picture: string;
   email: string;
};

const TopbarAccountMenu = () => {
   const router = useRouter();
   const [mounted, setMounted] = useState(false);
   const [open, setOpen] = useState(false);
   const [gscAccount, setGscAccount] = useState<GscAccountSummary | null>(null);
   const ref = useRef<HTMLDivElement | null>(null);
   const session = authClient.useSession?.();
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
            <span className="topbar-avatar topbar-avatar-large topbar-avatar-trigger-photo" aria-hidden="true">
               {accountPicture ? (
                  <img
                     alt=""
                     src={accountPicture}
                     className="topbar-avatar-image"
                     onError={(event) => {
                        event.currentTarget.style.display = 'none';
                     }}
                  />
               ) : (
                  <span>{accountInitials}</span>
               )}
            </span>
         </button>

         {open && (
            <div className="topbar-account-menu" role="menu">
               <div className="topbar-account-row">
                  <span className="topbar-avatar topbar-avatar-large topbar-avatar-trigger-photo" aria-hidden="true">
                     {accountPicture ? (
                        <img
                           alt=""
                           src={accountPicture}
                           className="topbar-avatar-image"
                           onError={(event) => {
                              event.currentTarget.style.display = 'none';
                           }}
                        />
                     ) : (
                        <span>{accountInitials}</span>
                     )}
                  </span>
                  <div className="topbar-account-meta">
                     <span className="topbar-account-email">{accountLabel}</span>
                     <span className="topbar-account-subtext">{gscAccount?.email ? 'Google account connected' : 'Signed in with Neon Auth'}</span>
                  </div>
               </div>

               <button type="button" role="menuitem" className="topbar-account-item" onClick={() => router.push('/settings')}>
                  <Icon type="settings-alt" size={20} />
                  Settings
               </button>

               <button
                  type="button"
                  role="menuitem"
                  className="topbar-account-item"
                  onClick={async () => {
                     await authClient.signOut();
                     window.location.href = '/auth/sign-in';
                  }}
               >
                  <Icon type="logout" size={20} />
                  Log out
               </button>
            </div>
         )}
      </div>
   );
};

export default TopbarAccountMenu;
