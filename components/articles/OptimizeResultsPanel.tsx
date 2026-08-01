import React, { useState } from 'react';
import ScoreGauge from './ScoreGauge';
import RemainingOpportunities from './RemainingOpportunities';
import type { OptimizeAdjustment } from '../../lib/optimizeStats';
import type { StepFocus, EditMode } from '../../lib/optimizationPlanner';
import { sectionResultLabel } from '../../lib/optimizeMessaging';
import { useEntrance } from '../../lib/motion/useEntrance';

const F = 'var(--font-family-primary)';
const SUCCESS = '#1AB25E';
const ERROR = '#FF6F77';
const TEXT = '#18181B';
const MUTED = '#52525C';

/** One adjustments-list row: word-delta stats plus enough section metadata to
 *  render a `sectionResultLabel` and (optionally) support click-to-scroll nav. */
export type AdjustmentRow = OptimizeAdjustment & {
  sectionId?: string;
  focus?: StepFocus;
  mode?: EditMode;
  reason?: string;
};

interface Props {
  /** Pre-optimize baseline content score (0–100). */
  preScore: number;
  /** Live post-optimize content score (0–100) — animates the gauge as sections resolve. */
  postScore: number;
  /** Number of sections the run changed. */
  changedCount: number;
  /** Net words added across changed sections (may be negative). */
  /** Per-changed-section word deltas, in section order. */
  adjustments: AdjustmentRow[];
  /** Uncovered AI-coverage items grouped by type, for the Remaining-Opportunities panel. */
  remainingRows: Array<{ label: string; count: number }>;
  /** Called with a row's sectionId when its card is clicked (e.g. to scroll to that section). */
  onCardClick?: (sectionId: string) => void;
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


/** One clickable adjustments-list card: section label (from sectionResultLabel) + word-delta chip.
 *  Hover shifts border/bg per design.md (150ms ease); snippet/favicon rows are deferred. */
const AdjustmentCard = ({ row, onCardClick }: { row: AdjustmentRow; onCardClick?: (sectionId: string) => void }) => {
  const [hover, setHover] = useState(false);
  const clickable = !!(onCardClick && row.sectionId);
  return (
    <div
      onClick={clickable ? () => onCardClick!(row.sectionId!) : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        border: '1px solid #F4F4F5', borderRadius: 12, background: hover ? '#f3f4f0' : '#FFFFFF',
        borderColor: hover ? '#E4E4E7' : '#F4F4F5', padding: '10px 12px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      <span
        style={{
          fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: '18px', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {sectionResultLabel({ focus: row.focus, mode: row.mode, reason: row.reason })}
      </span>
      <WordChip delta={row.wordDelta} />
    </div>
  );
};

/** Auto-Optimize results card — headline gauge with delta + 2 stat cards +
 *  Remaining-Opportunities panel + a per-section adjustments list. Presentational only
 *  (no data fetching). */
const OptimizeResultsPanel = ({ preScore, postScore, changedCount, adjustments, remainingRows, onCardClick }: Props) => {
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
            <AdjustmentCard key={`${a.sectionId ?? a.heading}-${i}`} row={a} onCardClick={onCardClick} />
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
