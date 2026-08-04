/**
 * Source Explorer — Official → TOP1 → TOP2 → … → AI Overview.
 * Editor-zone chrome; Koala CSS vars only.
 */
import React from 'react';
import DomainFavicon from '../common/DomainFavicon';
import type { CanonicalClaim, ClaimEvidence, SourceDiversity } from '../../lib/knowledgeEngine/types';

const F = 'var(--font-family-primary)';

function kindRank(e: ClaimEvidence): number {
  if (e.kind === 'official') return 0;
  if (e.kind === 'industry') return 1;
  if (e.kind === 'competitor') return 2 + (e.serpPositions?.[0] ?? 99);
  if (e.kind === 'ai_overview') return 200;
  if (e.kind === 'paa') return 300;
  return 150;
}

function kindLabel(e: ClaimEvidence): string {
  if (e.kind === 'official') return 'Official';
  if (e.kind === 'ai_overview') return 'AI Overview';
  if (e.kind === 'paa') return 'PAA';
  if (e.kind === 'industry') return 'Industry';
  const pos = e.serpPositions?.[0];
  return pos ? `TOP${pos}` : 'SERP';
}

function starsFor(e: ClaimEvidence): string {
  if (e.kind === 'official') return '★★★★★';
  if (e.kind === 'industry') return '★★★★☆';
  if (e.kind === 'competitor') {
    const pos = e.serpPositions?.[0] ?? 10;
    if (pos <= 2) return '★★★★☆';
    if (pos <= 5) return '★★★☆☆';
    return '★★☆☆☆';
  }
  if (e.kind === 'ai_overview') return '★★★☆☆';
  return '★★☆☆☆';
}

function DiversityChips({ d }: { d: SourceDiversity }) {
  const chips: string[] = [];
  if (d.official) chips.push('Official');
  if (d.competitors) chips.push('Competitors');
  if (d.aiOverview) chips.push('AI Overview');
  if (d.paa) chips.push('PAA');
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {chips.map((c) => (
        <span
          key={c}
          style={{
            fontSize: 10,
            fontWeight: 500,
            fontFamily: F,
            color: 'var(--koala-text-secondary)',
            background: 'var(--koala-bg-secondary)',
            border: '1px solid var(--koala-border-primary)',
            borderRadius: 8,
            padding: '2px 6px',
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export type SourceExplorerProps = {
  claim: CanonicalClaim;
};

export default function SourceExplorer({ claim }: SourceExplorerProps) {
  const rows = [...claim.evidence].sort((a, b) => kindRank(a) - kindRank(b));
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--koala-border-primary)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((e) => (
          <a
            key={`${e.url}-${e.kind}`}
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'inherit',
              fontFamily: F,
            }}
          >
            <DomainFavicon domain={e.domain} size={14} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--koala-text-primary)', minWidth: 72 }}>
              {kindLabel(e)}
            </span>
            <span style={{ fontSize: 10, color: '#F84416', letterSpacing: 1 }}>{starsFor(e)}</span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--koala-text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {e.title || e.domain}
            </span>
          </a>
        ))}
      </div>
      <DiversityChips d={claim.sourceDiversity} />
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--koala-text-tertiary)', fontFamily: F }}>
        Used by {claim.usedByCompetitors}/{claim.competitorsTotal || '?'} competitors
        {claim.consensusExplanation?.percent
          ? ` · ${claim.consensusExplanation.percent}% consensus`
          : ''}
      </p>
    </div>
  );
}
