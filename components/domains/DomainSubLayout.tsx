/**
 * Shared layout for domain sub-pages: Performance, Recommendations, Content Audit, etc.
 * White scroll area. Pass `heading` to render a page title row (title left, actions
 * right — the pattern Topical Map uses). Without `heading`, actions fall back to a slim
 * strip. (The Sites › domain › section breadcrumb was removed across all dashboard pages.)
 */
import React from 'react';

const FONT = 'var(--font-family-primary)';

type DomainSubLayoutProps = {
   domain: string;
   slug: string;
   section: string;
   children: React.ReactNode;
   actions?: React.ReactNode;
   contentMaxWidth?: number | string;
   heading?: React.ReactNode; // page title; when set, actions render beside it
};

const DomainSubLayout = ({ children, actions, contentMaxWidth = 1200, heading }: DomainSubLayoutProps) => (
   <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column' }} className="styled-scrollbar">
      {/* ─── Page title row (title + actions) ─── */}
      {heading && (
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px 0', flexWrap: 'wrap' }}>
            <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>{heading}</h1>
            {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{actions}</div> : null}
         </div>
      )}

      {/* ─── Slim actions strip (no heading) ─── */}
      {!heading && actions && (
         <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #F4F4F5', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 52 }}>
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
