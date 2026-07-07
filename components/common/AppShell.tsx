import React from 'react';
import SentryNav from './nav/SentryNav';
import GlobalTopbar from './GlobalTopbar';
import MobileBottomNav from './MobileBottomNav';
import { useRouteTransition } from '../../lib/motion/useRouteTransition';
import { useNavCollapsed } from '../../lib/useNavCollapsed';

type AppShellProps = {
   domains?: DomainType[];
   showAddModal: () => void;
   showSettings?: () => void;
   children: React.ReactNode;
   showSidebar?: boolean;
   sidebar?: React.ReactNode;
   topbarTitle?: string;
   /** Replaces the workspace switcher in the topbar's left slot (e.g. editor breadcrumb). */
   breadcrumb?: React.ReactNode;
   contentClassName?: string;
   /** Hide the mobile bottom nav (e.g. the content editor wants the full height). */
   hideMobileNav?: boolean;
};

const AppShell = ({
   domains = [],
   showAddModal,
   showSettings,
   children,
   showSidebar = true,
   sidebar,
   topbarTitle,
   breadcrumb,
   contentClassName = '',
   hideMobileNav = false,
}: AppShellProps) => {
   const contentRef = useRouteTransition<HTMLElement>();
   const [navCollapsed, toggleNavCollapsed] = useNavCollapsed();
   return (
      <div className="app-shell">
         <GlobalTopbar
            breadcrumb={breadcrumb}
            navCollapsed={navCollapsed}
            onToggleNavCollapse={toggleNavCollapsed}
         />
         <div className="app-shell-body">
            {sidebar ?? (showSidebar && (
               <SentryNav domains={domains} collapsed={navCollapsed} />
            ))}
            <main ref={contentRef} className={`app-content motion-page-enter ${contentClassName}`}>
               {children}
            </main>
         </div>
         {!hideMobileNav && (
            <MobileBottomNav
               domains={domains}
               showAddModal={showAddModal}
               showSettings={showSettings}
            />
         )}
      </div>
   );
};

export default AppShell;
