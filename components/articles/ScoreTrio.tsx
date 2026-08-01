import React, { useState } from 'react';
import ScoreGauge from './ScoreGauge';
import { computeOverallContentScore } from '../../lib/aiSearchScore';

const F = 'var(--font-family-primary)';

/* Side gauge = small dual-arc gauge + its label, rendered as a clickable button
   that jumps into the matching Write & Optimize section. The hover/focus highlight
   is NOT drawn here — it's an overlay pill in ScoreTrio that spans this side AND the
   centre content-score gauge (Ranksmile-style). This button only reports hover intent
   and handles the click. */
const SideGauge = ({ score, label, align, pending, onClick, onHover, delta, deltaPlacement }: {
  score: number; label: string; align: 'start' | 'end'; pending?: boolean;
  onClick?: () => void; onHover?: (on: boolean) => void;
  delta?: number; deltaPlacement?: 'right' | 'left' | 'below';
}) => {
  const content = (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'end' ? 'flex-end' : 'flex-start', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#52525c', fontFamily: F }}>{label}</span>
      <ScoreGauge score={score} size={38} pending={pending} delta={delta} deltaPlacement={deltaPlacement} />
    </span>
  );
  const justify = align === 'end' ? 'flex-end' : 'flex-start';
  if (!onClick) {
    return <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', justifyContent: justify }}>{content}</div>;
  }
  return (
    <button
      type="button" onClick={onClick} title={`Open Write & Optimize — ${label}`}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)} onBlur={() => onHover?.(false)}
      style={{
        position: 'relative', zIndex: 10, flex: 1, display: 'flex', justifyContent: justify,
        background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', fontFamily: F,
      }}
    >
      {content}
    </button>
  );
};

/** SEO · Content Score · AI Search gauge trio (centre = blend of SEO + AI).
 *  Hovering SEO or AI highlights a pill spanning that side AND the centre
 *  content-score gauge. onSeoClick / onAiClick open the matching Write & Optimize
 *  section. */
const ScoreTrio = ({ seo, ai, hasAi, content, onSeoClick, onAiClick, deltas }: {
  seo: number; ai: number; hasAi: boolean; content?: number; onSeoClick?: () => void; onAiClick?: () => void;
  /** Green "↑N" increase badges (vs the pre-optimize baseline), shown during Auto-Optimize. */
  deltas?: { seo?: number; overall?: number; ai?: number };
}) => {
  const overall = content ?? (hasAi ? computeOverallContentScore(seo, ai) : seo);
  const [hovered, setHovered] = useState<'seo' | 'ai' | null>(null);
  const overlayBase: React.CSSProperties = {
    position: 'absolute', top: 0, bottom: 0, width: 'calc(50% + 50px)',
    border: '1px solid #e4e4e7', background: '#f3f4f0', pointerEvents: 'none',
    transition: 'opacity 0.15s ease-out, background-color 0.15s ease-out',
  };
  return (
    <div style={{ padding: '6px 16px 16px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {/* Left highlight pill: SEO side + centre */}
        <div style={{ ...overlayBase, left: 0, borderRadius: '12px 50px 50px 12px', opacity: hovered === 'seo' ? 1 : 0 }} />
        {/* Right highlight pill: centre + AI side */}
        <div style={{ ...overlayBase, right: 0, borderRadius: '50px 12px 12px 50px', opacity: hovered === 'ai' ? 1 : 0 }} />
        <SideGauge label="SEO" align="start" score={seo} delta={deltas?.seo} deltaPlacement="right" onClick={onSeoClick} onHover={(on) => setHovered(on ? 'seo' : null)} />
        <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}><ScoreGauge score={overall} size={100} delta={deltas?.overall} deltaPlacement="below" /></div>
        <SideGauge label="AI Search" align="end" score={ai} pending={!hasAi} delta={deltas?.ai} deltaPlacement="left" onClick={onAiClick} onHover={(on) => setHovered(on ? 'ai' : null)} />
      </div>
    </div>
  );
};

export default ScoreTrio;
