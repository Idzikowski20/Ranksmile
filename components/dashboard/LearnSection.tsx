import React from 'react';
import { Card, WidgetShell } from '../koala/product';

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
  <WidgetShell title="Learn">
    <div
      className="dashboard-learn-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}
    >
      {CARDS.map((card) => (
        <Card key={card.title} padded elevated={false}>
          <a
            href={card.href}
            className="dashboard-learn-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              color: 'inherit',
              margin: -20,
              padding: 16,
            }}
          >
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <span
                style={{
                  fontSize: 13,
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: 'var(--koala-text-secondary)',
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
                  color: 'var(--koala-text-primary)',
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
                  color: 'var(--koala-text-secondary)',
                  marginTop: 'auto',
                  fontFamily: font,
                  ...clamp(1),
                }}
              >
                {card.meta}
              </span>
            </div>
          </a>
        </Card>
      ))}
    </div>
  </WidgetShell>
);

export default LearnSection;
