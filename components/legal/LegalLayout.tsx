import type { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const FONT = 'var(--font-family-primary)';

export default function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <Head>
        <title>{title} · Ranksmile</title>
        <meta name="robots" content="index,follow" />
      </Head>
      <main
        style={{
          minHeight: '100vh',
          background: '#f3f4f0',
          color: '#302E36',
          fontFamily: FONT,
          padding: '48px 24px 80px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6A6772' }}>
            <Link href="/" style={{ color: '#E07D42', textDecoration: 'none' }}>Ranksmile</Link>
            {' · Legal'}
          </p>
          <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 700, color: '#181225' }}>{title}</h1>
          <article style={{ fontSize: 15, lineHeight: 1.65 }}>{children}</article>
          <nav style={{ marginTop: 40, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
            <Link href="/legal/terms" style={{ color: '#E07D42' }}>Terms</Link>
            <Link href="/legal/privacy" style={{ color: '#E07D42' }}>Privacy</Link>
            <Link href="/legal/cookies" style={{ color: '#E07D42' }}>Cookies</Link>
          </nav>
          <p style={{ marginTop: 24, fontSize: 12, color: '#6A6772' }}>Last updated: 2026-08-01</p>
        </div>
      </main>
    </>
  );
}
