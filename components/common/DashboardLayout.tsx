import React from 'react';
import AppShell from './AppShell';

type DashboardLayoutProps = {
  domains?: DomainType[];
  showAddModal: () => void;
  showSettings?: () => void;
  children: React.ReactNode;
};

const DashboardLayout = ({
  domains = [],
  showAddModal,
  showSettings,
  children,
}: DashboardLayoutProps) => {
  return (
    <AppShell
        domains={domains}
        showAddModal={showAddModal}
        showSettings={showSettings}
    >
      {children}
    </AppShell>
  );
};

export default DashboardLayout;
