import React from 'react';
import TopbarAccountMenu from './TopbarAccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import TopbarSearch from './TopbarSearch';
import TopbarInbox from './TopbarInbox';

type Props = {
   title?: string;
   breadcrumb?: React.ReactNode;
};

const HelpButton = () => (
   <a
      href="https://docs.surferseo.com/"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Help"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9F9FA9', transition: 'opacity 150ms ease' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
   >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
         <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   </a>
);

const GlobalTopbar = ({ breadcrumb }: Props) => (
   <header className="global-topbar">
      <div className="global-topbar-left">
         {breadcrumb ?? <WorkspaceSwitcher />}
      </div>

      {/* Main region (right of the switcher). Equal-flex spacer + actions keep the
          search centered over the content column, SurferSEO-style. */}
      <div className="global-topbar-main">
         <div className="global-topbar-spacer" aria-hidden="true" />
         <div className="global-topbar-center" style={{ zIndex: 1 }}>
            <TopbarSearch />
         </div>
         <div className="global-topbar-actions" style={{ gap: 16 }}>
            <TopbarInbox />
            <HelpButton />
            <TopbarAccountMenu />
         </div>
      </div>
   </header>
);

export default GlobalTopbar;
