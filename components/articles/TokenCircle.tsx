import React from 'react';
import { formatTokens } from '../../lib/ai/sse';

// This-turn soft reference for the ring fill (per the Phase 4 decision).
const TOKEN_BUDGET = 60_000;

/** Twenty-style usage ring for the dark Surfy bar: this turn's tokens filling toward
 *  TOKEN_BUDGET, compact count ("12.3k") in the centre. */
const TokenCircle = ({ tokens }: { tokens: number }) => {
  const pct = Math.max(0, Math.min(tokens / TOKEN_BUDGET, 1));
  const r = 13;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <span title={`${Math.max(0, Math.round(tokens)).toLocaleString()} tokens used this turn`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <svg width={32} height={32} viewBox="0 0 32 32">
        <circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={3} />
        <circle
          cx={16} cy={16} r={r} fill="none" stroke="#AA93FD" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
        <text
          x={16} y={16} textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--font-family-primary)" fontSize={8.5} fontWeight={600} fill="rgba(255,255,255,0.9)"
        >
          {formatTokens(tokens)}
        </text>
      </svg>
    </span>
  );
};

export default TokenCircle;
