import type { CanonicalClaim, CompetitorDocument } from './types';

function becauseLabels(claim: CanonicalClaim, docs: CompetitorDocument[]): string[] {
  const labels: string[] = [];
  for (const e of claim.evidence) {
    if (e.kind === 'official') {
      labels.push('Official');
      continue;
    }
    const pos = e.serpPositions?.[0];
    if (pos) labels.push(`TOP${pos}`);
    else {
      const doc = docs.find((d) => d.url === e.url);
      if (doc) labels.push(`TOP${doc.serpPosition}`);
    }
  }
  return [...new Set(labels)].slice(0, 8);
}

/**
 * Knowledge Voting — competitor score/authority weighted consensus.
 * Official/PAA evidence boosts diversity; competitor support drives consensus share.
 */
export function voteClaims(
  claims: CanonicalClaim[],
  docs: CompetitorDocument[],
): CanonicalClaim[] {
  const totalWeight = docs.reduce((s, d) => s + Math.max(0.05, (d.score / 100) * d.authority), 0)
    || 1;

  return claims.map((claim) => {
    const supportingUrls = new Set(
      claim.evidence
        .filter((e) => e.kind === 'competitor' || e.kind === 'industry')
        .map((e) => e.url),
    );
    let support = 0;
    let hit = 0;
    for (const d of docs) {
      if (!supportingUrls.has(d.url)) continue;
      support += Math.max(0.05, (d.score / 100) * d.authority);
      hit += 1;
    }
    // Official-only claims: treat as high consensus for planner inclusion
    const hasOfficial = claim.evidence.some((e) => e.kind === 'official');
    let consensus = support / totalWeight;
    if (hasOfficial && hit === 0) consensus = Math.max(consensus, 0.8);
    if (hasOfficial) consensus = Math.min(1, consensus + 0.05);

    const because = becauseLabels(claim, docs);
    return {
      ...claim,
      consensus: Math.round(consensus * 1000) / 1000,
      usedByCompetitors: hit,
      competitorsTotal: docs.length,
      sourceDiversity: claim.sourceDiversity,
      consensusExplanation: {
        percent: Math.round(consensus * 100),
        because: because.length ? because : ['low_support'],
      },
    };
  });
}
