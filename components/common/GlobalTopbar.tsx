import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';
import TopbarAccountMenu from './TopbarAccountMenu';

type Props = {
   title?: string;
};

function getSection(pathname: string) {
   if (pathname.startsWith('/articles')) return { href: '/articles', label: 'Content Editor' };
   if (pathname.startsWith('/research')) return { href: '/research', label: 'Research' };
   if (pathname.startsWith('/domain')) return { href: '/domains', label: 'Domains' };
   if (pathname.startsWith('/settings')) return { href: '/settings', label: 'Settings' };
   return { href: '/dashboard', label: 'Dashboard' };
}

const GlobalTopbar = ({ title }: Props) => {
   const router = useRouter();
   const section = getSection(router.pathname);
   const crumbTitle = title || (router.pathname.includes('/[id]') ? 'Article' : section.label);

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
            <Icon type="caret-right" size={18} color="var(--topbar-muted)" />
            <div className="global-topbar-title">
               <span>{crumbTitle}</span>
               <button type="button" className="global-topbar-info" aria-label="Page info">
                  <Icon type="question" size={16} />
               </button>
            </div>
         </div>

         <button type="button" className="global-topbar-search" aria-label="Search">
            <Icon type="search" size={20} />
            <span>Search</span>
            <kbd>Ctrl+K</kbd>
         </button>

         <div className="global-topbar-actions">
            <button type="button" className="global-topbar-icon" aria-label="Notifications">
               <Icon type="download" size={20} />
            </button>
            <button type="button" className="global-topbar-icon" aria-label="Help">
               <Icon type="question" size={20} />
            </button>
            <TopbarAccountMenu />
         </div>
      </header>
   );
};

export default GlobalTopbar;
