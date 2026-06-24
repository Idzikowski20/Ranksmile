import React from 'react';
import SectionHeader from './SectionHeader';

const font = 'var(--font-family-primary)';

const GraduationIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M17 14.5001V11.4945C17 11.315 17 11.2253 16.9727 11.146C16.9485 11.076 16.9091 11.0122 16.8572 10.9592C16.7986 10.8993 16.7183 10.8592 16.5578 10.779L12 8.50006M4 9.50006V16.3067C4 16.6786 4 16.8645 4.05802 17.0274C4.10931 17.1713 4.1929 17.3016 4.30238 17.4082C4.42622 17.5287 4.59527 17.6062 4.93335 17.7612L11.3334 20.6945C11.5786 20.8069 11.7012 20.8631 11.8289 20.8853C11.9421 20.9049 12.0579 20.9049 12.1711 20.8853C12.2988 20.8631 12.4214 20.8069 12.6666 20.6945L19.0666 17.7612C19.4047 17.6062 19.5738 17.5287 19.6976 17.4082C19.8071 17.3016 19.8907 17.1713 19.942 17.0274C20 16.8645 20 16.6786 20 16.3067V9.50006M2 8.50006L11.6422 3.67895C11.7734 3.61336 11.839 3.58056 11.9078 3.56766C11.9687 3.55622 12.0313 3.55622 12.0922 3.56766C12.161 3.58056 12.2266 3.61336 12.3578 3.67895L22 8.50006L12.3578 13.3212C12.2266 13.3868 12.161 13.4196 12.0922 13.4325C12.0313 13.4439 11.9687 13.4439 11.9078 13.4325C11.839 13.4196 11.7734 13.3868 11.6422 13.3212L2 8.50006Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CARDS = [
  { label: 'New Video', title: "🎥  The SEO Playbook That's Working in 2026: 5 Case Studies", meta: '12 min watch', image: 'https://images.surferseo.art/61e7532a-6da8-453c-984e-3c027665489e.png', href: 'https://youtu.be/A2oodPYUw_4' },
  { label: 'Product Updates', title: "What's new at Surfer? June 2026", meta: '7 min watch', image: 'https://images.surferseo.art/08f4b0e8-a3c2-4d17-a380-905fd05d2502.avif', href: 'https://surferseo.com/blog/whats-new-at-surfer-june-2026-product-roundup/' },
  { label: 'New Video', title: 'Can ChatGPT, Claude, or Gemini Actually Build a Good SEO Strategy?', meta: '16 min watch', image: 'https://images.surferseo.art/d20d69f4-87eb-4730-80b6-77a0935fa528.png', href: 'https://youtu.be/APKFGK85-oE' },
  { label: 'Surfer Giveaway', title: 'Earn up to $60 discount', meta: '1 min read', image: 'https://images.surferseo.art/c74be147-3628-4a06-9bbc-a43e38223572.png', href: 'https://surferseo.com/earn-vouchers/' },
];

const clamp = (lines: number): React.CSSProperties => ({ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical' });

const LearnSection = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <SectionHeader icon={<GraduationIcon />} label="Learn" />
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
  </div>
);

export default LearnSection;
