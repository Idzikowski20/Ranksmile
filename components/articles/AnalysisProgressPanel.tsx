import React from 'react';
import ProgressCard from './ProgressCard';
import { analysisPhaseGroups, type PhaseRow } from '@/src/core/domain/articles/analysisPhaseRows';
import { AiEngineIcons, GoogleEngineIcon } from './EngineIcons';
import type { AnalysisPhases } from '@/src/core/domain/articles/analysisPhases';

const STATE_LABEL: Record<PhaseRow['state'], string> = {
  done: 'Done',
  active: 'In progress',
  error: 'Error',
  pending: 'Pending',
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

/**
 * `maxWidth` is the one thing the two hosts disagree on: the editor's side column is
 * 320px wide, so the list is capped to keep it off the borders, while the wizard page
 * has a 576px column and the cap left every label wrapping onto three lines.
 */
const AnalysisProgressPanel: React.FC<{
  phases: AnalysisPhases;
  maxWidth?: React.CSSProperties['maxWidth'];
}> = ({ phases, maxWidth = 340 }) => (
  // Centred in the panel rather than pinned to the top: for most of a run this is the
  // only thing in the column, and a short list hugging the toolbar reads as a leftover
  // fragment instead of the thing the user is waiting on. Centred horizontally too —
  // `4px` of side padding left the list glued to the panel's left border.
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 16,
    minHeight: '100%',
    maxWidth,
    margin: '0 auto',
    padding: '8px 24px',
  }}
  >
    {/* One focused live region: announcing the whole tree re-read every row on each tick;
        announcing nothing left completions and failures silent. */}
    <div aria-live="polite" style={HIDDEN}>{activeSummary(analysisPhaseGroups(phases))}</div>
    {analysisPhaseGroups(phases).map((group) => (
      <ProgressCard
        key={group.id}
        title={group.title}
        headingLevel={3}
        trailing={group.id === 'ai-search' ? <AiEngineIcons /> : <GoogleEngineIcon />}
        rows={group.rows.map((row) => ({
          id: row.id,
          label: row.label,
          detail: row.detail,
          state: row.state,
          ariaLabel: [STATE_LABEL[row.state], row.label, row.detail].filter(Boolean).join(': '),
        }))}
      />
    ))}
  </div>
);

export default AnalysisProgressPanel;
