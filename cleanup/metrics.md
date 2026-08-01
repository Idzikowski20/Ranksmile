# Cleanup metrics

Measured during ponytail cleanup (Gate → Wave D). Bundle figures are aggregates of `.next/static/chunks/pages` JS (dev/build tree present locally) — re-run after a production `next build` for ship numbers.

| Metric | Before | After |
|--------|--------|-------|
| Dead candidate files | 105 | 0 (removed) |
| Deleted files | — | ~105 UI/API/test files (+ scripts archived, not deleted) |
| Deleted LOC | — | ~18 023 (candidate tree) |
| Unused exports (ts-prune, post-whitelist) | — | 1334 (baseline) |
| Hex debt pages+components | 3294 | 3106 |
| Bundle JS (raw, pages chunks) | 400 803 191 | 400 757 046* |
| Bundle gzip | 75 610 563 | 75 603 139* |
| Bundle brotli | 62 691 707 | 62 685 975* |
| Build time | — | not re-measured (no full `next build` in this run) |

\* Stale `.next` without production rebuild after deletes — expect larger drop after clean `npm run build`.

## Sources

- [`cleanup/metrics-before.json`](metrics-before.json)
- [`cleanup/metrics-after.json`](metrics-after.json)
- [`cleanup/token-debt-history.jsonl`](token-debt-history.jsonl)
- [`scripts/dead-exports-baseline.json`](../scripts/dead-exports-baseline.json)

## Commands

```bash
npm run token:debt
npm run dead:exports
npm run check:koala-tokens
npm run typecheck
npm run test:ci
npm run smoke:min
```
