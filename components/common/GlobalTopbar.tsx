import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';
import TopbarAccountMenu from './TopbarAccountMenu';

type Props = {
   title?: string;
};

function getSection(pathname: string) {
   if (pathname.startsWith('/articles') || pathname.startsWith('/content-editor')) return { href: '/content-editor', label: 'Content Editor' };
   if (pathname.startsWith('/sites')) return { href: '/sites', label: 'Sites' };
   if (pathname.startsWith('/research')) return { href: '/research', label: 'Research' };
   if (pathname.startsWith('/domain')) return { href: '/domains', label: 'Domains' };
   if (pathname.startsWith('/settings')) return { href: '/settings', label: 'Settings' };
   return { href: '/dashboard', label: 'Dashboard' };
}

const GlobalTopbar = ({ title }: Props) => {
   const router = useRouter();
   const section = getSection(router.pathname);
   const crumbTitle = title || (router.pathname.includes('/[id]') ? 'Article' : null);

   return (
      <header className="global-topbar">
         <div className="global-topbar-left">
            <Link href="/dashboard" passHref>
               <a className="global-topbar-logo" aria-label="SerpBear dashboard">
                  <Icon type="logo" size={20} color="var(--color-text-tertiary)" />
               </a>
            </Link>
            <Icon type="caret-right" size={18} color="var(--topbar-muted)" />
            <Link href={section.href} passHref>
               <a className="global-topbar-link">{section.label}</a>
            </Link>
            {crumbTitle && (
               <>
                  <Icon type="caret-right" size={18} color="var(--topbar-muted)" />
                  <div className="global-topbar-title">
                     <span>{crumbTitle}</span>
                  </div>
               </>
            )}
         </div>

         <div className="global-topbar-actions">
            <TopbarAccountMenu />
         </div>
      </header>
   );
};

export default GlobalTopbar;
