import React from 'react';

/** Animated Surfer logo loader — a sweeping mask reveals the rounded-square outline. */
const SurferLoader = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading" {...props}>
    <defs>
      <mask id="app-loader-sweep">
        <rect x="-4" y="-4" width="32" height="32" fill="white" />
        <polygon className="surfer-loader-sweep" fill="black" points="34.96,4.92 34.14,2.66 -10.96,19.08 -10.14,21.34" />
      </mask>
    </defs>
    <rect fill="none" stroke="currentColor" strokeWidth="2.6" x="1.35" y="1.35" width="21.3" height="21.3" rx="4.3" ry="4.3" mask="url(#app-loader-sweep)" />
    <g fill="currentColor">
      <path d="M6.69922 15.7673V11.1256C6.69922 9.90231 6.95458 9.64697 8.17783 9.64697H8.6353C9.85868 9.64697 10.1139 9.90225 10.1139 11.1256V15.7673C10.1139 16.9907 9.85868 17.2459 8.6353 17.2459H8.17783C6.95458 17.2459 6.69922 16.9906 6.69922 15.7673Z" />
      <path d="M15.3204 6.75684C14.0972 6.75684 13.8418 7.0122 13.8418 8.23548V15.7674C13.8418 16.9907 14.0972 17.246 15.3204 17.246H15.7779C17.0013 17.246 17.2565 16.9907 17.2565 15.7674V8.23548C17.2565 7.01212 17.0013 6.75684 15.7779 6.75684H15.3204Z" />
    </g>
  </svg>
);

/** Full-screen global loading screen: white background + animated Surfer loader. */
const AppLoading = ({ label = 'Loading…' }: { label?: string }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'var(--font-family-primary)' }}>
    <SurferLoader width={52} height={52} style={{ color: '#F2643F' }} />
    <span style={{ fontSize: 14, color: '#52525C' }}>{label}</span>
  </div>
);

export { SurferLoader };
export default AppLoading;
