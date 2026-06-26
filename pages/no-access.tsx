import type { NextPage } from 'next';
import Head from 'next/head';

const font = 'var(--font-family-primary)';

const NoAccess: NextPage = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9ff', padding: 24 }}>
    <Head>
      <title>No access — SerpBear</title>
      <meta name="description" content="You don't have access to any workspace" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main role="main" style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '40px 28px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 16 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: '#F4F4F5', color: '#71717B' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: font }}>You don&apos;t have access to any workspace</span>
      <span style={{ fontSize: 14, color: '#52525C', lineHeight: 1.5, fontFamily: font }}>
        Your account isn&apos;t assigned to a workspace yet. Ask an organization owner or admin to grant you access, then refresh this page.
      </span>
      <a
        href="/"
        style={{ marginTop: 4, padding: '9px 18px', borderRadius: 8, background: '#2F2F34', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: font, transition: 'background 150ms ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
      >
        Try again
      </a>
    </main>
  </div>
);

export default NoAccess;
