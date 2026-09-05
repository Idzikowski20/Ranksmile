/**
 * The AI Search score Auto-Optimize acts on. The live score (the article as it is now)
 * wins whenever the scorer produced one; the stored score and the last visibility run
 * only fill in when it did not. Taking the max of all three pinned a copy with three
 * sections cut out at the stored 85 and skipped it as already_optimal.
 */
// eslint-disable-next-line import/prefer-default-export
export function resolveLiveAiScore(opts: {
  live: number | null | undefined;
  stored: number | null | undefined;
  latest: number | null | undefined;
}): number {
  if (opts.live != null && opts.live > 0) return opts.live;
  return Math.max(opts.stored ?? 0, opts.latest ?? 0);
}
