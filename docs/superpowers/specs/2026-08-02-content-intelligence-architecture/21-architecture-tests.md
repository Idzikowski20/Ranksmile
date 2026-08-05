# 21 — Architecture Tests

Not unit tests of business logic — **dependency firewalls** that fail CI if someone takes a shortcut.

## Required asserts (v1)

```text
assert: coverage_projection never imports html parser / cheerio / jsdom article scrape
assert: visibility_projection never imports html parser
assert: planner never imports adapter (coverageSnapshot* → CCM)
assert: judge never imports html parser for fact extraction
assert: benchmark never parses competitor HTML when CCM available
assert: wie_* never imports compiler adapter
assert: consumers outside allowlist never import lib/engines/coverageEngine as SoT
assert: only compiler/index builder may import knowledge.indexes internals
assert: GraphQuery is the only allowed graph access from consumers (eslint/depcruise)
```

## Implementation

- Boundary map: [`BOUNDARIES.md`](./BOUNDARIES.md)
- Zones + scanner: `lib/cia/`
- Tests: `__tests__/architecture/cia-boundaries.test.ts`
- Run: `npm run test:arch`
- ESLint: `.eslintrc.json` overrides for `lib/projections|planner|intelligence|compiler`

## Freeze gate

- [x] Boundary map written (`BOUNDARIES.md`)
- [x] Arch tests: `__tests__/architecture/cia-boundaries.test.ts` + `npm run test:arch`
