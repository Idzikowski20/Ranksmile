import React, { useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { registerMotionPlugins } from '../../lib/motion/gsap';
import SentryNav from './nav/SentryNav';
import GlobalTopbar from './GlobalTopbar';
import MobileSidebar from './MobileSidebar';
import { useRouteTransition } from '../../lib/motion/useRouteTransition';

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
   /** @deprecated Bottom nav removed — kept for call-site compatibility. */
   hideMobileNav?: boolean;
};

const AppShell = ({
   domains = [],
   children,
   showSidebar = true,
   sidebar,
   breadcrumb,
   contentClassName = '',
}: AppShellProps) => {
   const [mobileNavOpen, setMobileNavOpen] = useState(false);
   useGSAP(() => { registerMotionPlugins(); });
   const contentRef = useRouteTransition<HTMLElement>();

   useEffect(() => {
      document.documentElement.classList.add('app-framed');
      return () => document.documentElement.classList.remove('app-framed');
   }, []);

   return (
      <div className="app-shell">
         <GlobalTopbar
            breadcrumb={breadcrumb}
            onMobileMenuClick={() => setMobileNavOpen(true)}
         />
         <div className="app-shell-body">
            {sidebar ?? (showSidebar && (
               <SentryNav domains={domains} />
            ))}
            <main ref={contentRef} className={`app-content motion-page-enter ${contentClassName}`}>
               {children}
            </main>
         </div>
         <MobileSidebar
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            domains={domains}
         />
      </div>
   );
};

export default AppShell;
