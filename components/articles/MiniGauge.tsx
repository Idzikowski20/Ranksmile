import React from 'react';
import { scoreColor } from '../../lib/scoreColor';

// Tiny split dual-arc gauge (no ticks) — used in the editor sub-panel headers.
const ARC = 111.70107212763709;
const LEFT = 'M 43.05407289332279,89.39231012048832 A 40,40 0 0,1 43.05407289332279,10.607689879511682';
const RIGHT = 'M 56.94592710667722,89.39231012048832 A 40,40 0 0,0 56.94592710667722,10.607689879511682';

const MiniGauge = ({ score }: { score: number }) => {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const color = scoreColor(s);
  const offset = ARC * (1 - s / 100);
  return (
    <div style={{ position: 'relative', width: 36, height: 36 }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
        <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} />
        <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
        <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family-primary)', fontWeight: 600, fontSize: 11, color: '#18181B', fontVariantNumeric: 'tabular-nums' }}>{s}</span>
    </div>
  );
};

export default MiniGauge;
