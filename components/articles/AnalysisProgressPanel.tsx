import React from 'react';
import { Icon } from '../koala/icons';
import { Spinner } from '../koala/primitives/Spinner';
import { analysisPhaseGroups, type PhaseRow } from '../../lib/analysisPhaseRows';
import { AiEngineIcons, GoogleEngineIcon } from './EngineIcons';
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
  // Hidden from assistive tech: the panel's own live region announces the running step,
  // and Spinner carries role="status" which would announce a second time.
  if (state === 'active') return <Spinner size={14} color="currentColor" />;
  return <span style={{ width: 14, height: 14, display: 'inline-block' }} />;
};

/** Deep-analysis progress, rendered from typed phases (lib/analysisPhases). */
const HIDDEN: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
};

/**
 * One sentence describing where the pipeline is, for the live region below. Failures are
 * announced deliberately — a silent error is worse than a verbose one.
 */
function activeSummary(groups: ReturnType<typeof analysisPhaseGroups>): string {
  const rows = groups.flatMap((group) => group.rows);
  const row = rows.find((r) => r.state === 'error') ?? rows.find((r) => r.state === 'active');
  if (row) return [STATE_LABEL[row.state], row.label, row.detail].filter(Boolean).join(': ');
  if (rows.every((r) => r.state === 'done')) return 'Analysis complete';
  // Stages like fetch_page and term extraction have no row of their own, so a run can be
  // well underway with nothing active — that is not the same as not having started.
  return rows.some((r) => r.state === 'done') ? 'Analysis in progress' : 'Waiting to start';
}

const AnalysisProgressPanel: React.FC<{ phases: AnalysisPhases }> = ({ phases }) => (
  // Centred in the panel rather than pinned to the top: for most of a run this is the
  // only thing in the column, and a short list hugging the toolbar reads as a leftover
  // fragment instead of the thing the user is waiting on. Centred horizontally too —
  // `4px` of side padding left the list glued to the panel's left border.
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 28,
    minHeight: '100%',
    maxWidth: 340,
    margin: '0 auto',
    padding: '8px 24px',
  }}
  >
    {/* One focused live region: announcing the whole tree re-read every row on each tick;
        announcing nothing left completions and failures silent. */}
    <div aria-live="polite" style={HIDDEN}>{activeSummary(analysisPhaseGroups(phases))}</div>
    {analysisPhaseGroups(phases).map((group) => (
      <section key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--koala-text-primary)', margin: 0 }}>
            {group.title}
          </h3>
          {group.id === 'ai-search' ? <AiEngineIcons /> : <GoogleEngineIcon />}
        </div>
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
