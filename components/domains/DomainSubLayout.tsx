/**
 * Shared layout for domain sub-pages: Performance, Recommendations, Content Audit, etc.
 * Provides the breadcrumb header: Sites › [favicon] [domain] › [section]
 */
import React from 'react';
import Link from 'next/link';

type DomainSubLayoutProps = {
   domain: string;
   slug: string;
   section: string;
   children: React.ReactNode;
   actions?: React.ReactNode;
   contentMaxWidth?: number | string;
};

const ChevronRight = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, color: '#9F9FA9' }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M8.29289 5.29289C8.68342 4.90237 9.31658 4.90237 9.70711 5.29289L15.7071 11.2929C16.0976 11.6834 16.0976 12.3166 15.7071 12.7071L9.70711 18.7071C9.31658 19.0976 8.68342 19.0976 8.29289 18.7071C7.90237 18.3166 7.90237 17.6834 8.29289 17.2929L13.5858 12L8.29289 6.70711C7.90237 6.31658 7.90237 5.68342 8.29289 5.29289Z" fill="currentColor" />
   </svg>
);

const BC_LINK: React.CSSProperties = {
   fontSize: 14,
   fontWeight: 600,
   color: '#52525C',
   textDecoration: 'none',
   fontFamily: 'var(--font-family-primary)',
   lineHeight: '20px',
   transition: 'color 0.15s',
};

const DomainSubLayout = ({ domain, slug, section, children, actions, contentMaxWidth = 1200 }: DomainSubLayoutProps) => (
   <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column' }} className="styled-scrollbar">
      {/* ─── Sticky breadcrumb header ─── */}
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
            justifyContent: 'space-between',
            minHeight: 52,
         }}
      >
         <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Link href="/sites" passHref>
               <a style={BC_LINK}>Sites</a>
            </Link>
            <ChevronRight />
            <img
               alt=""
               style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
               src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
            />
            <Link href={`/sites/${slug}`} passHref>
               <a style={BC_LINK}>{domain}</a>
            </Link>
            <ChevronRight />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#09090B', fontFamily: 'var(--font-family-primary)', lineHeight: '20px' }}>
               {section}
            </span>
         </div>
         {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               {actions}
            </div>
         )}
      </div>

      {/* ─── Page content ─── */}
      <div style={{ flex: 1, padding: '24px 24px 48px', maxWidth: contentMaxWidth }}>
         {children}
      </div>
   </div>
);

export default DomainSubLayout;
