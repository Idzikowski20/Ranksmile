import React from 'react';
import TopbarAccountMenu from './TopbarAccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';

type Props = {
   title?: string;
};

const GlobalTopbar = (_props: Props) => (
   <header className="global-topbar">
      <div className="global-topbar-left">
         <WorkspaceSwitcher />
      </div>

      <div className="global-topbar-actions">
         <TopbarAccountMenu />
      </div>
   </header>
);

export default GlobalTopbar;
