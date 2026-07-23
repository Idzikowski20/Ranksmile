import React from 'react';
import { SentryPanel, SentryPanelHeader, SentryPanelBody } from '../sentry-pages';

const font = 'var(--font-family-primary)';

/** Product-owned learn cards — no third-party competitor branding. */
const CARDS = [
  {
    label: 'Getting started',
    title: 'Connect Search Console and import your first pages',
    meta: 'Setup guide',
    href: '/onboarding',
  },
  {
    label: 'Content',
    title: 'Write & Optimize: content score, AI Search coverage, Auto-Optimize',
    meta: 'Editor overview',
    href: '/articles',
  },
  {
    label: 'Site intelligence',
    title: 'Turn Performance and Recommendations into your next article',
    meta: 'Growth loop',
    href: '/domains',
  },
  {
    label: 'AI Visibility',
    title: 'Track how AI engines mention and cite your brand',
    meta: 'Measure',
    href: '/domains',
  },
];

const clamp = (lines: number): React.CSSProperties => ({
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
});

const LearnSection = () => (
  <SentryPanel>
    <SentryPanelHeader title="Learn" />
    <SentryPanelBody>
      <div
        className="dashboard-learn-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}
      >
        {CARDS.map((card) => (
          <a
            key={card.title}
            href={card.href}
            className="dashboard-learn-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 8,
              border: '1px solid #DAD9DE',
              textDecoration: 'none',
              color: 'inherit',
              background: '#fff',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <span
                style={{
                  fontSize: 13,
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: '#6A6772',
                  fontFamily: font,
                  ...clamp(1),
                }}
              >
                {card.label}
              </span>
              <span
                style={{
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  color: '#181225',
                  fontFamily: font,
                  ...clamp(3),
                }}
              >
                {card.title}
              </span>
              <span
                style={{
                  fontSize: 13,
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: '#6A6772',
                  marginTop: 'auto',
                  fontFamily: font,
                  ...clamp(1),
                }}
              >
                {card.meta}
              </span>
            </div>
          </a>
        ))}
      </div>
    </SentryPanelBody>
  </SentryPanel>
);

export default LearnSection;
