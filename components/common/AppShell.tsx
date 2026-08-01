import React, { useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { registerMotionPlugins } from '../../lib/motion/gsap';
import { useRouteTransition } from '../../lib/motion/useRouteTransition';
import { KoalaHeader, KoalaSidebar } from '../koala/shell';
import MobileSidebar from './MobileSidebar';

type AppShellProps = {
  domains?: DomainType[];
  showAddModal: () => void;
  showSettings?: () => void;
  children: React.ReactNode;
  showSidebar?: boolean;
  sidebar?: React.ReactNode;
  topbarTitle?: string;
  /** Replaces search in header (e.g. editor breadcrumb). */
  breadcrumb?: React.ReactNode;
  contentClassName?: string;
  /** @deprecated */
  hideMobileNav?: boolean;
};

/**
 * App shell = Product Sidebar + Header (Figma `4903:6905` + `6959:74257`).
 */
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
    document.documentElement.classList.add('app-framed', 'koala-shell');
    return () => {
      document.documentElement.classList.remove('app-framed', 'koala-shell');
    };
  }, []);

  return (
    <div className="app-shell koala-app-shell">
      <div className="app-shell-body koala-shell-body">
        {sidebar ?? (showSidebar ? <KoalaSidebar domains={domains} /> : null)}
        <div className="koala-shell-main">
          <KoalaHeader
            breadcrumb={breadcrumb}
            onMobileMenuClick={showSidebar ? () => setMobileNavOpen(true) : undefined}
          />
          <main ref={contentRef} className={`app-content motion-page-enter ${contentClassName}`}>
            {children}
          </main>
        </div>
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
