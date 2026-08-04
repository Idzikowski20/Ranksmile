# CIA import boundaries (v1)

Frozen with RFC v1.0. Enforced by `__tests__/architecture/cia-boundaries.test.ts`.

## Zones

| Zone | Path prefix | May import | Must NOT import |
|------|-------------|------------|-----------------|
| `ccm` | `lib/ccm/` | `lib/cia/`, `lib/types/` (future ccm types) | `cheerio`, `jsdom`, `lib/engines/coverageEngine`, adapter helpers |
| `compiler` | `lib/compiler/` | `lib/ccm/`, `lib/cia/`, TipTap types, heuristics | `lib/ao/`, `lib/wie/` (consumers) |
| `projections` | `lib/projections/` | `lib/ccm/`, `lib/cia/` | HTML parsers, `lib/engines/coverageEngine` as SoT, `coverageSnapshotToKg` |
| `planner` | `lib/planner/` | `lib/ccm/`, `lib/cia/`, projections types only | adapter `coverageSnapshot*`, HTML parsers |
| `intelligence` | `lib/intelligence/` | `lib/ccm/`, `lib/cia/`, `lib/projections/` (peer results) | compiler adapter, HTML fact extract |
| `legacy-bridge` | *(none yet)* | migration tests only | production planner/projections |

## Allowlisted HTML touch (ADR-001)

Only outside these zones (or future `lib/compiler/lexer/`): renderer, export, editor, presentation-policy allowlist. Not projections/planner/intelligence.

## Adapter rule (ADR-025)

Any `coverageSnapshotToKg` / snapshot→CCM helper lives under `lib/ccm/migration/` and may be imported only from `__tests__/**` and migration scripts — never from `lib/projections|planner|intelligence|ao|wie`.
