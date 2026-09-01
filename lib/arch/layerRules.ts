/**
 * Clean-architecture dependency rule, enforced by
 * __tests__/architecture/clean-arch-boundaries.test.ts.
 *
 * Each rule scans files under `root` and forbids any import specifier matching
 * one of `forbid`. Patterns match the raw specifier string, so they are written
 * to catch BOTH alias imports (`@/lib/x`, `@/src/infrastructure/y`) and relative
 * imports (`../../lib/x`, `../../infrastructure/y`) — hence segment-boundary
 * anchors like `(?:^|[\\/])lib[\\/]` rather than a literal `src/lib`.
 */
export type LayerRule = { root: string; label: string; forbid: RegExp[] };

// Vendors / outer layers the pure core must never touch.
const VENDORS = [
  /stripe/i,
  /sequelize/i,
  /^next(?:-|\/|$)/,
  /ioredis|bullmq|(?:^|[\\/])redis(?:$|[\\/])/i,
  /(?:^|[\\/])axios(?:$|[\\/])|node-fetch/i,
];
const OUTER = [
  /(?:^|[\\/])infrastructure[\\/]/,
  /(?:^|[\\/])composition[\\/]/,
  /(?:^|[\\/])pages[\\/]/,
];
// Inner-layer specifiers, so the denylist can enforce the dependency DIRECTION,
// not just keep outer layers out. Matched on the specifier, so a domain file that
// imports `../../application/x` (an inverted dependency) is caught the same as a
// vendor import. A layer never lists its own segment — that would forbid its
// files from importing each other.
const APPLICATION = [/(?:^|[\\/])application[\\/]/];
const DOMAIN = [/(?:^|[\\/])domain[\\/]/];
// Forbid lib/* EXCEPT lib/types/* — the pure type-declaration barrel (db.ts,
// sidecar.ts, rankTracking.ts, …) has no runtime/vendor coupling, so core may
// import types from it transitionally. Those types fold into src/core during the
// "lib/ infrastructure extraction" phase; until then this keeps the migration
// unblocked without dragging runtime lib code into the pure core.
const LIB = [/(?:^|[\\/])lib[\\/](?!types[\\/])/];

export const LAYER_RULES: LayerRule[] = [
  {
    root: 'src/core/domain',
    label: 'domain',
    // domain may import only src/core/domain + src/core/shared
    forbid: [...VENDORS, ...OUTER, ...LIB, ...APPLICATION],
  },
  {
    root: 'src/core/application',
    label: 'application',
    // application may import only src/core/domain + src/core/shared
    forbid: [...VENDORS, ...OUTER, ...LIB],
  },
  {
    root: 'src/core/shared',
    label: 'shared',
    // shared is the innermost leaf — pure primitives, may import only src/core/shared
    forbid: [...VENDORS, ...OUTER, ...LIB, ...APPLICATION, ...DOMAIN],
  },
];
