import React from 'react';

/** Provenance icons for wizard prompts — where Google surfaced each question. */

export const GoogleIcon = ({ size = 16 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-label="Google" style={{ flexShrink: 0 }}>
      <path d="M15.68 8.18c0-.54-.04-1.09-.14-1.62H8v3.08h4.32c-.18.99-.76 1.87-1.6 2.43v2h2.58c1.51-1.4 2.38-3.45 2.38-5.89Z" fill="#4285F4" />
      <path d="M8 16c2.16 0 3.98-.71 5.3-1.93l-2.58-2c-.72.49-1.64.76-2.72.76-2.09 0-3.86-1.41-4.49-3.3H.85v2.06A8 8 0 0 0 8 16Z" fill="#34A853" />
      <path d="M3.51 9.53a4.8 4.8 0 0 1 0-3.06V4.41H.85a8 8 0 0 0 0 7.18l2.66-2.06Z" fill="#FBBC04" />
      <path d="M8 3.17c1.14-.02 2.24.41 3.07 1.2l2.28-2.29A7.99 7.99 0 0 0 .85 4.41l2.66 2.06C4.14 4.57 5.91 3.17 8 3.17Z" fill="#EA4335" />
   </svg>
);

export const RedditIcon = ({ size = 16 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-label="Reddit" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="10" fill="#FF4500" />
      <circle cx="15" cy="8" r="1.6" fill="#fff" />
      <circle cx="10" cy="11.2" r="5.2" fill="#fff" />
      <ellipse cx="7.6" cy="10.6" rx="1.05" ry="1.2" fill="#FF4500" />
      <ellipse cx="12.4" cy="10.6" rx="1.05" ry="1.2" fill="#FF4500" />
      <path d="M7.4 13c.7.6 1.7.9 2.6.9s1.9-.3 2.6-.9" stroke="#FF4500" strokeWidth="0.8" strokeLinecap="round" fill="none" />
   </svg>
);

export const QuoraIcon = ({ size = 16 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" fill="#B92B27" aria-label="Quora" style={{ flexShrink: 0 }}>
      <path d="M7.38.95A11.96 11.96 0 0 1 21.25 19.54l2.41 2.42c.73.74.21 1.99-.83 1.99l-10.71.01h-.32A11.96 11.96 0 0 1 7.38.95Zm7.32 4.43a7.17 7.17 0 1 0-5.49 13.25 7.17 7.17 0 0 0 5.49-13.25Z" />
   </svg>
);

const ICONS: Record<string, React.FC<{ size?: number }>> = {
   google: GoogleIcon, reddit: RedditIcon, quora: QuoraIcon,
};

/** Inline icon shown next to a prompt row (bare, 16px). */
export const SourceInlineIcon = ({ source }: { source: string }) => {
   const Ico = ICONS[source];
   return Ico ? <Ico size={16} /> : null;
};

/** Circular badge shown stacked in a topic header. */
export const SourceBadge = ({ source }: { source: string }) => {
   const Ico = ICONS[source];
   if (!Ico) return null;
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 9999, background: '#fff', border: '1px solid #E4E4E7', flexShrink: 0 }}>
         <Ico size={14} />
      </span>
   );
};

/** Unique provenance sources across a topic's prompts, in a stable order. */
export const topicSources = (prompts: Array<{ provenance: string[] }>): string[] => {
   const seen = new Set<string>();
   for (const p of prompts) for (const s of p.provenance) if (ICONS[s]) seen.add(s);
   return ['google', 'reddit', 'quora'].filter((s) => seen.has(s));
};
