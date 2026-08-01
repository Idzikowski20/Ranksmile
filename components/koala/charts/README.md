# Koala Visualization Layer

**Owns:** rendering, motion, tooltip, legend, formatting, accessibility, theme.  
**Does not own:** business logic, aggregation, API, fetch, transform.

## Public API

- `Chart` — declarative `preset` + prepared `data` (+ optional `overrides` / `state`)
- `Sparkline` — `appearance` + immutable `values`

Everything else under this folder is **internal**.

## Rules

1. Charts never recompute data — `prepareSeries()` lives in the feature/page.
2. Widgets never transform series.
3. No inline arrays in JSX — hoist `const series = prepare…`.
4. Preset is SoT; chrome overrides only via `overrides`.
5. Unknown series `kind` = TypeScript error (no runtime fallback).
6. Fake time-series are forbidden.

## Presets

`TrafficTrend` · `KeywordTrend` · `RankHistory` · `Comparison` · `Distribution` · `StackedPositions` · `ActivityHeatmap`
