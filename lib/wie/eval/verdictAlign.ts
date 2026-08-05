/**
 * Single reconciliation model: heuristic benchmark + Judge → one beats_top5.
 * Benchmark winners are always deterministic (argmax). Judge may comment, not override.
 */
import type { BenchmarkFeature, CompetitorBenchmarkResult } from './competitorBenchmark';

export type BeatsTop5 = 'wins' | 'ties' | 'loses';

const FEATURES: BenchmarkFeature[] = ['opening', 'narrative', 'examples', 'eeat', 'cta'];

/** Feature weights for weighted AO-vs-Top verdict (opening dominates for reader-first). */
export const BENCHMARK_FEATURE_WEIGHTS: Record<BenchmarkFeature, number> = {
  opening: 0.3,
  narrative: 0.2,
  examples: 0.15,
  eeat: 0.2,
  cta: 0.15,
};

export type WeightedBeatsResult = {
  overall: BeatsTop5;
  aoScore: number;
  maxScore: number;
  ratio: number;
  lines: string[];
};

/** Weighted AO share of feature wins → wins / ties / loses with explicit math. */
export function weightedBeatsFromBenchmark(b: CompetitorBenchmarkResult): WeightedBeatsResult {
  let aoScore = 0;
  let maxScore = 0;
  const lines: string[] = [];
  for (const f of FEATURES) {
    const w = BENCHMARK_FEATURE_WEIGHTS[f];
    maxScore += w;
    const won = b.winners[f] === b.aoLabel;
    if (won) aoScore += w;
    lines.push(
      `${f} ${Math.round(w * 100)}% → ${won ? 'AO' : b.winners[f]} (${won ? '+' : '0'}${Math.round(w * 100)})`,
    );
  }
  const ratio = maxScore > 0 ? aoScore / maxScore : 0;
  let overall: BeatsTop5 = 'ties';
  if (ratio >= 0.85) overall = 'wins';
  else if (ratio <= 0.35) overall = 'loses';
  else overall = 'ties';
  // Opening loss alone caps at ties (reader-first gate)
  if (b.winners.opening !== b.aoLabel && overall === 'wins') overall = 'ties';

  return {
    overall,
    aoScore: Math.round(aoScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    lines,
  };
}

/** Majority/weighted overall from benchmark. */
export function beatsTop5FromBenchmark(b: CompetitorBenchmarkResult): BeatsTop5 {
  return weightedBeatsFromBenchmark(b).overall;
}

/**
 * Prefer weighted benchmark. Never upgrade Judge "wins" when benchmark is ties/loses.
 */
export function reconcileBeatsTop5(opts: {
  benchmark: CompetitorBenchmarkResult | null;
  judgeOverall?: BeatsTop5;
}): BeatsTop5 {
  if (!opts.benchmark) return opts.judgeOverall || 'ties';
  const fromBench = weightedBeatsFromBenchmark(opts.benchmark).overall;
  if (!opts.judgeOverall) return fromBench;
  if (fromBench === 'ties' || fromBench === 'loses') return fromBench;
  if (opts.judgeOverall === 'loses' || opts.judgeOverall === 'ties') return 'ties';
  return 'wins';
}

export function formatBeatsBreakdown(b: CompetitorBenchmarkResult): string {
  const w = weightedBeatsFromBenchmark(b);
  const won = FEATURES.filter((f) => b.winners[f] === b.aoLabel);
  const lost = FEATURES.filter((f) => b.winners[f] !== b.aoLabel);
  return [
    `AO wins: ${won.join(', ') || '—'}`,
    `AO loses: ${lost.map((f) => `${f}→${b.winners[f]}`).join(', ') || '—'}`,
    '',
    '### Weighted result',
    ...w.lines.map((l) => `- ${l}`),
    '',
    `**Final: ${w.overall}** (AO weighted share ${Math.round(w.ratio * 100)}% = ${w.aoScore}/${w.maxScore})`,
  ].join('\n');
}
