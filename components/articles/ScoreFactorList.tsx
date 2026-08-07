import React from 'react';
import { Icon } from '../koala/icons';
import type { FactorName, ScoreFactor } from '../../lib/aiScore/factors';

const LABELS: Record<FactorName, string> = {
  FACTS_COVERAGE: 'Facts covered',
  INTRODUCTION_COVERED_TOPICS: 'Covers the planned topics',
  INTRODUCTION_TARGET_AUDIENCE: 'Names the reader',
  INTRODUCTION_EARLY_QUERY_ANSWER: 'Answers the query early',
  INTRODUCTION_TOPIC_RELEVANCE: 'Stays on topic',
};

/** FACTS_COVERAGE measures the whole article, so the introduction note must not apply. */
function missingLabel(factor: ScoreFactor): string {
  if (!factor.name.startsWith('INTRODUCTION_')) {
    return factor.found ? 'Covered across the article' : 'Not covered yet';
  }
  return 'Not found in the introduction';
}

const ScoreFactorList: React.FC<{ factors: ScoreFactor[] }> = ({ factors }) => (
  <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
    {factors.map((factor) => (
      <li key={factor.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon
          name={factor.found ? 'CheckCircle' : 'Circle'}
          size={16}
          weight="bold"
          style={{ marginTop: 2, flexShrink: 0 }}
          color={factor.found ? 'var(--koala-status-success)' : 'var(--koala-text-disabled)'}
        />
        <span style={{ fontSize: 14 }}>
          <span style={{ color: 'var(--koala-text-primary)' }}>{LABELS[factor.name]}</span>
          {typeof factor.value === 'number' ? (
            <span style={{ marginLeft: 6, color: 'var(--koala-text-secondary)' }}>{`${factor.value}%`}</span>
          ) : null}
          <span style={{ display: 'block', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
            {factor.textSpan
              ? `“${factor.textSpan}”`
              : missingLabel(factor)}
          </span>
        </span>
      </li>
    ))}
  </ul>
);

export default ScoreFactorList;
