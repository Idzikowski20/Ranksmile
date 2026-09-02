/* eslint-disable max-len -- SVG path data; wrapping it would only make it unreadable. */
import React from 'react';
import { GOOGLE_G_PATHS } from '@/components/aiVisibility/modelIcons';

/**
 * Overlapping engine badges shown beside a progress group's title, so the row reads as
 * "these are the sources being consulted" without spelling them out again.
 */
const BADGE: React.CSSProperties = {
  marginRight: -4,
  width: 22,
  height: 22,
  borderRadius: 9999,
  border: '1px solid var(--koala-border-primary)',
  background: 'var(--koala-bg-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={BADGE}>{children}</div>
);

/** Brand logo from /public/ai-tracking (small, badge-sized assets). */
const EngineImg: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <img src={src} alt={alt} width={13} height={13} style={{ objectFit: 'contain' }} loading="lazy" />
);

/**
 * Google brand fills, in the same quadrant order as GOOGLE_G_PATHS. The shared `GoogleG`
 * component is not reused directly because it paints every quadrant in `currentColor` for
 * the monochrome AI-Visibility tables — rendering it here would turn the badge into a grey
 * blob. Only the geometry is shared.
 */
const GOOGLE_QUADRANT_FILLS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335'];

const GoogleMark = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {GOOGLE_G_PATHS.map((d, i) => <path key={d} d={d} fill={GOOGLE_QUADRANT_FILLS[i]} />)}
  </svg>
);

/** Decorative: the group title already says which sources these are. */
export const AiEngineIcons: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'row' }} aria-hidden="true">
    <Badge><EngineImg src="/ai-tracking/engine-chatgpt.svg" alt="ChatGPT" /></Badge>
    <Badge><GoogleMark /></Badge>
    <Badge><EngineImg src="/ai-tracking/engine-perplexity.svg" alt="Perplexity" /></Badge>
    <Badge><EngineImg src="/ai-tracking/engine-gemini.png" alt="Gemini" /></Badge>
  </div>
);

export const GoogleEngineIcon: React.FC = () => (
  <div style={{ display: 'flex' }} aria-hidden="true">
    <Badge><GoogleMark /></Badge>
  </div>
);
