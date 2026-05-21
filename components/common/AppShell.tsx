import React from 'react';
import Sidebar from './Sidebar';
import GlobalTopbar from './GlobalTopbar';

type AppShellProps = {
   domains?: DomainType[];
   showAddModal: () => void;
   showSettings?: () => void;
   children: React.ReactNode;
   showSidebar?: boolean;
   topbarTitle?: string;
   contentClassName?: string;
};

const AppShell = ({
   domains = [],
   showAddModal,
   showSettings,
   children,
   showSidebar = true,
   topbarTitle,
   contentClassName = '',
}: AppShellProps) => {
   return (
      <div className="app-shell">
         <GlobalTopbar title={topbarTitle} />
         <div className="app-shell-body">
            {showSidebar && (
               <Sidebar
                  domains={domains}
                  showAddModal={showAddModal}
                  showSettings={showSettings}
               />
            )}
            <main className={`app-content ${contentClassName}`}>
               {children}
            </main>
         </div>
      </div>
   );
};

export default AppShell;
