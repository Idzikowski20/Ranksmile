import React from 'react';
import ScoreGauge from './ScoreGauge';
import RemainingOpportunities from './RemainingOpportunities';
import type { OptimizeAdjustment } from '../../lib/optimizeStats';
import { useEntrance } from '../../lib/motion/useEntrance';

const F = 'var(--font-family-primary)';
const SUCCESS = '#1AB25E';
const ERROR = '#FF6F77';
const TEXT = '#18181B';
const MUTED = '#52525C';

interface Props {
  /** Pre-optimize baseline content score (0–100). */
  preScore: number;
  /** Live post-optimize content score (0–100) — animates the gauge as sections resolve. */
  postScore: number;
  /** Number of sections the run changed. */
  changedCount: number;
  /** Net words added across changed sections (may be negative). */
  wordsAdded: number;
  /** Per-changed-section word deltas, in section order. */
  adjustments: OptimizeAdjustment[];
  /** Uncovered AI-coverage items grouped by type, for the Remaining-Opportunities panel. */
  remainingRows: Array<{ label: string; count: number }>;
}

/* ── One signed-number stat card ──────────────────────────────────────── */
const StatCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div
    style={{
      flex: 1, minWidth: 0, background: '#f8f9ff', border: '1px solid #E4E4E7',
      borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
    }}
  >
    <span style={{ fontSize: 12, fontWeight: 500, color: MUTED, fontFamily: F, lineHeight: '16px' }}>{label}</span>
    <span style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color, fontFamily: F, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

/* ── +N / −N words chip ───────────────────────────────────────────────── */
const WordChip = ({ delta }: { delta: number }) => {
  if (delta === 0) {
    return <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, fontFamily: F, fontVariantNumeric: 'tabular-nums' }}>—</span>;
  }
  const up = delta > 0;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
        fontSize: 12, fontWeight: 600, lineHeight: '16px', fontFamily: F,
        fontVariantNumeric: 'tabular-nums', color: up ? SUCCESS : ERROR,
      }}
    >
      <svg viewBox="0 0 8 6" width={8} height={6} aria-hidden="true" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M4 0L8 6H0Z" fill="currentColor" />
      </svg>
      {up ? '+' : '−'}{Math.abs(delta)} words
    </span>
  );
};

/** Color a signed delta: success when positive, error when negative, muted at zero. */
const deltaColor = (n: number): string => {
  if (n > 0) return SUCCESS;
  if (n < 0) return ERROR;
  return MUTED;
};

/** Render a signed delta as text, with an em-dash for zero. */
const signed = (n: number, suffix = ''): string => {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `−${Math.abs(n)}${suffix}`;
  return '—';
};

/** Auto-Optimize results card — headline gauge with delta + 2 stat cards +
 *  Remaining-Opportunities panel + a per-section adjustments list. Presentational only
 *  (no data fetching). */
const OptimizeResultsPanel = ({ preScore, postScore, changedCount, wordsAdded, adjustments, remainingRows }: Props) => {
  const scoreDelta = Math.round(postScore) - Math.round(preScore);
  const VISIBLE = 8;
  const shown = adjustments.slice(0, VISIBLE);
  const extra = adjustments.length - shown.length;
  const entranceRef = useEntrance<HTMLDivElement>({ y: 16, duration: 0.35 });

  return (
    <div
      ref={entranceRef}
      style={{
        margin: 16, background: '#FFFFFF', border: '1px solid #F4F4F5',
        borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
        fontFamily: F,
      }}
    >
      {/* Headline: gauge + completed message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <ScoreGauge score={postScore} delta={scoreDelta} deltaPlacement="right" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, lineHeight: '20px' }}>Auto-Optimize completed</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: MUTED, lineHeight: '18px' }}>
            Review the changes below, then Save to keep them.
          </span>
        </div>
      </div>

      {/* Two stat cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard
          label="Boosted content score"
          value={`${Math.round(preScore)} → ${Math.round(postScore)}`}
          color={deltaColor(scoreDelta)}
        />
        <StatCard label="Optimized Sections" value={String(changedCount)} color={TEXT} />
      </div>

      {/* Remaining AI Opportunities */}
      <RemainingOpportunities rows={remainingRows} />

      {/* Per-section adjustments */}
      {adjustments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map((a, i) => (
            <div
              key={`${a.heading}-${i}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <span
                style={{
                  fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: '18px', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {a.heading || 'Untitled section'}
              </span>
              <WordChip delta={a.wordDelta} />
            </div>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 12, fontWeight: 400, color: MUTED, lineHeight: '16px' }}>
              +{extra} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default OptimizeResultsPanel;
