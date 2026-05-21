import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Icon from './Icon';

type Props = {
   email?: string;
   initials?: string;
};

const TopbarAccountMenu = ({ email = 'boski.idzikowski@gmail.com', initials = 'B' }: Props) => {
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement | null>(null);

   useEffect(() => {
      const onPointerDown = (event: MouseEvent) => {
         if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onPointerDown);
      return () => document.removeEventListener('mousedown', onPointerDown);
   }, []);

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
            <span className="topbar-avatar topbar-avatar-small">{initials}</span>
            <span className="topbar-avatar topbar-avatar-large">{initials}</span>
         </button>
         {open && (
            <div className="topbar-account-menu" role="menu">
               <div className="topbar-account-row">
                  <span className="topbar-avatar topbar-avatar-large">{initials}</span>
                  <span className="topbar-account-email">{email}</span>
               </div>
               <button type="button" role="menuitem" className="topbar-account-item" onClick={() => router.push('/settings')}>
                  <Icon type="settings-alt" size={20} />
                  Settings
               </button>
               <div className="topbar-account-section-label">Organization</div>
               <div className="topbar-account-org">
                  <span className="topbar-avatar topbar-avatar-small">{initials}</span>
                  <span>Your Organization</span>
                  <span className="topbar-account-check">✓</span>
               </div>
               <button
                  type="button"
                  role="menuitem"
                  className="topbar-account-item"
                  onClick={() => { window.location.href = '/api/auth/logout'; }}
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
