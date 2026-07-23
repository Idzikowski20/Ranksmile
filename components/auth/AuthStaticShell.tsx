import React from 'react';
import {
  IconCompass,
  IconDashboard,
  IconIssues,
  IconQuestion,
  IconSettings,
  IconSiren,
} from '../common/nav/sentryIcons';

/**
 * Static visual copy of dashboard chrome (GlobalTopbar + SentryNav rail).
 * Non-interactive preview only — pointer-events none; login card stays clickable.
 */
export default function AuthStaticShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell auth-static-shell" style={{ minHeight: '100dvh', height: '100dvh' }}>
      <header className="global-topbar" aria-hidden="true" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="global-topbar-left">
          <span
            className="sentry-nav-org"
            style={{ cursor: 'default', width: 32, height: 32, borderRadius: 8, color: '#FFFFFF' }}
          >
            <IconQuestion size={16} />
          </span>
        </div>
        <div className="global-topbar-actions">
          <div className="sentry-nav-btnbar sentry-nav-btnbar--horizontal">
            <span
              className="sentry-nav-utilbtn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 13,
                fontWeight: 500,
                minWidth: 160,
                justifyContent: 'space-between',
              }}
            >
              <span>Search</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Ctrl K</span>
            </span>
            <span className="sentry-nav-utilbtn" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sentry-nav-utilbtn" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </header>

      <div className="app-shell-body">
        <div className="sentry-nav-rail-wrap" aria-hidden="true" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <nav aria-label="Primary Navigation preview" className="sentry-nav">
            <ul className="sentry-nav-list">
              <li className="sentry-nav-item">
                <span className="sentry-nav-link" aria-current="location" data-active-group="true">
                  <IconDashboard />
                </span>
              </li>
              <li className="sentry-nav-item">
                <span className="sentry-nav-link"><IconIssues /></span>
              </li>
              <li className="sentry-nav-item">
                <span className="sentry-nav-link"><IconCompass /></span>
              </li>
              <li className="sentry-nav-item">
                <span className="sentry-nav-link"><IconSiren /></span>
              </li>
              <li className="sentry-nav-item">
                <span className="sentry-nav-link"><IconSettings /></span>
              </li>
            </ul>

            <div className="sentry-nav-footer">
              <div className="sentry-nav-btnbar">
                <span className="sentry-nav-utilbtn" style={{ opacity: 0.85 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#3F3F46',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                  >
                    A
                  </span>
                </span>
                <span className="sentry-nav-utilbtn" style={{ opacity: 0.85 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#52525C',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#fff',
                    position: 'relative',
                  }}
                  >
                    B
                    <span style={{
                      position: 'absolute',
                      right: -1,
                      bottom: -1,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#22C55E',
                      border: '2px solid #252525',
                    }}
                    />
                  </span>
                </span>
                <span className="sentry-nav-utilbtn" style={{ opacity: 0.85 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#3F3F46',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                  >
                    C
                  </span>
                </span>
                <span className="sentry-nav-utilbtn">
                  <IconQuestion size={18} />
                </span>
              </div>
            </div>
          </nav>
        </div>

        <main
          className="app-content"
          style={{
            padding: 0,
            background: 'transparent',
            overflow: 'hidden',
            borderRadius: 12,
            minHeight: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
