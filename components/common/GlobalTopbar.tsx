import React from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import TopbarSearch from './TopbarSearch';
import TopbarInbox from './TopbarInbox';

type Props = {
   title?: string;
   breadcrumb?: React.ReactNode;
   navCollapsed?: boolean;
   onToggleNavCollapse?: () => void;
};

const CollapseIcon = ({ collapsed }: { collapsed?: boolean }) => (
   <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}>
      <path fillRule="evenodd" d="M10.47 3.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L12.69 7 10.47 4.78a.75.75 0 0 1 0-1.06m-4.94 0a.75.75 0 0 0-1.06 0L1.22 6.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.31 7l2.22-2.22a.75.75 0 0 0 0-1.06" clipRule="evenodd" />
   </svg>
);

const HelpButton = () => (
   <a
      href="https://docs.surferseo.com/"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Help"
      className="global-topbar-help"
   >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
         <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   </a>
);

const GlobalTopbar = ({ breadcrumb, navCollapsed, onToggleNavCollapse }: Props) => (
   <header className="global-topbar">
      <div className="global-topbar-left">
         {onToggleNavCollapse && (
            <button
               type="button"
               className="global-topbar-collapse"
               aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
               aria-pressed={!!navCollapsed}
               onClick={onToggleNavCollapse}
            >
               <CollapseIcon collapsed={navCollapsed} />
            </button>
         )}
         {breadcrumb ?? <WorkspaceSwitcher />}
      </div>

      <div className="global-topbar-main">
         <div className="global-topbar-spacer" aria-hidden="true" />
         <div className="global-topbar-center">
            <TopbarSearch />
         </div>
         <div className="global-topbar-actions">
            <span className="ce-search-compact"><TopbarSearch compact /></span>
            <TopbarInbox />
            <HelpButton />
         </div>
      </div>
   </header>
);

export default GlobalTopbar;
