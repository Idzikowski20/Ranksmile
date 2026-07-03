/**
 * Shared layout for domain sub-pages: Performance, Recommendations, Content Audit, etc.
 * White scroll area with an optional slim header strip for page-level actions.
 * (The Sites › domain › section breadcrumb was removed across all dashboard pages.)
 */
import React from 'react';

type DomainSubLayoutProps = {
   domain: string;
   slug: string;
   section: string;
   children: React.ReactNode;
   actions?: React.ReactNode;
   contentMaxWidth?: number | string;
};

const DomainSubLayout = ({ children, actions, contentMaxWidth = 1200 }: DomainSubLayoutProps) => (
   <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column' }} className="styled-scrollbar">
      {/* ─── Optional sticky actions strip (breadcrumb removed) ─── */}
      {actions && (
         <div
            style={{
               position: 'sticky',
               top: 0,
               zIndex: 100,
               background: '#fff',
               borderBottom: '1px solid #F4F4F5',
               padding: '12px 24px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'flex-end',
               minHeight: 52,
            }}
         >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               {actions}
            </div>
         </div>
      )}

      {/* ─── Page content ─── */}
      <div style={{ flex: 1, padding: '24px 24px 48px', maxWidth: contentMaxWidth }}>
         {children}
      </div>
   </div>
);

export default DomainSubLayout;
