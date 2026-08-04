/**
 * DNA A/B — pick between competing patterns gated by outcome effectiveness.
 * Runtime section A/B is separate (abWrite); this gates DNA pattern choice.
 */
import type { WritingPattern } from './patternStore';

export type DnaAbPick = {
  winner: WritingPattern;
  loser: WritingPattern;
  variant: 'A' | 'B';
  reason: string;
};

/**
 * When both candidates have enough outcome samples, prefer higher success_rate.
 * Otherwise prefer higher confidence (Knowledge), not coin-flip SERP.
 */
export function pickDnaAbPattern(
  a: { pattern: WritingPattern; score: number },
  b: { pattern: WritingPattern; score: number },
): DnaAbPick {
  const au = a.pattern.effectiveness.used;
  const bu = b.pattern.effectiveness.used;
  if (au >= 3 && bu >= 3) {
    const aRate = a.pattern.effectiveness.success_rate;
    const bRate = b.pattern.effectiveness.success_rate;
    if (Math.abs(aRate - bRate) >= 0.05) {
      const aWins = aRate >= bRate;
      return {
        winner: aWins ? a.pattern : b.pattern,
        loser: aWins ? b.pattern : a.pattern,
        variant: aWins ? 'A' : 'B',
        reason: `DNA A/B gated by effectiveness (${aRate.toFixed(2)} vs ${bRate.toFixed(2)})`,
      };
    }
  }
  const aWins = a.score >= b.score;
  return {
    winner: aWins ? a.pattern : b.pattern,
    loser: aWins ? b.pattern : a.pattern,
    variant: aWins ? 'A' : 'B',
    reason: aWins
      ? `DNA A preferred by context score (${a.score.toFixed(3)} ≥ ${b.score.toFixed(3)})`
      : `DNA B preferred by context score (${b.score.toFixed(3)} > ${a.score.toFixed(3)})`,
  };
}
