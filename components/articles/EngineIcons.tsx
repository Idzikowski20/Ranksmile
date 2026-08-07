/* eslint-disable max-len -- SVG path data; wrapping it would only make it unreadable. */
import React from 'react';
import { GOOGLE_G_PATHS } from '../aiVisibility/modelIcons';

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

const Gemini = () => (
  <svg width={13} height={13} viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9.00005 16.1739C9.00005 15.1815 8.80875 14.2489 8.42614 13.3761C8.05548 12.5033 7.54734 11.744 6.90169 11.0984C6.25604 10.4527 5.49682 9.94457 4.62399 9.5739C3.75116 9.1913 2.81856 8.99999 1.82617 8.99999C2.81856 8.99999 3.75116 8.81466 4.62399 8.44402C5.49682 8.06142 6.25604 7.54727 6.90169 6.90162C7.54734 6.25598 8.05548 5.49673 8.42614 4.62392C8.80875 3.7511 9.00005 2.8185 9.00005 1.82611C9.00005 2.8185 9.18539 3.7511 9.55602 4.62392C9.93863 5.49673 10.4528 6.25598 11.0984 6.90162C11.7441 7.54727 12.5033 8.06142 13.3761 8.44402C14.2489 8.81466 15.1816 8.99999 16.1739 8.99999C15.1816 8.99999 14.2489 9.1913 13.3761 9.5739C12.5033 9.94457 11.7441 10.4527 11.0984 11.0984C10.4528 11.744 9.93863 12.5033 9.55602 13.3761C9.18539 14.2489 9.00005 15.1815 9.00005 16.1739Z" fill="#3179ED" />
  </svg>
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

const Sparkle = () => (
  <svg width={13} height={13} viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M14.1461 8.6792C13.1338 8.24322 12.2484 7.64599 11.4884 6.88676C10.7292 6.12753 10.1312 5.24138 9.696 4.22907C9.52952 3.84162 9.3944 3.44222 9.29138 3.03311C9.25778 2.89948 9.13834 2.80542 9.00023 2.80542C8.86211 2.80542 8.74267 2.89948 8.70907 3.03311C8.60605 3.44222 8.47167 3.84013 8.30445 4.22907C7.86847 5.24138 7.27124 6.12753 6.512 6.88676C5.75277 7.64525 4.86663 8.24322 3.85432 8.6792C3.46686 8.84568 3.06746 8.98081 2.65836 9.08383C2.52473 9.11742 2.43066 9.23687 2.43066 9.37498C2.43066 9.51309 2.52473 9.63254 2.65836 9.66613C3.06746 9.76915 3.46537 9.90353 3.85432 10.0708C4.86663 10.5067 5.75202 11.104 6.512 11.8632C7.27124 12.6224 7.86922 13.5086 8.30445 14.5209C8.47167 14.9091 8.60605 15.3077 8.70907 15.7168C8.72535 15.7818 8.76283 15.8394 8.81556 15.8807C8.8683 15.9219 8.93328 15.9444 9.00023 15.9445C9.13834 15.9445 9.25778 15.8505 9.29138 15.7168C9.3944 15.3077 9.52878 14.9098 9.696 14.5209C10.132 13.5086 10.7292 12.6232 11.4884 11.8632C12.2477 11.104 13.1338 10.506 14.1461 10.0708C14.5343 9.90353 14.933 9.76915 15.3421 9.66613C15.407 9.64985 15.4647 9.61238 15.5059 9.55964C15.5472 9.50691 15.5696 9.44193 15.5698 9.37498C15.5698 9.23687 15.4757 9.11742 15.3421 9.08383C14.933 8.98081 14.5351 8.84643 14.1461 8.6792Z" fill="var(--koala-text-brand)" />
  </svg>
);

/** Decorative: the group title already says which sources these are. */
export const AiEngineIcons: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'row' }} aria-hidden="true">
    <Badge><Sparkle /></Badge>
    <Badge><GoogleMark /></Badge>
    <Badge><Gemini /></Badge>
    <Badge><Sparkle /></Badge>
  </div>
);

export const GoogleEngineIcon: React.FC = () => (
  <div style={{ display: 'flex' }} aria-hidden="true">
    <Badge><GoogleMark /></Badge>
  </div>
);
