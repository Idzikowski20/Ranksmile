import React from 'react';
import { radius } from '../tokens/effects';
import { greyNeutral } from '../tokens/colors';

/** Country flag mark — Koala Flag (Figma `3950:133967`). */

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

export type FlagProps = {
  code: string;
  size?: number;
  className?: string;
};

export function Flag({ code, size = 20, className }: FlagProps) {
  const upper = code.toUpperCase();
  const flag = FLAGS[upper];
  const h = Math.round((size * 2) / 3);
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: h,
        borderRadius: radius.sm,
        overflow: 'hidden',
        boxShadow: `inset 0 0 0 1px ${greyNeutral[200]}`,
        flexShrink: 0,
        lineHeight: 0,
      }}
      title={upper}
    >
      {flag ? (
        <svg viewBox="0 0 60 40" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {flag}
        </svg>
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, color: greyNeutral[500], display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {upper}
        </span>
      )}
    </span>
  );
}

export default Flag;
