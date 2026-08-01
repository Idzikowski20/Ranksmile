import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Icon from './Icon';
import { authClient } from '../../lib/auth/client';
import { useOrganization } from '../../services/organization';
import { useGscAccount } from '../../services/gscAccount';
import { useProfile } from '../../services/profile';
import { Avatar } from '../koala/core/avatar';
import MenuListItem from '../koala/core/menuListItem';

const font = 'var(--font-family-primary)';

const OrgBadge = ({ size, logo, initial }: { size: number; logo: string; initial: string }) => (
   <Avatar src={logo || undefined} initials={initial} size={size} variant="secondary" />
);

const CheckIcon = () => (
   <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
   </svg>
);

const MenuItem = ({ icon, label, onClick, href }: { icon?: React.ReactNode; label: string; onClick?: () => void; href?: string }) => (
   <MenuListItem
      label={label}
      leadingItems={icon}
      onClick={onClick}
      as={href ? 'a' : 'button'}
      href={href}
      style={{ width: '100%', borderRadius: 6 }}
   />
);

const TopbarAccountMenu = () => {
   const router = useRouter();
   const [mounted, setMounted] = useState(false);
   const [open, setOpen] = useState(false);
   const [orgHover, setOrgHover] = useState(false);
   const ref = useRef<HTMLDivElement | null>(null);
   const session = authClient.useSession?.();
   const { data: gscAccount } = useGscAccount();
   const { data: profile } = useProfile();
   const { data: org } = useOrganization();
   const orgName = org?.name || 'Organization';
   const orgInitial = (org?.name || '').charAt(0).toUpperCase() || 'O';
   const orgLogo = org?.logoUrl || '';
   const email = mounted ? (session?.data?.user?.email ?? '') : '';
   const displayName = mounted ? (profile?.name || session?.data?.user?.name || '') : '';
   const accountPicture = (profile?.avatarUrl || gscAccount?.picture) || '';
   const accountInitials = (displayName || email || '?').charAt(0).toUpperCase();

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
               className="topbar-avatar-trigger-photo"
            >
               <Avatar src={accountPicture || undefined} initials={accountInitials} size={32} variant="primary" />
            </span>
         </button>

         {open && (
            <div className="topbar-account-menu motion-scale-in" role="menu" style={{ width: 320, borderRadius: 12, padding: 4, transformOrigin: 'top right' }}>
               <a
                  href="/settings/profile"
                  role="menuitem"
                  className="topbar-account-row"
               >
                  <span className="topbar-avatar topbar-avatar-large topbar-avatar-trigger-photo" aria-hidden="true">
                     <Avatar src={accountPicture || undefined} initials={accountInitials} size={40} variant="primary" />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                     {displayName && (
                        <span style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                     )}
                     <span style={{ fontFamily: font, fontSize: displayName ? 13 : 14, fontWeight: displayName ? 400 : 600, color: displayName ? '#71717B' : '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#2F2F34', background: orgHover ? '#f3f4f0' : 'transparent', transition: 'background 120ms ease' }}
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
