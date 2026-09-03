/**
 * Presence score — the 0–100 visibility index, calibrated against the reference tool.
 *
 * Our first model averaged a per-answer score (`max(0, 100-(pos-1)*15)`) over every
 * prompt × model pair. It ranked brands sensibly but sat at roughly half the reference
 * tool's scale — for the same brand at mention rate 27 % / average position 2.8 it gave
 * ~20 where the reference reported 43, so the two products' numbers were not comparable.
 *
 * Refitted by least squares against 100 brand rows read from a live tracker project
 * (7-day window, all models):
 *
 *     presence = 0.7242 × mentionRate − 3.2850 × avgPosition + 32.9482
 *
 * mean absolute error 0.34, worst case 0.90 — inside their integer rounding, so this
 * reproduces their published numbers rather than approximating the shape.
 *
 * Read it as: being named at all is most of the score (a brand cited first in even a
 * couple of answers lands near 30), each extra point of mention rate adds ~0.72, and each
 * position deeper costs ~3.29.
 *
 * Caveat worth knowing: the fit sample contains only brands that WERE mentioned, which is
 * where the large intercept comes from. A brand with no mentions scores 0, not 33 — that
 * case is short-circuited below instead of being extrapolated from the fit.
 */

const A_MENTION_RATE = 0.7242;
const B_AVG_POSITION = -3.2850;
const C_INTERCEPT = 32.9482;

export function presenceScore(opts: { mentionRate: number; avgPosition: number | null }): number {
   const { mentionRate, avgPosition } = opts;
   // Never mentioned → no presence. The fit only describes brands that appear at least once.
   if (!Number.isFinite(mentionRate) || mentionRate <= 0 || avgPosition == null || !Number.isFinite(avgPosition)) return 0;
   const raw = A_MENTION_RATE * mentionRate + B_AVG_POSITION * avgPosition + C_INTERCEPT;
   return Math.max(0, Math.min(100, Math.round(raw)));
}
