import React from 'react';

// Inline SVG flags (no emoji — Windows renders emoji flags as letters — and no CDN).
// viewBox 0 0 60 40 for all; simplified but recognizable for the striped/canton flags.
const FLAGS: Record<string, React.ReactNode> = {
   PL: (<><rect width="60" height="40" fill="#fff" /><rect y="20" width="60" height="20" fill="#dc143c" /></>),
   DE: (<><rect width="60" height="40" fill="#000" /><rect y="13.3" width="60" height="13.4" fill="#d00" /><rect y="26.7" width="60" height="13.3" fill="#ffce00" /></>),
   FR: (<><rect width="60" height="40" fill="#fff" /><rect width="20" height="40" fill="#002395" /><rect x="40" width="20" height="40" fill="#ed2939" /></>),
   IT: (<><rect width="60" height="40" fill="#fff" /><rect width="20" height="40" fill="#009246" /><rect x="40" width="20" height="40" fill="#ce2b37" /></>),
   NL: (<><rect width="60" height="40" fill="#fff" /><rect width="60" height="13.3" fill="#ae1c28" /><rect y="26.7" width="60" height="13.3" fill="#21468b" /></>),
   ES: (<><rect width="60" height="40" fill="#aa151b" /><rect y="10" width="60" height="20" fill="#f1bf00" /></>),
   PT: (<><rect width="60" height="40" fill="#f00" /><rect width="24" height="40" fill="#060" /></>),
   US: (
      <>
         {Array.from({ length: 13 }).map((_, i) => (
            <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill={i % 2 === 0 ? '#b22234' : '#fff'} />
         ))}
         <rect width="26" height={(40 / 13) * 7} fill="#3c3b6e" />
      </>
   ),
   GB: (
      <>
         <rect width="60" height="40" fill="#012169" />
         <path d="M0,0 60,40 M60,0 0,40" stroke="#fff" strokeWidth="8" />
         <path d="M0,0 60,40 M60,0 0,40" stroke="#c8102e" strokeWidth="4" />
         <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="12" />
         <path d="M30,0 V40 M0,20 H60" stroke="#c8102e" strokeWidth="6" />
      </>
   ),
};

/** Small rounded flag for a country code (falls back to the code text if unknown). */
const CountryFlag = ({ code, size = 20 }: { code: string; size?: number }) => {
   const flag = FLAGS[code.toUpperCase()];
   return (
      <span style={{ display: 'inline-block', width: size, height: Math.round((size * 2) / 3), borderRadius: 3, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', flexShrink: 0, lineHeight: 0 }}>
         {flag ? (
            <svg viewBox="0 0 60 40" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{flag}</svg>
         ) : (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#71717B' }}>{code}</span>
         )}
      </span>
   );
};

export default CountryFlag;
