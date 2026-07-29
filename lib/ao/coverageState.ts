/**
 * Presence ≠ Coverage.
 * Live presence checks may only reach mentioned/partial — never adequate+.
 */
export type CoverageState =
  | 'missing'
  | 'mentioned'
  | 'partial'
  | 'adequate'
  | 'comprehensive';

/** quality 0–5 → CoverageState */
export function coverageStateFromQuality(quality: number, covered: boolean): CoverageState {
  if (!covered || quality <= 0) return 'missing';
  if (quality <= 1) return 'mentioned';
  if (quality <= 2) return 'partial';
  if (quality <= 3) return 'adequate';
  return 'comprehensive';
}

/** Caps for liveCoverage presence signals (not LLM judge). */
export function livePresenceQualityCap(signal: 'exact' | 'partial' | 'weak'): number {
  if (signal === 'exact') return 2; // partial at best
  if (signal === 'partial') return 1; // mentioned
  return 1;
}

/** AO treats item as "done" only at adequate+. */
export function isAdequatelyCovered(quality: number, covered: boolean): boolean {
  return coverageStateFromQuality(quality, covered) === 'adequate'
    || coverageStateFromQuality(quality, covered) === 'comprehensive';
}

/** quality threshold for adequate = 3 */
export const ADEQUATE_QUALITY_MIN = 3;
