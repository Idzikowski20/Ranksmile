import React from 'react';
import Sidebar from './Sidebar';
import GlobalTopbar from './GlobalTopbar';
import MobileBottomNav from './MobileBottomNav';

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
}: AppShellProps) => {
   return (
      <div className="app-shell">
         <GlobalTopbar title={topbarTitle} breadcrumb={breadcrumb} />
         <div className="app-shell-body">
            {sidebar ?? (showSidebar && (
               <Sidebar
                  domains={domains}
                  showAddModal={showAddModal}
                  showSettings={showSettings}
               />
            ))}
            <main className={`app-content motion-page-enter ${contentClassName}`}>
               {children}
            </main>
         </div>
         <MobileBottomNav
            domains={domains}
            showAddModal={showAddModal}
            showSettings={showSettings}
         />
      </div>
   );
};

export default AppShell;
