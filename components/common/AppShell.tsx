import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useGSAP } from '@gsap/react';
import { registerMotionPlugins } from '@/components/motion/gsap';
import { useRouteTransition } from '@/components/motion/useRouteTransition';
import { AppBanner, KoalaHeader, KoalaSidebar, useAppBanner } from '../koala/shell';
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
  const { pathname } = useRouter();
  // Purchase/upgrade flows shouldn't carry the marketing announcement — keep the plan
  // and checkout pages focused.
  const suppressAnnouncement = pathname.startsWith('/billing') || pathname.startsWith('/plans');
  // Standing announcement: Polish is available. Yields to any page-level banner
  // (a warning/error published later wins), and stays gone once dismissed.
  useAppBanner(suppressAnnouncement ? null : {
    message: 'Ranksmile jest teraz dostępny w języku polskim.',
    variant: 'brand',
    dismissible: true,
    persistDismiss: true,
    dismissKey: 'locale-pl-announcement',
  });
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
      <AppBanner />
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
