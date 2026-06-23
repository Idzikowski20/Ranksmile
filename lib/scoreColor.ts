// lib/scoreColor.ts
export type ScoreBand = 'low' | 'mid' | 'high';

const clamp = (n: number) => Math.max(0, Math.min(n, 100));

export function scoreBand(score: number): ScoreBand {
  const s = clamp(score);
  if (s >= 66) return 'high';
  if (s >= 33) return 'mid';
  return 'low';
}

export function scoreColor(score: number): string {
  const band = scoreBand(score);
  return band === 'high' ? '#1ab25e' : band === 'mid' ? '#efa00d' : '#d70028';
}
