import React, { useId, useMemo } from 'react';
import { scoreColor } from '../../lib/scoreColor';

export type SiteAuditScoreGaugeVariant = 'watchtower' | 'compact';

interface Props {
  score: number;
  size?: number;
  /** Watchtower horseshoe for Site Health; compact dual-arc for small thematic cards. */
  variant?: SiteAuditScoreGaugeVariant;
  showLabel?: boolean;
}

const COMPACT_ARC = 111.70107212763709;
const COMPACT_LEFT = 'M 43.05407289332279,89.39231012048832 A 40,40 0 0,1 43.05407289332279,10.607689879511682';
const COMPACT_RIGHT = 'M 56.94592710667722,89.39231012048832 A 40,40 0 0,0 56.94592710667722,10.607689879511682';
const COMPACT_TICKS = [
  'M 13,50 L 7,50',
  'M 20.507288939919352,74.74732297293177 L 18.209155610562416,76.67568580199139',
  'M 17.350148297977597,29.598108327021617 L 14.806004009508321,28.008350534322002',
  'M 87,50 L 93,50',
  'M 79.49271106008065,74.74732297293176 L 81.79084438943758,76.67568580199138',
  'M 82.6498517020224,29.59810832702161 L 85.19399599049169,28.008350534322',
];

/** Horseshoe arc opening at bottom (≈240° large arc). Center (94, 94), r = 82. */
const WT_ARC = 'M 23 135 A 82 82 0 1 1 165 135';
const WT_CX = 94;
const WT_CY = 94;
/** Visible arc span in degrees. 0° = top, negative = left. */
const WT_ARC_SPAN = 240;
const WT_START_FROM_TOP = -WT_ARC_SPAN / 2;

export function siteHealthLabel(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  if (s >= 90) return 'Fantastic';
  if (s >= 75) return 'Great';
  if (s >= 60) return 'Good';
  if (s >= 40) return 'Fair';
  return 'Poor';
}

/** Arrow rotation around arc center: score 0 → left end, 100 → right end. */
function arrowRotationDeg(score: number): number {
  const t = Math.max(0, Math.min(100, score)) / 100;
  return WT_START_FROM_TOP + t * WT_ARC_SPAN;
}

/** Tip color along the green→cyan→blue spectrum at current score. */
function tipColorAt(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  if (t < 0.5) {
    const u = t / 0.5;
    return mixRgb([27, 163, 0], [102, 204, 255], u);
  }
  const u = (t - 0.5) / 0.5;
  return mixRgb([102, 204, 255], [13, 122, 225], u);
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function CompactGauge({ score, size }: { score: number; size: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const color = scoreColor(s);
  const offset = COMPACT_ARC * (1 - s / 100);
  const numberFont = size <= 64 ? 16 : 24;

  return (
    <div className="sentry-audit-gauge-compact" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="sentry-audit-gauge-compact-svg">
        <g>
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={COMPACT_LEFT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={COMPACT_LEFT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={COMPACT_RIGHT} stroke="#E4E4E7" strokeDasharray="111.70107212763709 9999" opacity={0.5} />
          <path fill="none" strokeWidth={12} strokeLinecap="round" d={COMPACT_RIGHT} stroke={color} strokeDasharray="111.70107212763709 9999" strokeDashoffset={offset} />
        </g>
        {COMPACT_TICKS.map((d) => (
          <path key={d} d={d} stroke="black" strokeOpacity={0.3} strokeWidth={1.5} strokeLinecap="butt" />
        ))}
      </svg>
      <div className="sentry-audit-gauge-compact-value" style={{ fontSize: numberFont }}>{s}</div>
    </div>
  );
}

function WatchtowerGauge({
  score,
  width,
  showLabel,
}: {
  score: number;
  width: number;
  showLabel: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  const label = siteHealthLabel(s);
  const arrowRot = useMemo(() => arrowRotationDeg(s), [s]);
  const tip = useMemo(() => tipColorAt(s), [s]);
  const gradId = `sa-grad-${uid}`;
  const height = Math.round(width * (148 / 188));
  // pathLength=100 → dash length equals score percent along the horseshoe.
  const fillLen = Math.max(0.01, s);

  return (
    <aside
      className="sentry-audit-watchtower"
      style={{ width, height }}
      aria-label={`Site health score: ${s} which is ${label}`}
    >
      <svg viewBox="0 0 188 148" xmlns="http://www.w3.org/2000/svg" className="sentry-audit-watchtower-svg" role="img">
        <title>{`Site health score: ${s} which is ${label}`}</title>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="23" y1="94" x2="165" y2="94">
            <stop offset="0%" stopColor="rgb(27, 163, 0)" />
            <stop offset="45%" stopColor="rgb(102, 204, 255)" />
            <stop offset="100%" stopColor="rgb(13, 122, 225)" />
          </linearGradient>
        </defs>

        {/* Full track (unfilled) */}
        <path
          d={WT_ARC}
          fill="none"
          stroke="#E8E8EC"
          strokeWidth={24}
          strokeLinecap="round"
          pathLength={100}
        />

        {/* Fill only up to score */}
        <path
          d={WT_ARC}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={24}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${fillLen} 100`}
        />

        {/* Ticks along the full arc (subtle) */}
        <g opacity={0.18} stroke="#181225" strokeWidth={1.5} strokeLinecap="butt">
          {Array.from({ length: 11 }, (_, i) => {
            const deg = WT_START_FROM_TOP + (i / 10) * WT_ARC_SPAN;
            const rad = ((deg - 90) * Math.PI) / 180;
            const r0 = 70;
            const r1 = 78;
            const x0 = WT_CX + Math.cos(rad) * r0;
            const y0 = WT_CY + Math.sin(rad) * r0;
            const x1 = WT_CX + Math.cos(rad) * r1;
            const y1 = WT_CY + Math.sin(rad) * r1;
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} />;
          })}
        </g>

        {/* Arrow at fill tip */}
        <g transform={`rotate(${arrowRot} ${WT_CX} ${WT_CY})`}>
          <path
            d="M 94,34 84,47 104,47 z"
            fill={tip}
            stroke={tip}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* Score + label */}
        <foreignObject width="118" height="76" x="35" y="61">
          <div xmlns="http://www.w3.org/1999/xhtml" className="sentry-audit-watchtower-center" aria-hidden="true">
            <div className="sentry-audit-watchtower-score">{s}</div>
            {showLabel ? <div className="sentry-audit-watchtower-label">{label}</div> : null}
          </div>
        </foreignObject>
      </svg>
    </aside>
  );
}

export default function SiteAuditScoreGauge({
  score,
  size = 96,
  variant,
  showLabel = true,
}: Props) {
  const resolved: SiteAuditScoreGaugeVariant =
    variant ?? (size >= 88 ? 'watchtower' : 'compact');

  if (resolved === 'compact') {
    return <CompactGauge score={score} size={size} />;
  }

  const width = Math.max(120, size + 40);
  return <WatchtowerGauge score={score} width={width} showLabel={showLabel} />;
}
