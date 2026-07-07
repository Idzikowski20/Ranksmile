import React from 'react';
import { SentryPanel, SentryPanelHeader, SentryPanelBody } from '../sentry-pages';

const font = 'var(--font-family-primary)';

const CARDS = [
  { label: 'New Video', title: "🎥  The SEO Playbook That's Working in 2026: 5 Case Studies", meta: '12 min watch', image: 'https://images.surferseo.art/61e7532a-6da8-453c-984e-3c027665489e.png', href: 'https://youtu.be/A2oodPYUw_4' },
  { label: 'Product Updates', title: "What's new at Surfer? June 2026", meta: '7 min watch', image: 'https://images.surferseo.art/08f4b0e8-a3c2-4d17-a380-905fd05d2502.avif', href: 'https://surferseo.com/blog/whats-new-at-surfer-june-2026-product-roundup/' },
  { label: 'New Video', title: 'Can ChatGPT, Claude, or Gemini Actually Build a Good SEO Strategy?', meta: '16 min watch', image: 'https://images.surferseo.art/d20d69f4-87eb-4730-80b6-77a0935fa528.png', href: 'https://youtu.be/APKFGK85-oE' },
  { label: 'Surfer Giveaway', title: 'Earn up to $60 discount', meta: '1 min read', image: 'https://images.surferseo.art/c74be147-3628-4a06-9bbc-a43e38223572.png', href: 'https://surferseo.com/earn-vouchers/' },
];

const clamp = (lines: number): React.CSSProperties => ({ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical' });

const LearnSection = () => (
  <SentryPanel>
    <SentryPanelHeader title="Learn" />
    <SentryPanelBody>
    <div className="dashboard-learn-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
      {CARDS.map((card) => (
        <a
          key={card.title}
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="dashboard-learn-card"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 16, border: '1px solid #F4F4F5', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease', willChange: 'transform' }}
        >
          <div style={{ aspectRatio: '16 / 9', width: '100%', overflow: 'hidden', background: '#F4F4F5' }}>
            <img src={card.image} alt={card.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 13, lineHeight: '16px', fontWeight: 500, color: '#9F9FA9', fontFamily: font, ...clamp(1) }}>{card.label}</span>
            <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#000', fontFamily: font, ...clamp(3) }}>{card.title}</span>
            <span style={{ fontSize: 13, lineHeight: '16px', fontWeight: 500, color: '#9F9FA9', marginTop: 'auto', fontFamily: font, ...clamp(1) }}>{card.meta}</span>
          </div>
        </a>
      ))}
    </div>
    </SentryPanelBody>
  </SentryPanel>
);

export default LearnSection;
