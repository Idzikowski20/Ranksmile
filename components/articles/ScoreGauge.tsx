import React, { useEffect } from 'react';

interface Props {
  score: number;
  /** Compact size for side panels (default: full size 300x116) */
  compact?: boolean;
}

const ScoreGauge = ({ score, compact }: Props) => {
  const [displayScore, setDisplayScore] = React.useState(0);
  const animRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const fromRef = React.useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = score;
    if (from === to) return;

    const duration = from === 0 ? 2800 : 900;

    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    startTimeRef.current = null;

    const animate = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const t = Math.min((ts - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; } };
  }, [score]);

  const cx = 250, cy = 190, r = 120, sw = 25;
  const totalArc = Math.PI * r;
  const gap = 10;
  const capR = sw / 2;

  const seg1End = (33 / 100) * totalArc;
  const seg2End = (66 / 100) * totalArc;
  const seg1Len = seg1End - gap / 2 - capR;
  const seg2Start = seg1End + gap / 2 + capR;
  const seg2Len = (seg2End - gap / 2 - capR) - seg2Start;
  const seg3Start = seg2End + gap / 2 + capR;
  const seg3Len = totalArc - capR - seg3Start;

  const ds = Math.max(0, Math.min(displayScore, 100));
  const dsArcPos = (ds / 100) * totalArc;

  const redFillLen   = Math.max(0, Math.min(dsArcPos - capR, seg1Len));
  const yellowFillLen = dsArcPos > seg2Start ? Math.max(0, Math.min(dsArcPos - seg2Start, seg2Len)) : 0;
  const greenFillLen  = dsArcPos > seg3Start ? Math.max(0, Math.min(dsArcPos - seg3Start, seg3Len)) : 0;

  const fraction = ds / 100;
  const angleRad = -Math.PI + fraction * Math.PI;
  const innerR = r - sw / 2 - 2;
  const outerR = r + sw / 2 + 3;
  const nx1 = cx + Math.cos(angleRad) * innerR;
  const ny1 = cy + Math.sin(angleRad) * innerR;
  const nx2 = cx + Math.cos(angleRad) * outerR;
  const ny2 = cy + Math.sin(angleRad) * outerR;

  const scoreColor = ds >= 66 ? '#1ab25e' : ds >= 33 ? '#efa00d' : '#d70028';
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const svgStyle: React.CSSProperties = compact
    ? { width: '100%', height: 'auto', marginTop: -8, marginBottom: -12, marginLeft: -4 }
    : { width: 300, height: 116, marginLeft: -18, marginTop: -24, marginBottom: -8 };

  const fontSize = compact ? 56 : 48;
  const fs2 = compact ? 20 : 24;
  const ty = compact ? cy - 4 : cy - 6;

  return (
    <svg viewBox="0 0 500 200" style={svgStyle}>
      {/* Faded tracks */}
      <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg1Len} 9999`} strokeDashoffset={0} opacity={0.18} />
      <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg2Len} 9999`} strokeDashoffset={-seg2Start} opacity={0.18} />
      <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${seg3Len} 9999`} strokeDashoffset={-seg3Start} opacity={0.18} />

      {/* Animated fills growing from left */}
      {redFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#ef4444" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${redFillLen} 9999`} strokeDashoffset={0} />
      )}
      {yellowFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#efa00d" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${yellowFillLen} 9999`} strokeDashoffset={-seg2Start} />
      )}
      {greenFillLen > 0 && (
        <path d={arcPath} fill="none" stroke="#1ab25e" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${greenFillLen} 9999`} strokeDashoffset={-seg3Start} />
      )}

      {/* Needle */}
      <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="#09090b" strokeWidth={3} strokeLinecap="round" />

      {/* Score text */}
      <g transform={`translate(${cx}, ${ty})`}>
        <text textAnchor="middle" fontFamily="var(--font-family-primary)">
          <tspan fontSize={fontSize} fontWeight={500} fill={scoreColor} letterSpacing="0.02em">{displayScore}</tspan>
          <tspan fontSize={fs2} fontWeight={400} fill="#3f3f47"> / 100</tspan>
        </text>
      </g>
    </svg>
  );
};

export default ScoreGauge;
