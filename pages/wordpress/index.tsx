import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/common/DashboardLayout';
import AddDomain from '../../components/domains/AddDomain';
import WpConnectionsTable from '../../components/wordpress/WpConnectionsTable';
import { useFetchDomains } from '../../services/domains';

const font = 'var(--font-family-primary)';
const HELP_URL = 'https://docs.surferseo.com/en/articles/6328028-wordpress-plugin-explained';

const ChevronRight = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8.25 4.5 7.5 7.5-7.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const WordPressIntegration: NextPage = () => {
   const router = useRouter();
   const { data: domainsData } = useFetchDomains(router, false);
   const domains = domainsData?.domains || [];
   const [showAddDomain, setShowAddDomain] = useState(false);

   const emptyState = (
      <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 14, color: '#71717B' }}>
         No WordPress sites connected yet. Connect from your WordPress admin (Surfer → Connect).
      </div>
   );

   return (
      <DashboardLayout domains={domains} showAddModal={() => setShowAddDomain(true)}>
         <>
            <Head><title>WordPress Integration — Surfer</title></Head>

            <div style={{ flex: 1, overflow: 'auto', padding: '32px 16px' }} className="styled-scrollbar">
               <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, fontFamily: font }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                     <h1 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#18181B' }}>WordPress Integration</h1>
                     <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#52525C' }}>Interact with your WordPress domains straight from Surfer!</p>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 12, padding: 24 }}>
                     <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                        <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B' }}>Accounts connected</span>
                        <a
                           href={HELP_URL}
                           target="_blank"
                           rel="noreferrer noopener"
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: '#155DFC', textDecoration: 'none', transition: 'color 150ms ease' }}
                           onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#F29964'; }}
                           onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#155DFC'; }}
                        >
                           How to connect?
                           <ChevronRight />
                        </a>
                     </div>

                     <WpConnectionsTable emptyState={emptyState} />
                  </div>
               </div>
            </div>

            {showAddDomain && <AddDomain domains={domains} closeModal={() => setShowAddDomain(false)} />}
         </>
      </DashboardLayout>
   );
};

export default WordPressIntegration;
