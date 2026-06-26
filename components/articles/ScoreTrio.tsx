import React from 'react';
import ScoreGauge from './ScoreGauge';

const F = 'var(--font-family-primary)';

/* Side gauge = small version of the main dual-arc gauge (fills from both sides). */
const SideGauge = ({ score, label, pending }: { score: number; label: string; pending?: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: 13, color: '#52525c', fontFamily: F }}>{label}</span>
    <ScoreGauge score={score} size={48} pending={pending} />
  </div>
);

/** SEO · Content Score · AI Search gauge trio (center = blend of SEO + AI). */
const ScoreTrio = ({ seo, ai, hasAi }: { seo: number; ai: number; hasAi: boolean }) => {
  const overall = hasAi ? Math.round((seo + ai) / 2) : seo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '6px 16px 16px' }}>
      <SideGauge label="SEO" score={seo} />
      <ScoreGauge score={overall} />
      <SideGauge label="AI Search" score={ai} pending={!hasAi} />
    </div>
  );
};

export default ScoreTrio;
