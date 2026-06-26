import React from 'react';
import { scoreColor } from '../../lib/scoreColor';

interface Props { score: number; compact?: boolean; size?: number; pending?: boolean; }

// Split dual-arc gauge (left + right half), each with a grey track and a coloured
// fill, plus 6 outer tick marks. Geometry copied verbatim from the reference SVG.
const ARC = 111.70107212763709; // arc length of each half
const LEFT = 'M 43.05407289332279,89.39231012048832 A 40,40 0 0,1 43.05407289332279,10.607689879511682';
const RIGHT = 'M 56.94592710667722,89.39231012048832 A 40,40 0 0,0 56.94592710667722,10.607689879511682';
const TICKS = [
  'M 13,50 L 7,50',
  'M 20.507288939919352,74.74732297293177 L 18.209155610562416,76.67568580199139',
  'M 17.350148297977597,29.598108327021617 L 14.806004009508321,28.008350534322002',
  'M 87,50 L 93,50',
  'M 79.49271106008065,74.74732297293176 L 81.79084438943758,76.67568580199138',
  'M 82.6498517020224,29.59810832702161 L 85.19399599049169,28.008350534322',
];

const ScoreGauge = ({ score, compact, size: sizeProp, pending }: Props) => {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const color = scoreColor(s);
  // No data yet → grey track only, no coloured fill, "—" in the centre.
  const offset = pending ? ARC : ARC * (1 - s / 100);
  const size = sizeProp ?? (compact ? 56 : 96);
  const numberFont = size <= 64 ? 16 : 24;
  const fillStyle: React.CSSProperties = { transition: 'stroke 400ms ease-in-out, stroke-dashoffset 600ms cubic-bezier(0.34,2,0.64,1)' };

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g>
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={LEFT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} style={fillStyle} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={RIGHT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} style={fillStyle} />
        </g>
        {TICKS.map((d) => (
          <path key={d} d={d} stroke="black" strokeOpacity={0.3} strokeWidth={1.5} strokeLinecap="butt" />
        ))}
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family-primary)', fontWeight: 700, fontSize: numberFont, color: pending ? '#9f9fa9' : '#18181B', fontVariantNumeric: 'tabular-nums' }}>
        {pending ? '—' : s}
      </span>
    </div>
  );
};

export default ScoreGauge;
