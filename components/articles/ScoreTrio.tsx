import React from 'react';
import ScoreGauge from './ScoreGauge';

const F = 'var(--font-family-primary)';

/* Side gauge = small version of the main dual-arc gauge (fills from both sides).
   When onClick is provided it becomes a clickable card: a hover border + soft
   shadow signal it jumps into Write & Optimize and expands the matching section.
   The padding/negative-margin pair keeps the resting size identical (no layout
   shift) — the border only appears on hover. */
const SideGauge = ({ score, label, pending, onClick }: { score: number; label: string; pending?: boolean; onClick?: () => void }) => {
  const inner = (
    <>
      <span style={{ fontSize: 13, color: '#52525c', fontFamily: F }}>{label}</span>
      <ScoreGauge score={score} size={48} pending={pending} />
    </>
  );
  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 };
  if (!onClick) return <div style={col}>{inner}</div>;
  return (
    <button
      type="button" onClick={onClick} title={`Open Write & Optimize — ${label}`}
      style={{
        ...col, padding: 8, margin: -8, borderRadius: 12, border: '1px solid transparent',
        background: 'transparent', cursor: 'pointer', fontFamily: F,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(24,26,34,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
      onFocus={(e) => { e.currentTarget.style.borderColor = '#aa93fd'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {inner}
    </button>
  );
};

/** SEO · Content Score · AI Search gauge trio (center = blend of SEO + AI).
 *  onSeoClick / onAiClick make the side gauges clickable shortcuts into the
 *  matching Write & Optimize section. */
const ScoreTrio = ({ seo, ai, hasAi, onSeoClick, onAiClick }: {
  seo: number; ai: number; hasAi: boolean; onSeoClick?: () => void; onAiClick?: () => void;
}) => {
  const overall = hasAi ? Math.round((seo + ai) / 2) : seo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '6px 16px 16px' }}>
      <SideGauge label="SEO" score={seo} onClick={onSeoClick} />
      <ScoreGauge score={overall} />
      <SideGauge label="AI Search" score={ai} pending={!hasAi} onClick={onAiClick} />
    </div>
  );
};

export default ScoreTrio;
