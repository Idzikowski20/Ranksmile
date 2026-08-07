import React from 'react';
import { Icon } from '../koala/icons';
import { analysisPhaseGroups, type PhaseRow } from '../../lib/analysisPhaseRows';
import type { AnalysisPhases } from '../../lib/analysisPhases';

const STATE_LABEL: Record<PhaseRow['state'], string> = {
  done: 'Done',
  active: 'In progress',
  error: 'Error',
  pending: 'Pending',
};

const Marker: React.FC<{ state: PhaseRow['state'] }> = ({ state }) => {
  if (state === 'done') return <Icon name="Check" size={16} weight="bold" />;
  if (state === 'error') return <Icon name="WarningCircle" size={16} weight="bold" />;
  if (state === 'active') {
    return (
      <span
        className="inline-block aspect-square animate-spin rounded-full"
        style={{
          width: 14, height: 14, border: '1.5px solid currentColor', borderBottomColor: 'transparent',
        }}
      />
    );
  }
  return <span style={{ width: 14, height: 14, display: 'inline-block' }} />;
};

/** Deep-analysis progress, rendered from typed phases (lib/analysisPhases). */
const HIDDEN: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
};

/** One sentence describing where the pipeline is, for the live region below. */
function activeSummary(groups: ReturnType<typeof analysisPhaseGroups>): string {
  for (const group of groups) {
    const row = group.rows.find((r) => r.state === 'active' || r.state === 'error');
    if (row) return [STATE_LABEL[row.state], row.label, row.detail].filter(Boolean).join(': ');
  }
  const finished = groups.every((g) => g.rows.every((r) => r.state === 'done'));
  return finished ? 'Analysis complete' : 'Waiting to start';
}

const AnalysisProgressPanel: React.FC<{ phases: AnalysisPhases }> = ({ phases }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '8px 4px' }}>
    {/* One focused live region: announcing the whole tree re-read every row on each tick,
        announcing nothing left completions and failures silent. */}
    <div aria-live="polite" style={HIDDEN}>{activeSummary(analysisPhaseGroups(phases))}</div>
    {analysisPhaseGroups(phases).map((group) => (
      <section key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--koala-text-primary)', margin: 0 }}>
          {group.title}
        </h3>
        {group.rows.map((row) => (
          <div
            key={row.id}
            aria-label={[STATE_LABEL[row.state], row.label, row.detail].filter(Boolean).join(': ')}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              color: row.state === 'active'
                ? 'var(--koala-text-primary)'
                : 'var(--koala-text-secondary)',
            }}
          >
            <span style={{ paddingTop: 2 }} aria-hidden="true"><Marker state={row.state} /></span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>
              {row.label}
              {row.detail ? (
                <span style={{ display: 'block', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                  {row.detail}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </section>
    ))}
  </div>
);

export default AnalysisProgressPanel;
