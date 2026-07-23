/**
 * Evidence + Information Gain helpers for score explainability.
 */
export type EvidenceSnippet = {
  engine: string;
  detail: string;
  reliability: number;
};

export function informationGain(opts: {
  priorCoverage: number;
  posteriorCoverage: number;
  importance?: number;
}): number {
  const delta = Math.max(0, opts.posteriorCoverage - opts.priorCoverage);
  const imp = opts.importance ?? 1;
  return Math.min(1, delta * imp);
}

export function attachEvidence(
  base: EvidenceSnippet[],
  extra: EvidenceSnippet[],
): EvidenceSnippet[] {
  return [...base, ...extra].slice(0, 20);
}
