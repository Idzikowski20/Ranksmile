import React from 'react';
import { FONT } from './widgetStyles';

const ConnectGoogleBanner = () => (
  <section style={{
    border: '1px solid #DAD9DE',
    borderRadius: 12,
    background: '#FFFFFF',
    boxShadow: '0 4px 0 0 #e4e4e7',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 12, background: '#F8F8F9',
        border: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT, marginBottom: 6 }}>
          Connect Google services
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT, lineHeight: '22px', maxWidth: 520 }}>
          Enrich your analysis with real-time data from Google Analytics and Google Search Console on your SEO Dashboard.
        </p>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <a
        href="/api/gsc/connect?redirect=/settings/google_search_console"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8,
          background: '#2F2F34', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: FONT,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        </svg>
        Connect
      </a>
      <a href="https://support.google.com/webmasters" target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, color: '#783AFB', fontFamily: FONT }}>
        Disclaimer
      </a>
    </div>
  </section>
);

export default ConnectGoogleBanner;
